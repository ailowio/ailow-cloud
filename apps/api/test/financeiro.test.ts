import { randomUUID } from 'node:crypto';
import type { LancamentoNovo } from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { registrarLancamento } from '../src/financeiro/lancamentos.js';
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

// S06 / RF-FIN-01…06, RN-01, RN-06, RN-10. Só o Dono acessa; cada empresa vê só o que é seu.
// Só afirma sobre ids/nomes criados aqui (L-0008). O relógio começa em 01:30 UTC de 12/11, que ainda é
// 22:30 de 11/11 em São Paulo: qualquer código que use a data UTC em vez do fuso do negócio erra "hoje".
const HOJE = '2026-11-11';
const AGORA = new Date('2026-11-12T01:30:00.000Z');

interface Conta {
  id: string;
  descricao: string | null;
  categoria: string | null;
  valor_centavos: number;
  vencimento: string;
  situacao: string;
  status: string;
}
interface Linha extends Omit<Conta, 'situacao'> {
  tipo: string;
  origem_tipo: string;
  origem_id: string | null;
  forma_pagamento: string | null;
  pago_em: string | null;
  estorno_de: string | null;
  estorno_motivo: string | null;
}
interface Relatorio {
  periodo: string;
  de: string;
  ate: string;
  entradas_centavos: number;
  saidas_centavos: number;
  saldo_centavos: number;
  por_forma: { forma_pagamento: string; entradas_centavos: number; saidas_centavos: number }[];
  por_categoria: { categoria: string; entradas_centavos: number; saidas_centavos: number }[];
}

