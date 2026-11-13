import { z } from 'zod';
import { celularSchema } from './clientes.js';
import { dataSchema, formaPagamentoSchema, VALOR_MAXIMO_CENTAVOS } from './financeiro.js';
import { ESTOQUE_MAXIMO } from './produtos-calculos.js';

// Contrato de Vendas (S10, RF-VEN-02…10, RN-02/07/08). Sem .transform() nas respostas.
export * from './vendas-calculos.js';

export const TIPOS_DESCONTO = ['nenhum', 'percentual', 'valor'] as const;
export const descontoVendaSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_DESCONTO),
    percentual: z.number().int().min(0).max(100).optional(),
    centavos: z.number().int().min(0).max(VALOR_MAXIMO_CENTAVOS).optional(),
  })
  .refine((d) => d.tipo !== 'percentual' || d.percentual !== undefined, { error: 'informe o percentual', path: ['percentual'] })
  .refine((d) => d.tipo !== 'valor' || d.centavos !== undefined, { error: 'informe o valor do desconto', path: ['centavos'] })
  .refine((d) => d.tipo === 'percentual' || d.percentual === undefined, { error: 'percentual só vale no desconto em %', path: ['percentual'] })
  .refine((d) => d.tipo === 'valor' || d.centavos === undefined, { error: 'centavos só valem no desconto em R$', path: ['centavos'] });

const itemVendaEntradaSchema = z.strictObject({
  sku_id: z.uuid(),
  quantidade: z.number().int().min(1).max(ESTOQUE_MAXIMO),
});

const pagamentoEntradaSchema = z.strictObject({
  forma: formaPagamentoSchema,
  valor_centavos: z.number().int().min(1).max(VALOR_MAXIMO_CENTAVOS),
});

// Nome só é obrigatório quando o celular ainda não é cliente (a regra vive na API, RN-07).
const clienteDaVendaSchema = z.strictObject({
  celular: celularSchema,
  nome: z.string().trim().min(1).max(80).optional(),
});

export const vendaFinalizarSchema = z
  .strictObject({
    itens: z.array(itemVendaEntradaSchema).min(1).max(30),
    cliente: clienteDaVendaSchema,
    desconto: descontoVendaSchema,
    pagamentos: z.array(pagamentoEntradaSchema).max(8),
  })
  .refine((v) => new Set(v.itens.map((i) => i.sku_id)).size === v.itens.length, {
    error: 'a mesma peça entra uma vez; aumente a quantidade',
    path: ['itens'],
  });
export type VendaFinalizar = z.infer<typeof vendaFinalizarSchema>;

export const STATUS_VENDA = ['finalizada', 'cancelada'] as const;
export const statusVendaSchema = z.enum(STATUS_VENDA);

const itemVendaSchema = z.object({
  sku_id: z.uuid(),
  codigo: z.string(),
  nome: z.string(),
  tamanho: z.string(),
  cor: z.string(),
  quantidade: z.number().int(),
  preco_unitario_centavos: z.number().int(),
});

const pagamentoVendaSchema = z.object({
  forma: formaPagamentoSchema,
  valor_centavos: z.number().int(),
});

const clienteResumoSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  celular: z.string(),
});

export const vendaSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  status: statusVendaSchema,
  subtotal_centavos: z.number().int(),
  desconto_centavos: z.number().int(),
  desconto_tipo: z.enum(TIPOS_DESCONTO),
  desconto_percentual: z.number().int().nullable(),
  total_centavos: z.number().int(),
  cliente: clienteResumoSchema.nullable(),
  vendedor_nome: z.string(),
  itens: z.array(itemVendaSchema),
  pagamentos: z.array(pagamentoVendaSchema),
  criado_em: z.iso.datetime(),
  cancelado_em: z.iso.datetime().nullable(),
  motivo_cancelamento: z.string().nullable(),
});
export type Venda = z.infer<typeof vendaSchema>;

export const vendaIdParamsSchema = z.object({ id: z.uuid() });
export const vendasDoClienteParamsSchema = z.object({ clienteId: z.uuid() });

export const compraDoClienteSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  total_centavos: z.number().int(),
  status: statusVendaSchema,
  criado_em: z.iso.datetime(),
});
export const comprasDoClienteSchema = z.object({ compras: z.array(compraDoClienteSchema) });
export type CompraDoCliente = z.infer<typeof compraDoClienteSchema>;

export const relatorioVendasQuerySchema = z.object({
  periodo: z.enum(['dia', 'mes']),
  data: dataSchema,
});

export const relatorioVendasSchema = z.object({
  periodo: z.enum(['dia', 'mes']),
  de: dataSchema,
  ate: dataSchema,
  vendas: z.number().int(),
  total_centavos: z.number().int(),
  com_cliente: z.number().int(),
  percentual_com_cliente: z.number().int(),
  por_forma: z.array(z.object({ forma: formaPagamentoSchema, valor_centavos: z.number().int() })),
  por_vendedor: z.array(z.object({ nome: z.string(), vendas: z.number().int(), total_centavos: z.number().int() })),
  por_categoria: z.array(z.object({ categoria: z.string(), total_centavos: z.number().int() })),
  repetidos: z.array(z.object({ celular: z.string(), vendas: z.number().int() })),
  suspeitos: z.array(z.object({ celular: z.string(), vendas: z.number().int() })),
});
export type RelatorioVendas = z.infer<typeof relatorioVendasSchema>;

// Linha da lista de vendas do período (S08): só o que a lista mostra; o detalhe vem de GET /vendas/{id}.
export const vendaResumoSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  status: statusVendaSchema,
  total_centavos: z.number().int(),
  cliente: z.object({ nome: z.string(), celular: z.string() }).nullable(),
  vendedor_nome: z.string(),
  formas: z.array(formaPagamentoSchema),
  criado_em: z.iso.datetime(),
});
export const listaVendasSchema = z.object({ vendas: z.array(vendaResumoSchema) });
export type VendaResumo = z.infer<typeof vendaResumoSchema>;

export const skuPorCodigoQuerySchema = z.object({
  codigo: z.string().trim().min(1).max(20),
});
export const skuParaVendaSchema = z.object({
  id: z.uuid(),
  codigo: z.string(),
  nome: z.string(),
  tamanho: z.string(),
  cor: z.string(),
  preco_centavos: z.number().int(),
  estoque: z.number().int(),
  categoria_nome: z.string(),
});
export type SkuParaVenda = z.infer<typeof skuParaVendaSchema>;
