import {
  type Pedido,
  type PedidoEditar,
  type PedidoEnviado,
  type PedidoNovo,
  type PedidoReceber,
  type RelatorioCompras,
  type StatusPedido,
  linkPedidoWhatsApp,
  parcelasFecham,
  textoDoPedido,
  totalDoPedido,
} from '@ailow/shared';
import type pg from 'pg';
import { registrarEvento } from '../acesso/comum.js';
import { FUSO, registrarLancamento } from '../financeiro/lancamentos.js';
import { ErroEstoque, registrarMovimento } from '../produtos/estoque.js';
import { type SkuParaVenda, travarSkusParaVenda } from '../produtos/produtos.js';
import { ErroFornecedor, buscarFornecedor } from './fornecedores.js';

// Compras (S11). Estoque e lançamento entram pela interface pública, na MESMA transação (RN-11).
// Este arquivo só escreve em pedidos_compra, itens_pedido_compra, parcelas_pedido_compra e a sequência.

export class ErroCompra extends Error {
  constructor(
    readonly codigo:
      | 'nao_encontrado'
      | 'sem_itens'
      | 'total_acima_do_limite'
      | 'sem_parcelas'
      | 'parcelas_divergem'
      | 'parcela_invalida'
      | 'status_invalido'
      | 'ja_recebido'
      | 'fornecedor_nao_encontrado',
  ) {
    super(codigo);
    this.name = 'ErroCompra';
  }
}

interface Ctx {
  empresaId: string;
  autorId: string;
  agora: Date;
}

async function proximoNumero(c: pg.PoolClient, empresaId: string): Promise<number> {
  const r = await c.query(
    `INSERT INTO pedido_compra_sequencia (empresa_id, ultimo) VALUES ($1, 1)
     ON CONFLICT (empresa_id) DO UPDATE SET ultimo = pedido_compra_sequencia.ultimo + 1
     RETURNING ultimo`,
    [empresaId],
  );
  return r.rows[0].ultimo as number;
}

async function montar(c: pg.PoolClient, id: string): Promise<Pedido | null> {
  const capa = await c.query(
    `SELECT p.id, p.numero, p.status, p.total_centavos, p.criado_em, p.enviado_em, p.recebido_em,
            f.id AS fornecedor_id, f.nome AS fornecedor_nome, f.whatsapp, f.cnpj
       FROM pedidos_compra p
       JOIN fornecedores f ON f.empresa_id = p.empresa_id AND f.id = p.fornecedor_id
      WHERE p.id = $1`,
    [id],
  );
  const linha = capa.rows[0] as
    | {
        id: string;
        numero: number;
        status: StatusPedido;
        total_centavos: number;
        criado_em: Date;
        enviado_em: Date | null;
        recebido_em: Date | null;
        fornecedor_id: string;
        fornecedor_nome: string;
        whatsapp: string;
        cnpj: string | null;
      }
    | undefined;
  if (!linha) return null;
  const itens = await c.query(
    `SELECT sku_id, codigo, produto_nome AS nome, tamanho, cor, quantidade, custo_unitario_centavos
       FROM itens_pedido_compra WHERE pedido_id = $1 ORDER BY codigo`,
    [id],
  );
  return {
    id: linha.id,
    numero: linha.numero,
    status: linha.status,
    total_centavos: linha.total_centavos,
    fornecedor: {
      id: linha.fornecedor_id,
      nome: linha.fornecedor_nome,
      whatsapp: linha.whatsapp,
      cnpj: linha.cnpj,
    },
    itens: itens.rows as Pedido['itens'],
    criado_em: linha.criado_em.toISOString(),
    enviado_em: linha.enviado_em?.toISOString() ?? null,
    recebido_em: linha.recebido_em?.toISOString() ?? null,
  };
}

