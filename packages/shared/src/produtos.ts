import { z } from 'zod';
import { VALOR_MAXIMO_CENTAVOS, valorCentavosSchema } from './financeiro.js';

// Contrato de Produtos (S07, RF-PRO-01…05/07; RN-01, RN-03, RN-05). ADR 006.
// Sem .transform() nos schemas de RESPOSTA (o serializador do Zod 4 não codifica transformação de mão única).

export const PORTES = ['slim', 'plus'] as const;
export const porteSchema = z.enum(PORTES);
export type Porte = z.infer<typeof porteSchema>;

// Entrada de mercadoria e ajustes são do Dono (RF-PRO-04); 'inicial' nasce no cadastro e 'venda' /
// 'estorno_venda' só a Vendas (S10) grava, pela interface pública de estoque.
export const TIPOS_MOVIMENTO = ['inicial', 'entrada', 'ajuste', 'venda', 'estorno_venda'] as const;
export const tipoMovimentoSchema = z.enum(TIPOS_MOVIMENTO);
export type TipoMovimento = z.infer<typeof tipoMovimentoSchema>;

export const ESTOQUE_MAXIMO = 100_000;
export const MAX_SKUS_POR_PRODUTO = 144;
export const MAX_CORES_POR_PRODUTO = 12;
export const NUMERO_MAXIMO_PRODUTO = 9999;

// ------------------------------------------------------------------ preço sugerido (RN-05)
/**
 * RN-05: preço sugerido = custo × (1 + markup), em centavos inteiros, sem ponto flutuante.
 * `markupBps` em pontos-base (1% = 100). O centavo é arredondado para o mais próximo, metade para cima
 * (o PRD diz "sem arredondamento", mas dinheiro é inteiro em centavos, RN-01). Sempre editável pelo Dono.
 */
export function precoSugeridoCentavos(custoCentavos: number, markupBps: number): number {
  if (!Number.isInteger(custoCentavos) || custoCentavos < 0) throw new Error('custo deve ser inteiro em centavos, não negativo');
  if (!Number.isInteger(markupBps) || markupBps < 0) throw new Error('markup deve ser inteiro em pontos-base, não negativo');
  return Math.floor((custoCentavos * (10_000 + markupBps) + 5_000) / 10_000);
}

// ------------------------------------------------------------------ ordem dos tamanhos e busca por preço
const ORDEM_DAS_LETRAS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG', 'EG', 'EGG', 'U'];

function chaveDoTamanho(t: string): [number, number, string] {
  const letra = ORDEM_DAS_LETRAS.indexOf(t);
  if (letra >= 0) return [0, letra, ''];
  if (/^\d+$/.test(t)) return [1, Number(t), ''];
  return [2, 0, t];
}

/** Ordem de grade, não alfabética: PP, P, M, G, GG…, depois 40, 42, 44…, depois o que não se conhece. */
export function compararTamanhos(a: string, b: string): number {
  const [ga, na, sa] = chaveDoTamanho(a);
  const [gb, nb, sb] = chaveDoTamanho(b);
  return ga - gb || na - nb || sa.localeCompare(sb);
}

/**
 * RF-PRO-03: o que a pessoa digitou na busca, se for um preço. Com centavos ("89,90") é exato; só os reais ("89")
 * é a faixa daquele real (R$ 89,00 a R$ 89,99). Devolve null se não parecer preço. Sem ponto flutuante (RN-01).
 */
export function faixaDePreco(texto: string): { min: number; max: number } | null {
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(texto.trim().replace(/^R\$\s*/i, ''));
  if (!m) return null;
  const reais = Number(m[1]) * 100;
  if (m[2] === undefined) return { min: reais, max: reais + 99 };
  const exato = reais + Number(m[2].padEnd(2, '0'));
  return { min: exato, max: exato };
}

// ------------------------------------------------------------------ código do SKU (P1 §4)
export function montarCodigoSku(numeroProduto: number, tamanho: string, corCodigo: string): string {
  if (!Number.isInteger(numeroProduto) || numeroProduto < 1 || numeroProduto > NUMERO_MAXIMO_PRODUTO) {
    throw new Error(`número do produto fora de 1 a ${NUMERO_MAXIMO_PRODUTO}`);
  }
  return `${String(numeroProduto).padStart(4, '0')}-${tamanho}-${corCodigo}`;
}

const semAcento = (texto: string): string => texto.normalize('NFD').replace(/\p{M}/gu, '');

/** Letras e números do nome, sem acento e em maiúsculas (base do código da cor). */
const letrasDaCor = (nome: string): string => semAcento(nome).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Mesma cor escrita de jeitos diferentes ("Rosa Chá", "rosa  cha") tem a mesma chave. */
export function chaveCor(nome: string): string {
  return semAcento(nome).toLowerCase().replace(/\s+/g, ' ').trim();
}

const SUFIXOS_DE_DESEMPATE = '23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 3 caracteres: as 3 primeiras letras (completa com X). Se já é de outra cor do produto, troca o último. */
export function codigoCor(nome: string, usados: ReadonlySet<string>): string {
  const letras = letrasDaCor(nome);
  if (letras === '') throw new Error('a cor precisa ter ao menos uma letra ou número');
  const base = letras.slice(0, 3).padEnd(3, 'X');
  if (!usados.has(base)) return base;
  for (const sufixo of SUFIXOS_DE_DESEMPATE) {
    const candidato = base.slice(0, 2) + sufixo;
    if (!usados.has(candidato)) return candidato;
  }
  throw new Error('cores demais com o mesmo começo');
}

/** Um código por cor distinta do produto, na ordem em que aparecem; a mesma cor repete o mesmo código. */
export function atribuirCodigosDeCor(nomes: readonly string[]): Map<string, string> {
  const mapa = new Map<string, string>();
  const usados = new Set<string>();
  for (const nome of nomes) {
    const chave = chaveCor(nome);
    if (mapa.has(chave)) continue;
    const codigo = codigoCor(nome, usados);
    usados.add(codigo);
    mapa.set(chave, codigo);
  }
  return mapa;
}

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
    // Id da venda (RN-08): obrigatório na venda e no seu estorno, proibido nos demais tipos.
    origemId: z.uuid().nullish(),
  })
  .refine((m) => (m.tipo === 'venda' || m.tipo === 'estorno_venda') === (m.origemId != null), {
    error: 'venda e estorno de venda exigem o id da venda; os demais tipos não têm',
    path: ['origemId'],
  })
  .refine((m) => !['inicial', 'entrada', 'estorno_venda'].includes(m.tipo) || m.quantidade > 0, {
    error: 'estoque inicial, entrada e estorno de venda são quantidades positivas',
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

export const produtoIdParamsSchema = z.object({ id: z.uuid() });
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
