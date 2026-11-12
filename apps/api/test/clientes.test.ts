import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
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

// S09 / RF-CLI-01…04, D8, RN-10. Cada empresa vê só o que é seu; Dono e Vendedor cadastram e consultam, só o Dono
// anonimiza. Só afirmamos sobre ids/nomes criados aqui (L-0008): os arquivos de teste rodam em paralelo no mesmo Postgres.
interface ClienteResp {
  id: string;
  nome: string;
  celular: string | null;
  aviso_lgpd_em: string | null;
  anonimizado_em: string | null;
  criado_em: string;
}

describe('Clientes (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

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

  let seq = 0;
  // Celulares únicos dentro do processo; cada empresa de teste é nova, então não colidem entre arquivos.
  const celularNovo = (): string => `219${String(20_000_000 + ++seq).padStart(8, '0')}`;
  const nomeNovo = (base = 'Cliente') => `${base} ${randomUUID().slice(0, 8)}`;

  async function criar(cli: Cliente, extra: Record<string, unknown> = {}): Promise<ClienteResp> {
    const res = await cli.post('/clientes', { nome: nomeNovo(), celular: celularNovo(), ...extra });
    if (res.statusCode !== 201) throw new Error(`criar cliente falhou: ${res.statusCode} ${res.body}`);
    const { id } = res.json() as { id: string };
    const ficha = await cli.get(`/clientes/${id}`);
    return ficha.json() as ClienteResp;
  }
  const listar = async (cli: Cliente, q?: string) => {
    const res = await cli.get(`/clientes${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`);
    return { status: res.statusCode, json: res.json() as { clientes: ClienteResp[]; truncado: boolean } };
  };
  const eventos = async (alvo: string) =>
    (await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1 ORDER BY id', [alvo])).rows.map((r) => r.tipo as string);

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 12);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Cli API A');
    b = await montar('Cli API B');
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('cadastro mínimo (RF-CLI-01)', () => {
    it.each(['dono', 'vendedor'] as const)('o %s cadastra nome + celular e a ficha volta só com dígitos', async (quem) => {
      const cli = a[quem];
      const nome = nomeNovo('Ana');
      const n = celularNovo();
      const res = await cli.post('/clientes', { nome: `  ${nome} `, celular: `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` });
      expect(res.statusCode).toBe(201);
      const { id } = res.json() as { id: string };
      const ficha = (await cli.get(`/clientes/${id}`)).json() as ClienteResp;
      expect(ficha).toMatchObject({ id, nome, celular: n, aviso_lgpd_em: null, anonimizado_em: null });
      // a empresa nunca sai no corpo (vem da sessão)
      expect(JSON.stringify(ficha)).not.toContain(a.dados.empresaId);
    });

    it('registra a auditoria sem guardar nome nem celular', async () => {
      const c = await criar(a.dono);
      expect(await eventos(c.id)).toEqual(['cliente_criado']);
    });

    it('recusa celular repetido na mesma empresa, mesmo digitado com outra máscara', async () => {
      const numero = celularNovo();
      await a.dono.post('/clientes', { nome: nomeNovo(), celular: numero });
      const outra = await a.vendedor.post('/clientes', { nome: nomeNovo(), celular: `(${numero.slice(0, 2)}) ${numero.slice(2, 7)}-${numero.slice(7)}` });
      expect(outra.statusCode).toBe(409);
      expect(outra.json()).toEqual({ erro: 'celular_ja_cadastrado' });
    });

    it('a outra empresa pode cadastrar o mesmo celular', async () => {
      const numero = celularNovo();
      expect((await a.dono.post('/clientes', { nome: nomeNovo(), celular: numero })).statusCode).toBe(201);
      expect((await b.dono.post('/clientes', { nome: nomeNovo(), celular: numero })).statusCode).toBe(201);
    });

    it.each([
      ['celular curto', { nome: 'Ana', celular: '123' }],
      ['fixo', { nome: 'Ana', celular: '1132345678' }],
      ['nome em branco', { nome: '   ', celular: '21920000009' }],
      ['sem celular', { nome: 'Ana' }],
      ['empresa_id no corpo', { nome: 'Ana', celular: '21920000009', empresa_id: randomUUID() }],
    ])('recusa %s com 400', async (_n, corpo) => {
      const res = await a.dono.post('/clientes', corpo);
      expect(res.statusCode).toBe(400);
    });

    it('sem sessão responde 401', async () => {
      const res = await new Cliente(app).post('/clientes', { nome: 'Ana', celular: celularNovo() });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('aviso de finalidade (RF-CLI-04, LGPD)', () => {
    it('grava a data do aviso quando o cadastro diz que avisou', async () => {
      const c = await criar(a.dono, { aviso_lgpd: true });
      expect(c.aviso_lgpd_em).toBe(relogio.agora.toISOString());
    });

    it('sem o aviso a data fica vazia e dá para registrar depois (Dono e Vendedor)', async () => {
      const c = await criar(a.vendedor);
      expect(c.aviso_lgpd_em).toBeNull();
      const res = await a.vendedor.post(`/clientes/${c.id}/aviso-lgpd`);
      expect(res.statusCode).toBe(200);
      expect((res.json() as ClienteResp).aviso_lgpd_em).toBe(relogio.agora.toISOString());
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_aviso_lgpd']);
    });

    it('registrar de novo mantém a data do primeiro aviso (evidência)', async () => {
      const c = await criar(a.dono);
      const primeira = (await a.dono.post(`/clientes/${c.id}/aviso-lgpd`)).json() as ClienteResp;
      // Poucos segundos bastam para a data diferir; minutos derrubariam as sessões por inatividade.
      relogio.avancarSegundos(5);
      const segunda = (await a.dono.post(`/clientes/${c.id}/aviso-lgpd`)).json() as ClienteResp;
      expect(segunda.aviso_lgpd_em).toBe(primeira.aviso_lgpd_em);
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_aviso_lgpd']);
    });

    it('cliente de outra empresa dá 404', async () => {
      const deB = await criar(b.dono);
      expect((await a.dono.post(`/clientes/${deB.id}/aviso-lgpd`)).statusCode).toBe(404);
    });
  });

  describe('busca por celular ou nome (RF-CLI-02)', () => {
    let maria: ClienteResp;
    let mario: ClienteResp;
    let joao: ClienteResp;
    const marca = randomUUID().slice(0, 6);

    beforeAll(async () => {
      maria = await criar(a.dono, { nome: `Maria ${marca}` });
      mario = await criar(a.dono, { nome: `Mário% ${marca}`, celular: '21988880001' });
      joao = await criar(a.dono, { nome: `João ${marca}`, celular: '21988880002' });
    });

    const ids = (r: { clientes: ClienteResp[] }) => r.clientes.map((c) => c.id);

    it('sem busca lista os clientes da empresa, em ordem de nome (sem contar acento nem caixa)', async () => {
      const r = ids((await listar(a.dono)).json);
      expect(r).toEqual(expect.arrayContaining([maria.id, mario.id, joao.id]));
      // João < Maria < Mário%: "joao" vem antes de "maria ", que vem antes de "mario%"
      expect(r.indexOf(joao.id)).toBeLessThan(r.indexOf(maria.id));
      expect(r.indexOf(maria.id)).toBeLessThan(r.indexOf(mario.id));
    });

    it('acha por pedaço do nome, sem diferenciar maiúscula nem acento', async () => {
      expect(ids((await listar(a.vendedor, `mario% ${marca}`)).json)).toEqual([mario.id]);
      expect(ids((await listar(a.vendedor, `JOAO ${marca}`)).json)).toEqual([joao.id]);
    });

    it('acha pelo celular digitado com máscara ou só pelos últimos dígitos', async () => {
      expect(ids((await listar(a.dono, '(21) 98888-0002')).json)).toEqual([joao.id]);
      expect(ids((await listar(a.dono, '98888000')).json)).toEqual(expect.arrayContaining([mario.id, joao.id]));
      expect(ids((await listar(a.dono, '+55 21 98888-0001')).json)).toEqual([mario.id]);
    });

    it('% e _ valem como letras, não como curinga', async () => {
      const r = (await listar(a.dono, `% ${marca}`)).json;
      expect(ids(r)).toEqual([mario.id]);
    });

    it('a busca não vaza clientes da outra empresa', async () => {
      const deB = await criar(b.dono, { nome: `Maria ${marca}` });
      const r = (await listar(a.dono, `Maria ${marca}`)).json;
      expect(ids(r)).toEqual([maria.id]);
      expect(ids((await listar(b.dono, `Maria ${marca}`)).json)).toEqual([deB.id]);
    });

    it('busca com mais de 80 caracteres é recusada', async () => {
      expect((await listar(a.dono, 'a'.repeat(81))).status).toBe(400);
    });

    it('sem sessão responde 401', async () => {
      expect((await new Cliente(app).get('/clientes')).statusCode).toBe(401);
    });
  });

  describe('ficha (RF-CLI-02)', () => {
    it('devolve os dados do cliente; de outra empresa ou inexistente dá 404', async () => {
      const c = await criar(a.vendedor);
      const ok = await a.dono.get(`/clientes/${c.id}`);
      expect(ok.statusCode).toBe(200);
      const deB = await criar(b.dono);
      expect((await a.dono.get(`/clientes/${deB.id}`)).statusCode).toBe(404);
      expect((await a.dono.get(`/clientes/${randomUUID()}`)).statusCode).toBe(404);
    });

    it('id que não é UUID dá 400', async () => {
      expect((await a.dono.get('/clientes/nao-e-uuid')).statusCode).toBe(400);
    });
  });

  describe('excluir/anonimizar (RF-CLI-04)', () => {
    it('o Dono anonimiza: some o nome e o celular, a linha fica e a lista não mostra mais', async () => {
      const numero = celularNovo();
      const c = await criar(a.dono, { celular: numero, aviso_lgpd: true });
      const res = await a.dono.post(`/clientes/${c.id}/anonimizar`);
      expect(res.statusCode).toBe(200);
      const depois = res.json() as ClienteResp;
      expect(depois).toMatchObject({ id: c.id, nome: 'Cliente anonimizado', celular: null });
      expect(depois.anonimizado_em).toBe(relogio.agora.toISOString());
      expect(JSON.stringify(depois)).not.toContain(c.nome);
      expect(JSON.stringify(depois)).not.toContain(numero);
      // a ficha continua existindo (as vendas apontam para ela) mas não aparece na busca
      expect((await a.dono.get(`/clientes/${c.id}`)).statusCode).toBe(200);
      expect((await listar(a.dono, c.nome)).json.clientes).toEqual([]);
      expect((await listar(a.dono, numero)).json.clientes).toEqual([]);
      // buscar pelo nome antigo nunca acharia nada mesmo sem o filtro: a lista inteira e o nome novo é que provam
      expect((await listar(a.dono)).json.clientes.map((x) => x.id)).not.toContain(c.id);
      expect((await listar(a.dono, 'anonimizado')).json.clientes.map((x) => x.id)).not.toContain(c.id);
      expect(await eventos(c.id)).toContain('cliente_anonimizado');
    });

    it('anonimizar libera o celular para um novo cadastro', async () => {
      const numero = celularNovo();
      const c = await criar(a.dono, { celular: numero });
      await a.dono.post(`/clientes/${c.id}/anonimizar`);
      expect((await a.dono.post('/clientes', { nome: nomeNovo(), celular: numero })).statusCode).toBe(201);
    });

    it('os dados pessoais somem do banco, não só da resposta', async () => {
      const c = await criar(a.dono);
      await a.dono.post(`/clientes/${c.id}/anonimizar`);
      const r = await owner.query('SELECT nome, celular FROM clientes WHERE id = $1', [c.id]);
      expect(r.rows[0]).toEqual({ nome: 'Cliente anonimizado', celular: null });
    });

    it('anonimizar duas vezes dá 409 e não duplica a auditoria', async () => {
      const c = await criar(a.dono);
      expect((await a.dono.post(`/clientes/${c.id}/anonimizar`)).statusCode).toBe(200);
      const segunda = await a.dono.post(`/clientes/${c.id}/anonimizar`);
      expect(segunda.statusCode).toBe(409);
      expect(segunda.json()).toEqual({ erro: 'cliente_anonimizado' });
      expect((await eventos(c.id)).filter((t) => t === 'cliente_anonimizado')).toHaveLength(1);
    });

    it('registrar aviso num cliente anonimizado dá 409', async () => {
      const c = await criar(a.dono);
      await a.dono.post(`/clientes/${c.id}/anonimizar`);
      expect((await a.dono.post(`/clientes/${c.id}/aviso-lgpd`)).statusCode).toBe(409);
    });

    it('o Vendedor não anonimiza (403) e o cliente fica intacto', async () => {
      const c = await criar(a.dono);
      const res = await a.vendedor.post(`/clientes/${c.id}/anonimizar`);
      expect(res.statusCode).toBe(403);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).celular).toBe(c.celular);
    });

    it('o Dono de outra empresa não anonimiza (404) e o cliente fica intacto', async () => {
      const c = await criar(a.dono);
      expect((await b.dono.post(`/clientes/${c.id}/anonimizar`)).statusCode).toBe(404);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).celular).toBe(c.celular);
    });

    it('sem sessão responde 401', async () => {
      expect((await new Cliente(app).post(`/clientes/${randomUUID()}/anonimizar`)).statusCode).toBe(401);
    });
  });
});
