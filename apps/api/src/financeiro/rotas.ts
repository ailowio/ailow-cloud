import {
  SEM_CATEGORIA,
  contasAPagarResponseSchema,
  despesaEntradaSchema,
  erroSchema,
  estornarEntradaSchema,
  extratoQuerySchema,
  extratoResponseSchema,
  idCriadoSchema,
  type Lancamento,
  lancamentoIdParamsSchema,
  pagarEntradaSchema,
  relatorioQuerySchema,
  relatorioSchema,
  type SituacaoConta,
} from '@ailow/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { type Deps, naoEncontrado, registrarEvento, semConteudo } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';
import { ErroFinanceiro, FUSO, estornarLancamento, pagarLancamento, registrarLancamento } from './lancamentos.js';

const sessaoCookie = [{ sessao: [] }];
// Teto de linhas por resposta: uma loja pequena fica longe disso (sem paginação no v1).
const LIMITE_LINHAS = 500;

// Colunas devolvidas ao cliente. `vencimento::text` evita o `pg` converter `date` para Date no fuso do servidor.
const COLUNAS = `id, tipo, origem_tipo, origem_id, descricao, categoria, valor_centavos, forma_pagamento,
  lancamentos.vencimento::text AS vencimento, pago_em, status, estorno_de, estorno_motivo`;

// Linha como o `pg` entrega (pago_em é Date) e a mesma linha no contrato da API (pago_em em ISO).
type LinhaBanco = Omit<Lancamento, 'pago_em'> & { pago_em: Date | null };
const paraLancamento = (r: LinhaBanco): Lancamento => ({ ...r, pago_em: r.pago_em ? r.pago_em.toISOString() : null });

// "Hoje" é sempre a data de São Paulo (ADR 005), nunca a data UTC do servidor.
async function hojeEm(c: pg.PoolClient, agora: Date): Promise<string> {
  const r = await c.query("SELECT (($1::timestamptz AT TIME ZONE $2::text)::date)::text AS hoje", [agora, FUSO]);
  return r.rows[0].hoje as string;
}

// Limites do período em datas de calendário (AAAA-MM-DD). Mês = do dia 1 ao último dia, inclusive.
function limites(periodo: 'dia' | 'mes', ref: string): { de: string; ate: string } {
  if (periodo === 'dia') return { de: ref, ate: ref };
  const ano = Number(ref.slice(0, 4));
  const mes = Number(ref.slice(5, 7));
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = ref.slice(0, 8);
  return { de: `${prefixo}01`, ate: `${prefixo}${String(ultimo).padStart(2, '0')}` };
}

// Só o que tem `pago_em` movimenta o caixa; o dia é o dia de São Paulo (parâmetros: de, ate, fuso).
const NO_PERIODO = `pago_em >= ($1::date)::timestamp AT TIME ZONE $3::text
  AND pago_em < (($2::date + 1)::timestamp) AT TIME ZONE $3::text`;

function responderErro(reply: FastifyReply, err: unknown) {
  if (err instanceof ErroFinanceiro) {
    if (err.codigo === 'nao_encontrado') return naoEncontrado(reply);
    return reply.code(409).send({ erro: err.codigo });
  }
  throw err;
}

