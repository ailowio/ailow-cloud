import {
  categoriaAlterarSchema,
  categoriaCorpoSchema,
  categoriaIdParamsSchema,
  categoriasQuerySchema,
  categoriasResponseSchema,
  empresaEntradaSchema,
  empresaSchema,
  erroSchema,
  LOGO_MAX_BYTES,
  LOGO_MIMES,
} from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { type Deps, naoEncontrado, registrarEvento, semConteudo } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';

const UNIQUE_VIOLATION = '23505';
const sessaoCookie = [{ sessao: [] }];
const LOGO_SELECT =
  'nome, telefone, endereco, markup_bps, inatividade_minutos, (logo_bytes IS NOT NULL) AS tem_logo';

function mimePermitido(m: string): m is (typeof LOGO_MIMES)[number] {
  return (LOGO_MIMES as readonly string[]).includes(m);
}

// Configurações da empresa (S05, RF-CFG-02/03/04). Rotas de dados exigem o Dono (RN-10);
// GET da imagem da logo é de qualquer sessão (aparece no topo para Vendedor também).
// A empresa vem da sessão, nunca do corpo, e a RLS é a segunda trava.
export async function registrarRotasConfiguracoes(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const comSessao = [g.exigirSessao];

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
        const r = await c.query(`SELECT ${LOGO_SELECT} FROM empresas WHERE id = $1`, [s.empresaId]);
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
        RETURNING ${LOGO_SELECT}`,
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

  // ---------------------------------------------------------------- logo (RF-CFG-02)
  rotas.get(
    '/empresa/logo',
    {
      preValidation: comSessao,
      schema: {
        tags: ['configuracoes'],
        summary: 'Imagem da logo da empresa (qualquer usuário da sessão)',
        security: sessaoCookie,
        response: { 401: erroSchema, 404: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const row = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query<{ logo_bytes: Buffer | null; logo_mime: string | null }>(
          'SELECT logo_bytes, logo_mime FROM empresas WHERE id = $1',
          [s.empresaId],
        );
        return r.rows[0] ?? null;
      });
      if (!row?.logo_bytes || !row.logo_mime) return naoEncontrado(reply);
      // Resposta binária: fora do schema Zod (só 401/404 tipados acima).
      return reply
        .header('cache-control', 'private, no-store')
        .type(row.logo_mime)
        .send(row.logo_bytes as never);
    },
  );

  rotas.put(
    '/empresa/logo',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Envia ou substitui a logo da empresa (PNG/JPEG/WebP, até 512 KiB)',
        security: sessaoCookie,
        // multipart: corpo não passa pelo Zod
        response: { 200: empresaSchema, 400: erroSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const arquivo = await request.file();
      if (!arquivo) {
        return reply.code(400).send({ erro: 'requisicao_invalida', mensagem: 'envie o arquivo no campo file' });
      }
      const mime = arquivo.mimetype;
      if (!mimePermitido(mime)) {
        await arquivo.toBuffer().catch(() => undefined);
        return reply.code(400).send({ erro: 'requisicao_invalida', mensagem: 'use PNG, JPEG ou WebP' });
      }
      let bytes: Buffer;
      try {
        bytes = await arquivo.toBuffer();
      } catch {
        return reply.code(400).send({ erro: 'requisicao_invalida', mensagem: `logo até ${LOGO_MAX_BYTES} bytes` });
      }
      if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) {
        return reply.code(400).send({ erro: 'requisicao_invalida', mensagem: `logo até ${LOGO_MAX_BYTES} bytes` });
      }
      return withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `UPDATE empresas SET logo_bytes = $2, logo_mime = $3 WHERE id = $1 RETURNING ${LOGO_SELECT}`,
          [s.empresaId, bytes, mime],
        );
        await registrarEvento(c, {
          empresaId: s.empresaId,
          atorTipo: 'usuario',
          atorId: s.usuarioId,
          alvoId: s.empresaId,
          tipo: 'empresa_logo_alterada',
          em: agora(),
        });
        return r.rows[0];
      });
    },
  );

  rotas.route({
    method: 'DELETE',
    url: '/empresa/logo',
    preValidation: soDono,
    schema: {
      tags: ['configuracoes'],
      summary: 'Remove a logo da empresa (volta o placeholder do app)',
      security: sessaoCookie,
      response: { 200: empresaSchema, 401: erroSchema, 403: erroSchema },
    },
    handler: async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `UPDATE empresas SET logo_bytes = NULL, logo_mime = NULL WHERE id = $1 RETURNING ${LOGO_SELECT}`,
          [s.empresaId],
        );
        await registrarEvento(c, {
          empresaId: s.empresaId,
          atorTipo: 'usuario',
          atorId: s.usuarioId,
          alvoId: s.empresaId,
          tipo: 'empresa_logo_alterada',
          em: agora(),
        });
        return r.rows[0];
      });
    },
  });

  // ---------------------------------------------------------------- categorias
  rotas.get(
    '/categorias',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Categorias da empresa (de produto e/ou financeiras) e os atributos de cada uma (Dono)',
        security: sessaoCookie,
        querystring: categoriasQuerySchema,
        response: { 200: categoriasResponseSchema, 400: erroSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const categorias = await withEmpresa(pool, s.empresaId, async (c) => {
        // Sem `tipo` na consulta, devolve os dois tipos.
        const r = await c.query(
          `SELECT id, nome, atributos, ativa, tipo FROM categorias
            WHERE ($1::text IS NULL OR tipo = $1) ORDER BY lower(nome), id`,
          [request.query.tipo ?? null],
        );
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
        summary: 'Cria uma categoria de produto (com atributos) ou financeira, conforme o tipo (Dono)',
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
            'INSERT INTO categorias (empresa_id, nome, atributos, tipo, criado_em) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [s.empresaId, request.body.nome, request.body.atributos, request.body.tipo, agora()],
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
        const resultado = await withEmpresa(pool, s.empresaId, async (c) => {
          // O tipo não muda na edição; só ele diz se a categoria pode ter atributos.
          const atual = await c.query('SELECT tipo FROM categorias WHERE id = $1 FOR UPDATE', [request.params.id]);
          if (atual.rowCount === 0) return 'nao_encontrada' as const;
          if (atual.rows[0].tipo === 'financeira' && atributos.length > 0) return 'financeira_com_atributos' as const;
          await c.query('UPDATE categorias SET nome = $2, atributos = $3, ativa = $4 WHERE id = $1', [
            request.params.id,
            nome,
            atributos,
            ativa,
          ]);
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'categoria_alterada',
            em: agora(),
          });
          return 'ok' as const;
        });
        if (resultado === 'nao_encontrada') return naoEncontrado(reply);
        if (resultado === 'financeira_com_atributos') {
          return reply.code(400).send({ erro: 'categoria_financeira_sem_atributos' });
        }
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
