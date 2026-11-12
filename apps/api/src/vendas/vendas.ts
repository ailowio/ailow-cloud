import {
  type CompraDoCliente,
  type DescontoVenda,
  type RelatorioVendas,
  type Venda,
  type VendaFinalizar,
  calcularFechamento,
  celularSuspeito,
} from '@ailow/shared';
import type pg from 'pg';
import { registrarEvento } from '../acesso/comum.js';
import { ErroCliente, buscarCliente, buscarPorCelular, criarCliente, resumoDosClientes } from '../clientes/clientes.js';
import { ErroEstoque, registrarMovimento } from '../produtos/estoque.js';
import { type SkuParaVenda, travarSkusParaVenda } from '../produtos/produtos.js';
import { ErroFinanceiro, FUSO, estornarOrigem, registrarLancamento } from '../financeiro/lancamentos.js';

// Vendas (S10). Estoque, lançamento e cliente entram pela interface pública de cada módulo, na MESMA transação.
// Este arquivo só escreve em vendas, itens_venda, pagamentos_venda e venda_sequencia.

export class ErroVenda extends Error {
  constructor(
    readonly codigo:
      | 'nao_encontrado'
      | 'estoque_insuficiente'
      | 'nome_obrigatorio'
      | 'cliente_inativo'
      | 'pagamentos_divergem'
      | 'desconto_acima_do_subtotal'
      | 'total_acima_do_limite'
      | 'sem_itens'
      | 'ja_cancelada'
      | 'venda_de_outro',
  ) {
    super(codigo);
    this.name = 'ErroVenda';
  }
}

interface Ctx {
  empresaId: string;
  autorId: string;
  perfil: 'dono' | 'vendedor';
  agora: Date;
}

interface LinhaVenda {
  id: string;
  numero: number;
  status: 'finalizada' | 'cancelada';
  subtotal_centavos: number;
  desconto_centavos: number;
  desconto_tipo: Venda['desconto_tipo'];
  desconto_percentual: number | null;
  total_centavos: number;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_celular: string | null;
  vendedor_id: string;
  vendedor_nome: string;
  criado_em: Date;
  cancelado_em: Date | null;
  motivo_cancelamento: string | null;
}

const descontoDe = (d: VendaFinalizar['desconto']): DescontoVenda => {
  if (d.tipo === 'percentual') return { tipo: 'percentual', percentual: d.percentual ?? 0 };
  if (d.tipo === 'valor') return { tipo: 'valor', centavos: d.centavos ?? 0 };
  return { tipo: 'nenhum' };
};

async function hoje(c: pg.PoolClient, agora: Date): Promise<string> {
  const r = await c.query("SELECT (($1::timestamptz AT TIME ZONE $2)::date)::text AS hoje", [agora, FUSO]);
  return r.rows[0].hoje as string;
}

async function proximoNumero(c: pg.PoolClient, empresaId: string): Promise<number> {
  const r = await c.query(
    `INSERT INTO venda_sequencia (empresa_id, ultimo) VALUES ($1, 1)
     ON CONFLICT (empresa_id) DO UPDATE SET ultimo = venda_sequencia.ultimo + 1
     RETURNING ultimo`,
    [empresaId],
  );
  return r.rows[0].ultimo as number;
}

async function montar(c: pg.PoolClient, id: string): Promise<Venda | null> {
  const capa = await c.query(
    `SELECT v.id, v.numero, v.status, v.subtotal_centavos, v.desconto_centavos, v.desconto_tipo, v.desconto_percentual,
            v.total_centavos, v.cliente_id, v.vendedor_id, u.nome AS vendedor_nome, v.criado_em, v.cancelado_em, v.motivo_cancelamento
       FROM vendas v
       JOIN usuarios u ON u.empresa_id = v.empresa_id AND u.id = v.vendedor_id
      WHERE v.id = $1`,
    [id],
  );
  const linha = capa.rows[0] as Omit<LinhaVenda, 'cliente_nome' | 'cliente_celular'> | undefined;
  if (!linha) return null;
  const cliente = linha.cliente_id ? await buscarCliente(c, linha.cliente_id) : null;
  const itens = await c.query(
    `SELECT sku_id, codigo, produto_nome AS nome, tamanho, cor, quantidade, preco_unitario_centavos
       FROM itens_venda WHERE venda_id = $1 ORDER BY codigo`,
    [id],
  );
  const pagamentos = await c.query(
    `SELECT forma, valor_centavos FROM pagamentos_venda WHERE venda_id = $1 ORDER BY ordem`,
    [id],
  );
  return {
    id: linha.id,
    numero: linha.numero,
    status: linha.status,
    subtotal_centavos: linha.subtotal_centavos,
    desconto_centavos: linha.desconto_centavos,
    desconto_tipo: linha.desconto_tipo,
    desconto_percentual: linha.desconto_percentual,
    total_centavos: linha.total_centavos,
    cliente: cliente ? { id: cliente.id, nome: cliente.nome, celular: cliente.celular } : null,
    vendedor_nome: linha.vendedor_nome,
    itens: itens.rows as Venda['itens'],
    pagamentos: pagamentos.rows as Venda['pagamentos'],
    criado_em: linha.criado_em.toISOString(),
    cancelado_em: linha.cancelado_em?.toISOString() ?? null,
    motivo_cancelamento: linha.motivo_cancelamento,
  };
}