// Financeiro (S06, RF-FIN-02…05). Todas as rotas exigem o Dono (RN-10): o Vendedor nunca chega aqui.
// A empresa e o autor vêm da sessão; a RLS é a segunda trava.
export async function registrarRotasFinanceiro(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.post(
    '/financeiro/despesas',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Registra uma despesa, em aberto ou já paga (Dono)',
        security: sessaoCookie,
        body: despesaEntradaSchema,
        response: { 201: idCriadoSchema, 400: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const d = request.body;
      const quando = agora();
      const id = await withEmpresa(pool, s.empresaId, async (c) => {
        const { id: novo } = await registrarLancamento(
          c,
          { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando },
          {
            tipo: 'saida',
            origem_tipo: 'despesa',
            origem_id: null,
            descricao: d.descricao,
            categoria: d.categoria,
            valor_centavos: d.valor_centavos,
            forma_pagamento: d.forma_pagamento,
            vencimento: d.vencimento,
            paga: d.paga,
          },
        );
        await registrarEvento(c, {
          empresaId: s.empresaId,
          atorTipo: 'usuario',
          atorId: s.usuarioId,
          alvoId: novo,
          tipo: 'despesa_criada',
          em: quando,
        });
        return novo;
      });
      return reply.code(201).send({ id });
    },
  );

  rotas.get(
    '/financeiro/contas-a-pagar',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Contas a pagar em aberto, por vencimento, com a situação de cada uma (Dono)',
        security: sessaoCookie,
        response: { 200: contasAPagarResponseSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const quando = agora();
      return withEmpresa(pool, s.empresaId, async (c) => {
        const hoje = await hojeEm(c, quando);
        const r = await c.query(
          `SELECT ${COLUNAS},
                  CASE WHEN lancamentos.vencimento < $1::date THEN 'vencida'
                       WHEN lancamentos.vencimento = $1::date THEN 'hoje'
                       WHEN lancamentos.vencimento <= $1::date + 7 THEN 'proximos_7_dias'
                       ELSE 'depois' END AS situacao
             FROM lancamentos
            WHERE status = 'aberto' AND tipo = 'saida'
            ORDER BY lancamentos.vencimento, criado_em, id
            LIMIT ${LIMITE_LINHAS}`,
          [hoje],
        );
        const linhas = r.rows as (LinhaBanco & { situacao: SituacaoConta })[];
        return { hoje, contas: linhas.map((l) => ({ ...paraLancamento(l), situacao: l.situacao })) };
      });
    },
  );

  rotas.post(
    '/financeiro/lancamentos/:id/pagar',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Marca uma conta em aberto como paga (Dono)',
        security: sessaoCookie,
        params: lancamentoIdParamsSchema,
        body: pagarEntradaSchema,
        response: { 204: semConteudo, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        await withEmpresa(pool, s.empresaId, async (c) => {
          await pagarLancamento(
            c,
            { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando },
            request.params.id,
            request.body.forma_pagamento,
          );
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'lancamento_pago',
            em: quando,
          });
        });
        return reply.code(204).send(null);
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.post(
    '/financeiro/lancamentos/:id/estornar',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Estorna um lançamento: cria o inverso ligado ao original, com motivo; nada é apagado (Dono)',
        security: sessaoCookie,
        params: lancamentoIdParamsSchema,
        body: estornarEntradaSchema,
        response: { 201: idCriadoSchema, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const quando = agora();
      try {
        const id = await withEmpresa(pool, s.empresaId, async (c) => {
          const { id: estorno } = await estornarLancamento(
            c,
            { empresaId: s.empresaId, autorId: s.usuarioId, agora: quando },
            request.params.id,
            request.body.motivo,
          );
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: request.params.id,
            tipo: 'lancamento_estornado',
            em: quando,
          });
          return estorno;
        });
        return reply.code(201).send({ id });
      } catch (err) {
        return responderErro(reply, err);
      }
    },
  );

  rotas.get(
    '/financeiro/extrato',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Lançamentos que movimentaram o caixa em um dia, do mais recente ao mais antigo (Dono)',
        security: sessaoCookie,
        querystring: extratoQuerySchema,
        response: { 200: extratoResponseSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const quando = agora();
      return withEmpresa(pool, s.empresaId, async (c) => {
        const data = request.query.data ?? (await hojeEm(c, quando));
        const r = await c.query(
          `SELECT ${COLUNAS} FROM lancamentos
            WHERE ${NO_PERIODO}
            ORDER BY pago_em DESC, id
            LIMIT ${LIMITE_LINHAS}`,
          [data, data, FUSO],
        );
        return { data, lancamentos: (r.rows as LinhaBanco[]).map(paraLancamento) };
      });
    },
  );

  rotas.get(
    '/financeiro/relatorio',
    {
      preValidation: soDono,
      schema: {
        tags: ['financeiro'],
        summary: 'Entradas × saídas do dia ou do mês, por forma de pagamento e por categoria (Dono)',
        security: sessaoCookie,
        querystring: relatorioQuerySchema,
        response: { 200: relatorioSchema, 400: erroSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const quando = agora();
      const { periodo } = request.query;
      return withEmpresa(pool, s.empresaId, async (c) => {
        const ref = request.query.data ?? (await hojeEm(c, quando));
        const { de, ate } = limites(periodo, ref);
        const somas = `coalesce(sum(valor_centavos) FILTER (WHERE tipo = 'entrada'), 0) AS entradas,
                       coalesce(sum(valor_centavos) FILTER (WHERE tipo = 'saida'), 0) AS saidas`;
        const porForma = await c.query(
          `SELECT forma_pagamento, ${somas} FROM lancamentos
            WHERE ${NO_PERIODO} GROUP BY forma_pagamento ORDER BY forma_pagamento`,
          [de, ate, FUSO],
        );
        // Categoria é texto livre: "Aluguel" e "aluguel" somam juntas (ADR 005).
        const porCategoria = await c.query(
          `SELECT coalesce(min(categoria), $4::text) AS categoria, ${somas} FROM lancamentos
            WHERE ${NO_PERIODO} GROUP BY lower(categoria)
            ORDER BY sum(valor_centavos) DESC, 1`,
          [de, ate, FUSO, SEM_CATEGORIA],
        );
        // sum() de inteiros volta como texto (bigint); os valores cabem com folga em Number.
        const linha = (r: { entradas: string; saidas: string }) => ({
          entradas_centavos: Number(r.entradas),
          saidas_centavos: Number(r.saidas),
        });
        const forma = porForma.rows.map((r) => ({ forma_pagamento: r.forma_pagamento, ...linha(r) }));
        const entradas = forma.reduce((t, f) => t + f.entradas_centavos, 0);
        const saidas = forma.reduce((t, f) => t + f.saidas_centavos, 0);
        return {
          periodo,
          de,
          ate,
          entradas_centavos: entradas,
          saidas_centavos: saidas,
          saldo_centavos: entradas - saidas,
          por_forma: forma,
          por_categoria: porCategoria.rows.map((r) => ({ categoria: r.categoria, ...linha(r) })),
        };
      });
    },
  );
}
