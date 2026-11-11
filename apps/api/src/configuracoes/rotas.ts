import {
  categoriaAlterarSchema,
  categoriaCorpoSchema,
  categoriaIdParamsSchema,
  categoriasResponseSchema,
  empresaEntradaSchema,
  empresaSchema,
  erroSchema,
} from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { type Deps, naoEncontrado, registrarEvento, semConteudo } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';

const UNIQUE_VIOLATION = '23505';
const sessaoCookie = [{ sessao: [] }];

// Configurações da empresa (S05, RF-CFG-02/03/04). Todas as rotas exigem o Dono (RN-10);
// a empresa vem da sessão, nunca do corpo, e a RLS é a segunda trava.
export async function registrarRotasConfiguracoes(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];

  // ---------------------------------------------------------------- dados da empresa + markup + trava
  rotas.get(
    '/empresa',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Dados da empresa, markup padrão e trava por inatividade (Dono)',
        security: sessaoCookie,
        response: { 200: empresaSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          'SELECT nome, telefone, endereco, markup_bps, inatividade_minutos FROM empresas WHERE id = $1',
          [s.empresaId],
        );
        return r.rows[0];
      });
    },
  );

  rotas.put(
    '/empresa',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Altera dados da empresa, markup padrão e trava por inatividade (Dono)',
        security: sessaoCookie,
        body: empresaEntradaSchema,
        response: { 200: empresaSchema, 400: erroSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const e = request.body;
      return withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `UPDATE empresas
              SET nome = $2, telefone = $3, endereco = $4, markup_bps = $5, inatividade_minutos = $6
            WHERE id = $1
        RETURNING nome, telefone, endereco, markup_bps, inatividade_minutos`,
          [s.empresaId, e.nome, e.telefone, e.endereco, e.markup_bps, e.inatividade_minutos],
        );
        await registrarEvento(c, {
          empresaId: s.empresaId,
          atorTipo: 'usuario',
          atorId: s.usuarioId,
          alvoId: s.empresaId,
          tipo: 'empresa_alterada',
          em: agora(),
        });
        return r.rows[0];
      });
    },
  );

  // ---------------------------------------------------------------- categorias
  rotas.get(
    '/categorias',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Categorias da empresa e os atributos de cada uma (Dono)',
        security: sessaoCookie,
        response: { 200: categoriasResponseSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const categorias = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query('SELECT id, nome, atributos, ativa FROM categorias ORDER BY lower(nome), id');
        return r.rows;
      });
      return { categorias };
    },
  );

  rotas.post(
    '/categorias',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Cria uma categoria com seus atributos (Dono)',
        security: sessaoCookie,
        body: categoriaCorpoSchema,
        response: { 201: z.object({ id: z.uuid() }), 400: erroSchema, 401: erroSchema, 403: erroSchema, 409: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const id = await withEmpresa(pool, s.empresaId, async (c) => {
          const r = await c.query(
            'INSERT INTO categorias (empresa_id, nome, atributos, criado_em) VALUES ($1, $2, $3, $4) RETURNING id',
            [s.empresaId, request.body.nome, request.body.atributos, agora()],
          );
          const novo = r.rows[0].id as string;
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: novo,
            tipo: 'categoria_criada',
            em: agora(),
          });
          return novo;
        });
        return reply.code(201).send({ id });
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'categoria_ja_existe' });
        }
        throw err;
      }
    },
  );

  rotas.put(
    '/categorias/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Renomeia, troca os atributos ou (des)ativa uma categoria (Dono)',
        security: sessaoCookie,
        params: categoriaIdParamsSchema,
        body: categoriaAlterarSchema,
        response: {
          204: semConteudo,
          400: erroSchema,
          401: erroSchema,
          403: erroSchema,
          404: erroSchema,
          409: erroSchema,
        },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { nome, atributos, ativa } = request.body;
      try {
        const achou = await withEmpresa(pool, s.empresaId, async (c) => {
          const r = await c.query(
            'UPDATE categorias SET nome = $2, atributos = $3, ativa = $4 WHERE id = $1 RETURNING id',
            [request.params.id, nome, atributos, ativa],
          );
          if (r.rowCount === 0) return false;
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'categoria_alterada',
            em: agora(),
          });
          return true;
        });
        if (!achou) return naoEncontrado(reply);
        return reply.code(204).send(null);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'categoria_ja_existe' });
        }
        throw err;
      }
    },
  );
}
