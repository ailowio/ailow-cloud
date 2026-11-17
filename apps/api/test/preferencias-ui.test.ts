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

describe('Preferências UI (ADR 018)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

  interface Lado {
    empresa: EmpresaDeTeste;
    dono: Cliente;
    vendedor: Cliente;
  }

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN falhou: ${r.statusCode}`);
    return { empresa: p.empresa, dono: p.dono, vendedor };
  }

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar(`Pref A ${randomUUID().slice(0, 6)}`);
    b = await montar(`Pref B ${randomUUID().slice(0, 6)}`);
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  it('sem sessão: 401', async () => {
    expect((await new Cliente(app).get('/preferencias-ui')).statusCode).toBe(401);
    expect((await new Cliente(app).put('/preferencias-ui', { chave: 'modulos_ordem', valor: ['vendas'] })).statusCode).toBe(
      401,
    );
  });

  it('GET vazio; PUT grava e GET devolve; UPSERT substitui', async () => {
    const vazio = await a.vendedor.get('/preferencias-ui');
    expect(vazio.statusCode).toBe(200);
    expect(vazio.json()).toEqual({});

    const ordem = ['pessoas', 'clientes', 'vendas', 'produtos'] as const;
    const put = await a.vendedor.put('/preferencias-ui', { chave: 'modulos_ordem', valor: [...ordem] });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ modulos_ordem: [...ordem] });

    const lido = await a.vendedor.get('/preferencias-ui');
    expect(lido.json()).toEqual({ modulos_ordem: [...ordem] });

    const outra = ['vendas', 'produtos'] as const;
    expect((await a.vendedor.put('/preferencias-ui', { chave: 'modulos_ordem', valor: [...outra] })).json()).toEqual({
      modulos_ordem: [...outra],
    });
    expect((await a.vendedor.get('/preferencias-ui')).json()).toEqual({ modulos_ordem: [...outra] });
  });

  it('Dono e Vendedor da mesma empresa não compartilham a ordem', async () => {
    await a.dono.put('/preferencias-ui', { chave: 'modulos_ordem', valor: ['configuracoes', 'vendas'] });
    await a.vendedor.put('/preferencias-ui', { chave: 'modulos_ordem', valor: ['clientes'] });
    expect((await a.dono.get('/preferencias-ui')).json()).toEqual({ modulos_ordem: ['configuracoes', 'vendas'] });
    expect((await a.vendedor.get('/preferencias-ui')).json()).toEqual({ modulos_ordem: ['clientes'] });
  });

  it('empresa A não lê nem sobrescreve preferências da B', async () => {
    await b.dono.put('/preferencias-ui', { chave: 'modulos_ordem', valor: ['financeiro', 'vendas'] });
    expect((await a.dono.get('/preferencias-ui')).json()).not.toEqual({ modulos_ordem: ['financeiro', 'vendas'] });
    const linhasB = await owner.query(
      `SELECT valor FROM preferencias_ui WHERE empresa_id = $1 AND chave = 'modulos_ordem'`,
      [b.empresa.empresaId],
    );
    expect(linhasB.rows.some((r) => JSON.stringify(r.valor).includes('financeiro'))).toBe(true);
  });
});
