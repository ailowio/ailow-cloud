import { type FormaPagamento, type LancamentoNovo, lancamentoNovoSchema } from '@ailow/shared';
import type pg from 'pg';

// INTERFACE PÚBLICA do Financeiro (RF-FIN-06, ADR 005). Vendas e Compras criam lançamentos só por aqui,
// passando o cliente da PRÓPRIA transação (o `withEmpresa()` deles): o lançamento entra ou sai junto com a
// venda/compra. Este é o único arquivo (com as rotas do módulo) que toca a tabela `lancamentos`.

// Fuso do negócio no v1 (ADR 005): "hoje" e a data de um pagamento são sempre em São Paulo.
export const FUSO = 'America/Sao_Paulo';

export interface ContextoFinanceiro {
  empresaId: string;
  // Usuário que está agindo (vem da sessão do chamador, nunca do corpo da requisição).
  autorId: string;
  agora: Date;
}

export type CodigoErroFinanceiro =
  | 'nao_encontrado'
  | 'ja_pago'
  | 'ja_estornado'
  | 'e_estorno'
  | 'lancamento_estornado';

// Falha de regra de negócio esperada (a rota a traduz em 404/409); o resto sobe como erro inesperado.
export class ErroFinanceiro extends Error {
  constructor(readonly codigo: CodigoErroFinanceiro) {
    super(codigo);
    this.name = 'ErroFinanceiro';
  }
}

/** RF-FIN-01: grava um lançamento. Valida o contrato (centavos inteiros, tipo × origem, pago exige forma). */
export async function registrarLancamento(
  c: pg.PoolClient,
  ctx: ContextoFinanceiro,
  entrada: LancamentoNovo,
): Promise<{ id: string }> {
  const l = lancamentoNovoSchema.parse(entrada);
  const r = await c.query(
    `INSERT INTO lancamentos
       (empresa_id, tipo, origem_tipo, origem_id, descricao, categoria, valor_centavos, forma_pagamento,
        vencimento, pago_em, status, criado_por, pago_por, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [
      ctx.empresaId,
      l.tipo,
      l.origem_tipo,
      l.origem_id,
      l.descricao,
      l.categoria,
      l.valor_centavos,
      l.forma_pagamento,
      l.vencimento,
      l.paga ? ctx.agora : null,
      l.paga ? 'pago' : 'aberto',
      ctx.autorId,
      l.paga ? ctx.autorId : null,
      ctx.agora,
    ],
  );
  return { id: r.rows[0].id as string };
}

/**
 * RF-FIN-04 / RN-06: estorno = lançamento inverso ligado ao original, com motivo. Nada é apagado nem reescrito.
 * Original pago: o estorno entra no caixa com o sentido oposto, na data do estorno.
 * Original em aberto: é um cancelamento; os dois ficam `estornado` e nada entra no caixa.
 */
export async function estornarLancamento(
  c: pg.PoolClient,
  ctx: ContextoFinanceiro,
  lancamentoId: string,
  motivo: string,
): Promise<{ id: string }> {
  // FOR UPDATE: duas tentativas simultâneas enfileiram; a 2ª já enxerga o original estornado.
  const achado = await c.query(
    `SELECT id, tipo, origem_tipo, status, descricao, categoria, valor_centavos, forma_pagamento
       FROM lancamentos WHERE id = $1 FOR UPDATE`,
    [lancamentoId],
  );
  const o = achado.rows[0] as
    | {
        id: string;
        tipo: 'entrada' | 'saida';
        origem_tipo: string;
        status: 'aberto' | 'pago' | 'estornado';
        descricao: string | null;
        categoria: string | null;
        valor_centavos: number;
        forma_pagamento: FormaPagamento | null;
      }
    | undefined;
  if (!o) throw new ErroFinanceiro('nao_encontrado');
  if (o.origem_tipo === 'estorno') throw new ErroFinanceiro('e_estorno');
  if (o.status === 'estornado') throw new ErroFinanceiro('ja_estornado');

  const pago = o.status === 'pago';
  const r = await c.query(
    `INSERT INTO lancamentos
       (empresa_id, tipo, origem_tipo, origem_id, descricao, categoria, valor_centavos, forma_pagamento,
        vencimento, pago_em, status, estorno_de, estorno_motivo, criado_por, pago_por, criado_em)
     VALUES ($1, $2, 'estorno', $3, $4, $5, $6, $7, ($8::timestamptz AT TIME ZONE $9)::date, $10, $11, $3, $12, $13, $14, $8)
     RETURNING id`,
    [
      ctx.empresaId,
      o.tipo === 'entrada' ? 'saida' : 'entrada',
      o.id,
      o.descricao,
      o.categoria,
      o.valor_centavos,
      o.forma_pagamento,
      ctx.agora,
      FUSO,
      pago ? ctx.agora : null,
      pago ? 'pago' : 'estornado',
      motivo,
      ctx.autorId,
      pago ? ctx.autorId : null,
    ],
  );
  await c.query("UPDATE lancamentos SET status = 'estornado' WHERE id = $1", [o.id]);
  return { id: r.rows[0].id as string };
}

/** RF-FIN-03: baixa uma conta em aberto. O UPDATE condicional é atômico: a 2ª baixa simultânea não passa. */
export async function pagarLancamento(
  c: pg.PoolClient,
  ctx: ContextoFinanceiro,
  lancamentoId: string,
  forma: FormaPagamento,
): Promise<void> {
  const r = await c.query(
    `UPDATE lancamentos SET status = 'pago', pago_em = $2, forma_pagamento = $3, pago_por = $4
      WHERE id = $1 AND status = 'aberto'`,
    [lancamentoId, ctx.agora, forma, ctx.autorId],
  );
  if (r.rowCount === 1) return;
  const atual = await c.query('SELECT status FROM lancamentos WHERE id = $1', [lancamentoId]);
  const status = atual.rows[0]?.status as string | undefined;
  if (!status) throw new ErroFinanceiro('nao_encontrado');
  throw new ErroFinanceiro(status === 'estornado' ? 'lancamento_estornado' : 'ja_pago');
}
