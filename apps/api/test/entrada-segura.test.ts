import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import { type Cliente, Relogio, adminPool, appDeTeste, loginAdmin, prepararEmpresa, semearAdmin } from './helpers.js';

// S13a: caractere nulo (U+0000) na entrada é 400 em qualquer rota, nunca 500 (o Postgres não guarda NUL em texto).
describe('entrada com caractere nulo', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let dono: Cliente;
  const esperado = { erro: 'requisicao_invalida', mensagem: 'texto com caractere nulo (U+0000) não é aceito' };

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 4);
    owner = adminPool();
    app = await appDeTeste(pool, new Relogio());
    const adm = await loginAdmin(app, new Relogio(), await semearAdmin(pool));
    dono = (await prepararEmpresa(app, adm, 'Entrada Segura')).dono;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  it('query com %00 dá 400 (GET /produtos?q=)', async () => {
    const res = await dono.get('/produtos?q=a%00b');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual(esperado);
  });

  it('corpo com \\u0000 no valor ou no nome do campo dá 400 (POST /categorias)', async () => {
    const valor = await dono.post('/categorias', { nome: 'Sut\u0000iã', atributos: [], tipo: 'produto' });
    expect(valor.statusCode).toBe(400);
    expect(valor.json()).toEqual(esperado);
    const campo = await dono.post('/categorias', { nome: 'Ok', atributos: [], ['x\u0000']: 1 });
    expect(campo.statusCode).toBe(400);
  });

  it('texto normal com acento e emoji continua valendo', async () => {
    const res = await dono.post('/categorias', { nome: 'Sutiã 😀', atributos: [], tipo: 'produto' });
    expect(res.statusCode).toBe(201);
  });
});
