import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import { Relogio, appDeTeste } from './helpers.js';

// AUD-61: o contrato publicado (OpenAPI 3.1) cobre as rotas de acesso e declara a autenticação.
interface Operacao {
  security?: Record<string, unknown>[];
  tags?: string[];
  summary?: string;
  operationId?: string;
  requestBody?: unknown;
  parameters?: { in: string }[];
  responses?: Record<string, { content?: Record<string, unknown> } | undefined>;
}
interface Documento {
  openapi: string;
  paths: Record<string, Record<string, Operacao>>;
  components: { securitySchemes: Record<string, { type: string; in: string; name: string }> };
}

describe('OpenAPI do módulo de acesso', () => {
  let pool: pg.Pool;
  let app: FastifyInstance;
  let doc: Documento;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    app = await appDeTeste(pool, new Relogio());
    doc = (await app.inject({ method: 'GET', url: '/openapi.json' })).json() as Documento;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  const esperadas = [
    'post /acesso/entrar',
    'get /acesso/usuarios',
    'post /acesso/pin',
    'get /acesso/eu',
    'post /acesso/sair',
    'put /acesso/meu-pin',
    'get /usuarios',
    'post /usuarios',
    'post /usuarios/{id}/derrubar-sessoes',
    'post /usuarios/{id}/desbloquear',
    'post /usuarios/{id}/desativar',
    'put /usuarios/{id}/pin',
    'get /empresa',
    'put /empresa',
    'get /empresa/logo',
    'put /empresa/logo',
    'delete /empresa/logo',
    'get /categorias',
    'post /categorias',
    'put /categorias/{id}',
    'post /financeiro/despesas',
    'get /financeiro/contas-a-pagar',
    'post /financeiro/lancamentos/{id}/pagar',
    'post /financeiro/lancamentos/{id}/estornar',
    'post /financeiro/vendas/{id}/estornar',
    'get /financeiro/extrato',
    'get /financeiro/relatorio',
    'get /produtos',
    'post /produtos',
    'post /skus/{id}/estoque',
    'get /skus/{id}/movimentos',
    'get /estoque/alertas',
    'post /etiquetas',
    'get /clientes',
    'post /clientes',
    'get /clientes/{id}',
    'post /clientes/{id}/aviso-lgpd',
    'put /clientes/{id}',
    'delete /clientes/{id}',
    'post /clientes/{id}/inativar',
    'post /clientes/{id}/reativar',
    'post /vendas',
    'get /vendas/relatorio',
    'get /vendas/por-cliente/{clienteId}',
    'get /vendas/{id}',
    'post /vendas/{id}/cancelar',
    'get /skus/por-codigo',
    'get /fornecedores',
    'post /fornecedores',
    'get /fornecedores/{id}',
    'put /fornecedores/{id}',
    'get /compras',
    'post /compras',
    'get /compras/relatorio',
    'get /compras/{id}',
    'put /compras/{id}',
    'post /compras/{id}/enviar',
    'post /compras/{id}/receber',
    'get /pontos/estado',
    'post /pontos',
    'get /pontos/espelho',
    'post /pontos/manual',
    'put /pontos/{id}',
    'post /pontos/{id}/excluir',
    'post /admin/login',
    'post /admin/sair',
    'post /admin/empresas',
    'post /admin/empresas/{empresaId}/dono/senha',
  ];
  const publicas = new Set(['post /acesso/entrar', 'post /admin/login']);
  // Corpo multipart (upload da logo) não passa pelo Zod, mas a rota responde 400 a corpo inválido.
  const operacoesComCorpoLivre = new Set(['put /empresa/logo']);

  it('é OpenAPI 3.1 e declara os 3 esquemas de cookie', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect(Object.keys(doc.components.securitySchemes).sort()).toEqual(['admin_sessao', 'aparelho', 'sessao']);
    for (const s of Object.values(doc.components.securitySchemes)) expect(s).toMatchObject({ type: 'apiKey', in: 'cookie' });
  });

  it.each(esperadas)('documenta %s com resumo e tag', (chave) => {
    const [metodo, caminho] = chave.split(' ') as [string, string];
    const op = doc.paths[caminho]?.[metodo];
    expect(op, chave).toBeDefined();
    expect(op?.summary).toBeTruthy();
    expect(op?.tags?.length).toBeGreaterThan(0);
  });

  it('toda rota de acesso, exceto os dois logins, declara qual cookie a autentica', () => {
    for (const chave of esperadas) {
      const [metodo, caminho] = chave.split(' ') as [string, string];
      const op = doc.paths[caminho]?.[metodo];
      if (publicas.has(chave)) expect(op?.security, chave).toBeUndefined();
      else expect(op?.security?.length, chave).toBeGreaterThan(0);
    }
  });

  // S13a (Schemathesis ST103): a validação de entrada responde 400 em toda rota com corpo, caminho ou query.
  it('toda operação com entrada documenta o 400 de validação (e nenhuma sem entrada o inventa)', () => {
    for (const [caminho, ops] of Object.entries(doc.paths)) {
      for (const [metodo, op] of Object.entries(ops)) {
        const comEntrada = Boolean(op.requestBody) || (op.parameters ?? []).some((p) => p.in !== 'cookie');
        const tem400 = op.responses?.['400'] !== undefined;
        expect(tem400, `${metodo} ${caminho}`).toBe(comEntrada || operacoesComCorpoLivre.has(`${metodo} ${caminho}`));
      }
    }
  });

  it('todo operationId existe e é único; logo e etiquetas documentam o 200 binário', () => {
    const ids = Object.values(doc.paths).flatMap((ops) => Object.values(ops).map((o) => o.operationId));
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(doc.paths['/empresa/logo']?.get?.responses?.['200']?.content ?? {})).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);
    expect(Object.keys(doc.paths['/etiquetas']?.post?.responses?.['200']?.content ?? {})).toEqual(['application/pdf']);
  });

  it('nenhuma rota fora da lista esperada surgiu sem ser documentada aqui', () => {
    const todas = Object.entries(doc.paths).flatMap(([c, ops]) => Object.keys(ops).map((m) => `${m} ${c}`));
    const conhecidas = new Set([...esperadas, 'get /health']);
    expect(todas.filter((k) => !conhecidas.has(k))).toEqual([]);
  });
});
