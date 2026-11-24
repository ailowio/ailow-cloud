import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { receberPedido } from '../src/compras/compras.js';
import {
  Cliente,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// F01 (plano "Aprimoramentos voz 23/11", D-A2): prova que a venda vira entrada no Financeiro e que a compra recebida
// vira contas a pagar, pelas rotas HTTP. Só ids e nomes criados neste arquivo (L-0008); cada teste usa a própria empresa.
// Relógio parado em 2026-11-11 09:00 em São Paulo.
const DIA = '2026-11-11';

interface Lado {
  empresaId: string;
  donoId: string;
  dono: Cliente;
  categoria: string;
}

interface Peca {
  skuId: string;
  codigo: string;
}

interface Linha {
  id: string;
  tipo: 'entrada' | 'saida';
  origem_tipo: string;
  origem_id: string | null;
  categoria: string | null;
  valor_centavos: number;
  forma_pagamento: string | null;
  vencimento: string;
  status: string;
}

describe('Financeiro × Vendas × Compras (integração F01)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();
  let seq = 0;
  const celular = () => `119${String(60_000_000 + ++seq).padStart(8, '0')}`;

  async function montar(nome: string): Promise<Lado & { vendedor: Cliente }> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const pin = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (pin.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${pin.statusCode}`);
    const cat = await p.dono.post('/categorias', { nome: 'Sutiã', atributos: ['Bojo'], tipo: 'produto' });
    if (cat.statusCode !== 201) throw new Error(`categoria falhou: ${cat.statusCode} ${cat.body}`);
    return {
      empresaId: p.empresa.empresaId,
      donoId: p.empresa.donoId,
      dono: p.dono,
      vendedor,
      categoria: (cat.json() as { id: string }).id,
    };
  }

  async function peca(lado: Lado, estoque = 5): Promise<Peca> {
    const res = await lado.dono.post('/produtos', {
      nome: `Peça ${randomUUID().slice(0, 8)}`,
      categoria_id: lado.categoria,
      porte: 'slim',
      atributos: ['Bojo'],
      fornecedor: 'Oficina',
      custo_centavos: 4500,
      preco_centavos: 8990,
      skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: estoque, estoque_minimo: 1 }],
    });
    if (res.statusCode !== 201) throw new Error(`produto falhou: ${res.statusCode} ${res.body}`);
    const sku = (res.json() as { skus: { id: string; codigo: string }[] }).skus[0] as { id: string; codigo: string };
    return { skuId: sku.id, codigo: sku.codigo };
  }

  async function pedidoEnviado(lado: Lado, p: Peca, quantidade: number, custo: number): Promise<string> {
    const tel = `119${String(50_000_000 + ++seq).padStart(8, '0')}`;
    const f = await lado.dono.post('/fornecedores', { nome: `Forne ${tel.slice(-4)}`, whatsapp: tel, cnpj: null });
    if (f.statusCode !== 201) throw new Error(`fornecedor falhou: ${f.statusCode} ${f.body}`);
    const ped = await lado.dono.post('/compras', {
      fornecedor_id: (f.json() as { id: string }).id,
      itens: [{ sku_id: p.skuId, quantidade, custo_centavos: custo }],
    });
    if (ped.statusCode !== 201) throw new Error(`pedido falhou: ${ped.statusCode} ${ped.body}`);
    const { id } = ped.json() as { id: string };
    const env = await lado.dono.post(`/compras/${id}/enviar`);
    if (env.statusCode !== 200) throw new Error(`enviar falhou: ${env.statusCode} ${env.body}`);
    return id;
  }

  const estoqueDe = async (lado: Lado, codigo: string) =>
    ((await lado.dono.get(`/skus/por-codigo?codigo=${encodeURIComponent(codigo)}`)).json() as { estoque: number }).estoque;
  const extrato = async (lado: Lado) => ((await lado.dono.get(`/financeiro/extrato?data=${DIA}`)).json() as { lancamentos: Linha[] }).lancamentos;
  const contasAPagar = async (lado: Lado) => ((await lado.dono.get('/financeiro/contas-a-pagar')).json() as { contas: Linha[] }).contas;
  const relatorio = async (lado: Lado) =>
    (await lado.dono.get(`/financeiro/relatorio?periodo=dia&data=${DIA}`)).json() as {
      entradas_centavos: number;
      saidas_centavos: number;
      saldo_centavos: number;
      por_forma: { forma_pagamento: string; entradas_centavos: number; saidas_centavos: number }[];
      por_categoria: { categoria: string; entradas_centavos: number; saidas_centavos: number }[];
    };
  const contar = async (sql: string, empresaId: string, alvo: string) =>
    Number((await owner.query(sql, [empresaId, alvo])).rows[0].n);

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 8);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('venda → entrada (RF-VEN-06, D10)', () => {
    it('venda em 2 formas gera 2 entradas pagas na data, categoria Vendas, somando o total, e aparece no relatório do dia', async () => {
      const loja = await montar('F01 venda duas formas');
      const p = await peca(loja);
      const res = await loja.vendedor.post('/vendas', {
        itens: [{ sku_id: p.skuId, quantidade: 1 }],
        cliente: { celular: celular(), nome: 'Ana Souza' },
        desconto: { tipo: 'nenhum' },
        pagamentos: [
          { forma: 'pix', valor_centavos: 6000 },
          { forma: 'dinheiro', valor_centavos: 2990 },
        ],
      });
      expect(res.statusCode).toBe(201);
      const venda = res.json() as { id: string; total_centavos: number };
      expect(venda.total_centavos).toBe(8990);

      const deste = (await extrato(loja)).filter((l) => l.origem_id === venda.id);
      expect(deste).toHaveLength(2);
      for (const l of deste) {
        expect(l).toMatchObject({ tipo: 'entrada', status: 'pago', origem_tipo: 'venda', categoria: 'Vendas', vencimento: DIA });
      }
      expect(deste.map((l) => `${l.forma_pagamento}:${l.valor_centavos}`).sort()).toEqual(['dinheiro:2990', 'pix:6000']);
      expect(deste.reduce((s, l) => s + l.valor_centavos, 0)).toBe(venda.total_centavos);

      // Empresa nova só com esta venda: o relatório do dia é exatamente ela.
      const rel = await relatorio(loja);
      expect(rel).toMatchObject({ entradas_centavos: 8990, saidas_centavos: 0, saldo_centavos: 8990 });
      const forma = Object.fromEntries(rel.por_forma.map((x) => [x.forma_pagamento, x.entradas_centavos]));
      expect(forma).toMatchObject({ pix: 6000, dinheiro: 2990 });
      expect(rel.por_categoria.find((c) => c.categoria === 'Vendas')?.entradas_centavos).toBe(8990);
    });

    it('cancelar a venda em 2 formas estorna as duas entradas e o saldo do dia volta a zero', async () => {
      const loja = await montar('F01 cancela duas formas');
      const p = await peca(loja);
      const res = await loja.dono.post('/vendas', {
        itens: [{ sku_id: p.skuId, quantidade: 1 }],
        cliente: { celular: celular(), nome: 'Bia Lima' },
        desconto: { tipo: 'nenhum' },
        pagamentos: [
          { forma: 'pix', valor_centavos: 6000 },
          { forma: 'dinheiro', valor_centavos: 2990 },
        ],
      });
      const { id } = res.json() as { id: string };
      expect((await loja.dono.post(`/vendas/${id}/cancelar`, { motivo: 'Cliente desistiu' })).statusCode).toBe(200);

      const deste = (await extrato(loja)).filter((l) => l.origem_id === id);
      const originais = deste.filter((l) => l.tipo === 'entrada');
      expect(originais).toHaveLength(2);
      for (const l of originais) expect(l.status).toBe('estornado');
      const estornos = (await extrato(loja)).filter((l) => l.tipo === 'saida' && l.origem_tipo === 'estorno');
      expect(estornos.map((l) => l.valor_centavos).sort((x, y) => x - y)).toEqual([2990, 6000]);
      expect(await estoqueDe(loja, p.codigo)).toBe(5);

      expect(await relatorio(loja)).toMatchObject({ entradas_centavos: 8990, saidas_centavos: 8990, saldo_centavos: 0 });
    });
  });

  describe('compra recebida → contas a pagar (RF-COM-04, RN-11)', () => {
    it('receber com 3 parcelas gera 3 saídas em aberto com os vencimentos; pagar uma tira só ela da lista', async () => {
      const loja = await montar('F01 compra 3 parcelas');
      const p = await peca(loja, 1);
      const pedidoId = await pedidoEnviado(loja, p, 3, 3000); // total 9000
      const parcelas = [
        { valor_centavos: 3000, vencimento: '2026-11-20' },
        { valor_centavos: 3000, vencimento: '2026-12-20' },
        { valor_centavos: 3000, vencimento: '2027-01-20' },
      ];
      const res = await loja.dono.post(`/compras/${pedidoId}/receber`, { parcelas });
      expect(res.statusCode).toBe(200);
      expect(await estoqueDe(loja, p.codigo)).toBe(4);

      const lista = (await contasAPagar(loja)).filter((l) => l.origem_id === pedidoId);
      expect(lista).toHaveLength(3);
      for (const l of lista) expect(l).toMatchObject({ tipo: 'saida', status: 'aberto', origem_tipo: 'compra', categoria: 'Compras', forma_pagamento: null });
      expect(lista.map((l) => `${l.vencimento}:${l.valor_centavos}`).sort()).toEqual(
        parcelas.map((x) => `${x.vencimento}:${x.valor_centavos}`),
      );
      expect(lista.reduce((s, l) => s + l.valor_centavos, 0)).toBe(9000);
      // Em aberto não mexe no caixa do dia.
      expect(await relatorio(loja)).toMatchObject({ entradas_centavos: 0, saidas_centavos: 0 });

      const primeira = lista.find((l) => l.vencimento === '2026-11-20') as Linha;
      expect((await loja.dono.post(`/financeiro/lancamentos/${primeira.id}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(204);
      const depois = (await contasAPagar(loja)).filter((l) => l.origem_id === pedidoId);
      expect(depois.map((l) => l.vencimento).sort()).toEqual(['2026-12-20', '2027-01-20']);
      expect(await relatorio(loja)).toMatchObject({ saidas_centavos: 3000 });
    });

    it('falha no meio do recebimento (2ª parcela com data inexistente): nenhum lançamento, nenhuma parcela, estoque e status intactos', async () => {
      const loja = await montar('F01 compra atomica');
      const p = await peca(loja, 1);
      const pedidoId = await pedidoEnviado(loja, p, 2, 4500); // total 9000
      const ctx = { empresaId: loja.empresaId, autorId: loja.donoId, perfil: 'dono' as const, agora: relogio.agora };
      // 1ª parcela entra; a 2ª cai no banco (29/02 fora de bissexto), já com estoque movimentado e 1 lançamento gravado.
      await expect(
        withEmpresa(pool, loja.empresaId, (c) =>
          receberPedido(c, ctx, pedidoId, {
            parcelas: [
              { valor_centavos: 4500, vencimento: '2026-11-20' },
              { valor_centavos: 4500, vencimento: '2026-02-30' },
            ],
          }),
        ),
      ).rejects.toThrow();

      expect(await contar('SELECT count(*) AS n FROM lancamentos WHERE empresa_id = $1 AND origem_id = $2', loja.empresaId, pedidoId)).toBe(0);
      expect(await contar('SELECT count(*) AS n FROM parcelas_pedido_compra WHERE empresa_id = $1 AND pedido_id = $2', loja.empresaId, pedidoId)).toBe(0);
      expect(await contar('SELECT count(*) AS n FROM movimentos_estoque WHERE empresa_id = $1 AND origem_id = $2', loja.empresaId, pedidoId)).toBe(0);
      expect(await estoqueDe(loja, p.codigo)).toBe(1);
      expect(await contasAPagar(loja)).toEqual([]);
      const st = await owner.query('SELECT status FROM pedidos_compra WHERE id = $1', [pedidoId]);
      expect(st.rows[0].status).toBe('enviado');

      // E o pedido continua recebível depois da falha.
      const ok = await loja.dono.post(`/compras/${pedidoId}/receber`, { parcelas: [{ valor_centavos: 9000, vencimento: '2026-11-30' }] });
      expect(ok.statusCode).toBe(200);
      expect(await estoqueDe(loja, p.codigo)).toBe(3);
    });

    it('o Vendedor não vê contas a pagar nem as parcelas da compra (RN-10)', async () => {
      const loja = await montar('F01 vendedor sem contas');
      const p = await peca(loja);
      const pedidoId = await pedidoEnviado(loja, p, 1, 4500);
      await loja.dono.post(`/compras/${pedidoId}/receber`, { parcelas: [{ valor_centavos: 4500, vencimento: '2026-11-30' }] });
      const res = await loja.vendedor.get('/financeiro/contas-a-pagar');
      expect(res.statusCode).toBe(403);
      expect(res.body).not.toContain(pedidoId);
    });
  });
});
