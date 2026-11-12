import { z } from 'zod';
import { celularSchema } from './clientes.js';
import { normalizarCnpj } from './compras-calculos.js';
import { dataSchema, VALOR_MAXIMO_CENTAVOS } from './financeiro.js';
import { ESTOQUE_MAXIMO } from './produtos-calculos.js';

// Contrato de Compras (S11, RF-COM-01…05, RN-11). Sem .transform() nas respostas.
export * from './compras-calculos.js';

export const NOME_FORNECEDOR_MAX = 80;
export const LIMITE_FORNECEDORES_NA_LISTA = 200;

const nomeFornecedorSchema = z.string().trim().min(1, { error: 'informe o nome' }).max(NOME_FORNECEDOR_MAX);

// CNPJ opcional: vazio/ausente = null; se vier, precisa ser 14 dígitos (com ou sem máscara).
export const cnpjOpcionalSchema = z
  .string()
  .max(22)
  .nullish()
  .refine((v) => v == null || v.trim() === '' || normalizarCnpj(v) !== null, {
    error: 'CNPJ com 14 dígitos, ex.: 12.345.678/0001-95',
  })
  .transform((v) => (v == null || v.trim() === '' ? null : (normalizarCnpj(v) as string)));

// ------------------------------------------------------------------ fornecedores (RF-COM-01)
export const fornecedorNovoSchema = z.strictObject({
  nome: nomeFornecedorSchema,
  whatsapp: celularSchema,
  cnpj: cnpjOpcionalSchema,
});
export type FornecedorNovo = z.infer<typeof fornecedorNovoSchema>;

export const fornecedorEditarSchema = fornecedorNovoSchema;
export type FornecedorEditar = z.infer<typeof fornecedorEditarSchema>;

export const fornecedoresQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
});
export const fornecedorIdParamsSchema = z.object({ id: z.uuid() });

export const fornecedorSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  whatsapp: z.string(),
  cnpj: z.string().nullable(),
  criado_em: z.string(),
});
export type Fornecedor = z.infer<typeof fornecedorSchema>;

export const fornecedoresResponseSchema = z.object({
  fornecedores: z.array(fornecedorSchema),
  truncado: z.boolean(),
});
export const fornecedorCriadoSchema = z.object({ id: z.uuid() });

// ------------------------------------------------------------------ pedidos (RF-COM-02…04)
export const STATUS_PEDIDO = ['rascunho', 'enviado', 'recebido'] as const;
export const statusPedidoSchema = z.enum(STATUS_PEDIDO);
export type StatusPedido = z.infer<typeof statusPedidoSchema>;

const itemPedidoEntradaSchema = z.strictObject({
  sku_id: z.uuid(),
  quantidade: z.number().int().min(1).max(ESTOQUE_MAXIMO),
  custo_centavos: z.number().int().min(1).max(VALOR_MAXIMO_CENTAVOS),
});

export const pedidoNovoSchema = z
  .strictObject({
    fornecedor_id: z.uuid(),
    itens: z.array(itemPedidoEntradaSchema).min(1).max(60),
  })
  .refine((p) => new Set(p.itens.map((i) => i.sku_id)).size === p.itens.length, {
    error: 'a mesma peça entra uma vez; aumente a quantidade',
    path: ['itens'],
  });
export type PedidoNovo = z.infer<typeof pedidoNovoSchema>;

export const pedidoEditarSchema = pedidoNovoSchema;
export type PedidoEditar = z.infer<typeof pedidoEditarSchema>;

const parcelaReceberSchema = z.strictObject({
  valor_centavos: z.number().int().min(1).max(VALOR_MAXIMO_CENTAVOS),
  vencimento: dataSchema,
});

export const pedidoReceberSchema = z
  .strictObject({
    parcelas: z.array(parcelaReceberSchema).min(1).max(24),
  })
  .refine((p) => new Set(p.parcelas.map((x) => x.vencimento)).size === p.parcelas.length, {
    error: 'cada parcela precisa de uma data de vencimento diferente',
    path: ['parcelas'],
  });
export type PedidoReceber = z.infer<typeof pedidoReceberSchema>;

export const pedidoIdParamsSchema = z.object({ id: z.uuid() });

const itemPedidoSchema = z.object({
  sku_id: z.uuid(),
  codigo: z.string(),
  nome: z.string(),
  tamanho: z.string(),
  cor: z.string(),
  quantidade: z.number().int(),
  custo_unitario_centavos: z.number().int(),
});

export const pedidoSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  status: statusPedidoSchema,
  total_centavos: z.number().int(),
  fornecedor: z.object({
    id: z.uuid(),
    nome: z.string(),
    whatsapp: z.string(),
    cnpj: z.string().nullable(),
  }),
  itens: z.array(itemPedidoSchema),
  criado_em: z.string(),
  enviado_em: z.string().nullable(),
  recebido_em: z.string().nullable(),
});
export type Pedido = z.infer<typeof pedidoSchema>;

export const pedidoEnviadoSchema = z.object({
  pedido: pedidoSchema,
  whatsapp_url: z.string().url(),
});
export type PedidoEnviado = z.infer<typeof pedidoEnviadoSchema>;

export const pedidosQuerySchema = z.object({
  status: statusPedidoSchema.optional(),
});

export const pedidosResponseSchema = z.object({
  pedidos: z.array(
    z.object({
      id: z.uuid(),
      numero: z.number().int(),
      status: statusPedidoSchema,
      total_centavos: z.number().int(),
      fornecedor_nome: z.string(),
      criado_em: z.string(),
      enviado_em: z.string().nullable(),
      recebido_em: z.string().nullable(),
    }),
  ),
});

// ------------------------------------------------------------------ relatório (RF-COM-05)
export const relatorioComprasQuerySchema = z.object({
  periodo: z.enum(['mes']),
  data: dataSchema,
});

export const relatorioComprasSchema = z.object({
  periodo: z.literal('mes'),
  data: dataSchema,
  pedidos: z.number().int(),
  total_centavos: z.number().int(),
  por_fornecedor: z.array(
    z.object({
      fornecedor_id: z.uuid(),
      nome: z.string(),
      pedidos: z.number().int(),
      total_centavos: z.number().int(),
    }),
  ),
});
export type RelatorioCompras = z.infer<typeof relatorioComprasSchema>;