async function resolverCliente(c: pg.PoolClient, ctx: Ctx, pedido: VendaFinalizar): Promise<string> {
  const achado = await buscarPorCelular(c, pedido.cliente.celular);
  if (achado) {
    if (!achado.ativo) throw new ErroVenda('cliente_inativo');
    return achado.id;
  }
  const nome = pedido.cliente.nome?.trim();
  if (!nome) throw new ErroVenda('nome_obrigatorio');
  try {
    const novo = await criarCliente(c, ctx, { nome, celular: pedido.cliente.celular, aviso_lgpd: false });
    return novo.id;
  } catch (err) {
    if (err instanceof ErroCliente && err.codigo === 'celular_ja_cadastrado') throw new ErroVenda('cliente_inativo');
    throw err;
  }
}

/** RF-VEN-06 / RN-02 / RN-07: tudo ou nada. O preço é o do banco, não o do carrinho. */
export async function finalizarVenda(c: pg.PoolClient, ctx: Ctx, pedido: VendaFinalizar): Promise<Venda> {
  const ids = pedido.itens.map((i) => i.sku_id).sort();
  const skus = await travarSkusParaVenda(c, ids);
  if (!skus) throw new ErroVenda('nao_encontrado');
  const porId = new Map(skus.map((s) => [s.id, s]));
  for (const item of pedido.itens) {
    const sku = porId.get(item.sku_id) as SkuParaVenda;
    if (item.quantidade > sku.estoque) throw new ErroVenda('estoque_insuficiente');
  }

  const fechamento = calcularFechamento(
    pedido.itens.map((i) => ({ precoCentavos: (porId.get(i.sku_id) as SkuParaVenda).preco_centavos, quantidade: i.quantidade })),
    descontoDe(pedido.desconto),
    pedido.pagamentos.map((p) => p.valor_centavos),
  );
  if (!fechamento.ok) throw new ErroVenda(fechamento.erro);

  const clienteId = await resolverCliente(c, ctx, pedido);
  const numero = await proximoNumero(c, ctx.empresaId);
  const data = await hoje(c, ctx.agora);
  const gravada = await c.query(
    `INSERT INTO vendas
       (empresa_id, numero, cliente_id, vendedor_id, subtotal_centavos, desconto_centavos, total_centavos,
        desconto_tipo, desconto_percentual, status, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'finalizada', $10)
     RETURNING id`,
    [
      ctx.empresaId,
      numero,
      clienteId,
      ctx.autorId,
      fechamento.subtotalCentavos,
      fechamento.descontoCentavos,
      fechamento.totalCentavos,
      pedido.desconto.tipo,
      pedido.desconto.tipo === 'percentual' ? pedido.desconto.percentual : null,
      ctx.agora,
    ],
  );
  const vendaId = gravada.rows[0].id as string;

  for (const item of pedido.itens) {
    const sku = porId.get(item.sku_id) as SkuParaVenda;
    await c.query(
      `INSERT INTO itens_venda
         (empresa_id, venda_id, sku_id, quantidade, preco_unitario_centavos, produto_nome, codigo, tamanho, cor, categoria_nome)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [ctx.empresaId, vendaId, sku.id, item.quantidade, sku.preco_centavos, sku.nome, sku.codigo, sku.tamanho, sku.cor, sku.categoria_nome],
    );
    try {
      await registrarMovimento(c, ctx, {
        skuId: sku.id,
        tipo: 'venda',
        quantidade: -item.quantidade,
        motivo: `Venda ${numero}`,
        origemId: vendaId,
      });
    } catch (err) {
      if (err instanceof ErroEstoque) throw new ErroVenda(err.codigo === 'estoque_insuficiente' ? 'estoque_insuficiente' : 'nao_encontrado');
      throw err;
    }
  }

  for (const [ordem, pag] of pedido.pagamentos.entries()) {
    await c.query(
      `INSERT INTO pagamentos_venda (empresa_id, venda_id, forma, valor_centavos, ordem) VALUES ($1, $2, $3, $4, $5)`,
      [ctx.empresaId, vendaId, pag.forma, pag.valor_centavos, ordem],
    );
    await registrarLancamento(c, ctx, {
      tipo: 'entrada',
      origem_tipo: 'venda',
      origem_id: vendaId,
      descricao: `Venda ${numero}`,
      categoria: 'Vendas',
      valor_centavos: pag.valor_centavos,
      forma_pagamento: pag.forma,
      vencimento: data,
      paga: true,
    });
  }

  await registrarEvento(c, { empresaId: ctx.empresaId, atorTipo: 'usuario', atorId: ctx.autorId, alvoId: vendaId, tipo: 'venda_finalizada', em: ctx.agora });
  return (await montar(c, vendaId)) as Venda;
}

/** RF-VEN-08 / RN-08. O Vendedor cancela as próprias; o Dono, qualquer uma da empresa (D19). */
export async function cancelarVenda(c: pg.PoolClient, ctx: Ctx, vendaId: string, motivo: string): Promise<Venda> {
  const trava = await c.query('SELECT id, numero, status, total_centavos, vendedor_id FROM vendas WHERE id = $1 FOR UPDATE', [vendaId]);
  const venda = trava.rows[0] as { id: string; numero: number; status: string; total_centavos: number; vendedor_id: string } | undefined;
  if (!venda) throw new ErroVenda('nao_encontrado');
  if (ctx.perfil === 'vendedor' && venda.vendedor_id !== ctx.autorId) throw new ErroVenda('venda_de_outro');
  if (venda.status === 'cancelada') throw new ErroVenda('ja_cancelada');

  const itens = await c.query('SELECT sku_id, quantidade FROM itens_venda WHERE venda_id = $1 ORDER BY sku_id', [vendaId]);
  for (const item of itens.rows as { sku_id: string; quantidade: number }[]) {
    await registrarMovimento(c, ctx, {
      skuId: item.sku_id,
      tipo: 'estorno_venda',
      quantidade: item.quantidade,
      motivo: `Cancelamento da venda ${venda.numero}`,
      origemId: vendaId,
    });
  }
  if (venda.total_centavos > 0) {
    try {
      await estornarOrigem(c, ctx, 'venda', vendaId, motivo);
    } catch (err) {
      if (err instanceof ErroFinanceiro) throw new ErroVenda(err.codigo === 'ja_estornado' ? 'ja_cancelada' : 'nao_encontrado');
      throw err;
    }
  }
  await c.query(
    `UPDATE vendas SET status = 'cancelada', motivo_cancelamento = $2, cancelado_por = $3, cancelado_em = $4 WHERE id = $1`,
    [vendaId, motivo, ctx.autorId, ctx.agora],
  );
  await registrarEvento(c, { empresaId: ctx.empresaId, atorTipo: 'usuario', atorId: ctx.autorId, alvoId: vendaId, tipo: 'venda_cancelada', em: ctx.agora });
  return (await montar(c, vendaId)) as Venda;
}

export async function buscarVenda(c: pg.PoolClient, id: string): Promise<Venda | null> {
  return montar(c, id);
}

export async function comprasDoCliente(c: pg.PoolClient, clienteId: string): Promise<CompraDoCliente[]> {
  const r = await c.query(
    `SELECT id, numero, total_centavos, status, criado_em
       FROM vendas WHERE cliente_id = $1
       ORDER BY numero DESC
       LIMIT 50`,
    [clienteId],
  );
  return r.rows.map((row) => ({ ...row, criado_em: (row.criado_em as Date).toISOString() })) as CompraDoCliente[];
}

function limites(periodo: 'dia' | 'mes', ref: string): { de: string; ate: string } {
  if (periodo === 'dia') return { de: ref, ate: ref };
  const ano = Number(ref.slice(0, 4));
  const mes = Number(ref.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = ref.slice(0, 8);
  return { de: `${prefixo}01`, ate: `${prefixo}${String(ultimo).padStart(2, '0')}` };
}

/** RF-VEN-09. O Vendedor só vê as próprias vendas, e só do dia. */
export async function relatorioVendas(
  c: pg.PoolClient,
  ctx: Ctx,
  periodo: 'dia' | 'mes',
  data: string,
): Promise<RelatorioVendas> {
  const { de, ate } = limites(periodo, data);
  const vendedorId = ctx.perfil === 'vendedor' ? ctx.autorId : null;
  const capas = await c.query(
    `SELECT v.id, v.total_centavos, v.cliente_id, u.nome AS vendedor_nome
       FROM vendas v
       JOIN usuarios u ON u.empresa_id = v.empresa_id AND u.id = v.vendedor_id
      WHERE v.status = 'finalizada'
        AND v.criado_em >= ($1::date)::timestamp AT TIME ZONE $3::text
        AND v.criado_em < (($2::date + 1)::timestamp) AT TIME ZONE $3::text
        AND ($4::uuid IS NULL OR v.vendedor_id = $4)`,
    [de, ate, FUSO, vendedorId],
  );
  const ids = capas.rows.map((r) => r.id as string);
  const clienteIds = [...new Set(capas.rows.map((r) => r.cliente_id as string | null).filter((id): id is string => id !== null))];
  const clientes = await resumoDosClientes(c, clienteIds);
  const pagamentos = ids.length
    ? await c.query('SELECT forma, valor_centavos FROM pagamentos_venda WHERE venda_id = ANY($1::uuid[])', [ids])
    : { rows: [] };
  const itens = ids.length
    ? await c.query(
        'SELECT categoria_nome, quantidade * preco_unitario_centavos AS valor FROM itens_venda WHERE venda_id = ANY($1::uuid[])',
        [ids],
      )
    : { rows: [] };

  const porForma = new Map<string, number>();
  for (const p of pagamentos.rows as { forma: string; valor_centavos: number }[]) {
    porForma.set(p.forma, (porForma.get(p.forma) ?? 0) + p.valor_centavos);
  }
  const porCategoria = new Map<string, number>();
  for (const i of itens.rows as { categoria_nome: string; valor: number }[]) {
    porCategoria.set(i.categoria_nome, (porCategoria.get(i.categoria_nome) ?? 0) + Number(i.valor));
  }
  const porVendedor = new Map<string, { vendas: number; total: number }>();
  const porCelular = new Map<string, number>();
  let total = 0;
  let comCliente = 0;
  for (const v of capas.rows as { total_centavos: number; cliente_id: string | null; vendedor_nome: string }[]) {
    total += v.total_centavos;
    if (v.cliente_id) comCliente += 1;
    const atual = porVendedor.get(v.vendedor_nome) ?? { vendas: 0, total: 0 };
    porVendedor.set(v.vendedor_nome, { vendas: atual.vendas + 1, total: atual.total + v.total_centavos });
    const celular = v.cliente_id ? clientes.get(v.cliente_id)?.celular : undefined;
    if (celular) porCelular.set(celular, (porCelular.get(celular) ?? 0) + 1);
  }

  const celulares = [...porCelular.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return {
    periodo,
    de,
    ate,
    vendas: capas.rows.length,
    total_centavos: total,
    com_cliente: comCliente,
    percentual_com_cliente: capas.rows.length === 0 ? 0 : Math.floor((comCliente * 100) / capas.rows.length),
    por_forma: [...porForma.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([forma, valor_centavos]) => ({
      forma: forma as RelatorioVendas['por_forma'][number]['forma'],
      valor_centavos,
    })),
    por_vendedor: [...porVendedor.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([nome, g]) => ({ nome, vendas: g.vendas, total_centavos: g.total })),
    por_categoria: [...porCategoria.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([categoria, total_centavos]) => ({ categoria, total_centavos })),
    repetidos: celulares.filter(([, n]) => n >= 2).map(([celular, vendas]) => ({ celular, vendas })),
    suspeitos: celulares.filter(([celular]) => celularSuspeito(celular)).map(([celular, vendas]) => ({ celular, vendas })),
  };
}