describe('Financeiro (API, só Dono)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio(AGORA);

  interface Lado {
    dados: EmpresaDeTeste;
    dono: Cliente;
    vendedor: Cliente;
    vendedorId: string;
  }
  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor, vendedorId: p.vendedorId };
  }

  const despesa = (extra: Record<string, unknown> = {}) => ({
    descricao: 'Condomínio',
    categoria: 'Aluguel',
    valor_centavos: 150_000,
    vencimento: '2026-11-20',
    forma_pagamento: null,
    paga: false,
    ...extra,
  });
  async function criarDespesa(cli: Cliente, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await cli.post('/financeiro/despesas', despesa(extra));
    if (res.statusCode !== 201) throw new Error(`criar despesa falhou: ${res.statusCode} ${res.body}`);
    return (res.json() as { id: string }).id;
  }
  // Como Vendas vai fazer: pela interface pública, na transação do chamador, no instante `quando`.
  async function venda(lado: Lado, extra: Partial<LancamentoNovo> = {}, quando = AGORA): Promise<string> {
    const l: LancamentoNovo = {
      tipo: 'entrada',
      origem_tipo: 'venda',
      origem_id: randomUUID(),
      descricao: null,
      categoria: 'Sutiã',
      valor_centavos: 10_000,
      forma_pagamento: 'pix',
      vencimento: HOJE,
      paga: true,
      ...extra,
    };
    const empresaId = lado.dados.empresaId;
    const { id } = await withEmpresa(pool, empresaId, (c) =>
      registrarLancamento(c, { empresaId, autorId: lado.dados.donoId, agora: quando }, l),
    );
    return id;
  }
  const contas = async (cli: Cliente) => ((await cli.get('/financeiro/contas-a-pagar')).json() as { hoje: string; contas: Conta[] });
  const extrato = async (cli: Cliente, data = HOJE) =>
    (await cli.get(`/financeiro/extrato?data=${data}`)).json() as { data: string; lancamentos: Linha[] };
  const relatorio = async (cli: Cliente, periodo: 'dia' | 'mes', data?: string) =>
    (await cli.get(`/financeiro/relatorio?periodo=${periodo}${data ? `&data=${data}` : ''}`)).json() as Relatorio;
  const eventos = async (alvo: string) =>
    (await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1 ORDER BY id', [alvo])).rows.map((r) => r.tipo as string);

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    // loginAdmin avança o relógio (anti-replay do TOTP): volta ao instante do teste, ainda dentro da validade das sessões.
    a = await montar('Fin API A');
    b = await montar('Fin API B');
    relogio.agora = AGORA;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('autorização (RN-10, TEST-17): 2 empresas × 2 perfis', () => {
    const rotas: [string, 'GET' | 'POST', string, unknown][] = [
      ['nova despesa', 'POST', '/financeiro/despesas', despesa()],
      ['contas a pagar', 'GET', '/financeiro/contas-a-pagar', undefined],
      ['extrato', 'GET', `/financeiro/extrato?data=${HOJE}`, undefined],
      ['relatório', 'GET', '/financeiro/relatorio?periodo=dia', undefined],
      ['pagar', 'POST', `/financeiro/lancamentos/${randomUUID()}/pagar`, { forma_pagamento: 'pix' }],
      ['estornar', 'POST', `/financeiro/lancamentos/${randomUUID()}/estornar`, { motivo: 'engano' }],
      ['estornar venda', 'POST', `/financeiro/vendas/${randomUUID()}/estornar`, { motivo: 'engano' }],
    ];

    it.each(rotas)('sem sessão: %s devolve 401', async (_n, metodo, url, corpo) => {
      const anonimo = new Cliente(app);
      expect((await anonimo.req(metodo, url, corpo)).statusCode).toBe(401);
    });

    it.each(rotas)('Vendedor nunca acessa: %s devolve 403', async (_n, metodo, url, corpo) => {
      expect((await a.vendedor.req(metodo, url, corpo)).statusCode).toBe(403);
    });

    it('o 403 do Vendedor não tem efeito colateral: a despesa dele não é criada nem baixa conta do Dono', async () => {
      const marca = `Vendedor tentou ${randomUUID()}`;
      expect((await a.vendedor.post('/financeiro/despesas', despesa({ descricao: marca }))).statusCode).toBe(403);
      expect((await contas(a.dono)).contas.map((c) => c.descricao)).not.toContain(marca);

      const id = await criarDespesa(a.dono);
      expect((await a.vendedor.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(403);
      expect((await contas(a.dono)).contas.find((c) => c.id === id)?.status).toBe('aberto');
    });

    it('o Dono de uma empresa não vê, não baixa nem estorna lançamento da outra', async () => {
      const idB = await criarDespesa(b.dono, { descricao: `Só da B ${randomUUID()}` });
      const vendaB = await venda(b);

      expect((await contas(a.dono)).contas.map((c) => c.id)).not.toContain(idB);
      expect((await extrato(a.dono)).lancamentos.map((l) => l.id)).not.toContain(vendaB);

      const pagar = await a.dono.post(`/financeiro/lancamentos/${idB}/pagar`, { forma_pagamento: 'pix' });
      expect(pagar.statusCode).toBe(404);
      const estornar = await a.dono.post(`/financeiro/lancamentos/${vendaB}/estornar`, { motivo: 'invasão' });
      expect(estornar.statusCode).toBe(404);
      const origemB = (await owner.query('SELECT origem_id FROM lancamentos WHERE id = $1', [vendaB])).rows[0].origem_id as string;
      expect((await a.dono.post(`/financeiro/vendas/${origemB}/estornar`, { motivo: 'invasão' })).statusCode).toBe(404);

      // Nada mudou do lado da B.
      expect((await contas(b.dono)).contas.find((c) => c.id === idB)?.status).toBe('aberto');
      expect((await extrato(b.dono)).lancamentos.find((l) => l.id === vendaB)?.status).toBe('pago');
    });

    it('empresa_id no corpo é ignorado: a despesa vai para a empresa da sessão', async () => {
      const marca = `Com empresa_id ${randomUUID()}`;
      const res = await a.dono.post('/financeiro/despesas', { ...despesa({ descricao: marca }), empresa_id: b.dados.empresaId });
      expect(res.statusCode).toBe(201);
      expect((await contas(a.dono)).contas.map((c) => c.descricao)).toContain(marca);
      expect((await contas(b.dono)).contas.map((c) => c.descricao)).not.toContain(marca);
    });
  });

  describe('nova despesa (RF-FIN-02)', () => {
    it('em aberto: aparece nas contas a pagar, com valor em centavos inteiros', async () => {
      const id = await criarDespesa(a.dono, { descricao: 'Água', valor_centavos: 18_990, vencimento: '2026-11-25' });
      const conta = (await contas(a.dono)).contas.find((c) => c.id === id);
      expect(conta).toMatchObject({ descricao: 'Água', categoria: 'Aluguel', valor_centavos: 18_990, vencimento: '2026-11-25', status: 'aberto' });
    });

    it('já nasce paga: vai para o extrato de hoje, com a forma, e não fica nas contas a pagar', async () => {
      const id = await criarDespesa(a.dono, { descricao: 'Sacolas', paga: true, forma_pagamento: 'dinheiro', vencimento: HOJE });
      expect((await contas(a.dono)).contas.map((c) => c.id)).not.toContain(id);
      const linha = (await extrato(a.dono)).lancamentos.find((l) => l.id === id);
      expect(linha).toMatchObject({ status: 'pago', forma_pagamento: 'dinheiro', tipo: 'saida', origem_tipo: 'despesa', pago_em: AGORA.toISOString() });
    });

    it.each([
      ['valor zero', { valor_centavos: 0 }],
      ['valor negativo', { valor_centavos: -500 }],
      ['valor com centavos quebrados', { valor_centavos: 10.5 }],
      ['valor em texto', { valor_centavos: '100' }],
      ['valor acima do teto', { valor_centavos: 2_000_000_001 }],
      ['29/02 em ano não bissexto', { vencimento: '2026-02-29' }],
      ['data no formato brasileiro', { vencimento: '20/11/2026' }],
      ['descrição vazia', { descricao: '   ' }],
      ['categoria vazia', { categoria: '' }],
      ['paga sem forma de pagamento', { paga: true, forma_pagamento: null }],
      ['forma de pagamento inventada', { forma_pagamento: 'cheque' }],
      ['boleto (fora do v1)', { paga: true, forma_pagamento: 'boleto' }],
    ])('recusa %s com 400 e não grava', async (_nome, parte) => {
      const marca = `Inválida ${randomUUID()}`;
      const res = await a.dono.post('/financeiro/despesas', despesa({ descricao: marca, ...parte }));
      expect(res.statusCode).toBe(400);
      expect((await contas(a.dono)).contas.map((c) => c.descricao)).not.toContain(marca);
    });

    describe('categoria financeira da despesa', () => {
      const nova = async (lado: Lado, nome: string, tipo: 'produto' | 'financeira') => {
        const res = await lado.dono.post('/categorias', { nome, atributos: [], tipo });
        expect(res.statusCode).toBe(201);
        return (res.json() as { id: string }).id;
      };
      const recusada = async (lado: Lado, categoria: string) => {
        const marca = `Categoria inválida ${randomUUID()}`;
        const res = await lado.dono.post('/financeiro/despesas', despesa({ descricao: marca, categoria }));
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ erro: 'categoria_invalida' });
        expect((await contas(lado.dono)).contas.map((c) => c.descricao)).not.toContain(marca);
      };

      it('empresa nova já tem as categorias financeiras padrão para escolher', async () => {
        const id = await criarDespesa(a.dono, { categoria: 'Luz' });
        expect((await contas(a.dono)).contas.find((c) => c.id === id)?.categoria).toBe('Luz');
      });

      it('categoria que não existe é recusada com categoria_invalida', async () => {
        await recusada(a, `Inventada ${randomUUID().slice(0, 8)}`);
      });

      it('categoria de PRODUTO não vale como categoria financeira, mesmo com o mesmo nome', async () => {
        const nome = `Só de produto ${randomUUID().slice(0, 8)}`;
        await nova(a, nome, 'produto');
        await recusada(a, nome);
      });

      it('categoria financeira desativada não vale mais para despesa nova', async () => {
        const nome = `Desativada ${randomUUID().slice(0, 8)}`;
        const id = await nova(a, nome, 'financeira');
        expect((await a.dono.post('/financeiro/despesas', despesa({ categoria: nome }))).statusCode).toBe(201);
        expect((await a.dono.put(`/categorias/${id}`, { nome, atributos: [], ativa: false })).statusCode).toBe(204);
        await recusada(a, nome);
      });

      it('categoria financeira de outra empresa não vale', async () => {
        const nome = `Só da B ${randomUUID().slice(0, 8)}`;
        await nova(b, nome, 'financeira');
        await recusada(a, nome);
      });

      it('sem diferenciar maiúsculas, e grava o nome como o Dono o cadastrou ("aluguel" vira "Aluguel")', async () => {
        const id = await criarDespesa(a.dono, { categoria: '  aLuGuEl ' });
        expect((await contas(a.dono)).contas.find((c) => c.id === id)?.categoria).toBe('Aluguel');
      });

      it('renomear a categoria não reescreve o histórico: o lançamento guarda o nome da época', async () => {
        const nome = `Antes ${randomUUID().slice(0, 8)}`;
        const cat = await nova(a, nome, 'financeira');
        const id = await criarDespesa(a.dono, { categoria: nome });
        const novoNome = `Depois ${randomUUID().slice(0, 8)}`;
        expect((await a.dono.put(`/categorias/${cat}`, { nome: novoNome, atributos: [], ativa: true })).statusCode).toBe(204);
        expect((await contas(a.dono)).contas.find((c) => c.id === id)?.categoria).toBe(nome);
      });
    });

    it('registra quem criou e a ação na trilha de auditoria (AUD-10)', async () => {
      const id = await criarDespesa(a.dono);
      const r = await owner.query('SELECT criado_por FROM lancamentos WHERE id = $1', [id]);
      expect(r.rows[0].criado_por).toBe(a.dados.donoId);
      expect(await eventos(id)).toEqual(['despesa_criada']);
    });
  });

  describe('contas a pagar (RF-FIN-03)', () => {
    it('classifica vencida, hoje, próximos 7 dias e depois, usando "hoje" em São Paulo (não em UTC)', async () => {
      const ontem = await criarDespesa(a.dono, { vencimento: '2026-11-10' });
      const hoje = await criarDespesa(a.dono, { vencimento: '2026-11-11' });
      const em7 = await criarDespesa(a.dono, { vencimento: '2026-11-18' });
      const em8 = await criarDespesa(a.dono, { vencimento: '2026-11-19' });
      const r = await contas(a.dono);
      expect(r.hoje).toBe(HOJE);
      const por = (id: string) => r.contas.find((c) => c.id === id)?.situacao;
      expect(por(ontem)).toBe('vencida');
      expect(por(hoje)).toBe('hoje');
      expect(por(em7)).toBe('proximos_7_dias');
      expect(por(em8)).toBe('depois');
    });

    it('lista por vencimento, as mais antigas primeiro', async () => {
      const x = await criarDespesa(a.dono, { vencimento: '2026-12-30' });
      const y = await criarDespesa(a.dono, { vencimento: '2026-12-05' });
      const ids = (await contas(a.dono)).contas.map((c) => c.id);
      expect(ids.indexOf(y)).toBeLessThan(ids.indexOf(x));
      const datas = (await contas(a.dono)).contas.map((c) => c.vencimento);
      expect(datas).toEqual([...datas].sort());
    });

    it('não lista contas pagas nem estornadas', async () => {
      const paga = await criarDespesa(a.dono);
      const estornada = await criarDespesa(a.dono);
      await a.dono.post(`/financeiro/lancamentos/${paga}/pagar`, { forma_pagamento: 'pix' });
      await a.dono.post(`/financeiro/lancamentos/${estornada}/estornar`, { motivo: 'lançada por engano' });
      const ids = (await contas(a.dono)).contas.map((c) => c.id);
      expect(ids).not.toContain(paga);
      expect(ids).not.toContain(estornada);
    });
  });

  describe('marcar como pago (RF-FIN-03)', () => {
    it('baixa a conta com a forma escolhida, hoje, e deixa rastro', async () => {
      const id = await criarDespesa(a.dono);
      const res = await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'credito' });
      expect(res.statusCode).toBe(204);
      const linha = (await extrato(a.dono)).lancamentos.find((l) => l.id === id);
      expect(linha).toMatchObject({ status: 'pago', forma_pagamento: 'credito', pago_em: AGORA.toISOString() });
      expect(await eventos(id)).toEqual(['despesa_criada', 'lancamento_pago']);
      const r = await owner.query('SELECT pago_por FROM lancamentos WHERE id = $1', [id]);
      expect(r.rows[0].pago_por).toBe(a.dados.donoId);
    });

    it('toque duplo: a segunda baixa recebe 409 ja_pago e nada muda', async () => {
      const id = await criarDespesa(a.dono);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(204);
      const segunda = await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'dinheiro' });
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json()).toEqual({ erro: 'ja_pago' });
      expect((await extrato(a.dono)).lancamentos.find((l) => l.id === id)?.forma_pagamento).toBe('pix');
    });

    it.each([
      ['sem forma de pagamento', {}],
      ['forma inventada', { forma_pagamento: 'cheque' }],
      ['boleto (fora do v1)', { forma_pagamento: 'boleto' }],
    ])('recusa %s com 400 e a conta segue em aberto', async (_n, corpo) => {
      const id = await criarDespesa(a.dono);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, corpo)).statusCode).toBe(400);
      expect((await contas(a.dono)).contas.find((c) => c.id === id)?.status).toBe('aberto');
    });

    it('conta inexistente é 404; conta estornada é 409', async () => {
      expect((await a.dono.post(`/financeiro/lancamentos/${randomUUID()}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(404);
      const id = await criarDespesa(a.dono);
      await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'engano' });
      const res = await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'pix' });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ erro: 'lancamento_estornado' });
    });

    it('id que não é UUID é 400', async () => {
      expect((await a.dono.post('/financeiro/lancamentos/abc/pagar', { forma_pagamento: 'pix' })).statusCode).toBe(400);
    });
  });

  describe('estorno (RF-FIN-04, RN-06)', () => {
    it('estorna uma venda paga: cria o inverso ligado ao original, com motivo, e nada é apagado', async () => {
      const id = await venda(a, { valor_centavos: 25_000, forma_pagamento: 'credito' });
      const res = await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'Cliente devolveu' });
      expect(res.statusCode).toBe(201);
      const idEstorno = (res.json() as { id: string }).id;

      const linhas = (await extrato(a.dono)).lancamentos;
      expect(linhas.find((l) => l.id === id)).toMatchObject({ status: 'estornado', valor_centavos: 25_000, tipo: 'entrada' });
      expect(linhas.find((l) => l.id === idEstorno)).toMatchObject({
        tipo: 'saida',
        origem_tipo: 'estorno',
        origem_id: id,
        estorno_de: id,
        estorno_motivo: 'Cliente devolveu',
        valor_centavos: 25_000,
        forma_pagamento: 'credito',
        status: 'pago',
      });
      expect(await eventos(id)).toEqual(['lancamento_estornado']);
    });

    it('segundo estorno do mesmo lançamento é 409 ja_estornado; estorno de estorno é 409 e_estorno', async () => {
      const id = await venda(a);
      const primeiro = await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'primeiro' });
      const idEstorno = (primeiro.json() as { id: string }).id;
      const segundo = await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'segundo' });
      expect(segundo.statusCode).toBe(409);
      expect(segundo.json()).toEqual({ erro: 'ja_estornado' });
      const desfazer = await a.dono.post(`/financeiro/lancamentos/${idEstorno}/estornar`, { motivo: 'desfazer' });
      expect(desfazer.statusCode).toBe(409);
      expect(desfazer.json()).toEqual({ erro: 'e_estorno' });
    });

    it('toque duplo simultâneo gera um único estorno', async () => {
      const id = await venda(a);
      const [r1, r2] = await Promise.all([
        a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'toque 1' }),
        a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'toque 2' }),
      ]);
      expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
      const n = await owner.query('SELECT 1 FROM lancamentos WHERE estorno_de = $1', [id]);
      expect(n.rowCount).toBe(1);
    });

    it('cancelar conta em aberto: nada entra no caixa e ela some das contas a pagar', async () => {
      const id = await criarDespesa(a.dono, { valor_centavos: 77_700 });
      const res = await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'Lançada duas vezes' });
      expect(res.statusCode).toBe(201);
      expect((await contas(a.dono)).contas.map((c) => c.id)).not.toContain(id);
      const idEstorno = (res.json() as { id: string }).id;
      const linhas = (await extrato(a.dono)).lancamentos.map((l) => l.id);
      expect(linhas).not.toContain(id);
      expect(linhas).not.toContain(idEstorno);
    });

    it.each([
      ['sem motivo', {}],
      ['motivo vazio', { motivo: '   ' }],
      ['motivo curto demais', { motivo: 'ok' }],
    ])('recusa %s com 400 e o lançamento fica como estava', async (_n, corpo) => {
      const id = await venda(a);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, corpo)).statusCode).toBe(400);
      expect((await extrato(a.dono)).lancamentos.find((l) => l.id === id)?.status).toBe('pago');
    });

    it('lançamento inexistente é 404', async () => {
      expect((await a.dono.post(`/financeiro/lancamentos/${randomUUID()}/estornar`, { motivo: 'engano' })).statusCode).toBe(404);
    });
  });

  // RN-08 / RF-VEN-08: cancelar uma venda estorna todos os lançamentos dela de uma vez.
  describe('estorno de venda inteira (RN-08)', () => {
    async function vendaEmDuasFormas(lado: Lado): Promise<{ origem: string; pix: string; dinheiro: string }> {
      const origem = randomUUID();
      const pix = await venda(lado, { origem_id: origem, valor_centavos: 6_000, forma_pagamento: 'pix' });
      const dinheiro = await venda(lado, { origem_id: origem, valor_centavos: 2_990, forma_pagamento: 'dinheiro' });
      return { origem, pix, dinheiro };
    }

    it('estorna os dois pagamentos, devolve os ids dos estornos e deixa rastro da venda na trilha', async () => {
      const v = await vendaEmDuasFormas(a);
      const res = await a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'Cliente devolveu tudo' });
      expect(res.statusCode).toBe(201);
      const { ids } = res.json() as { ids: string[] };
      expect(ids).toHaveLength(2);

      const linhas = (await extrato(a.dono)).lancamentos;
      expect(linhas.find((l) => l.id === v.pix)?.status).toBe('estornado');
      expect(linhas.find((l) => l.id === v.dinheiro)?.status).toBe('estornado');
      const estornos = linhas.filter((l) => ids.includes(l.id));
      expect(estornos.map((e) => e.valor_centavos).sort((x, y) => x - y)).toEqual([2_990, 6_000]);
      for (const e of estornos) expect(e).toMatchObject({ tipo: 'saida', origem_tipo: 'estorno', estorno_motivo: 'Cliente devolveu tudo', status: 'pago' });
      expect(await eventos(v.origem)).toEqual(['venda_estornada']);
    });

    it('o relatório do dia volta ao que era antes da venda (entrou e saiu o mesmo valor)', async () => {
      const empresa = await montar('Fin API venda relatório');
      const v = await vendaEmDuasFormas(empresa);
      expect((await relatorio(empresa.dono, 'dia', HOJE)).entradas_centavos).toBe(8_990);
      await empresa.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'Troca por outro modelo' });
      const rel = await relatorio(empresa.dono, 'dia', HOJE);
      expect(rel).toMatchObject({ entradas_centavos: 8_990, saidas_centavos: 8_990, saldo_centavos: 0 });
    });

    it('segunda tentativa é 409 ja_estornado e não cria estorno extra', async () => {
      const v = await vendaEmDuasFormas(a);
      await a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'primeira' });
      const segunda = await a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'segunda' });
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json()).toEqual({ erro: 'ja_estornado' });
      const n = await owner.query('SELECT 1 FROM lancamentos WHERE estorno_de = ANY($1::uuid[])', [[v.pix, v.dinheiro]]);
      expect(n.rowCount).toBe(2);
    });

    it('toque duplo simultâneo: um 201 e um 409, só dois estornos no total', async () => {
      const v = await vendaEmDuasFormas(a);
      const [r1, r2] = await Promise.all([
        a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'toque 1' }),
        a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, { motivo: 'toque 2' }),
      ]);
      expect([r1.statusCode, r2.statusCode].sort()).toEqual([201, 409]);
      const n = await owner.query('SELECT 1 FROM lancamentos WHERE estorno_de = ANY($1::uuid[])', [[v.pix, v.dinheiro]]);
      expect(n.rowCount).toBe(2);
    });

    it('venda inexistente é 404; id que não é UUID é 400', async () => {
      expect((await a.dono.post(`/financeiro/vendas/${randomUUID()}/estornar`, { motivo: 'engano' })).statusCode).toBe(404);
      expect((await a.dono.post('/financeiro/vendas/abc/estornar', { motivo: 'engano' })).statusCode).toBe(400);
    });

    it.each([
      ['sem motivo', {}],
      ['motivo curto demais', { motivo: 'ok' }],
    ])('recusa %s com 400 e a venda fica como estava', async (_n, corpo) => {
      const v = await vendaEmDuasFormas(a);
      expect((await a.dono.post(`/financeiro/vendas/${v.origem}/estornar`, corpo)).statusCode).toBe(400);
      expect((await extrato(a.dono)).lancamentos.find((l) => l.id === v.pix)?.status).toBe('pago');
    });

    it('despesa e compra não são "venda": o id de uma despesa não estorna nada por esta rota', async () => {
      const id = await criarDespesa(a.dono);
      expect((await a.dono.post(`/financeiro/vendas/${id}/estornar`, { motivo: 'engano' })).statusCode).toBe(404);
      expect((await contas(a.dono)).contas.find((c) => c.id === id)?.status).toBe('aberto');
    });
  });

  describe('relatório do dia e do mês (RF-FIN-05)', () => {
    let r: Lado;

    beforeAll(async () => {
      r = await montar('Fin API Relatório');
      relogio.agora = AGORA;
      // Dia 11/11 (SP): 17.500 de entradas, 5.000 de saídas pagas.
      await venda(r, { valor_centavos: 10_000, forma_pagamento: 'pix', categoria: 'Sutiã' });
      await venda(r, { valor_centavos: 5_000, forma_pagamento: 'dinheiro', categoria: 'Sutiã' });
      await venda(r, { valor_centavos: 2_500, forma_pagamento: 'pix', categoria: 'Calcinha' });
      await criarDespesa(r.dono, { valor_centavos: 4_000, categoria: 'Aluguel', paga: true, forma_pagamento: 'dinheiro', vencimento: HOJE });
      await criarDespesa(r.dono, { valor_centavos: 1_000, categoria: 'aluguel', paga: true, forma_pagamento: 'pix', vencimento: HOJE });
      // Em aberto: ainda não saiu do caixa, não entra no relatório.
      await criarDespesa(r.dono, { valor_centavos: 99_999 });
      // 10/11 (SP) e 31/10 às 23:30 (SP), 30/11 às 23:59 (SP), 01/12 às 00:01 (SP).
      await venda(r, { valor_centavos: 300 }, new Date('2026-11-10T15:00:00.000Z'));
      await venda(r, { valor_centavos: 7_000 }, new Date('2026-11-01T02:30:00.000Z'));
      await venda(r, { valor_centavos: 800 }, new Date('2026-12-01T02:59:00.000Z'));
      await venda(r, { valor_centavos: 9_000 }, new Date('2026-12-01T03:01:00.000Z'));
      // Meia-noite exata de São Paulo (03:00 UTC): 01/11 00:00 abre novembro; 01/12 00:00 abre dezembro.
      await venda(r, { valor_centavos: 600 }, new Date('2026-11-01T03:00:00.000Z'));
      await venda(r, { valor_centavos: 4_000 }, new Date('2026-12-01T03:00:00.000Z'));
    });

    it('dia: totais de entradas, saídas e saldo, só do que foi pago naquele dia', async () => {
      const rel = await relatorio(r.dono, 'dia', HOJE);
      expect(rel).toMatchObject({ periodo: 'dia', de: HOJE, ate: HOJE, entradas_centavos: 17_500, saidas_centavos: 5_000, saldo_centavos: 12_500 });
    });

    it('sem informar a data, o dia é "hoje" em São Paulo (11/11), não a data UTC (12/11)', async () => {
      const rel = await relatorio(r.dono, 'dia');
      expect(rel.de).toBe(HOJE);
      expect(rel.entradas_centavos).toBe(17_500);
    });

    it('por forma de pagamento', async () => {
      const rel = await relatorio(r.dono, 'dia', HOJE);
      const f = Object.fromEntries(rel.por_forma.map((x) => [x.forma_pagamento, x]));
      expect(f.pix).toMatchObject({ entradas_centavos: 12_500, saidas_centavos: 1_000 });
      expect(f.dinheiro).toMatchObject({ entradas_centavos: 5_000, saidas_centavos: 4_000 });
      expect(rel.por_forma).toHaveLength(2);
    });

    it('por categoria, sem diferenciar maiúsculas ("Aluguel" = "aluguel")', async () => {
      const rel = await relatorio(r.dono, 'dia', HOJE);
      const c = rel.por_categoria;
      expect(c).toHaveLength(3);
      expect(c.find((x) => x.categoria.toLowerCase() === 'aluguel')).toMatchObject({ entradas_centavos: 0, saidas_centavos: 5_000 });
      expect(c.find((x) => x.categoria === 'Sutiã')).toMatchObject({ entradas_centavos: 15_000, saidas_centavos: 0 });
      expect(c.find((x) => x.categoria === 'Calcinha')).toMatchObject({ entradas_centavos: 2_500, saidas_centavos: 0 });
    });

    it('mês: de 01/11 a 30/11, respeitando a virada de mês no fuso de São Paulo', async () => {
      const rel = await relatorio(r.dono, 'mes', '2026-11-15');
      expect(rel).toMatchObject({ periodo: 'mes', de: '2026-11-01', ate: '2026-11-30' });
      // 17.500 (dia 11) + 300 (dia 10) + 800 (30/11 23:59) + 600 (01/11 00:00 exato).
      // Ficam de fora: 31/10 23:30 e 01/12 00:00 exato (4.000) e 00:01 (9.000).
      expect(rel.entradas_centavos).toBe(17_500 + 300 + 800 + 600);
      expect(rel.saidas_centavos).toBe(5_000);
    });

    it('mês de dezembro começa na meia-noite de São Paulo (03:00 UTC), com o instante exato incluído', async () => {
      const rel = await relatorio(r.dono, 'mes', '2026-12-31');
      expect(rel).toMatchObject({ de: '2026-12-01', ate: '2026-12-31', entradas_centavos: 4_000 + 9_000 });
    });

    it('mês de outubro pega a venda de 31/10 às 23:30 (SP), que em UTC já é novembro', async () => {
      const rel = await relatorio(r.dono, 'mes', '2026-10-20');
      expect(rel).toMatchObject({ de: '2026-10-01', ate: '2026-10-31', entradas_centavos: 7_000 });
    });

    it('fevereiro de ano bissexto termina no dia 29', async () => {
      expect(await relatorio(r.dono, 'mes', '2028-02-10')).toMatchObject({ de: '2028-02-01', ate: '2028-02-29' });
    });

    it('um dia sem movimento devolve zeros e listas vazias (nunca erro)', async () => {
      expect(await relatorio(r.dono, 'dia', '2026-01-05')).toEqual({
        periodo: 'dia',
        de: '2026-01-05',
        ate: '2026-01-05',
        entradas_centavos: 0,
        saidas_centavos: 0,
        saldo_centavos: 0,
        por_forma: [],
        por_categoria: [],
      });
    });

    it('o estorno entra no dia em que foi feito e o saldo reflete as duas pontas', async () => {
      const id = await venda(r, { valor_centavos: 1_234, forma_pagamento: 'debito', categoria: 'Meia' });
      const antes = await relatorio(r.dono, 'dia', HOJE);
      const res = await r.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'Troca' });
      expect(res.statusCode).toBe(201);
      const depois = await relatorio(r.dono, 'dia', HOJE);
      // A venda continua contada (entrou no caixa naquele dia) e o estorno sai na data do estorno.
      expect(depois.entradas_centavos).toBe(antes.entradas_centavos);
      expect(depois.saidas_centavos).toBe(antes.saidas_centavos + 1_234);
      expect(depois.saldo_centavos).toBe(antes.saldo_centavos - 1_234);
      expect(depois.por_forma.find((x) => x.forma_pagamento === 'debito')).toMatchObject({ entradas_centavos: 1_234, saidas_centavos: 1_234 });
    });

    it('não mistura empresas: a outra empresa não vê esses valores', async () => {
      const rel = await relatorio(b.dono, 'mes', '2026-10-20');
      expect(rel.entradas_centavos).toBe(0);
      expect(rel.por_forma).toEqual([]);
    });

    it('recusa período inválido e data inexistente com 400', async () => {
      expect((await r.dono.get('/financeiro/relatorio?periodo=ano')).statusCode).toBe(400);
      expect((await r.dono.get('/financeiro/relatorio')).statusCode).toBe(400);
      expect((await r.dono.get('/financeiro/relatorio?periodo=dia&data=2026-02-30')).statusCode).toBe(400);
    });
  });

  describe('extrato do dia', () => {
    it('lista, do mais recente para o mais antigo, o que movimentou o caixa naquele dia — e só ele', async () => {
      const e = await montar('Fin API Extrato');
      relogio.agora = AGORA;
      const primeiro = await venda(e, {}, new Date('2026-11-11T13:00:00.000Z'));
      const segundo = await venda(e, {}, new Date('2026-11-11T17:00:00.000Z'));
      const outroDia = await venda(e, {}, new Date('2026-11-10T17:00:00.000Z'));
      const aberta = await criarDespesa(e.dono);
      const ids = (await extrato(e.dono)).lancamentos.map((l) => l.id);
      expect(ids).toEqual([segundo, primeiro]);
      expect(ids).not.toContain(outroDia);
      expect(ids).not.toContain(aberta);
    });

    it('sem a data, usa hoje em São Paulo; data inexistente é 400', async () => {
      expect((await a.dono.get('/financeiro/extrato')).json()).toMatchObject({ data: HOJE });
      expect((await a.dono.get('/financeiro/extrato?data=2026-13-01')).statusCode).toBe(400);
    });
  });
});