async function gravarItens(
  c: pg.PoolClient,
  ctx: Ctx,
  pedidoId: string,
  itens: PedidoNovo['itens'],
  porId: Map<string, SkuParaVenda>,
): Promise<void> {
  for (const item of itens) {
    const sku = porId.get(item.sku_id) as SkuParaVenda;
    await c.query(
      `INSERT INTO itens_pedido_compra
         (empresa_id, pedido_id, sku_id, quantidade, custo_unitario_centavos, produto_nome, codigo, tamanho, cor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        ctx.empresaId,
        pedidoId,
        sku.id,
        item.quantidade,
        item.custo_centavos,
        sku.nome,
        sku.codigo,
        sku.tamanho,
        sku.cor,
      ],
    );
  }
}

async function resolverSkus(c: pg.PoolClient, itens: PedidoNovo['itens']): Promise<Map<string, SkuParaVenda>> {
  const ids = itens.map((i) => i.sku_id).sort();
  const skus = await travarSkusParaVenda(c, ids);
  if (!skus) throw new ErroCompra('nao_encontrado');
  return new Map(skus.map((s) => [s.id, s]));
}

function totalDe(itens: PedidoNovo['itens']): number {
  const tot = totalDoPedido(itens.map((i) => ({ quantidade: i.quantidade, custoCentavos: i.custo_centavos })));
  if (!tot.ok) throw new ErroCompra(tot.erro);
  return tot.totalCentavos;
}

/** RF-COM-02: cria o pedido em rascunho. */
export async function criarPedido(c: pg.PoolClient, ctx: Ctx, novo: PedidoNovo): Promise<Pedido> {
  const fornecedor = await buscarFornecedor(c, novo.fornecedor_id);
  if (!fornecedor) throw new ErroCompra('fornecedor_nao_encontrado');
  const porId = await resolverSkus(c, novo.itens);
  const total = totalDe(novo.itens);
  const numero = await proximoNumero(c, ctx.empresaId);
  const gravado = await c.query(
    `INSERT INTO pedidos_compra
       (empresa_id, numero, fornecedor_id, status, total_centavos, criado_por, criado_em)
     VALUES ($1, $2, $3, 'rascunho', $4, $5, $6)
     RETURNING id`,
    [ctx.empresaId, numero, novo.fornecedor_id, total, ctx.autorId, ctx.agora],
  );
  const pedidoId = gravado.rows[0].id as string;
  await gravarItens(c, ctx, pedidoId, novo.itens, porId);
  await registrarEvento(c, {
    empresaId: ctx.empresaId,
    atorTipo: 'usuario',
    atorId: ctx.autorId,
    alvoId: pedidoId,
    tipo: 'pedido_compra_criado',
    em: ctx.agora,
  });
  return (await montar(c, pedidoId)) as Pedido;
}

/** Só rascunho: troca fornecedor e itens. */
export async function editarPedido(c: pg.PoolClient, ctx: Ctx, pedidoId: string, dados: PedidoEditar): Promise<Pedido> {
  const trava = await c.query('SELECT id, status FROM pedidos_compra WHERE id = $1 FOR UPDATE', [pedidoId]);
  const ped = trava.rows[0] as { id: string; status: StatusPedido } | undefined;
  if (!ped) throw new ErroCompra('nao_encontrado');
  if (ped.status !== 'rascunho') throw new ErroCompra('status_invalido');
  const fornecedor = await buscarFornecedor(c, dados.fornecedor_id);
  if (!fornecedor) throw new ErroCompra('fornecedor_nao_encontrado');
  const porId = await resolverSkus(c, dados.itens);
  const total = totalDe(dados.itens);
  await c.query('DELETE FROM itens_pedido_compra WHERE pedido_id = $1', [pedidoId]);
  await gravarItens(c, ctx, pedidoId, dados.itens, porId);
  await c.query(`UPDATE pedidos_compra SET fornecedor_id = $2, total_centavos = $3 WHERE id = $1`, [
    pedidoId,
    dados.fornecedor_id,
    total,
  ]);
  return (await montar(c, pedidoId)) as Pedido;
}

/** RF-COM-03: rascunho → enviado e devolve o link do WhatsApp. */
export async function enviarPedido(c: pg.PoolClient, ctx: Ctx, pedidoId: string): Promise<PedidoEnviado> {
  const trava = await c.query('SELECT id, status FROM pedidos_compra WHERE id = $1 FOR UPDATE', [pedidoId]);
  const ped = trava.rows[0] as { id: string; status: StatusPedido } | undefined;
  if (!ped) throw new ErroCompra('nao_encontrado');
  if (ped.status !== 'rascunho') throw new ErroCompra('status_invalido');
  await c.query(`UPDATE pedidos_compra SET status = 'enviado', enviado_em = $2 WHERE id = $1`, [pedidoId, ctx.agora]);
  const pedido = (await montar(c, pedidoId)) as Pedido;
  const texto = textoDoPedido({
    numero: pedido.numero,
    itens: pedido.itens.map((i) => ({ codigo: i.codigo, cor: i.cor, quantidade: i.quantidade })),
  });
  await registrarEvento(c, {
    empresaId: ctx.empresaId,
    atorTipo: 'usuario',
    atorId: ctx.autorId,
    alvoId: pedidoId,
    tipo: 'pedido_compra_enviado',
    em: ctx.agora,
  });
  return { pedido, whatsapp_url: linkPedidoWhatsApp(pedido.fornecedor.whatsapp, texto) };
}

/**
 * RF-COM-04 / RN-11: enviado → recebido. Entrada de estoque + uma saída financeira por parcela, tudo ou nada.
 */
export async function receberPedido(c: pg.PoolClient, ctx: Ctx, pedidoId: string, corpo: PedidoReceber): Promise<Pedido> {
  const trava = await c.query(
    'SELECT id, numero, status, total_centavos FROM pedidos_compra WHERE id = $1 FOR UPDATE',
    [pedidoId],
  );
  const ped = trava.rows[0] as { id: string; numero: number; status: StatusPedido; total_centavos: number } | undefined;
  if (!ped) throw new ErroCompra('nao_encontrado');
  if (ped.status === 'recebido') throw new ErroCompra('ja_recebido');
  if (ped.status !== 'enviado') throw new ErroCompra('status_invalido');

  const fecha = parcelasFecham(
    ped.total_centavos,
    corpo.parcelas.map((p) => p.valor_centavos),
  );
  if (!fecha.ok) throw new ErroCompra(fecha.erro);

  const itens = await c.query(
    `SELECT sku_id, quantidade FROM itens_pedido_compra WHERE pedido_id = $1 ORDER BY sku_id`,
    [pedidoId],
  );
  const skuIds = (itens.rows as { sku_id: string }[]).map((i) => i.sku_id);
  const skus = await travarSkusParaVenda(c, skuIds);
  if (!skus) throw new ErroCompra('nao_encontrado');

  for (const item of itens.rows as { sku_id: string; quantidade: number }[]) {
    try {
      await registrarMovimento(c, ctx, {
        skuId: item.sku_id,
        tipo: 'compra',
        quantidade: item.quantidade,
        motivo: `Pedido de compra ${ped.numero}`,
        origemId: pedidoId,
      });
    } catch (err) {
      if (err instanceof ErroEstoque) throw new ErroCompra('nao_encontrado');
      throw err;
    }
  }

  for (const [ordem, parcela] of corpo.parcelas.entries()) {
    const lanc = await registrarLancamento(c, ctx, {
      tipo: 'saida',
      origem_tipo: 'compra',
      origem_id: pedidoId,
      descricao: `Pedido ${ped.numero} · parcela ${ordem + 1}`,
      categoria: 'Compras',
      valor_centavos: parcela.valor_centavos,
      forma_pagamento: null,
      vencimento: parcela.vencimento,
      paga: false,
    });
    await c.query(
      `INSERT INTO parcelas_pedido_compra
         (empresa_id, pedido_id, ordem, valor_centavos, vencimento, lancamento_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ctx.empresaId, pedidoId, ordem, parcela.valor_centavos, parcela.vencimento, lanc.id],
    );
  }

  await c.query(
    `UPDATE pedidos_compra SET status = 'recebido', recebido_em = $2, recebido_por = $3 WHERE id = $1`,
    [pedidoId, ctx.agora, ctx.autorId],
  );
  await registrarEvento(c, {
    empresaId: ctx.empresaId,
    atorTipo: 'usuario',
    atorId: ctx.autorId,
    alvoId: pedidoId,
    tipo: 'pedido_compra_recebido',
    em: ctx.agora,
  });
  return (await montar(c, pedidoId)) as Pedido;
}

