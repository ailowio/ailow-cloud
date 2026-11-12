import {
  clienteCriadoSchema,
  clienteEditarSchema,
  clienteIdParamsSchema,
  clienteNovoSchema,
  clienteSchema,
  clientesQuerySchema,
  clientesResponseSchema,
  erroSchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, registrarEvento, semConteudo, semPermissao } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import {
  ErroCliente,
  buscarCliente,
  criarCliente,
  editarCliente,
  excluirCliente,
  listarClientes,
  mudarSituacao,
  registrarAviso,
} from './clientes.js';

const sessaoCookie = [{ sessao: [] }];

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroCliente) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    return reply.code(409).send({ erro: err.codigo });
  }
  throw err;
}

// Clientes (S09/S09b, RF-CLI-01…05). Dono e Vendedor cadastram, editam, consultam e registram o aviso; só o Dono
// inativa, reativa, exclui e vê os inativos (RN-10). A empresa e o autor vêm da sessão, nunca do corpo; a RLS é a
// segunda trava. A auditoria guarda só o id do cliente: nome e celular nunca vão para o registro de eventos.
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
        summary: 'Lista e busca clientes por nome ou celular; por padrão só os ativos (inativos: só o Dono)',
        security: sessaoCookie,
        querystring: clientesQuerySchema,
        response: { 200: clientesResponseSchema, 400: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { q, situacao } = request.query;
      if (situacao === 'inativos' && s.perfil !== 'dono') return semPermissao(reply);
      return withEmpresa(pool, s.empresaId, (c) => listarClientes(c, q, situacao));
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
        summary: 'Ficha do cliente (inclusive inativo)',
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

  rotas.put(
    '/clientes/:id',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Corrige nome e celular do cliente (o celular segue único por empresa)',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        body: clienteEditarSchema,
        response: { 200: clienteSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const { cliente } = await withEmpresa(pool, s.empresaId, async (c) => {
          const r = await editarCliente(c, request.params.id, request.body);
          if (r.mudou) {
            await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: request.params.id, tipo: 'cliente_editado', em: quando });
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
    '/clientes/:id/aviso-lgpd',
    {
      preValidation: logado,
      schema: {
        tags: ['clientes'],
        summary: 'Registra que o cliente foi avisado da finalidade do celular; repetir mantém a data do primeiro aviso',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        response: { 200: clienteSchema, 400: erroSchema, 404: erroSchema, 401: erroSchema },
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

  // Inativar e reativar compartilham o desenho: só o Dono, 409 se já está na situação pedida, auditoria só na mudança.
  for (const [acao, ativo, evento, resumo] of [
    ['inativar', false, 'cliente_inativado', 'Inativa o cliente: some da busca padrão, o número continua reservado e dá para reativar (Dono)'],
    ['reativar', true, 'cliente_reativado', 'Reativa um cliente inativado (Dono)'],
  ] as const) {
    rotas.post(
      `/clientes/:id/${acao}`,
      {
        preValidation: soDono,
        schema: {
          tags: ['clientes'],
          summary: resumo,
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
            const novo = await mudarSituacao(c, request.params.id, ativo);
            await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: request.params.id, tipo: evento, em: quando });
            return novo;
          });
          return reply.code(200).send(cliente);
        } catch (err) {
          return responderErro(reply, err);
        }
      },
    );
  }

  rotas.delete(
    '/clientes/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['clientes'],
        summary: 'Exclui o cliente de verdade, a pedido dele: a linha sai do banco e o número fica livre (Dono; irreversível)',
        security: sessaoCookie,
        params: clienteIdParamsSchema,
        response: { 204: semConteudo, 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        await withEmpresa(pool, s.empresaId, async (c) => {
          await excluirCliente(c, request.params.id);
          await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: request.params.id, tipo: 'cliente_excluido', em: quando });
        });
        return reply.code(204).send(null);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );
}
