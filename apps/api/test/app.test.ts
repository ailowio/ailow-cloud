import { Writable } from 'node:stream';
import { healthResponseSchema } from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { TEST_PEPPER } from './helpers.js';

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
    app = await buildApp({ pool, logger: { level: 'info', stream: log.stream }, authPepper: TEST_PEPPER });
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
      const app2 = await buildApp({ pool: semBanco, logger: false, authPepper: TEST_PEPPER });
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
