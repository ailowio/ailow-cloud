import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import { Relogio, appDeTeste } from './helpers.js';

// O navegador só fala com a origem do app; o proxy do Vite (dev) repassa à API os prefixos de uma LISTA FIXA.
// Rota nova com prefixo novo e sem entrada na lista dá 404 no navegador, mesmo com a API e os testes verdes
// (S06: /financeiro). Este teste liga as duas pontas: todo prefixo do OpenAPI precisa estar no proxy.
describe('proxy do app web x rotas da API', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;
  let prefixosDaApi: string[];

  function prefixosDoProxy(): string[] {
    const fonte = readFileSync(join(import.meta.dirname, '..', '..', 'web', 'vite.config.ts'), 'utf8');
    const achado = /'\^\/\(([^)]+)\)\(\/\|\$\)'/.exec(fonte);
    if (!achado?.[1]) throw new Error('lista de prefixos do proxy não encontrada em apps/web/vite.config.ts');
    // No arquivo o ponto vem escapado em dobro (openapi\\.json): volta a ser só "openapi.json".
    return achado[1].split('|').map((p) => p.replace(/\\\\\./g, '.'));
  }

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    app = await appDeTeste(pool, new Relogio());
    const doc = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as { paths: Record<string, unknown> };
    // /openapi.json não aparece no próprio documento (rota oculta): entra à mão.
    const primeiros = Object.keys(doc.paths).map((caminho) => caminho.split('/')[1] as string);
    prefixosDaApi = [...new Set([...primeiros, 'openapi.json'])].sort();
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('o leitor da lista do proxy enxerga os prefixos já conhecidos', () => {
    expect(prefixosDoProxy()).toEqual(expect.arrayContaining(['acesso', 'usuarios', 'empresa', 'categorias', 'admin', 'health']));
  });

  it('todo prefixo de rota da API está na lista do proxy do app web', () => {
    const noProxy = new Set(prefixosDoProxy());
    expect(prefixosDaApi.filter((p) => !noProxy.has(p))).toEqual([]);
  });

  it('o prefixo /financeiro, em particular, é repassado', () => {
    expect(prefixosDoProxy()).toContain('financeiro');
  });
});
