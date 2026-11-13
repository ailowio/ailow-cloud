import { z } from 'zod';
import { VALOR_MAXIMO_CENTAVOS, valorCentavosSchema } from './financeiro.js';
import {
  ESTOQUE_MAXIMO,
  MAX_CORES_POR_PRODUTO,
  MAX_SKUS_POR_PRODUTO,
  chaveCor,
  letrasDaCor,
} from './produtos-calculos.js';

// Contrato de Produtos (S07, RF-PRO-01…05/07; RN-01, RN-03, RN-05). ADR 006.
// Sem .transform() nos schemas de RESPOSTA (o serializador do Zod 4 não codifica transformação de mão única).
// As regras puras (preço sugerido, código do SKU, ordem de tamanhos) estão em produtos-calculos.ts, sem Zod.
export * from './produtos-calculos.js';

export const PORTES = ['slim', 'plus'] as const;
export const porteSchema = z.enum(PORTES);
export type Porte = z.infer<typeof porteSchema>;

// Entrada de mercadoria e ajustes são do Dono (RF-PRO-04); 'inicial' nasce no cadastro e 'venda' /
// 'estorno_venda' só a Vendas (S10) grava, pela interface pública de estoque.
export const TIPOS_MOVIMENTO = ['inicial', 'entrada', 'ajuste', 'venda', 'estorno_venda', 'compra'] as const;
export const tipoMovimentoSchema = z.enum(TIPOS_MOVIMENTO);
export type TipoMovimento = z.infer<typeof tipoMovimentoSchema>;

// ------------------------------------------------------------------ entrada (cadastro do produto)
const estoqueSchema = z.number().int({ error: 'quantidade inteira' }).min(0).max(ESTOQUE_MAXIMO);

// Tamanho como está na etiqueta do fornecedor (P1 §1): P, GG, 46, U, G1…
export const tamanhoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,3}$/, { error: 'tamanho com 1 a 3 letras ou números' });

export const corSchema = z
  .string()
  .trim()
  .min(1, { error: 'informe a cor' })
  .max(30)
  .refine((c) => letrasDaCor(c) !== '', { error: 'a cor precisa ter ao menos uma letra ou número' });

export const skuNovoSchema = z.object({
  tamanho: tamanhoSchema,
  cor: corSchema,
  estoque_inicial: estoqueSchema,
  // Obrigatório no cadastro (RF-PRO-05): 0 = não quero aviso.
  estoque_minimo: estoqueSchema,
});
export type SkuNovo = z.infer<typeof skuNovoSchema>;

const atributoSchema = z.string().trim().min(1).max(40);

export const produtoNovoSchema = z
  .object({
    nome: z.string().trim().min(1, { error: 'informe o nome' }).max(80),
    categoria_id: z.uuid(),
    porte: porteSchema,
    // Quais atributos da categoria este produto tem (liga/desliga); a API confere contra a categoria.
    atributos: z
      .array(atributoSchema)
      .max(20)
      .refine((l) => new Set(l.map((a) => a.toLowerCase())).size === l.length, { error: 'atributos repetidos' }),
    fornecedor: z.string().trim().min(1).max(80).nullable(),
    custo_centavos: z.number().int({ error: 'custo em centavos inteiros' }).min(0).max(VALOR_MAXIMO_CENTAVOS),
    preco_centavos: valorCentavosSchema,
    skus: z.array(skuNovoSchema).min(1, { error: 'escolha ao menos um tamanho e uma cor' }).max(MAX_SKUS_POR_PRODUTO),
  })
  .refine((p) => new Set(p.skus.map((s) => `${s.tamanho}|${chaveCor(s.cor)}`)).size === p.skus.length, {
    error: 'tamanho e cor repetidos',
    path: ['skus'],
  })
  .refine((p) => new Set(p.skus.map((s) => chaveCor(s.cor))).size <= MAX_CORES_POR_PRODUTO, {
    error: `no máximo ${MAX_CORES_POR_PRODUTO} cores por produto`,
    path: ['skus'],
  });
export type ProdutoNovo = z.infer<typeof produtoNovoSchema>;

// S09: edição do produto (modelo). A grade (tamanho × cor), o número e o código dos SKUs não mudam; o estoque só
// muda por movimento. Mesmos limites e regras do cadastro.
export const produtoEditarSchema = z.object({
  nome: produtoNovoSchema.shape.nome,
  categoria_id: z.uuid(),
  porte: porteSchema,
  atributos: produtoNovoSchema.shape.atributos,
  fornecedor: produtoNovoSchema.shape.fornecedor,
  custo_centavos: produtoNovoSchema.shape.custo_centavos,
  preco_centavos: produtoNovoSchema.shape.preco_centavos,
});
export type ProdutoEditar = z.infer<typeof produtoEditarSchema>;

