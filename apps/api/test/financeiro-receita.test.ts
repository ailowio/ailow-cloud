import { randomUUID } from 'node:crypto';
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

// ADR 015 (aceito em 2026-11-16): receita manual + contas a receber. A receita é ENTRADA, sem origem_id, com
// descrição e categoria financeira; nasce recebida ou em aberto. A baixa usa a mesma rota da conta a pagar.
// Mesmo relógio do financeiro.test.ts: 01:30 UTC de 12/11 ainda é 11/11 em São Paulo. Só ids/nomes daqui (L-0008).
const HOJE = '2026-11-11';
const AGORA = new Date('2026-11-12T01:30:00.000Z');

interface Conta {
  id: string;
  tipo: string;
  origem_tipo: string;
  origem_id: string | null;
  descricao: string | null;
  categoria: string | null;
  valor_centavos: number;
  vencimento: string;
  situacao: string;
  status: string;
  forma_pagamento: string | null;
}

describe('Receita manual e contas a receber (ADR 015)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio(AGORA);

  interface Lado {
    dados: EmpresaDeTeste;
    dono: Cliente;
    vendedor: Cliente;
  }
  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor };
  }

  const receita = (extra: Record<string, unknown> = {}) => ({
    descricao: `Sinal de encomenda ${randomUUID().slice(0, 8)}`,
    categoria: 'Outros',
    valor_centavos: 25_000,
    vencimento: '2026-11-20',
    forma_pagamento: null,
    paga: false,
    ...extra,
  });
  async function criarReceita(cli: Cliente, extra: Record<string, unknown> = {}): Promise<string> {
    const res = await cli.post('/financeiro/receitas', receita(extra));
    if (res.statusCode !== 201) throw new Error(`criar receita falhou: ${res.statusCode} ${res.body}`);
    return (res.json() as { id: string }).id;
  }
  const aReceber = async (cli: Cliente) =>
    (await cli.get('/financeiro/contas-a-receber')).json() as { hoje: string; contas: Conta[] };
  const aPagar = async (cli: Cliente) => (await cli.get('/financeiro/contas-a-pagar')).json() as { contas: Conta[] };
  const extrato = async (cli: Cliente) =>
    (await cli.get(`/financeiro/extrato?data=${HOJE}`)).json() as { lancamentos: Conta[] };
  const relatorio = async (cli: Cliente) =>
    (await cli.get(`/financeiro/relatorio?periodo=dia&data=${HOJE}`)).json() as {
      entradas_centavos: number;
      saidas_centavos: number;
      saldo_centavos: number;
    };

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Fin Receita A');
    b = await montar('Fin Receita B');
    relogio.agora = AGORA;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('autorização (RN-10): 2 empresas × 2 perfis', () => {
    const rotas: [string, 'GET' | 'POST', string, unknown][] = [
      ['nova receita', 'POST', '/financeiro/receitas', receita()],
      ['contas a receber', 'GET', '/financeiro/contas-a-receber', undefined],
    ];
    it.each(rotas)('sem sessão: %s devolve 401', async (_n, metodo, url, corpo) => {
      expect((await new Cliente(app).req(metodo, url, corpo)).statusCode).toBe(401);
    });
    it.each(rotas)('Vendedor nunca acessa: %s devolve 403', async (_n, metodo, url, corpo) => {
      expect((await a.vendedor.req(metodo, url, corpo)).statusCode).toBe(403);
    });

    it('o 403 do Vendedor não cria receita', async () => {
      const marca = `Vendedor tentou ${randomUUID()}`;
      expect((await a.vendedor.post('/financeiro/receitas', receita({ descricao: marca }))).statusCode).toBe(403);
      expect((await aReceber(a.dono)).contas.map((c) => c.descricao)).not.toContain(marca);
    });

    it('uma empresa não vê nem recebe a receita da outra; empresa_id no corpo é ignorado', async () => {
      const idB = await criarReceita(b.dono);
      expect((await aReceber(a.dono)).contas.map((c) => c.id)).not.toContain(idB);
      expect((await a.dono.post(`/financeiro/lancamentos/${idB}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(404);
      expect((await aReceber(b.dono)).contas.find((c) => c.id === idB)?.status).toBe('aberto');

      const marca = `Com empresa_id ${randomUUID()}`;
      const res = await a.dono.post('/financeiro/receitas', { ...receita({ descricao: marca }), empresa_id: b.dados.empresaId });
      expect(res.statusCode).toBe(201);
      expect((await aReceber(a.dono)).contas.map((c) => c.descricao)).toContain(marca);
      expect((await aReceber(b.dono)).contas.map((c) => c.descricao)).not.toContain(marca);
    });
  });

  describe('nova receita', () => {
    it('em aberto: vira conta a RECEBER (entrada, origem receita, sem origem_id) e não aparece nas contas a pagar', async () => {
      const id = await criarReceita(a.dono, { valor_centavos: 12_345, vencimento: '2026-11-25' });
      const conta = (await aReceber(a.dono)).contas.find((c) => c.id === id);
      expect(conta).toMatchObject({
        tipo: 'entrada',
        origem_tipo: 'receita',
        origem_id: null,
        categoria: 'Outros',
        valor_centavos: 12_345,
        vencimento: '2026-11-25',
        status: 'aberto',
        situacao: 'depois',
      });
      expect((await aPagar(a.dono)).contas.map((c) => c.id)).not.toContain(id);
    });

    it('já recebida: entra no extrato e nas entradas do relatório de hoje, com a forma, e não fica a receber', async () => {
      const antes = await relatorio(a.dono);
      const id = await criarReceita(a.dono, { paga: true, forma_pagamento: 'dinheiro', valor_centavos: 7_000, vencimento: HOJE });
      expect((await aReceber(a.dono)).contas.map((c) => c.id)).not.toContain(id);
      expect((await extrato(a.dono)).lancamentos.find((l) => l.id === id)).toMatchObject({
        tipo: 'entrada',
        status: 'pago',
        forma_pagamento: 'dinheiro',
      });
      const depois = await relatorio(a.dono);
      expect(depois.entradas_centavos - antes.entradas_centavos).toBe(7_000);
      expect(depois.saidas_centavos - antes.saidas_centavos).toBe(0);
    });

    it('já recebida sem forma de pagamento: 400 e nada é criado', async () => {
      const marca = `Sem forma ${randomUUID()}`;
      expect((await a.dono.post('/financeiro/receitas', receita({ descricao: marca, paga: true }))).statusCode).toBe(400);
      const r = await owner.query('SELECT count(*)::int AS n FROM lancamentos WHERE descricao = $1', [marca]);
      expect(r.rows[0].n).toBe(0);
    });

    it('valor zero, negativo, quebrado ou acima do teto: 400', async () => {
      for (const valor_centavos of [0, -1, 10.5, 2_000_000_001]) {
        expect((await a.dono.post('/financeiro/receitas', receita({ valor_centavos }))).statusCode, String(valor_centavos)).toBe(400);
      }
    });

    it('descrição em branco ou data inexistente (29/02 fora de bissexto): 400', async () => {
      expect((await a.dono.post('/financeiro/receitas', receita({ descricao: '   ' }))).statusCode).toBe(400);
      expect((await a.dono.post('/financeiro/receitas', receita({ vencimento: '2026-02-29' }))).statusCode).toBe(400);
    });

    it('categoria inexistente, de produto ou de outra empresa: 400 categoria_invalida', async () => {
      const inexistente = await a.dono.post('/financeiro/receitas', receita({ categoria: `Nao existe ${randomUUID()}` }));
      expect(inexistente.statusCode).toBe(400);
      expect(inexistente.json()).toEqual({ erro: 'categoria_invalida' });

      const nomeB = `So da B ${randomUUID().slice(0, 8)}`;
      expect((await b.dono.post('/categorias', { nome: nomeB, atributos: [], tipo: 'financeira' })).statusCode).toBe(201);
      expect((await a.dono.post('/financeiro/receitas', receita({ categoria: nomeB }))).statusCode).toBe(400);
    });

    it('registra a criação na trilha de auditoria (AUD-10)', async () => {
      const id = await criarReceita(a.dono);
      const r = await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1', [id]);
      expect(r.rows.map((x) => x.tipo)).toContain('receita_criada');
    });
  });

  describe('contas a receber', () => {
    it('classifica vencida, hoje, próximos 7 dias e depois, com "hoje" em São Paulo', async () => {
      const vencida = await criarReceita(a.dono, { vencimento: '2026-11-10' });
      const hoje = await criarReceita(a.dono, { vencimento: HOJE });
      const semana = await criarReceita(a.dono, { vencimento: '2026-11-18' });
      const depois = await criarReceita(a.dono, { vencimento: '2026-11-19' });
      const r = await aReceber(a.dono);
      expect(r.hoje).toBe(HOJE);
      const sit = (id: string) => r.contas.find((c) => c.id === id)?.situacao;
      expect([sit(vencida), sit(hoje), sit(semana), sit(depois)]).toEqual(['vencida', 'hoje', 'proximos_7_dias', 'depois']);
      // Ordem por vencimento: as mais antigas primeiro.
      const ordem = r.contas.map((c) => c.id).filter((id) => [vencida, hoje, semana, depois].includes(id));
      expect(ordem).toEqual([vencida, hoje, semana, depois]);
    });

    it('uma venda paga e uma despesa em aberto NÃO são contas a receber', async () => {
      const empresaId = a.dados.empresaId;
      const { id: vendaId } = await withEmpresa(pool, empresaId, (c) =>
        registrarLancamento(c, { empresaId, autorId: a.dados.donoId, agora: AGORA }, {
          tipo: 'entrada',
          origem_tipo: 'venda',
          origem_id: randomUUID(),
          descricao: null,
          categoria: null,
          valor_centavos: 1_000,
          forma_pagamento: 'pix',
          vencimento: HOJE,
          paga: true,
        }),
      );
      const despesa = await a.dono.post('/financeiro/despesas', {
        descricao: 'Luz',
        categoria: 'Luz',
        valor_centavos: 9_900,
        vencimento: '2026-11-20',
        forma_pagamento: null,
        paga: false,
      });
      const ids = (await aReceber(a.dono)).contas.map((c) => c.id);
      expect(ids).not.toContain(vendaId);
      expect(ids).not.toContain((despesa.json() as { id: string }).id);
    });

    it('receber: a baixa usa a forma escolhida, tira da lista e soma nas entradas do dia; 2ª baixa é 409', async () => {
      const id = await criarReceita(a.dono, { valor_centavos: 4_321 });
      const antes = await relatorio(a.dono);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(204);
      expect((await aReceber(a.dono)).contas.map((c) => c.id)).not.toContain(id);
      expect((await relatorio(a.dono)).entradas_centavos - antes.entradas_centavos).toBe(4_321);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/pagar`, { forma_pagamento: 'pix' })).statusCode).toBe(409);
    });

    it('estornar uma receita recebida lança a SAÍDA de mesmo valor; o saldo do dia volta ao que era', async () => {
      const antes = await relatorio(a.dono);
      const id = await criarReceita(a.dono, { paga: true, forma_pagamento: 'credito', valor_centavos: 3_000, vencimento: HOJE });
      const est = await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'lançada em dobro' });
      expect(est.statusCode).toBe(201);
      const depois = await relatorio(a.dono);
      expect(depois.saldo_centavos).toBe(antes.saldo_centavos);
      const r = await owner.query('SELECT tipo, origem_tipo FROM lancamentos WHERE id = $1', [(est.json() as { id: string }).id]);
      expect(r.rows[0]).toEqual({ tipo: 'saida', origem_tipo: 'estorno' });
    });

    it('cancelar uma receita em aberto (estorno) a tira das contas a receber sem mexer no caixa', async () => {
      const id = await criarReceita(a.dono);
      const antes = await relatorio(a.dono);
      expect((await a.dono.post(`/financeiro/lancamentos/${id}/estornar`, { motivo: 'cliente desistiu' })).statusCode).toBe(201);
      expect((await aReceber(a.dono)).contas.map((c) => c.id)).not.toContain(id);
      expect(await relatorio(a.dono)).toEqual(antes);
    });
  });

  describe('banco: as regras da receita valem mesmo fora da API (CHECKs da migração)', () => {
    async function inserir(campos: { tipo: string; origem_id: string | null; descricao: string | null }) {
      return withEmpresa(pool, a.dados.empresaId, (c) =>
        c.query(
          `INSERT INTO lancamentos (empresa_id, tipo, origem_tipo, origem_id, descricao, valor_centavos, vencimento, status, criado_por)
           VALUES ($1, $2, 'receita', $3, $4, 100, $5, 'aberto', $6)`,
          [a.dados.empresaId, campos.tipo, campos.origem_id, campos.descricao, HOJE, a.dados.donoId],
        ),
      );
    }
    it('receita de SAÍDA é recusada', async () => {
      await expect(inserir({ tipo: 'saida', origem_id: null, descricao: 'x' })).rejects.toThrow(/lancamentos_receita_entrada_check/);
    });
    it('receita com origem_id é recusada', async () => {
      await expect(inserir({ tipo: 'entrada', origem_id: randomUUID(), descricao: 'x' })).rejects.toThrow(/lancamentos_sem_origem_id_check/);
    });
    it('receita sem descrição é recusada', async () => {
      await expect(inserir({ tipo: 'entrada', origem_id: null, descricao: null })).rejects.toThrow(/lancamentos_receita_descricao_check/);
    });
    it('despesa continua sem origem_id e venda continua exigindo origem_id', async () => {
      const ins = (origem: string, origemId: string | null, tipo: string) =>
        withEmpresa(pool, a.dados.empresaId, (c) =>
          c.query(
            `INSERT INTO lancamentos (empresa_id, tipo, origem_tipo, origem_id, descricao, valor_centavos, vencimento, status, criado_por)
             VALUES ($1, $2, $3, $4, 'x', 100, $5, 'aberto', $6)`,
            [a.dados.empresaId, tipo, origem, origemId, HOJE, a.dados.donoId],
          ),
        );
      await expect(ins('despesa', randomUUID(), 'saida')).rejects.toThrow(/lancamentos_sem_origem_id_check/);
      await expect(ins('venda', null, 'entrada')).rejects.toThrow(/lancamentos_sem_origem_id_check/);
    });
  });

  describe('interface pública (registrarLancamento)', () => {
    it('recusa receita de saída e receita com origem_id antes de chegar ao banco', async () => {
      const empresaId = a.dados.empresaId;
      const base = {
        origem_tipo: 'receita' as const,
        descricao: 'Aporte',
        categoria: 'Outros',
        valor_centavos: 100,
        forma_pagamento: null,
        vencimento: HOJE,
        paga: false,
      };
      const ctx = { empresaId, autorId: a.dados.donoId, agora: AGORA };
      await expect(
        withEmpresa(pool, empresaId, (c) => registrarLancamento(c, ctx, { ...base, tipo: 'saida', origem_id: null })),
      ).rejects.toThrow();
      await expect(
        withEmpresa(pool, empresaId, (c) => registrarLancamento(c, ctx, { ...base, tipo: 'entrada', origem_id: randomUUID() })),
      ).rejects.toThrow();
    });
  });
});
