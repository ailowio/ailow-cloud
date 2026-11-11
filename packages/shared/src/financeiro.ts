import { z } from 'zod';

// Contrato do Financeiro (S06, RF-FIN-01…06). Só o Dono acessa pela API (RN-10).
// Sem .transform() nos schemas de resposta: o serializador do Zod 4 não codifica transformação de mão única.

// RN-01: dinheiro é inteiro em centavos, sempre positivo; o sentido (entrada/saída) está em `tipo`.
// Teto de R$ 20 milhões por lançamento: cabe no `integer` do Postgres e na precisão do JavaScript.
export const VALOR_MAXIMO_CENTAVOS = 2_000_000_000;
export const valorCentavosSchema = z
  .number()
  .int({ error: 'valor em centavos inteiros' })
  .min(1, { error: 'o valor precisa ser maior que zero' })
  .max(VALOR_MAXIMO_CENTAVOS, { error: 'valor acima do limite de R$ 20 milhões' });

export const FORMAS_PAGAMENTO = ['dinheiro', 'pix', 'debito', 'credito', 'boleto'] as const;
export const formaPagamentoSchema = z.enum(FORMAS_PAGAMENTO);
export type FormaPagamento = z.infer<typeof formaPagamentoSchema>;

// Data de calendário AAAA-MM-DD (sem hora nem fuso). Recusa 29/02 fora de ano bissexto, 31/04 etc.
export const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'data no formato AAAA-MM-DD' })
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
    },
    { error: 'data inexistente no calendário' },
  );

export const TIPOS_LANCAMENTO = ['entrada', 'saida'] as const;
export const tipoLancamentoSchema = z.enum(TIPOS_LANCAMENTO);
export type TipoLancamento = z.infer<typeof tipoLancamentoSchema>;

export const ORIGENS_LANCAMENTO = ['venda', 'compra', 'despesa', 'estorno'] as const;
export const origemLancamentoSchema = z.enum(ORIGENS_LANCAMENTO);
export const STATUS_LANCAMENTO = ['aberto', 'pago', 'estornado'] as const;
export const statusLancamentoSchema = z.enum(STATUS_LANCAMENTO);

const descricaoSchema = z.string().trim().min(1, { error: 'informe a descrição' }).max(120);
const categoriaTextoSchema = z.string().trim().min(1, { error: 'informe a categoria' }).max(40);

// ------------------------------------------------------------------ interface pública (outros módulos)
// Entrada de `registrarLancamento()`. Estorno não entra aqui: tem função própria (RN-06).
export const lancamentoNovoSchema = z
  .object({
    tipo: tipoLancamentoSchema,
    origem_tipo: z.enum(['venda', 'compra', 'despesa']),
    // Id da venda/compra de origem; despesa não tem.
    origem_id: z.uuid().nullable(),
    descricao: descricaoSchema.nullable(),
    categoria: categoriaTextoSchema.nullable(),
    valor_centavos: valorCentavosSchema,
    forma_pagamento: formaPagamentoSchema.nullable(),
    vencimento: dataSchema,
    // true = nasce paga (pago_em = agora); false = em aberto (conta a pagar/receber).
    paga: z.boolean(),
  })
  .refine((l) => (l.origem_tipo === 'venda') === (l.tipo === 'entrada'), {
    error: 'venda é entrada; compra e despesa são saída',
    path: ['tipo'],
  })
  .refine((l) => (l.origem_tipo === 'despesa') === (l.origem_id === null), {
    error: 'venda e compra exigem o id de origem; despesa não tem',
    path: ['origem_id'],
  })
  .refine((l) => l.origem_tipo !== 'despesa' || l.descricao !== null, {
    error: 'despesa exige descrição',
    path: ['descricao'],
  })
  .refine((l) => !l.paga || l.forma_pagamento !== null, {
    error: 'lançamento pago exige a forma de pagamento',
    path: ['forma_pagamento'],
  });
export type LancamentoNovo = z.infer<typeof lancamentoNovoSchema>;

// ------------------------------------------------------------------ rotas do Dono
export const despesaEntradaSchema = z
  .object({
    descricao: descricaoSchema,
    categoria: categoriaTextoSchema,
    valor_centavos: valorCentavosSchema,
    vencimento: dataSchema,
    forma_pagamento: formaPagamentoSchema.nullable(),
    // true = já nasce paga (RF-FIN-02); exige a forma de pagamento.
    paga: z.boolean(),
  })
  .refine((d) => !d.paga || d.forma_pagamento !== null, {
    error: 'despesa já paga exige a forma de pagamento',
    path: ['forma_pagamento'],
  });
export type DespesaEntrada = z.infer<typeof despesaEntradaSchema>;

export const lancamentoSchema = z.object({
  id: z.uuid(),
  tipo: tipoLancamentoSchema,
  origem_tipo: origemLancamentoSchema,
  origem_id: z.uuid().nullable(),
  descricao: z.string().nullable(),
  categoria: z.string().nullable(),
  valor_centavos: z.number().int(),
  forma_pagamento: formaPagamentoSchema.nullable(),
  vencimento: dataSchema,
  pago_em: z.iso.datetime().nullable(),
  status: statusLancamentoSchema,
  estorno_de: z.uuid().nullable(),
  estorno_motivo: z.string().nullable(),
});
export type Lancamento = z.infer<typeof lancamentoSchema>;

export const lancamentoIdParamsSchema = z.object({ id: z.uuid() });

export const idCriadoSchema = z.object({ id: z.uuid() });

export const pagarEntradaSchema = z.object({ forma_pagamento: formaPagamentoSchema });
export const estornarEntradaSchema = z.object({
  motivo: z.string().trim().min(3, { error: 'diga o motivo do estorno' }).max(200),
});

// Contas a pagar (RF-FIN-03): vencidas em destaque, hoje, próximos 7 dias.
export const SITUACOES_CONTA = ['vencida', 'hoje', 'proximos_7_dias', 'depois'] as const;
export const situacaoContaSchema = z.enum(SITUACOES_CONTA);
export type SituacaoConta = z.infer<typeof situacaoContaSchema>;
export const contaAPagarSchema = lancamentoSchema.extend({ situacao: situacaoContaSchema });
export type ContaAPagar = z.infer<typeof contaAPagarSchema>;
export const contasAPagarResponseSchema = z.object({
  // "Hoje" segundo o servidor (America/Sao_Paulo): a tela não decide o que é vencido.
  hoje: dataSchema,
  contas: z.array(contaAPagarSchema),
});

// Relatório (RF-FIN-05) e extrato do dia.
export const relatorioQuerySchema = z.object({
  periodo: z.enum(['dia', 'mes']),
  // Qualquer dia do período; omitido = hoje.
  data: dataSchema.optional(),
});
export const extratoQuerySchema = z.object({ data: dataSchema.optional() });

const totaisSchema = z.object({
  entradas_centavos: z.number().int().min(0),
  saidas_centavos: z.number().int().min(0),
});
export const relatorioSchema = totaisSchema.extend({
  periodo: z.enum(['dia', 'mes']),
  de: dataSchema,
  ate: dataSchema,
  saldo_centavos: z.number().int(),
  por_forma: z.array(totaisSchema.extend({ forma_pagamento: formaPagamentoSchema })),
  por_categoria: z.array(totaisSchema.extend({ categoria: z.string() })),
});
export type Relatorio = z.infer<typeof relatorioSchema>;
export const SEM_CATEGORIA = 'Sem categoria';

export const extratoResponseSchema = z.object({ data: dataSchema, lancamentos: z.array(lancamentoSchema) });
