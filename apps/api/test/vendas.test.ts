import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import { ErroVenda, finalizarVenda } from '../src/vendas/vendas.js';
import {
  Cliente,
  type EmpresaDeTeste,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// S10 / RF-VEN-01…10, RN-02/07/08, TEST-17. Só ids e números criados neste arquivo (L-0008).
// O relógio fica parado em 2026-11-11 09:00 em São Paulo: não avançar minutos (L-0016).
const DIA = '2026-11-11';

interface Lado {
  dados: EmpresaDeTeste;
  dono: Cliente;
  vendedor: Cliente;
  vendedorId: string;
  categoria: string;
}

interface Peca {
  skuId: string;
  codigo: string;
  preco: number;
}

describe('Vendas (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();
  let seq = 0;
  const celular = () => `119${String(80_000_000 + ++seq).padStart(8, '0')}`;

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const pin = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (pin.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${pin.statusCode}`);
    const cat = await p.dono.post('/categorias', { nome: 'Sutiã', atributos: ['Bojo'], tipo: 'produto' });
    if (cat.statusCode !== 201) throw new Error(`categoria falhou: ${cat.statusCode} ${cat.body}`);
    return { dados: p.empresa, dono: p.dono, vendedor, vendedorId: p.vendedorId, categoria: (cat.json() as { id: string }).id };
  }

  async function peca(lado: Lado, estoque = 5, preco = 8990): Promise<Peca> {
    const res = await lado.dono.post('/produtos', {
      nome: `Peça ${randomUUID().slice(0, 8)}`,
      categoria_id: lado.categoria,
      porte: 'slim',
      atributos: ['Bojo'],
      fornecedor: 'Oficina',
      custo_centavos: 4500,
      preco_centavos: preco,
      skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: estoque, estoque_minimo: 1 }],
    });
    if (res.statusCode !== 201) throw new Error(`produto falhou: ${res.statusCode} ${res.body}`);
    const sku = (res.json() as { skus: { id: string; codigo: string }[] }).skus[0] as { id: string; codigo: string };
    return { skuId: sku.id, codigo: sku.codigo, preco };
  }

  function fechar(p: Peca, tel: string, extra: Record<string, unknown> = {}) {
    return {
      itens: [{ sku_id: p.skuId, quantidade: 1 }],
      cliente: { celular: tel, nome: 'Ana Souza' },
      desconto: { tipo: 'nenhum' },
      pagamentos: [{ forma: 'pix', valor_centavos: p.preco }],
      ...extra,
    };
  }

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 8);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Vendas A');
    b = await montar('Vendas B');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  const estoqueDe = async (lado: Lado, codigo: string) => {
    const res = await lado.dono.get(`/skus/por-codigo?codigo=${encodeURIComponent(codigo)}`);
    return { status: res.statusCode, json: res.json() as { estoque: number; preco_centavos: number; nome: string } };
  };

  describe('autorização (TEST-17): 2 empresas × 2 perfis', () => {
    it('sem sessão, finalizar e o relatório devolvem 401', async () => {
      const anon = new Cliente(app);
      expect((await anon.post('/vendas', {})).statusCode).toBe(401);
      expect((await anon.get(`/vendas/relatorio?periodo=dia&data=${DIA}`)).statusCode).toBe(401);
    });

    it('a empresa B não lê, não cancela e não vê no histórico a venda da empresa A', async () => {
      const p = await peca(a);
      const tel = celular();
      const venda = await a.dono.post('/vendas', fechar(p, tel));
      expect(venda.statusCode).toBe(201);
      const { id } = venda.json() as { id: string; cliente: { id: string } };
      expect((await b.dono.get(`/vendas/${id}`)).statusCode).toBe(404);
      expect((await b.vendedor.post(`/vendas/${id}/cancelar`, { motivo: 'Não é minha' })).statusCode).toBe(404);
      expect((await b.dono.get(`/vendas/por-cliente/${(venda.json() as { cliente: { id: string } }).cliente.id}`)).json()).toEqual({
        compras: [],
      });
      expect((await estoqueDe(a, p.codigo)).json.estoque).toBe(4);
      expect((await estoqueDe(b, p.codigo)).status).toBe(404);
    });

    it('o Vendedor vende e lê o próprio comprovante; o mês inteiro é só do Dono', async () => {
      const p = await peca(a);
      const venda = await a.vendedor.post('/vendas', fechar(p, celular()));
      expect(venda.statusCode).toBe(201);
      const corpo = venda.json() as { id: string; numero: number };
      expect((await a.vendedor.get(`/vendas/${corpo.id}`)).statusCode).toBe(200);
      expect((await a.vendedor.get(`/vendas/relatorio?periodo=mes&data=${DIA}`)).statusCode).toBe(403);
      expect(JSON.stringify(venda.json())).not.toContain('custo');
    });
  });

  describe('finalizar (RN-02, RN-07, RF-VEN-06/10)', () => {
    it('cria o cliente que não existia, baixa o estoque, lança o Pix pago e numera a partir de 1', async () => {
      const loja = await montar('Vendas numera');
      const p = await peca(loja);
      const tel = celular();
      const res = await loja.dono.post('/vendas', fechar(p, tel));
      expect(res.statusCode).toBe(201);
      const venda = res.json() as {
        id: string;
        numero: number;
        total_centavos: number;
        cliente: { nome: string; celular: string };
        pagamentos: { forma: string; valor_centavos: number }[];
      };
      expect(venda.numero).toBe(1);
      expect(venda.total_centavos).toBe(8990);
      expect(venda.cliente).toMatchObject({ nome: 'Ana Souza', celular: tel });
      expect(venda.pagamentos).toEqual([{ forma: 'pix', valor_centavos: 8990 }]);
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(4);

      const lista = await loja.dono.get(`/clientes?q=${tel}`);
      expect((lista.json() as { clientes: { celular: string }[] }).clientes.map((c) => c.celular)).toContain(tel);

      const segunda = await loja.vendedor.post('/vendas', fechar(await peca(loja), celular()));
      expect((segunda.json() as { numero: number }).numero).toBe(2);

      const extrato = await loja.dono.get(`/financeiro/extrato?data=${DIA}`);
      const lanc = (extrato.json() as { lancamentos: { origem_id: string; origem_tipo: string; status: string; valor_centavos: number; forma_pagamento: string }[] }).lancamentos.filter(
        (l) => l.origem_id === venda.id,
      );
      expect(lanc).toEqual([
        expect.objectContaining({ origem_tipo: 'venda', status: 'pago', valor_centavos: 8990, forma_pagamento: 'pix' }),
      ]);
    });

    it('cliente já cadastrado entra pelo celular, sem usar o nome enviado', async () => {
      const loja = await montar('Vendas cliente');
      const tel = celular();
      const criado = await loja.dono.post('/clientes', { nome: 'Bia Lima', celular: tel, aviso_lgpd: false });
      expect(criado.statusCode).toBe(201);
      const p = await peca(loja);
      const res = await loja.dono.post('/vendas', {
        ...fechar(p, tel),
        cliente: { celular: tel, nome: 'Nome Que Não Vale' },
      });
      expect(res.statusCode).toBe(201);
      expect((res.json() as { cliente: { nome: string; id: string } }).cliente.nome).toBe('Bia Lima');
      expect((res.json() as { cliente: { id: string } }).cliente.id).toBe((criado.json() as { id: string }).id);
    });

    it('celular novo sem nome não grava venda nem estoque', async () => {
      const p = await peca(a, 3);
      const res = await a.dono.post('/vendas', { ...fechar(p, celular()), cliente: { celular: celular() } });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ erro: 'nome_obrigatorio' });
      expect((await estoqueDe(a, p.codigo)).json.estoque).toBe(3);
    });

    it('cliente inativo não é recriado e a peça continua no estoque', async () => {
      const loja = await montar('Vendas inativo');
      const tel = celular();
      const criado = await loja.dono.post('/clientes', { nome: 'Inativa', celular: tel, aviso_lgpd: false });
      const id = (criado.json() as { id: string }).id;
      expect((await loja.dono.post(`/clientes/${id}/inativar`)).statusCode).toBe(200);
      const p = await peca(loja);
      const res = await loja.dono.post('/vendas', fechar(p, tel));
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ erro: 'cliente_inativo' });
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(5);
    });

    it('10% de desconto e Pix + dinheiro fecham; um centavo a menos não grava nada', async () => {
      const loja = await montar('Vendas desconto');
      const p = await peca(loja);
      const certo = await loja.dono.post('/vendas', {
        ...fechar(p, celular()),
        desconto: { tipo: 'percentual', percentual: 10 },
        pagamentos: [
          { forma: 'pix', valor_centavos: 4000 },
          { forma: 'dinheiro', valor_centavos: 4091 },
        ],
      });
      expect(certo.statusCode).toBe(201);
      expect(certo.json()).toMatchObject({ subtotal_centavos: 8990, desconto_centavos: 899, total_centavos: 8091 });

      const q = await peca(loja);
      const errado = await loja.dono.post('/vendas', {
        ...fechar(q, celular()),
        pagamentos: [{ forma: 'pix', valor_centavos: 8989 }],
      });
      expect(errado.statusCode).toBe(400);
      expect(errado.json()).toMatchObject({ erro: 'pagamentos_divergem' });
      expect((await estoqueDe(loja, q.codigo)).json.estoque).toBe(5);
    });

    it('sem estoque suficiente não entra, e um SKU inexistente no meio não baixa o outro', async () => {
      const loja = await montar('Vendas estoque');
      const p = await peca(loja, 1);
      const sem = await loja.dono.post('/vendas', {
        ...fechar(p, celular()),
        itens: [{ sku_id: p.skuId, quantidade: 2 }],
        pagamentos: [{ forma: 'pix', valor_centavos: 17980 }],
      });
      expect(sem.statusCode).toBe(409);
      expect(sem.json()).toMatchObject({ erro: 'estoque_insuficiente' });
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(1);

      const boa = await peca(loja, 4);
      const atomica = await loja.dono.post('/vendas', {
        itens: [
          { sku_id: boa.skuId, quantidade: 1 },
          { sku_id: randomUUID(), quantidade: 1 },
        ],
        cliente: { celular: celular(), nome: 'Lia' },
        desconto: { tipo: 'nenhum' },
        pagamentos: [{ forma: 'debito', valor_centavos: 17980 }],
      });
      expect(atomica.statusCode).toBe(404);
      expect((await estoqueDe(loja, boa.codigo)).json.estoque).toBe(4);
    });

    it('o corpo não aceita empresa_id nem SKU repetido', async () => {
      const p = await peca(a);
      const extra = await a.dono.post('/vendas', { ...fechar(p, celular()), empresa_id: a.dados.empresaId });
      expect(extra.statusCode).toBe(400);
      const repetido = await a.dono.post('/vendas', {
        ...fechar(p, celular()),
        itens: [
          { sku_id: p.skuId, quantidade: 1 },
          { sku_id: p.skuId, quantidade: 1 },
        ],
      });
      expect(repetido.statusCode).toBe(400);
    });
  });

  describe('cancelar (RN-08, RF-VEN-08) e apagar o cliente (ADR 007)', () => {
    it('devolver o estoque e estorna o lançamento; a segunda vez não estorna de novo', async () => {
      const loja = await montar('Vendas cancela');
      const p = await peca(loja);
      const venda = await loja.vendedor.post('/vendas', fechar(p, celular()));
      const { id, numero } = venda.json() as { id: string; numero: number };
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(4);

      const cancelou = await loja.vendedor.post(`/vendas/${id}/cancelar`, { motivo: 'Cliente desistiu' });
      expect(cancelou.statusCode).toBe(200);
      expect(cancelou.json()).toMatchObject({ status: 'cancelada', motivo_cancelamento: 'Cliente desistiu' });
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(5);

      const deNovo = await loja.dono.post(`/vendas/${id}/cancelar`, { motivo: 'De novo' });
      expect(deNovo.statusCode).toBe(409);
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(5);

      const extrato = await loja.dono.get(`/financeiro/extrato?data=${DIA}`);
      const linhas = (extrato.json() as { lancamentos: { descricao: string | null; status: string; tipo: string }[] }).lancamentos.filter(
        (l) => l.descricao === `Venda ${numero}`,
      );
      expect(linhas.map((l) => `${l.tipo}:${l.status}`).sort()).toEqual(['entrada:estornado', 'saida:pago']);
    });

    it('apagar o cliente tira o vínculo e a venda continua, sem o nome', async () => {
      const loja = await montar('Vendas set null');
      const tel = celular();
      const p = await peca(loja);
      const venda = await loja.dono.post('/vendas', fechar(p, tel));
      const corpo = venda.json() as { id: string; numero: number; cliente: { id: string } };
      expect((await loja.dono.delete(`/clientes/${corpo.cliente.id}`)).statusCode).toBe(204);
      const depois = await loja.dono.get(`/vendas/${corpo.id}`);
      expect(depois.statusCode).toBe(200);
      expect(depois.json()).toMatchObject({ numero: corpo.numero, cliente: null, status: 'finalizada' });
    });
  });

  describe('relatório e histórico (RF-VEN-09, RF-CLI-02)', () => {
    it('o Dono vê forma, vendedor, categoria, repetido e suspeito; o Vendedor só o próprio dia', async () => {
      const loja = await montar('Vendas relatorio');
      const p = await peca(loja, 8);
      const repetido = celular();
      const suspeito = '11911111111';
      await loja.dono.post('/vendas', fechar(p, repetido));
      await loja.dono.post('/vendas', {
        ...fechar(p, repetido),
        itens: [{ sku_id: p.skuId, quantidade: 1 }],
      });
      await loja.vendedor.post('/vendas', fechar(p, suspeito));

      const rel = await loja.dono.get(`/vendas/relatorio?periodo=dia&data=${DIA}`);
      expect(rel.statusCode).toBe(200);
      const corpo = rel.json() as {
        vendas: number;
        total_centavos: number;
        com_cliente: number;
        percentual_com_cliente: number;
        por_forma: { forma: string; valor_centavos: number }[];
        por_categoria: { categoria: string; total_centavos: number }[];
        por_vendedor: { nome: string; vendas: number }[];
        repetidos: { celular: string; vendas: number }[];
        suspeitos: { celular: string; vendas: number }[];
      };
      expect(corpo.vendas).toBe(3);
      expect(corpo.total_centavos).toBe(8990 * 3);
      expect(corpo.com_cliente).toBe(3);
      expect(corpo.percentual_com_cliente).toBe(100);
      expect(corpo.por_forma).toEqual([{ forma: 'pix', valor_centavos: 8990 * 3 }]);
      expect(corpo.por_categoria).toEqual([{ categoria: 'Sutiã', total_centavos: 8990 * 3 }]);
      expect(corpo.repetidos).toEqual([{ celular: repetido, vendas: 2 }]);
      expect(corpo.suspeitos).toEqual([{ celular: suspeito, vendas: 1 }]);
      expect(corpo.por_vendedor.map((v) => v.vendas).sort()).toEqual([1, 2]);

      const doVendedor = await loja.vendedor.get(`/vendas/relatorio?periodo=dia&data=${DIA}`);
      const soEle = doVendedor.json() as { vendas: number; suspeitos: { celular: string }[]; repetidos: unknown[] };
      expect(soEle.vendas).toBe(1);
      expect(soEle.suspeitos.map((s) => s.celular)).toEqual([suspeito]);
      expect(soEle.repetidos).toEqual([]);
    });

    it('a lista do dia traz número, cliente, total, formas e status (inclui canceladas); o Vendedor só as próprias', async () => {
      const loja = await montar('Vendas lista');
      const p = await peca(loja, 8);
      const telA = celular();
      const telB = celular();
      const a = (await loja.dono.post('/vendas', fechar(p, telA))).json() as { id: string; numero: number };
      const b = (await loja.vendedor.post('/vendas', fechar(p, telB, { cliente: { celular: telB, nome: 'Bia Lima' } }))).json() as {
        id: string;
        numero: number;
      };
      const cancel = await loja.dono.post(`/vendas/${a.id}/cancelar`, { motivo: 'Teste da lista' });
      expect(cancel.statusCode).toBe(200);

      const r = await loja.dono.get(`/vendas/lista?periodo=dia&data=${DIA}`);
      expect(r.statusCode).toBe(200);
      const { vendas } = r.json() as {
        vendas: { id: string; numero: number; status: string; total_centavos: number; formas: string[]; cliente: { nome: string; celular: string } | null }[];
      };
      expect(vendas.map((v) => v.numero)).toEqual([b.numero, a.numero].sort((x, y) => y - x));
      const va = vendas.find((v) => v.id === a.id);
      expect(va).toMatchObject({ status: 'cancelada', total_centavos: 8990, formas: ['pix'] });
      expect(va?.cliente).toEqual({ nome: 'Ana Souza', celular: telA });
      expect(vendas.find((v) => v.id === b.id)?.cliente?.nome).toBe('Bia Lima');

      const doVendedor = await loja.vendedor.get(`/vendas/lista?periodo=dia&data=${DIA}`);
      expect((doVendedor.json() as { vendas: { id: string }[] }).vendas.map((v) => v.id)).toEqual([b.id]);
      expect((await loja.vendedor.get(`/vendas/lista?periodo=mes&data=${DIA}`)).statusCode).toBe(403);
      expect((await app.inject({ method: 'GET', url: `/vendas/lista?periodo=dia&data=${DIA}` })).statusCode).toBe(401);
    });

    it('a ficha lista a compra pelo número da venda', async () => {
      const loja = await montar('Vendas ficha');
      const tel = celular();
      const p = await peca(loja);
      const venda = await loja.dono.post('/vendas', fechar(p, tel));
      const corpo = venda.json() as { numero: number; cliente: { id: string }; total_centavos: number };
      const ficha = await loja.vendedor.get(`/vendas/por-cliente/${corpo.cliente.id}`);
      expect(ficha.json()).toEqual({
        compras: [expect.objectContaining({ numero: corpo.numero, total_centavos: 8990, status: 'finalizada' })],
      });
    });
  });

  describe('consulta do SKU pelo código (scanner)', () => {
    it('devolve preço e estoque, sem custo, e 404 para código de outra empresa', async () => {
      const p = await peca(a);
      const res = await a.vendedor.get(`/skus/por-codigo?codigo=${encodeURIComponent(p.codigo)}`);
      expect(res.statusCode).toBe(200);
      const json = res.json() as { codigo: string; preco_centavos: number; estoque: number };
      expect(json).toMatchObject({ codigo: p.codigo, preco_centavos: 8990, estoque: expect.any(Number) });
      expect(JSON.stringify(json)).not.toContain('custo');
      expect((await b.dono.get(`/skus/por-codigo?codigo=${encodeURIComponent(p.codigo)}`)).statusCode).toBe(404);
    });
  });

  // RN-07 / RN-08: "tudo ou nada" também com dois balcões ao mesmo tempo (TEST-12, concorrência).
  describe('concorrência', () => {
    it('duas vendas da última peça: uma entra, a outra é recusada e o saldo fica em 0', async () => {
      const loja = await montar('Vendas última peça');
      const p = await peca(loja, 1);
      const [x, y] = await Promise.all([
        loja.dono.post('/vendas', fechar(p, celular())),
        loja.vendedor.post('/vendas', fechar(p, celular())),
      ]);
      expect([x.statusCode, y.statusCode].sort()).toEqual([201, 409]);
      const recusada = x.statusCode === 409 ? x : y;
      expect(recusada.json()).toMatchObject({ erro: 'estoque_insuficiente' });
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(0);
    });

    // ADR 009 (opção A): a trava de venda_sequencia vale até o COMMIT; por isso o número é alocado por último,
    // depois do estoque, dos pagamentos e do Financeiro, para encurtar o tempo em que as vendas da empresa esperam.
    it('aloca o número da venda por último: depois dele não há mais baixa de estoque, item, pagamento nem lançamento', async () => {
      const loja = await montar('Vendas número por último');
      const p = await peca(loja);
      const ctx = { empresaId: loja.dados.empresaId, autorId: loja.dados.donoId, perfil: 'dono' as const, agora: relogio.agora };
      const c = await pool.connect();
      const sql: string[] = [];
      try {
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE ailow_app');
        await c.query("SELECT set_config('app.empresa_id', $1, true)", [loja.dados.empresaId]);
        const original = c.query.bind(c) as (...args: unknown[]) => Promise<unknown>;
        (c as unknown as { query: unknown }).query = (...args: unknown[]) => {
          const primeiro = args[0];
          sql.push(typeof primeiro === 'string' ? primeiro : (primeiro as { text: string }).text);
          return original(...args);
        };
        await finalizarVenda(c, ctx, fechar(p, celular()) as Parameters<typeof finalizarVenda>[2]);
        await c.query('ROLLBACK');
      } finally {
        c.release();
      }
      const aloca = sql.findIndex((s) => s.includes('venda_sequencia'));
      expect(aloca).toBeGreaterThan(-1);
      const gravacoes = /INSERT INTO (itens_venda|pagamentos_venda|movimentos_estoque|lancamentos)|UPDATE skus/;
      expect(sql.slice(aloca + 1).filter((s) => gravacoes.test(s))).toEqual([]);
      expect(sql.slice(0, aloca).filter((s) => gravacoes.test(s)).length).toBeGreaterThan(0);
      // A trava dura até o COMMIT: o comando que aloca o número é o último; a resposta já foi montada antes dele.
      expect(sql.slice(aloca + 1).filter((s) => !/^\s*(COMMIT|ROLLBACK)\s*$/.test(s))).toEqual([]);
    });

    it('oito vendas ao mesmo tempo na mesma loja recebem os números 1 a 8, sem repetir e sem buraco', async () => {
      const loja = await montar('Vendas oito juntas');
      const pecas = await Promise.all(Array.from({ length: 8 }, () => peca(loja)));
      const respostas = await Promise.all(
        pecas.map((p, i) => (i % 2 ? loja.vendedor : loja.dono).post('/vendas', fechar(p, celular()))),
      );
      expect(respostas.map((r) => r.statusCode)).toEqual(Array(8).fill(201));
      const numeros = respostas.map((r) => (r.json() as { numero: number }).numero).sort((x, y) => x - y);
      expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('venda recusada não gasta número: a próxima venda da loja continua na sequência', async () => {
      const loja = await montar('Vendas recusada sem buraco');
      const sem = await peca(loja, 0);
      const ok = await peca(loja);
      expect(((await loja.dono.post('/vendas', fechar(ok, celular()))).json() as { numero: number }).numero).toBe(1);
      const recusada = await loja.dono.post('/vendas', fechar(sem, celular()));
      expect(recusada.statusCode).toBe(409);
      const outra = await peca(loja);
      expect(((await loja.dono.post('/vendas', fechar(outra, celular()))).json() as { numero: number }).numero).toBe(2);
    });

    it('o texto "Venda N" continua aparecendo no histórico do SKU e no extrato, mesmo sem o número gravado no texto', async () => {
      const loja = await montar('Vendas texto composto');
      const p = await peca(loja);
      const venda = await loja.dono.post('/vendas', fechar(p, celular()));
      const { numero } = venda.json() as { numero: number };
      const movs = await loja.dono.get(`/skus/${p.skuId}/movimentos`);
      const motivos = (movs.json() as { movimentos: { tipo: string; motivo: string }[] }).movimentos.filter((m) => m.tipo === 'venda');
      expect(motivos.map((m) => m.motivo)).toEqual([`Venda ${numero}`]);
      const extrato = await loja.dono.get(`/financeiro/extrato?data=${DIA}`);
      const descricoes = (extrato.json() as { lancamentos: { descricao: string | null; origem_id: string }[] }).lancamentos
        .filter((l) => l.origem_id === (venda.json() as { id: string }).id)
        .map((l) => l.descricao);
      expect(descricoes).toEqual([`Venda ${numero}`]);
    });

    it('dois cancelamentos da mesma venda: um vale, o outro é recusado e o estoque volta uma vez só', async () => {
      const loja = await montar('Vendas cancela junto');
      const p = await peca(loja);
      const venda = await loja.dono.post('/vendas', fechar(p, celular()));
      const { id } = venda.json() as { id: string };
      const [x, y] = await Promise.all([
        loja.dono.post(`/vendas/${id}/cancelar`, { motivo: 'Primeiro balcão' }),
        loja.dono.post(`/vendas/${id}/cancelar`, { motivo: 'Segundo balcão' }),
      ]);
      expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409]);
      expect((await estoqueDe(loja, p.codigo)).json.estoque).toBe(5);
    });

    it('o mesmo celular novo em duas vendas abertas juntas: a 2ª diz "já cadastrado" e não grava nada', async () => {
      const loja = await montar('Vendas celular junto');
      const tel = celular();
      const p1 = await peca(loja);
      const p2 = await peca(loja);
      const ctx = { empresaId: loja.dados.empresaId, autorId: loja.dados.donoId, perfil: 'dono' as const, agora: relogio.agora };
      const abrir = async () => {
        const c = await pool.connect();
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE ailow_app');
        await c.query("SELECT set_config('app.empresa_id', $1, true)", [loja.dados.empresaId]);
        const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
        return { c, pid };
      };
      const pedido = (peca: Peca) => fechar(peca, tel) as Parameters<typeof finalizarVenda>[2];

      const um = await abrir();
      const dois = await abrir();
      try {
        await finalizarVenda(um.c, ctx, pedido(p1));
        // A 2ª já passou da busca do celular (ainda não existia) e espera o índice único da 1ª.
        const segunda = finalizarVenda(dois.c, ctx, pedido(p2)).then(
          () => null,
          (err: unknown) => err,
        );
        for (let i = 0; i < 100; i++) {
          const esperando = await owner.query("SELECT 1 FROM pg_stat_activity WHERE pid = $1 AND wait_event_type = 'Lock'", [dois.pid]);
          if (esperando.rowCount) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        await um.c.query('COMMIT');
        const erro = await segunda;
        expect(erro).toBeInstanceOf(ErroVenda);
        expect((erro as ErroVenda).codigo).toBe('cliente_ja_cadastrado');
      } finally {
        await dois.c.query('ROLLBACK').catch(() => {});
        await um.c.query('ROLLBACK').catch(() => {});
        um.c.release();
        dois.c.release();
      }
      expect((await estoqueDe(loja, p2.codigo)).json.estoque).toBe(5);
    });
  });
});
