import {
  comprasDoClienteSchema,
  erroSchema,
  estornarEntradaSchema,
  listaVendasSchema,
  relatorioVendasQuerySchema,
  relatorioVendasSchema,
  vendaFinalizarSchema,
  vendaIdParamsSchema,
  vendaSchema,
  vendasDoClienteParamsSchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, semPermissao } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import { ErroVenda, buscarVenda, cancelarVenda, comprasDoCliente, finalizarVenda, listaVendas, relatorioVendas } from './vendas.js';

const sessaoCookie = [{ sessao: [] }];

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroVenda) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    if (err.codigo === 'venda_de_outro') return semPermissao(reply);
    const conflito =
      err.codigo === 'estoque_insuficiente' ||
      err.codigo === 'cliente_inativo' ||
      err.codigo === 'cliente_ja_cadastrado' ||
      err.codigo === 'ja_cancelada';
    return reply.code(conflito ? 409 : 400).send({ erro: err.codigo });
  }
  throw err;
}

// Vendas (S10, RF-VEN-02…10). Dono e Vendedor finalizam, consultam e cancelam (o Vendedor, só as próprias).
// O relatório do mês é só do Dono. A empresa e o autor vêm da sessão.
export async function registrarRotasVendas(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const logado = [g.exigirSessao];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.post(
    '/vendas',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Finaliza a venda: cliente, desconto, pagamentos, baixa de estoque e lançamentos, numa transação',
        security: sessaoCookie,
        body: vendaFinalizarSchema,
        response: { 201: vendaSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const venda = await withEmpresa(pool, s.empresaId, (c) =>
          finalizarVenda(c, { empresaId: s.empresaId, autorId: s.usuarioId, perfil: s.perfil, agora: agora() }, request.body),
        );
        return reply.code(201).send(venda);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/vendas/relatorio',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Vendas do dia ou do mês, por forma, vendedor e categoria; o Vendedor só vê as próprias do dia',
        security: sessaoCookie,
        querystring: relatorioVendasQuerySchema,
        response: { 200: relatorioVendasSchema, 400: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      if (s.perfil === 'vendedor' && request.query.periodo === 'mes') return semPermissao(reply);
      return withEmpresa(pool, s.empresaId, (c) =>
        relatorioVendas(c, { empresaId: s.empresaId, autorId: s.usuarioId, perfil: s.perfil, agora: agora() }, request.query.periodo, request.query.data),
      );
    },
  );

  rotas.get(
    '/vendas/lista',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Lista as vendas do dia ou do mês (com canceladas); o Vendedor só vê as próprias do dia',
        security: sessaoCookie,
        querystring: relatorioVendasQuerySchema,
        response: { 200: listaVendasSchema, 400: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      if (s.perfil === 'vendedor' && request.query.periodo === 'mes') return semPermissao(reply);
      const vendas = await withEmpresa(pool, s.empresaId, (c) =>
        listaVendas(c, { empresaId: s.empresaId, autorId: s.usuarioId, perfil: s.perfil, agora: agora() }, request.query.periodo, request.query.data),
      );
      return { vendas };
    },
  );

  rotas.get(
    '/vendas/por-cliente/:clienteId',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Histórico de compras de um cliente, da mais recente à mais antiga (número da venda)',
        security: sessaoCookie,
        params: vendasDoClienteParamsSchema,
        response: { 200: comprasDoClienteSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const compras = await withEmpresa(pool, s.empresaId, (c) => comprasDoCliente(c, request.params.clienteId));
      return { compras };
    },
  );

  rotas.get(
    '/vendas/:id',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Comprovante da venda',
        security: sessaoCookie,
        params: vendaIdParamsSchema,
        response: { 200: vendaSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const venda = await withEmpresa(pool, s.empresaId, (c) => buscarVenda(c, request.params.id));
      if (!venda) return naoEncontrado(reply);
      return venda;
    },
  );

  rotas.post(
    '/vendas/:id/cancelar',
    {
      preValidation: logado,
      schema: {
        tags: ['vendas'],
        summary: 'Cancela a venda: devolve o estoque e estorna os lançamentos; a venda permanece',
        security: sessaoCookie,
        params: vendaIdParamsSchema,
        body: estornarEntradaSchema,
        response: { 200: vendaSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      try {
        const venda = await withEmpresa(pool, s.empresaId, (c) =>
          cancelarVenda(
            c,
            { empresaId: s.empresaId, autorId: s.usuarioId, perfil: s.perfil, agora: agora() },
            request.params.id,
            request.body.motivo,
          ),
        );
        return venda;
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );
}
