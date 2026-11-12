import {
  clienteCriadoSchema,
  clienteIdParamsSchema,
  clienteNovoSchema,
  clienteSchema,
  clientesQuerySchema,
  clientesResponseSchema,
  erroSchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, registrarEvento } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import { ErroCliente, anonimizarCliente, buscarCliente, criarCliente, listarClientes, registrarAviso } from './clientes.js';

const sessaoCookie = [{ sessao: [] }];

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroCliente) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    return reply.code(409).send({ erro: err.codigo });
  }
  throw err;
}

// Clientes (S09, RF-CLI-01…04). Dono e Vendedor cadastram, consultam e registram o aviso; só o Dono anonimiza (RN-10).
// A empresa e o autor vêm da sessão, nunca do corpo; a RLS é a segunda trava. A auditoria guarda só o id do cliente:
// nome e celular nunca vão para o registro de eventos.
export async function registrarRotasClientes(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const logado = [g.exigirSessao];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/clientes',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Lista e busca clientes por nome ou celular (anonimizados não aparecem)',
        security: sessaoCookie,
        querystring: clientesQuerySchema,
        response: { 200: clientesResponseSchema, 400: erroSchema, 401: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => listarClientes(c, request.query.q));
    },
  );

  rotas.post(
    '/clientes',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Cadastra um cliente (nome + celular único por empresa; opcionalmente já registra o aviso de finalidade)',
        security: sessaoCookie,
        body: clienteNovoSchema,
        response: { 201: clienteCriadoSchema, 400: erroSchema, 409: erroSchema, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const criado = await withEmpresa(pool, s.empresaId, async (c) => {
          const novo = await criarCliente(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando }, request.body);
          await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: novo.id, tipo: 'cliente_criado', em: quando });
          return novo;
        });
        return reply.code(201).send(criado);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/clientes/:id',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Ficha do cliente',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        response: { 200: clienteSchema, 400: erroSchema, 404: erroSchema, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const cliente = await withEmpresa(pool, s.empresaId, (c) => buscarCliente(c, request.params.id));
      if (cliente === null) return naoEncontrado(reply);
      return cliente;
    },
  );

  rotas.post(
    '/clientes/:id/aviso-lgpd',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Registra que o cliente foi avisado da finalidade do celular; repetir mantém a data do primeiro aviso',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        response: { 200: clienteSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const { cliente } = await withEmpresa(pool, s.empresaId, async (c) => {
          const r = await registrarAviso(c, request.params.id, quando);
          if (r.mudou) {
            await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: request.params.id, tipo: 'cliente_aviso_lgpd', em: quando });
          }
          return r;
        });
        return reply.code(200).send(cliente);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/clientes/:id/anonimizar',
    {
      preValidation: soDono,
      schema: {
        tags: ['clientes'],
        summary: 'Excluir/anonimizar a pedido do cliente: apaga nome e celular, mantém a linha para as vendas (Dono)',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        response: { 200: clienteSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const cliente = await withEmpresa(pool, s.empresaId, async (c) => {
          const anonimo = await anonimizarCliente(c, request.params.id, quando);
          await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: request.params.id, tipo: 'cliente_anonimizado', em: quando });
          return anonimo;
        });
        return reply.code(200).send(cliente);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );
}