export async function buscarPedido(c: pg.PoolClient, id: string): Promise<Pedido | null> {
  return montar(c, id);
}

export async function listarPedidos(
  c: pg.PoolClient,
  status: StatusPedido | undefined,
): Promise<{
  pedidos: {
    id: string;
    numero: number;
    status: StatusPedido;
    total_centavos: number;
    fornecedor_nome: string;
    criado_em: string;
    enviado_em: string | null;
    recebido_em: string | null;
  }[];
}> {
  const r = await c.query(
    `SELECT p.id, p.numero, p.status, p.total_centavos, f.nome AS fornecedor_nome,
            p.criado_em, p.enviado_em, p.recebido_em
       FROM pedidos_compra p
       JOIN fornecedores f ON f.empresa_id = p.empresa_id AND f.id = p.fornecedor_id
      WHERE ($1::text IS NULL OR p.status = $1)
      ORDER BY p.numero DESC`,
    [status ?? null],
  );
  return {
    pedidos: (r.rows as {
      id: string;
      numero: number;
      status: StatusPedido;
      total_centavos: number;
      fornecedor_nome: string;
      criado_em: Date;
      enviado_em: Date | null;
      recebido_em: Date | null;
    }[]).map((p) => ({
      id: p.id,
      numero: p.numero,
      status: p.status,
      total_centavos: p.total_centavos,
      fornecedor_nome: p.fornecedor_nome,
      criado_em: p.criado_em.toISOString(),
      enviado_em: p.enviado_em?.toISOString() ?? null,
      recebido_em: p.recebido_em?.toISOString() ?? null,
    })),
  };
}

