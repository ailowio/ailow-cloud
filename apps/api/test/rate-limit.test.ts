import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { TEST_PEPPER, TEST_TOTP_CHAVE } from './helpers.js';

// Threat model #3 (SEC-07): sem limite, quem adivinha senha só paga o custo do argon2. O limite vale por IP nas
// rotas que conferem senha; o resto da API não é afetado.
const ENTRAR = { email: 'ninguem@ailow.test', senha: 'senha-qualquer-bem-longa' };
const ADMIN = { ...ENTRAR, codigo: '123456' };

describe('rate limit das rotas de senha', () => {
  let pool: pg.Pool;
  const apps: FastifyInstance[] = [];

  beforeAll(() => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
  });
  afterAll(async () => {
    await Promise.all(apps.map((a) => a.close()));
    await pool.end();
  });

  async function novoApp(extra: Partial<Parameters<typeof buildApp>[0]> = {}) {
    const app = await buildApp({
      pool,
      authPepper: TEST_PEPPER,
      totpChave: TEST_TOTP_CHAVE,
      limiteLogin: { max: 3, janelaMs: 60_000 },
      ...extra,
    });
    await app.ready();
    apps.push(app);
    return app;
  }
  const entrar = (app: FastifyInstance, headers: Record<string, string> = {}) =>
    app.inject({ method: 'POST', url: '/acesso/entrar', payload: ENTRAR, headers });

  it('/acesso/entrar: dentro do limite responde 401; passando dele responde 429 com Retry-After', async () => {
    const app = await novoApp();
    for (let i = 0; i < 3; i++) expect((await entrar(app)).statusCode).toBe(401);
    const bloqueada = await entrar(app);
    expect(bloqueada.statusCode).toBe(429);
    expect(bloqueada.json()).toEqual({ erro: 'muitas_tentativas' });
    expect(Number(bloqueada.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('/admin/login tem o mesmo limite', async () => {
    const app = await novoApp();
    const tentar = () => app.inject({ method: 'POST', url: '/admin/login', payload: ADMIN });
    for (let i = 0; i < 3; i++) expect((await tentar()).statusCode).toBe(401);
    expect((await tentar()).statusCode).toBe(429);
  });

  it('o limite não atinge as outras rotas (saúde segue respondendo)', async () => {
    const app = await novoApp();
    for (let i = 0; i < 3; i++) await entrar(app);
    expect((await entrar(app)).statusCode).toBe(429);
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });

  it('a janela reinicia: depois do tempo, volta a aceitar tentativas', async () => {
    const app = await novoApp({ limiteLogin: { max: 1, janelaMs: 300 } });
    expect((await entrar(app)).statusCode).toBe(401);
    expect((await entrar(app)).statusCode).toBe(429);
    await new Promise((r) => setTimeout(r, 450));
    expect((await entrar(app)).statusCode).toBe(401);
  });

  it('sem proxy confiável, X-Forwarded-For forjado NÃO abre balde novo', async () => {
    const app = await novoApp();
    for (let i = 0; i < 3; i++) await entrar(app, { 'x-forwarded-for': `10.0.0.${i}` });
    expect((await entrar(app, { 'x-forwarded-for': '10.0.0.99' })).statusCode).toBe(429);
  });

  it('atrás de proxy confiável (Traefik), cada cliente real tem o seu balde e a entrada forjada à esquerda é ignorada', async () => {
    // O inject() chega do 127.0.0.1: é ele o "proxy" em que a API confia; o cliente real vem no X-Forwarded-For.
    const app = await novoApp({ trustProxy: '127.0.0.1' });
    const de = (ip: string, forjado = '6.6.6.6') => ({ 'x-forwarded-for': `${forjado}, ${ip}` });
    // Cliente A esgota o balde, mesmo trocando o valor forjado a cada tentativa.
    for (let i = 0; i < 3; i++) expect((await entrar(app, de('203.0.113.1', `7.7.7.${i}`))).statusCode).toBe(401);
    expect((await entrar(app, de('203.0.113.1', '8.8.8.8'))).statusCode).toBe(429);
    // Cliente B (outro IP real) não é afetado por A.
    expect((await entrar(app, de('203.0.113.2'))).statusCode).toBe(401);
  });
});
