import {
  erroSchema,
  fornecedorCriadoSchema,
  fornecedorEditarSchema,
  fornecedorIdParamsSchema,
  fornecedorNovoSchema,
  fornecedorSchema,
  fornecedoresQuerySchema,
  fornecedoresResponseSchema,
  pedidoEditarSchema,
  pedidoEnviadoSchema,
  pedidoIdParamsSchema,
  pedidoNovoSchema,
  pedidoReceberSchema,
  pedidoSchema,
  pedidosQuerySchema,
  pedidosResponseSchema,
  relatorioComprasQuerySchema,
  relatorioComprasSchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, registrarEvento } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import {
  ErroCompra,
  ErroFornecedor,
  buscarPedido,
  criarPedido,
  editarPedido,
  enviarPedido,
  receberPedido,
  listarPedidos,
  relatorioCompras,
} from './compras.js';
import { buscarFornecedor, criarFornecedor, editarFornecedor, listarFornecedores } from './fornecedores.js';

const sessaoCookie = [{ sessao: [] }];

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroFornecedor) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    return reply.code(409).send({ erro: err.codigo });
  }
  if (err instanceof ErroCompra) {
    if (err.codigo === 'nao_encontrado' || err.codigo === 'fornecedor_nao_encontrado') return naoEncontrado(reply);
    const conflito = err.codigo === 'ja_recebido' || err.codigo === 'status_invalido';
    return reply.code(conflito ? 409 : 400).send({ erro: err.codigo });
  }
  throw err;
}

// Compras (S11, RF-COM-01…05, RN-11). Só o Dono (RN-10). A empresa e o autor vêm da sessão.
export async function registrarRotasCompras(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/fornecedores',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Lista e busca fornecedores por nome ou WhatsApp',
        security: sessaoCookie,
        querystring: fornecedoresQuerySchema,
        response: { 200: fornecedoresResponseSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => listarFornecedores(c, request.query.q));
    },
  );

  rotas.post(
    '/fornecedores',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Cadastra um fornecedor (nome, WhatsApp único por empresa, CNPJ opcional)',
        security: sessaoCookie,
        body: fornecedorNovoSchema,
        response: { 201: fornecedorCriadoSchema, 400: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const criado = await withEmpresa(pool, s.empresaId, async (c) => {
          const novo = await criarFornecedor(c, { empresaId: s.empresaId }, request.body);
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: novo.id,
            tipo: 'fornecedor_criado',
            em: quando,
          });
          return novo;
        });
        return reply.code(201).send(criado);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/fornecedores/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Ficha do fornecedor',
        security: sessaoCookie,
        params: fornecedorIdParamsSchema,
        response: { 200: fornecedorSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const f = await withEmpresa(pool, s.empresaId, (c) => buscarFornecedor(c, request.params.id));
      if (!f) return naoEncontrado(reply);
      return f;
    },
  );

  rotas.put(
    '/fornecedores/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Edita nome, WhatsApp e CNPJ do fornecedor',
        security: sessaoCookie,
        params: fornecedorIdParamsSchema,
        body: fornecedorEditarSchema,
        response: { 200: fornecedorSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        return await withEmpresa(pool, s.empresaId, (c) => editarFornecedor(c, request.params.id, request.body));
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/compras/relatorio',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Compras recebidas do mês, por fornecedor',
        security: sessaoCookie,
        querystring: relatorioComprasQuerySchema,
        response: { 200: relatorioComprasSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => relatorioCompras(c, request.query.data));
    },
  );

  rotas.get(
    '/compras',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Lista pedidos de compra (opcionalmente filtrados por status)',
        security: sessaoCookie,
        querystring: pedidosQuerySchema,
        response: { 200: pedidosResponseSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => listarPedidos(c, request.query.status));
    },
  );

  rotas.post(
    '/compras',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Cria um pedido de compra em rascunho',
        security: sessaoCookie,
        body: pedidoNovoSchema,
        response: { 201: pedidoSchema, 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const pedido = await withEmpresa(pool, s.empresaId, (c) =>
          criarPedido(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.body),
        );
        return reply.code(201).send(pedido);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/compras/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Detalhe do pedido de compra',
        security: sessaoCookie,
        params: pedidoIdParamsSchema,
        response: { 200: pedidoSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const pedido = await withEmpresa(pool, s.empresaId, (c) => buscarPedido(c, request.params.id));
      if (!pedido) return naoEncontrado(reply);
      return pedido;
    },
  );

  rotas.put(
    '/compras/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Edita um pedido ainda em rascunho',
        security: sessaoCookie,
        params: pedidoIdParamsSchema,
        body: pedidoEditarSchema,
        response: { 200: pedidoSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        return await withEmpresa(pool, s.empresaId, (c) =>
          editarPedido(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.params.id, request.body),
        );
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/compras/:id/enviar',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Marca o pedido como enviado e devolve o link do WhatsApp com o texto do pedido',
        security: sessaoCookie,
        params: pedidoIdParamsSchema,
        response: { 200: pedidoEnviadoSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        return await withEmpresa(pool, s.empresaId, (c) =>
          enviarPedido(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() }, request.params.id),
        );
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/compras/:id/receber',
    {
      preValidation: soDono,
      schema: {
        tags: ['compras'],
        summary: 'Recebe o pedido: estoque + parcelas no Financeiro, numa única transação (RN-11)',
        security: sessaoCookie,
        params: pedidoIdParamsSchema,
        body: pedidoReceberSchema,
        response: { 200: pedidoSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        return await withEmpresa(pool, s.empresaId, (c) =>
          receberPedido(
            c,
            { empresaId: s.empresaId, autorId: s.usuarioId, agora: agora() },
            request.params.id,
            request.body,
          ),
        );
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );
}
