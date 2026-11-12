import { erroSchema } from '@ailow/shared';
import type { FastifySchema } from 'fastify';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

// Ajustes do contrato OpenAPI que o schema Zod não expressa (S13a, PRD §10.6; lint por Spectral em `npm run lint:openapi`).

/** `GET /compras/:id/enviar` -> `get_compras_id_enviar`: único por método + caminho e estável entre versões. */
export function operationIdDe(metodo: string, caminho: string): string {
  const partes = caminho.split('/').flatMap((p) => p.replace(/^:/, '').split(/[^a-zA-Z0-9]+/));
  return [metodo.toLowerCase(), ...partes.filter(Boolean).map((p) => p.toLowerCase())].join('_');
}

interface RespostaBinaria {
  descricao: string;
  tipos: string[];
}

// Respostas 200 que não são JSON (ADR 003 e RF-CFG-02): o schema Zod só tipa os erros.
const BINARIAS: Record<string, RespostaBinaria> = {
  'GET /empresa/logo': { descricao: 'Imagem da logo da empresa', tipos: ['image/png', 'image/jpeg', 'image/webp'] },
  'POST /etiquetas': { descricao: 'PDF das etiquetas (uma página por fileira)', tipos: ['application/pdf'] },
};

export function respostaBinariaDe(metodo: string, caminho: string): RespostaBinaria | undefined {
  return BINARIAS[`${metodo.toUpperCase()} ${caminho}`];
}

type Entrada = Parameters<typeof jsonSchemaTransform>[0];

/** Transform do @fastify/swagger: o do Zod + `operationId` + 400 de validação + o 200 binário onde houver. */
export function transformarContrato(entrada: Entrada) {
  // Rota com corpo, caminho ou query valida a entrada e responde 400 `requisicao_invalida` (tratador de erros do app).
  const s = entrada.schema as { body?: unknown; params?: unknown; querystring?: unknown; response?: Record<string, unknown> };
  const comEntrada = s.body !== undefined || s.params !== undefined || s.querystring !== undefined;
  const base = jsonSchemaTransform(
    comEntrada && s.response?.['400'] === undefined
      ? { ...entrada, schema: { ...entrada.schema, response: { 400: erroSchema, ...s.response } } as Entrada['schema'] }
      : entrada,
  );
  const rota = entrada.route;
  const metodo = (Array.isArray(rota.method) ? rota.method[0] : rota.method) ?? 'GET';
  const schema: Record<string, unknown> = { ...base.schema, operationId: operationIdDe(metodo, rota.url) };

  const binaria = respostaBinariaDe(metodo, rota.url);
  if (binaria) {
    const conteudo = Object.fromEntries(binaria.tipos.map((t) => [t, { schema: { type: 'string', format: 'binary' } }]));
    schema.response = { ...(schema.response as Record<string, unknown>), 200: { description: binaria.descricao, content: conteudo } };
  }
  return { ...base, schema: schema as FastifySchema };
}