// ------------------------------------------------------------------ entrada / ajuste de estoque (RF-PRO-04)
export const ajusteEstoqueSchema = z
  .object({
    tipo: z.enum(['entrada', 'ajuste']),
    // Com sinal: entrada é positiva; ajuste pode tirar (perda, contagem) mas nunca deixa o saldo negativo (RN-03).
    quantidade: z
      .number()
      .int({ error: 'quantidade inteira' })
      .min(-ESTOQUE_MAXIMO)
      .max(ESTOQUE_MAXIMO)
      .refine((q) => q !== 0, { error: 'a quantidade não pode ser zero' }),
    motivo: z.string().trim().min(3, { error: 'diga o motivo' }).max(200),
  })
  .refine((a) => a.tipo !== 'entrada' || a.quantidade > 0, {
    error: 'entrada de mercadoria é uma quantidade positiva',
    path: ['quantidade'],
  });
export type AjusteEstoque = z.infer<typeof ajusteEstoqueSchema>;

// ------------------------------------------------------------------ interface pública de estoque (Vendas, Compras…)
// Entrada de `registrarMovimento()`. As regras de tipo × sinal × origem são as mesmas dos CHECKs do banco:
// o erro aparece na aplicação com uma mensagem clara, e o banco continua sendo a última trava.
export const movimentoNovoSchema = z
  .object({
    skuId: z.uuid(),
    tipo: tipoMovimentoSchema,
    // Com sinal: positivo entra, negativo sai.
    quantidade: z
      .number()
      .int({ error: 'quantidade inteira' })
      .min(-ESTOQUE_MAXIMO)
      .max(ESTOQUE_MAXIMO)
      .refine((q) => q !== 0, { error: 'a quantidade não pode ser zero' }),
    motivo: z.string().trim().min(3, { error: 'diga o motivo' }).max(200),
    // Id da venda (RN-08) ou do pedido de compra (RN-11): obrigatório nesses tipos, proibido nos demais.
    origemId: z.uuid().nullish(),
  })
  .refine(
    (m) => (m.tipo === 'venda' || m.tipo === 'estorno_venda' || m.tipo === 'compra') === (m.origemId != null),
    {
      error: 'venda, estorno de venda e compra exigem o id de origem; os demais tipos não têm',
      path: ['origemId'],
    },
  )
  .refine((m) => !['inicial', 'entrada', 'estorno_venda', 'compra'].includes(m.tipo) || m.quantidade > 0, {
    error: 'estoque inicial, entrada, estorno de venda e compra são quantidades positivas',
    path: ['quantidade'],
  })
  .refine((m) => m.tipo !== 'venda' || m.quantidade < 0, {
    error: 'a venda tira do estoque (quantidade negativa)',
    path: ['quantidade'],
  });
export type MovimentoNovo = z.infer<typeof movimentoNovoSchema>;

// ------------------------------------------------------------------ respostas
export const skuSchema = z.object({
  id: z.uuid(),
  codigo: z.string(),
  tamanho: z.string(),
  cor: z.string(),
  estoque: z.number().int().min(0),
  // Ausente para o Vendedor (RF-PRO-07 pede só produto, preço e estoque).
  estoque_minimo: z.number().int().min(0).optional(),
});
export type Sku = z.infer<typeof skuSchema>;

export const produtoSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  nome: z.string(),
  categoria_id: z.uuid(),
  categoria_nome: z.string(),
  porte: porteSchema,
  atributos: z.array(z.string()),
  preco_centavos: z.number().int(),
  ativo: z.boolean(),
  // RF-PRO-07: custo e fornecedor só existem na resposta do Dono. Para o Vendedor a chave nem aparece.
  custo_centavos: z.number().int().optional(),
  fornecedor: z.string().nullable().optional(),
  skus: z.array(skuSchema),
});
export type Produto = z.infer<typeof produtoSchema>;

export const produtosQuerySchema = z.object({ q: z.string().trim().max(80).optional() });
export const produtosResponseSchema = z.object({ produtos: z.array(produtoSchema), truncado: z.boolean() });

export const produtoCriadoSchema = z.object({
  id: z.uuid(),
  numero: z.number().int(),
  skus: z.array(z.object({ id: z.uuid(), codigo: z.string() })),
});

export const produtoEditadoSchema = z.object({ id: z.uuid() });

export const produtoIdParamsSchema =z.object({ id: z.uuid() });
export const skuIdParamsSchema = z.object({ id: z.uuid() });

export const estoqueResponseSchema = z.object({ estoque: z.number().int().min(0) });

export const movimentoSchema = z.object({
  id: z.uuid(),
  tipo: tipoMovimentoSchema,
  quantidade: z.number().int(),
  saldo_apos: z.number().int().min(0),
  motivo: z.string(),
  origem_id: z.uuid().nullable(),
  autor_nome: z.string(),
  criado_em: z.iso.datetime(),
});
export type Movimento = z.infer<typeof movimentoSchema>;
export const movimentosResponseSchema = z.object({ movimentos: z.array(movimentoSchema) });

// RF-PRO-05: SKUs abaixo do mínimo, para o aviso vermelho da tela inicial do Dono.
export const alertaEstoqueSchema = z.object({
  sku_id: z.uuid(),
  codigo: z.string(),
  produto: z.string(),
  tamanho: z.string(),
  cor: z.string(),
  estoque: z.number().int().min(0),
  estoque_minimo: z.number().int().min(1),
});
export type AlertaEstoque = z.infer<typeof alertaEstoqueSchema>;
export const alertasEstoqueResponseSchema = z.object({ total: z.number().int().min(0), itens: z.array(alertaEstoqueSchema) });
