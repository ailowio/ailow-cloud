import { Writable } from 'node:stream';
import { healthResponseSchema } from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TEST_PEPPER, TEST_TOTP_CHAVE } from './helpers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function coletor() {
  const linhas: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      linhas.push(...chunk.toString().split('\n').filter(Boolean));
      cb();
    },
  });
  return { stream, registros: () => linhas.map((l) => JSON.parse(l) as Record<string, unknown>) };
}

describe('API', () => {
  const log = coletor();
  let pool: pg.Pool;
  let app: FastifyInstance;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_TEST, max: 2 });
    app = await buildApp({ pool, logger: { level: 'info', stream: log.stream }, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  describe('GET /health', () => {
    it('responde 200 com api e banco saudáveis, no contrato do pacote shared', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(healthResponseSchema.parse(res.json())).toEqual({ status: 'ok', db: 'ok' });
    });

    it('responde 503 degradado quando o banco está inacessível (sem derrubar a api)', async () => {
      const semBanco = new pg.Pool({
        connectionString: 'postgresql://x:y@127.0.0.1:1/z',
        connectionTimeoutMillis: 500,
      });
      const app2 = await buildApp({ pool: semBanco, logger: false, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE });
      try {
        const res = await app2.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(503);
        expect(res.json()).toEqual({ status: 'degraded', db: 'down' });
      } finally {
        await app2.close();
        await semBanco.end();
      }
    });
  });

  describe('request_id (OBS-01/02)', () => {
    it('gera um UUID quando o cliente não envia e devolve no cabeçalho', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.headers['x-request-id']).toMatch(UUID);
    });

    it('reaproveita um x-request-id válido do cliente', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': 'abc-123_XYZ.9' },
      });
      expect(res.headers['x-request-id']).toBe('abc-123_XYZ.9');
    });

    it('descarta x-request-id malicioso ou longo demais e gera um novo', async () => {
      for (const ruim of ['a'.repeat(200), 'com espaço', '<script>', 'a"b']) {
        const res = await app.inject({ method: 'GET', url: '/health', headers: { 'x-request-id': ruim } });
        expect(res.headers['x-request-id']).toMatch(UUID);
      }
    });

    it('escreve logs JSON com request_id igual ao cabeçalho de resposta', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-request-id': 'req-log-1' },
      });
      expect(res.headers['x-request-id']).toBe('req-log-1');
      const doRequest = log.registros().filter((r) => r.request_id === 'req-log-1');
      expect(doRequest.length).toBeGreaterThanOrEqual(2); // chegada + conclusão
      expect(doRequest.every((r) => !('reqId' in r))).toBe(true);
    });

    it('não registra credenciais (authorization e cookie) nos logs', async () => {
      await app.inject({
        method: 'GET',
        url: '/health',
        headers: {
          'x-request-id': 'req-log-2',
          authorization: 'Bearer segredo-super-secreto',
          cookie: 'sessao=segredo-super-secreto',
        },
      });
      const bruto = JSON.stringify(log.registros().filter((r) => r.request_id === 'req-log-2'));
      expect(bruto).not.toContain('segredo-super-secreto');
    });

    // S09 / SEC-04: a busca de clientes manda nome ou celular na URL; isso é dado pessoal e não vai para o log.
    it('não registra a query string (busca por nome ou celular) nos logs', async () => {
      await app.inject({ method: 'GET', url: '/health?q=11987654321&nome=Maria-da-Silva', headers: { 'x-request-id': 'req-log-3' } });
      const registros = log.registros().filter((r) => r.request_id === 'req-log-3');
      expect(registros.length).toBeGreaterThanOrEqual(2);
      const bruto = JSON.stringify(registros);
      expect(bruto).not.toContain('11987654321');
      expect(bruto).not.toContain('Maria-da-Silva');
      expect(bruto).toContain('/health');
    });
  });

  // S09b / SEC-04: o Postgres põe os valores da linha no `detail` ("Failing row contains (...)", "Key (celular)=(...)").
  // Num 500 isso iria para o log com nome e celular de cliente; o log guarda o erro sem esses campos.
  describe('erros do banco no log (SEC-04)', () => {
    it('um 500 com `detail` do Postgres não grava os valores da linha, mas guarda o código para diagnóstico', async () => {
      const log2 = coletor();
      const app2 = await buildApp({ pool, logger: { level: 'info', stream: log2.stream }, authPepper: TEST_PEPPER, totpChave: TEST_TOTP_CHAVE });
      app2.get('/_falha-de-teste', async () => {
        throw Object.assign(new Error('new row violates check constraint "clientes_celular_check"'), {
          code: '23514',
          detail: 'Failing row contains (Maria da Silva Sigilosa, 11987654321).',
          where: 'valor 11987654321',
        });
      });
      await app2.ready();
      const res = await app2.inject({ method: 'GET', url: '/_falha-de-teste', headers: { 'x-request-id': 'req-log-4' } });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ erro: 'erro_interno' });
      const bruto = JSON.stringify(log2.registros().filter((r) => r.request_id === 'req-log-4'));
      expect(bruto).not.toContain('Maria da Silva Sigilosa');
      expect(bruto).not.toContain('11987654321');
      expect(bruto).toContain('23514');
      expect(bruto).toContain('clientes_celular_check');
      await app2.close();
    });
  });

  describe('OpenAPI (DOC-05)', () => {
    it('publica /openapi.json em OpenAPI 3.1 descrevendo /health', async () => {
      const res = await app.inject({ method: 'GET', url: '/openapi.json' });
      expect(res.statusCode).toBe(200);
      const doc = res.json();
      expect(doc.openapi).toMatch(/^3\.1\./);
      expect(doc.paths['/health'].get.responses['200']).toBeDefined();
      expect(doc.paths['/health'].get.responses['503']).toBeDefined();
    });
  });
});
