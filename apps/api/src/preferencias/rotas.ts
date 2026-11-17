import { erroSchema, preferenciaUiPutSchema, preferenciasUiResponseSchema } from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Deps } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';

const sessaoCookie = [{ sessao: [] }];

/** ADR 018: preferências de UI do usuário da sessão (ordem dos módulos). */
export async function registrarRotasPreferencias(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const logado = [g.exigirSessao];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/preferencias-ui',
    {
      preValidation: logado,
      schema: {
        tags: ['preferencias'],
        summary: 'Preferências de UI do usuário da sessão (ordem dos módulos da home)',
        security: sessaoCookie,
        response: { 200: preferenciasUiResponseSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `SELECT chave, valor FROM preferencias_ui WHERE usuario_id = $1 AND chave = 'modulos_ordem'`,
          [s.usuarioId],
        );
        const row = r.rows[0] as { chave: string; valor: unknown } | undefined;
        if (!row) return {};
        const parse = preferenciaUiPutSchema.shape.valor.safeParse(row.valor);
        return parse.success ? { modulos_ordem: parse.data } : {};
      });
    },
  );

  rotas.put(
    '/preferencias-ui',
    {
      preValidation: logado,
      schema: {
        tags: ['preferencias'],
        summary: 'Grava uma preferência de UI do usuário da sessão (UPSERT)',
        security: sessaoCookie,
        body: preferenciaUiPutSchema,
        response: { 200: preferenciasUiResponseSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const { chave, valor } = request.body;
      const quando = agora();
      return withEmpresa(pool, s.empresaId, async (c) => {
        await c.query(
          `INSERT INTO preferencias_ui (empresa_id, usuario_id, chave, valor, atualizado_em)
           VALUES ($1, $2, $3, $4::jsonb, $5)
           ON CONFLICT (empresa_id, usuario_id, chave)
           DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = EXCLUDED.atualizado_em`,
          [s.empresaId, s.usuarioId, chave, JSON.stringify(valor), quando],
        );
        return { modulos_ordem: valor };
      });
    },
  );
}
