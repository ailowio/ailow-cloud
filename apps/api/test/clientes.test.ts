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

// S09/S09b / RF-CLI-01…05, D8, RN-10. Cada empresa vê só o que é seu; Dono e Vendedor cadastram, editam e consultam,
// só o Dono inativa, reativa e exclui. Só afirmamos sobre ids/nomes criados aqui (L-0008): os arquivos de teste
// rodam em paralelo no mesmo Postgres.
interface ClienteResp {
  id: string;
  nome: string;
  celular: string;
  aviso_lgpd_em: string | null;
  ativo: boolean;
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
  const comMascara = (n: string) => `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;

  async function criar(cli: Cliente, extra: Record<string, unknown> = {}): Promise<ClienteResp> {
    const res = await cli.post('/clientes', { nome: nomeNovo(), celular: celularNovo(), ...extra });
    if (res.statusCode !== 201) throw new Error(`criar cliente falhou: ${res.statusCode} ${res.body}`);
    const { id } = res.json() as { id: string };
    const ficha = await cli.get(`/clientes/${id}`);
    return ficha.json() as ClienteResp;
  }
  const listar = async (cli: Cliente, q?: string, situacao?: string) => {
    const params = [q === undefined ? '' : `q=${encodeURIComponent(q)}`, situacao === undefined ? '' : `situacao=${situacao}`].filter(Boolean);
    const res = await cli.get(`/clientes${params.length ? `?${params.join('&')}` : ''}`);
    return { status: res.statusCode, json: res.json() as { clientes: ClienteResp[]; truncado: boolean } };
  };
  const ids = (r: { clientes: ClienteResp[] }) => r.clientes.map((c) => c.id);
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
      const res = await cli.post('/clientes', { nome: `  ${nome} `, celular: comMascara(n) });
      expect(res.statusCode).toBe(201);
      const { id } = res.json() as { id: string };
      const ficha = (await cli.get(`/clientes/${id}`)).json() as ClienteResp;
      expect(ficha).toMatchObject({ id, nome, celular: n, aviso_lgpd_em: null, ativo: true });
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
      const outra = await a.vendedor.post('/clientes', { nome: nomeNovo(), celular: comMascara(numero) });
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

    it('a resposta de validação não repete o celular nem o nome enviados', async () => {
      const res = await a.dono.post('/clientes', { nome: 'Fulana Sigilosa', celular: '(21) 9-ABCD-0001' });
      expect(res.statusCode).toBe(400);
      expect(res.body).not.toContain('Fulana Sigilosa');
      expect(res.body).not.toContain('ABCD');
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

    it('situação desconhecida é recusada', async () => {
      expect((await listar(a.dono, undefined, 'todos')).status).toBe(400);
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

  describe('editar nome e celular (RF-CLI-05)', () => {
    it.each(['dono', 'vendedor'] as const)('o %s corrige nome e celular; a ficha e a busca mostram o novo', async (quem) => {
      const c = await criar(a.dono, { aviso_lgpd: true });
      const novoNome = nomeNovo('Corrigida');
      const novoNumero = celularNovo();
      const res = await a[quem].put(`/clientes/${c.id}`, { nome: `  ${novoNome} `, celular: comMascara(novoNumero) });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: c.id, nome: novoNome, celular: novoNumero, ativo: true, aviso_lgpd_em: c.aviso_lgpd_em });
      expect(ids((await listar(a.dono, novoNumero)).json)).toEqual([c.id]);
      expect(ids((await listar(a.dono, c.celular)).json)).toEqual([]);
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_editado']);
    });

    it('salvar sem mudar nada responde 200 e não gera auditoria nova', async () => {
      const c = await criar(a.dono);
      const res = await a.dono.put(`/clientes/${c.id}`, { nome: c.nome, celular: comMascara(c.celular) });
      expect(res.statusCode).toBe(200);
      expect(await eventos(c.id)).toEqual(['cliente_criado']);
    });

    it('trocar só o nome mantém o próprio celular (não conta como repetido)', async () => {
      const c = await criar(a.dono);
      const res = await a.dono.put(`/clientes/${c.id}`, { nome: nomeNovo('So nome'), celular: c.celular });
      expect(res.statusCode).toBe(200);
    });

    it('celular de outro cliente da empresa dá 409 e nada muda', async () => {
      const outro = await criar(a.dono);
      const c = await criar(a.dono);
      const res = await a.dono.put(`/clientes/${c.id}`, { nome: 'Nome Novo', celular: outro.celular });
      expect(res.statusCode).toBe(409);
      expect(res.json()).toEqual({ erro: 'celular_ja_cadastrado' });
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp)).toMatchObject({ nome: c.nome, celular: c.celular });
    });

    it('celular de cliente INATIVO também conta como repetido (o número continua reservado)', async () => {
      const inativo = await criar(a.dono);
      await a.dono.post(`/clientes/${inativo.id}/inativar`);
      const c = await criar(a.dono);
      expect((await a.dono.put(`/clientes/${c.id}`, { nome: c.nome, celular: inativo.celular })).statusCode).toBe(409);
    });

    it.each([
      ['sem nome', { nome: ' ', celular: '21920000009' }],
      ['celular inválido', { nome: 'Ana', celular: '123' }],
      ['sem celular', { nome: 'Ana' }],
      ['aviso_lgpd no corpo', { nome: 'Ana', celular: '21920000009', aviso_lgpd: true }],
      ['empresa_id no corpo', { nome: 'Ana', celular: '21920000009', empresa_id: randomUUID() }],
    ])('recusa %s com 400', async (_n, corpo) => {
      const c = await criar(a.dono);
      expect((await a.dono.put(`/clientes/${c.id}`, corpo)).statusCode).toBe(400);
    });

    it('cliente de outra empresa ou inexistente dá 404 e o da outra empresa fica intacto', async () => {
      const deB = await criar(b.dono);
      expect((await a.dono.put(`/clientes/${deB.id}`, { nome: 'Invasor', celular: celularNovo() })).statusCode).toBe(404);
      expect((await a.dono.put(`/clientes/${randomUUID()}`, { nome: 'Ana', celular: celularNovo() })).statusCode).toBe(404);
      expect(((await b.dono.get(`/clientes/${deB.id}`)).json() as ClienteResp).nome).toBe(deB.nome);
    });

    it('sem sessão responde 401', async () => {
      expect((await new Cliente(app).put(`/clientes/${randomUUID()}`, { nome: 'Ana', celular: celularNovo() })).statusCode).toBe(401);
    });
  });

  describe('inativar e reativar (RF-CLI-04)', () => {
    it('o Dono inativa: some da lista padrão, aparece em Inativos e a ficha continua abrindo', async () => {
      const c = await criar(a.dono);
      const res = await a.dono.post(`/clientes/${c.id}/inativar`);
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: c.id, nome: c.nome, celular: c.celular, ativo: false });
      expect(ids((await listar(a.dono)).json)).not.toContain(c.id);
      expect(ids((await listar(a.dono, c.nome)).json)).toEqual([]);
      expect(ids((await listar(a.dono, c.nome, 'inativos')).json)).toEqual([c.id]);
      expect(ids((await listar(a.dono, undefined, 'inativos')).json)).toContain(c.id);
      expect(((await a.vendedor.get(`/clientes/${c.id}`)).json() as ClienteResp).ativo).toBe(false);
    });

    it('o número de um inativo continua reservado (novo cadastro dá 409)', async () => {
      const c = await criar(a.dono);
      await a.dono.post(`/clientes/${c.id}/inativar`);
      const res = await a.vendedor.post('/clientes', { nome: nomeNovo(), celular: c.celular });
      expect(res.statusCode).toBe(409);
    });

    it('reativar traz de volta para a lista padrão', async () => {
      const c = await criar(a.dono);
      await a.dono.post(`/clientes/${c.id}/inativar`);
      const res = await a.dono.post(`/clientes/${c.id}/reativar`);
      expect(res.statusCode).toBe(200);
      expect((res.json() as ClienteResp).ativo).toBe(true);
      expect(ids((await listar(a.dono, c.nome)).json)).toEqual([c.id]);
      expect(ids((await listar(a.dono, c.nome, 'inativos')).json)).toEqual([]);
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_inativado', 'cliente_reativado']);
    });

    it('inativar quem já está inativo e reativar quem está ativo dão 409, sem auditoria repetida', async () => {
      const c = await criar(a.dono);
      expect((await a.dono.post(`/clientes/${c.id}/reativar`)).json()).toEqual({ erro: 'cliente_ja_ativo' });
      await a.dono.post(`/clientes/${c.id}/inativar`);
      const de_novo = await a.dono.post(`/clientes/${c.id}/inativar`);
      expect(de_novo.statusCode).toBe(409);
      expect(de_novo.json()).toEqual({ erro: 'cliente_ja_inativo' });
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_inativado']);
    });

    it('o Vendedor não inativa nem reativa (403) e não lista os inativos (403)', async () => {
      const c = await criar(a.dono);
      expect((await a.vendedor.post(`/clientes/${c.id}/inativar`)).statusCode).toBe(403);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).ativo).toBe(true);
      await a.dono.post(`/clientes/${c.id}/inativar`);
      expect((await a.vendedor.post(`/clientes/${c.id}/reativar`)).statusCode).toBe(403);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).ativo).toBe(false);
      expect((await listar(a.vendedor, undefined, 'inativos')).status).toBe(403);
    });

    it('o Dono de outra empresa não inativa nem reativa (404)', async () => {
      const c = await criar(a.dono);
      expect((await b.dono.post(`/clientes/${c.id}/inativar`)).statusCode).toBe(404);
      expect((await b.dono.post(`/clientes/${c.id}/reativar`)).statusCode).toBe(404);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).ativo).toBe(true);
    });

    it('sem sessão responde 401', async () => {
      expect((await new Cliente(app).post(`/clientes/${randomUUID()}/inativar`)).statusCode).toBe(401);
      expect((await new Cliente(app).post(`/clientes/${randomUUID()}/reativar`)).statusCode).toBe(401);
    });
  });

  describe('excluir (RF-CLI-04)', () => {
    it('o Dono exclui: a linha sai do banco, a ficha dá 404 e o número fica livre', async () => {
      const c = await criar(a.dono, { aviso_lgpd: true });
      const res = await a.dono.delete(`/clientes/${c.id}`);
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');
      expect((await a.dono.get(`/clientes/${c.id}`)).statusCode).toBe(404);
      expect(ids((await listar(a.dono, c.nome)).json)).toEqual([]);
      expect(ids((await listar(a.dono, c.nome, 'inativos')).json)).toEqual([]);
      expect((await owner.query('SELECT 1 FROM clientes WHERE id = $1', [c.id])).rowCount).toBe(0);
      expect((await a.dono.post('/clientes', { nome: nomeNovo(), celular: c.celular })).statusCode).toBe(201);
    });

    it('registra a exclusão na auditoria só com o id', async () => {
      const c = await criar(a.dono);
      await a.dono.delete(`/clientes/${c.id}`);
      expect(await eventos(c.id)).toEqual(['cliente_criado', 'cliente_excluido']);
    });

    it('também exclui um cliente inativo', async () => {
      const c = await criar(a.dono);
      await a.dono.post(`/clientes/${c.id}/inativar`);
      expect((await a.dono.delete(`/clientes/${c.id}`)).statusCode).toBe(204);
    });

    it('excluir de novo dá 404', async () => {
      const c = await criar(a.dono);
      await a.dono.delete(`/clientes/${c.id}`);
      expect((await a.dono.delete(`/clientes/${c.id}`)).statusCode).toBe(404);
    });

    it('o Vendedor não exclui (403) e o cliente fica intacto', async () => {
      const c = await criar(a.dono);
      expect((await a.vendedor.delete(`/clientes/${c.id}`)).statusCode).toBe(403);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).celular).toBe(c.celular);
    });

    it('o Dono de outra empresa não exclui (404) e o cliente fica intacto', async () => {
      const c = await criar(a.dono);
      expect((await b.dono.delete(`/clientes/${c.id}`)).statusCode).toBe(404);
      expect(((await a.dono.get(`/clientes/${c.id}`)).json() as ClienteResp).celular).toBe(c.celular);
    });

    it('id que não é UUID dá 400 e sem sessão dá 401', async () => {
      expect((await a.dono.delete('/clientes/nao-e-uuid')).statusCode).toBe(400);
      expect((await new Cliente(app).delete(`/clientes/${randomUUID()}`)).statusCode).toBe(401);
    });
  });
});