/** RF-COM-05: compras recebidas do mês (fuso São Paulo), por fornecedor. */
export async function relatorioCompras(c: pg.PoolClient, data: string): Promise<RelatorioCompras> {
  const r = await c.query(
    `SELECT f.id AS fornecedor_id, f.nome,
            count(*)::int AS pedidos,
            coalesce(sum(p.total_centavos), 0)::int AS total_centavos
       FROM pedidos_compra p
       JOIN fornecedores f ON f.empresa_id = p.empresa_id AND f.id = p.fornecedor_id
      WHERE p.status = 'recebido'
        AND (p.recebido_em AT TIME ZONE $2)::date >= date_trunc('month', $1::date)::date
        AND (p.recebido_em AT TIME ZONE $2)::date < (date_trunc('month', $1::date) + interval '1 month')::date
      GROUP BY f.id, f.nome
      ORDER BY lower(f.nome), f.id`,
    [data, FUSO],
  );
  const por = r.rows as { fornecedor_id: string; nome: string; pedidos: number; total_centavos: number }[];
  return {
    periodo: 'mes',
    data,
    pedidos: por.reduce((a, x) => a + x.pedidos, 0),
    total_centavos: por.reduce((a, x) => a + x.total_centavos, 0),
    por_fornecedor: por,
  };
}

// Reexport para a rota traduzir ErroFornecedor sem import circular estranho.
export { ErroFornecedor };
