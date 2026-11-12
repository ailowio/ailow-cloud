import {
  ajusteEditarSchema,
  ajusteExcluirSchema,
  ajusteNovoSchema,
  erroSchema,
  espelhoQuerySchema,
  espelhoSchema,
  marcaSchema,
  pontoBatidoSchema,
  pontoEstadoSchema,
  pontoIdParamsSchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, semConteudo, semPermissao } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import { ErroPonto, adicionarPonto, baterPonto, editarPonto, espelhoDoMes, estadoDoPonto, excluirPonto } from './pontos.js';

const sessaoCookie = [{ sessao: [] }];

// 404 = não existe (ou é de outra empresa); 400 = pedido impossível (futuro); 409 = conflito com o estado do ponto.
function responderErro(reply: FastifyReply, err: unknown) {
  if (!(err instanceof ErroPonto)) throw err;
  if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
  if (err.codigo === 'no_futuro') return reply.code(400).send({ erro: err.codigo });
  return reply.code(409).send({ erro: err.codigo });
}

// Pessoas (S12, RF-PES-01/02/03). Dono e Vendedor batem o próprio ponto; o espelho do Vendedor é só o dele (RN-10);
// adicionar, editar e excluir ponto é só do Dono (ADR 008).
export async function registrarRotasPessoas(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const erros = { 401: erroSchema, 403: erroSchema };
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];

  rotas.get(
    '/pontos/estado',
    {
      preValidation: [g.exigirSessao],
      schema: {
        tags: ['pessoas'],
        summary: 'O que a próxima batida do usuário da sessão vai ser (entrada ou saída)',
        security: sessaoCookie,
        response: { 200: pontoEstadoSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => estadoDoPonto(c, s.usuarioId));
    },
  );

  rotas.post(
    '/pontos',
    {
      preValidation: [g.exigirSessao],
      schema: {
        tags: ['pessoas'],
        summary: 'Bate o ponto: alterna entrada/saída do usuário da sessão, com a hora do servidor',
        security: sessaoCookie,
        response: { 201: pontoBatidoSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const batido = await withEmpresa(pool, s.empresaId, (c) =>
          baterPonto(c, { empresaId: s.empresaId, usuarioId: s.usuarioId, agora: agora() }),
        );
        return reply.code(201).send(batido);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/pontos/espelho',
    {
      preValidation: [g.exigirSessao],
      schema: {
        tags: ['pessoas'],
        summary: 'Espelho de ponto do mês: o Vendedor vê o próprio; o Dono vê todos ou filtra por usuário',
        security: sessaoCookie,
        querystring: espelhoQuerySchema,
        response: { 200: espelhoSchema, 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const pedido = request.query.usuario_id ?? null;
      if (s.perfil !== 'dono' && pedido !== null && pedido !== s.usuarioId) return semPermissao(reply);
      const alvo = s.perfil === 'dono' ? pedido : s.usuarioId;
      try {
        return await withEmpresa(pool, s.empresaId, (c) => espelhoDoMes(c, request.query.mes, alvo));
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  const errosAjuste = { 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros };

  rotas.post(
    '/pontos/manual',
    {
      preValidation: soDono,
      schema: {
        tags: ['pessoas'],
        summary: 'Dono adiciona um ponto esquecido (dia + HH:MM de São Paulo, nunca no futuro), com motivo',
        security: sessaoCookie,
        body: ajusteNovoSchema,
        response: { 201: marcaSchema, ...errosAjuste },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const marca = await withEmpresa(pool, s.empresaId, (c) =>
          adicionarPonto(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.body),
        );
        return reply.code(201).send(marca);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.put(
    '/pontos/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['pessoas'],
        summary: 'Dono muda o horário de um ponto (a sequência entrada/saída precisa continuar válida), com motivo',
        security: sessaoCookie,
        params: pontoIdParamsSchema,
        body: ajusteEditarSchema,
        response: { 200: marcaSchema, ...errosAjuste },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        return await withEmpresa(pool, s.empresaId, (c) =>
          editarPonto(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.params.id, request.body),
        );
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/pontos/:id/excluir',
    {
      preValidation: soDono,
      schema: {
        tags: ['pessoas'],
        summary: 'Dono exclui um ponto (exclusão lógica; a sequência precisa continuar válida), com motivo',
        security: sessaoCookie,
        params: pontoIdParamsSchema,
        body: ajusteExcluirSchema,
        response: { 204: semConteudo, ...errosAjuste },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        await withEmpresa(pool, s.empresaId, (c) =>
          excluirPonto(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.params.id, request.body),
        );
        return reply.code(204).send(null);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );
}
