import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TEST_PEPPER, TEST_TOTP_CHAVE } from './helpers.js';

// S13b (RNF-03, OBS-*): métricas RED por rota TEMPLATE. Sem token configurado a rota nem existe (404).
const TOKEN = 'token-de-teste-com-16+-caracteres';
const UUID = '0b0b0b0b-1111-4222-8333-444444444444';

describe('GET /metrics', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;
  let semToken: FastifyInstance;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 2 });
    app = await buildApp({ pool, logger: false, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE, metricsToken: TOKEN });
    semToken = await buildApp({ pool, logger: false, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE });
    await Promise.all([app.ready(), semToken.ready()]);
  });

  afterAll(async () => {
    await app.close();
    await semToken.close();
    await pool.end();
  });

  const metricas = async (token: string | null = TOKEN) =>
    app.inject({ method: 'GET', url: '/metrics', headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('sem METRICS_TOKEN configurado a rota não existe (404)', async () => {
    const res = await semToken.inject({ method: 'GET', url: '/metrics', headers: { authorization: `Bearer ${TOKEN}` } });
    expect(res.statusCode).toBe(404);
  });

  it('exige Bearer correto (401 sem credencial ou com token errado) e não aceita cookie', async () => {
    expect((await metricas(null)).statusCode).toBe(401);
    expect((await metricas('outro-token-com-16+-caracteres')).statusCode).toBe(401);
    expect((await metricas('curto')).statusCode).toBe(401);
    const res = await app.inject({ method: 'GET', url: '/metrics', headers: { cookie: `sessao=${TOKEN}` } });
    expect(res.statusCode).toBe(401);
  });

  it('com o token, responde 200 em texto Prometheus', async () => {
    const res = await metricas();
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.body).toContain('# TYPE http_requests_total counter');
    expect(res.body).toContain('# TYPE http_request_duration_seconds histogram');
  });

  it('conta por rota TEMPLATE, método e classe de status (cardinalidade limitada, sem PII na etiqueta)', async () => {
    await app.inject({ method: 'GET', url: '/health' });
    // Sem sessão: 401. A URL tem um uuid e uma query com dado pessoal: nada disso pode virar etiqueta.
    await app.inject({ method: 'GET', url: `/clientes/${UUID}?celular=11912345678` });
    await app.inject({ method: 'GET', url: '/clientes/00000000-0000-4000-8000-000000000001' });
    const corpo = (await metricas()).body;
    expect(corpo).toMatch(/http_requests_total\{method="GET",route="\/health",status_class="2xx"\} [1-9]/);
    expect(corpo).toMatch(/http_requests_total\{method="GET",route="\/clientes\/:id",status_class="4xx"\} 2\b/);
    expect(corpo).not.toContain(UUID);
    expect(corpo).not.toContain('11912345678');
    expect(corpo).toMatch(/http_request_duration_seconds_bucket\{le="0\.5",method="GET",route="\/health",status_class="2xx"\} [1-9]/);
  });

  it('URL inexistente vira a rota fixa "desconhecida" (não cria série nova por URL)', async () => {
    await app.inject({ method: 'GET', url: '/nao-existe-abc123' });
    const corpo = (await metricas()).body;
    expect(corpo).toMatch(/route="desconhecida",status_class="4xx"/);
    expect(corpo).not.toContain('nao-existe-abc123');
  });

  it('o próprio /metrics não entra na contagem e fica fora do OpenAPI', async () => {
    await metricas();
    expect((await metricas()).body).not.toContain('route="/metrics"');
    const doc = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).not.toContain('/metrics');
  });

  it('a falha do SLI aparece como 5xx (503 do health sem banco)', async () => {
    const semBanco = new pg.Pool({ connectionString: 'postgresql://x:y@127.0.0.1:1/z', connectionTimeoutMillis: 300 });
    const app2 = await buildApp({ pool: semBanco, logger: false, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE, metricsToken: TOKEN });
    try {
      expect((await app2.inject({ method: 'GET', url: '/health' })).statusCode).toBe(503);
      const corpo = (await app2.inject({ method: 'GET', url: '/metrics', headers: { authorization: `Bearer ${TOKEN}` } })).body;
      expect(corpo).toMatch(/http_requests_total\{method="GET",route="\/health",status_class="5xx"\} 1\b/);
    } finally {
      await app2.close();
      await semBanco.end();
    }
  });
});
