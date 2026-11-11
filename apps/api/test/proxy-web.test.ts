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

  // O padrão (chave do proxy) como está em apps/web/vite.config.ts, já como regex de verdade.
  function padraoDoProxy(): string {
    const fonte = readFileSync(join(import.meta.dirname, '..', '..', 'web', 'vite.config.ts'), 'utf8');
    const achado = /'(\^\/\([^']+)':/.exec(fonte);
    if (!achado?.[1]) throw new Error('padrão do proxy não encontrado em apps/web/vite.config.ts');
    // No arquivo as barras invertidas vêm em dobro (texto de string JS): volta ao padrão que o Vite usa.
    return achado[1].replace(/\\\\/g, '\\');
  }

  function prefixosDoProxy(): string[] {
    const achado = /^\^\/\(([^)]+)\)/.exec(padraoDoProxy());
    if (!achado?.[1]) throw new Error('lista de prefixos do proxy não encontrada em apps/web/vite.config.ts');
    return achado[1].split('|').map((p) => p.replace(/\\\./g, '.'));
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

  // O Vite casa o padrão com a URL INCLUINDO a query string. Um padrão que só aceitasse "/" ou o fim depois do
  // prefixo deixava "/categorias?tipo=financeira" cair no app (sem conexão na tela), com a API e os testes verdes.
  describe('o padrão do proxy casa com a URL como o navegador a envia', () => {
    const casa = (url: string) => new RegExp(padraoDoProxy()).test(url);

    it.each([
      '/categorias',
      '/categorias/0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11',
      '/categorias?tipo=financeira',
      '/financeiro/extrato?data=2026-11-11',
      '/financeiro/relatorio?periodo=mes&data=2026-11-01',
      '/empresa',
      '/health',
      '/openapi.json',
    ])('repassa %s à API', (url) => {
      expect(casa(url)).toBe(true);
    });

    it.each(['/', '/categoriasx', '/financeiro-antigo', '/index.html', '/assets/index.js'])('não captura %s (é do app)', (url) => {
      expect(casa(url)).toBe(false);
    });
  });
});
