import {
  ajusteEstoqueSchema,
  alertasEstoqueResponseSchema,
  erroSchema,
  estoqueResponseSchema,
  etiquetasPedidoSchema,
  movimentosResponseSchema,
  produtoCriadoSchema,
  produtoEditadoSchema,
  produtoEditarSchema,
  produtoIdParamsSchema,
  produtoNovoSchema,
  produtosQuerySchema,
  produtosResponseSchema,
  skuIdParamsSchema,
  skuParaVendaSchema,
  skuPorCodigoQuerySchema,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { type Deps, naoEncontrado, registrarEvento } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import { FUSO } from '../financeiro/lancamentos.js';
import { ErroEstoque, registrarMovimento } from './estoque.js';
import { type DadosEtiqueta, gerarPdfEtiquetas } from './etiquetas.js';
import {
  ErroProduto,
  alertasDeEstoque,
  arquivarProduto,
  buscarSkuPorCodigo,
  criarProduto,
  dadosDasEtiquetas,
  editarProduto,
  listarProdutos,
  movimentosDoSku,
} from './produtos.js';

const sessaoCookie = [{ sessao: [] }];
const DIA_EM_SAO_PAULO = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroEstoque) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    return reply.code(409).send({ erro: err.codigo });
  }
  if (err instanceof ErroProduto) {
    return reply.code(err.codigo === 'limite_de_produtos' ? 409 : 400).send({ erro: err.codigo });
  }
  throw err;
}

// Produtos e estoque (S07, RF-PRO-01…05/07). Listar é do Dono e do Vendedor (sem custo); o resto é só do Dono (RN-10).
// A empresa e o autor vêm da sessão, nunca do corpo; a RLS é a segunda trava.
export async function registrarRotasProdutos(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const logado = [g.exigirSessao];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/skus/por-codigo',
    {
      preValidation: logado,
      schema: {
        tags: ['produtos'],
        summary: 'Uma peça pelo código do QR, com preço e estoque e sem custo (Dono e Vendedor)',
        security: sessaoCookie,
        querystring: skuPorCodigoQuerySchema,
        response: { 200: skuParaVendaSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const sku = await withEmpresa(pool, s.empresaId, (c) => buscarSkuPorCodigo(c, request.query.codigo));
      if (!sku) return naoEncontrado(reply);
      return sku;
    },
  );

  rotas.get(
    '/produtos',
    {
      preValidation: logado,
      schema: {
        tags: ['produtos'],
        summary: 'Lista e busca produtos por nome, código ou preço; o Vendedor não recebe custo nem fornecedor',
        security: sessaoCookie,
        querystring: produtosQuerySchema,
        response: { 200: produtosResponseSchema, 400: erroSchema, 401: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => listarProdutos(c, s.perfil, request.query.q));
    },
  );

  rotas.post(
    '/produtos',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Cria um produto com os seus SKUs, códigos e estoque inicial (Dono)',
        security: sessaoCookie,
        body: produtoNovoSchema,
        response: { 201: produtoCriadoSchema, 400: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const criado = await withEmpresa(pool, s.empresaId, async (c) => {
          const novo = await criarProduto(c, { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando }, request.body);
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: novo.id,
            tipo: 'produto_criado',
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

  rotas.put(
    '/produtos/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Edita nome, categoria, porte, atributos, fornecedor, custo e preço do produto; a grade e os códigos não mudam (Dono)',
        security: sessaoCookie,
        params: produtoIdParamsSchema,
        body: produtoEditarSchema,
        response: { 200: produtoEditadoSchema, 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const achou = await withEmpresa(pool, s.empresaId, async (c) => {
          const ok = await editarProduto(c, request.params.id, request.body);
          if (ok) {
            await registrarEvento(c, {
              empresaId: s.empresaId,
              atorTipo: 'usuario',
              atorId: s.usuarioId,
              alvoId: request.params.id,
              tipo: 'produto_editado',
              em: quando,
            });
          }
          return ok;
        });
        if (!achou) return naoEncontrado(reply);
        return reply.code(200).send({ id: request.params.id });
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/produtos/:id/arquivar',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Arquiva o produto: some da lista, da venda e das etiquetas; SKUs, saldo e movimentos ficam (Dono)',
        security: sessaoCookie,
        params: produtoIdParamsSchema,
        response: { 200: produtoEditadoSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      const resultado = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await arquivarProduto(c, request.params.id);
        if (r === 'arquivado') {
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'produto_arquivado',
            em: quando,
          });
        }
        return r;
      });
      if (resultado === 'nao_encontrado') return naoEncontrado(reply);
      if (resultado === 'ja_arquivado') return reply.code(409).send({ erro: 'ja_arquivado' });
      return reply.code(200).send({ id: request.params.id });
    },
  );

  rotas.post(
    '/skus/:id/estoque',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Entrada ou ajuste de estoque de um SKU, com motivo; o saldo nunca fica negativo (Dono)',
        security: sessaoCookie,
        params: skuIdParamsSchema,
        body: ajusteEstoqueSchema,
        response: { 200: estoqueResponseSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const { estoque } = await withEmpresa(pool, s.empresaId, async (c) => {
          const r = await registrarMovimento(
            c,
            { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando },
            { skuId: request.params.id, ...request.body },
          );
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'estoque_ajustado',
            em: quando,
          });
          return r;
        });
        return reply.code(200).send({ estoque });
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/skus/:id/movimentos',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Histórico de movimentos de estoque de um SKU, do mais recente ao mais antigo (Dono)',
        security: sessaoCookie,
        params: skuIdParamsSchema,
        response: { 200: movimentosResponseSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const movimentos = await withEmpresa(pool, s.empresaId, (c) => movimentosDoSku(c, request.params.id));
      if (movimentos === null) return naoEncontrado(reply);
      return { movimentos };
    },
  );

  rotas.post(
    '/etiquetas',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'PDF das etiquetas com QR (bobina 33 × 22 mm, 3 colunas; uma página por fileira), sem custo (Dono)',
        security: sessaoCookie,
        body: etiquetasPedidoSchema,
        // 200 = application/pdf (binário, fora do schema Zod; ver ADR 003).
        response: { 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { itens } = request.body;
      const dados = await withEmpresa(pool, s.empresaId, (c) => dadosDasEtiquetas(c, itens.map((i) => i.sku_id)));
      if (dados === null) return naoEncontrado(reply);
      const etiquetas = itens.flatMap((i) => Array.from({ length: i.quantidade }, () => dados.get(i.sku_id) as DadosEtiqueta));
      const pdf = await gerarPdfEtiquetas(etiquetas);
      const dia = DIA_EM_SAO_PAULO.format(agora()); // AAAA-MM-DD; em UTC, às 22h já seria "amanhã"
      return reply
        .header('cache-control', 'private, no-store')
        .header('content-disposition', `attachment; filename="etiquetas-${dia}.pdf"`)
        .type('application/pdf')
        .send(pdf as never);
    },
  );

  rotas.get(
    '/estoque/alertas',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'SKUs com estoque abaixo do mínimo, para o aviso da tela inicial (Dono)',
        security: sessaoCookie,
        response: { 200: alertasEstoqueResponseSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, (c) => alertasDeEstoque(c));
    },
  );
}
