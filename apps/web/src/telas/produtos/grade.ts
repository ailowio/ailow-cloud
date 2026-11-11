import type { SkuNovo } from '@ailow/shared';
import {
  ESTOQUE_MAXIMO,
  MAX_CORES_POR_PRODUTO,
  PRECO_MAXIMO_CENTAVOS,
  chaveCor,
  compararTamanhos,
  letrasDaCor,
  precoSugeridoCentavos,
} from '@ailow/shared/puro';
import { reaisParaCentavos } from '../../lib/dinheiro';

// Regras do passo a passo de "Novo produto" (RF-PRO-01) que não dependem da tela: grades da pesquisa P1,
// combinações tamanho × cor, quantidades digitadas e preço sugerido. A API valida tudo de novo (esta é só a tela).

export const GRADES = [
  { id: 'letras', rotulo: 'P, M, G, GG', tamanhos: ['P', 'M', 'G', 'GG'] },
  { id: 'sutia', rotulo: 'Sutiã 40 a 56', tamanhos: ['40', '42', '44', '46', '48', '50', '52', '54', '56'] },
  { id: 'unico', rotulo: 'Tamanho único', tamanhos: ['U'] },
] as const;

// Sugestões para tocar em vez de digitar; a lista cresce com o uso na loja (P1 §3, regra 4).
export const CORES_SUGERIDAS = ['Preto', 'Nude', 'Branco', 'Vermelho', 'Chocolate', 'Vinho', 'Rosa', 'Azul'];

const TAMANHO_VALIDO = /^[A-Z0-9]{1,3}$/;

/** Liga/desliga um tamanho; a lista fica na ordem de grade (P, M, G, GG… 40, 42…). */
export function alternarTamanho(tamanhos: readonly string[], tamanho: string): string[] {
  const novo = tamanhos.includes(tamanho) ? tamanhos.filter((t) => t !== tamanho) : [...tamanhos, tamanho];
  return novo.sort(compararTamanhos);
}

/** Tamanho digitado à mão (ex.: G1): maiúsculas, 1 a 3 letras ou números. Inválido ou repetido não entra. */
export function adicionarTamanho(tamanhos: readonly string[], digitado: string): string[] {
  const t = digitado.trim().toUpperCase();
  if (!TAMANHO_VALIDO.test(t) || tamanhos.includes(t)) return [...tamanhos];
  return [...tamanhos, t].sort(compararTamanhos);
}

/** Liga/desliga uma cor sem diferenciar maiúsculas nem acento ("Rosa Chá" = "rosa cha"). */
export function alternarCor(cores: readonly string[], cor: string): string[] {
  const chave = chaveCor(cor);
  return cores.some((c) => chaveCor(c) === chave) ? cores.filter((c) => chaveCor(c) !== chave) : [...cores, cor.trim()];
}

/** Cor digitada à mão: apara, ignora vazia/repetida/sem letra e respeita o limite de cores do produto. */
export function adicionarCor(cores: readonly string[], digitada: string): string[] {
  const cor = digitada.trim();
  const repetida = cores.some((c) => chaveCor(c) === chaveCor(cor));
  if (cor === '' || cor.length > 30 || letrasDaCor(cor) === '' || repetida || cores.length >= MAX_CORES_POR_PRODUTO) {
    return [...cores];
  }
  return [...cores, cor];
}

export const chaveSku = (tamanho: string, cor: string): string => `${tamanho}|${chaveCor(cor)}`;

export interface Combinacao {
  chave: string;
  tamanho: string;
  cor: string;
}

/** Um SKU por par tamanho × cor: tamanhos na ordem de grade, cores na ordem em que foram escolhidas. */
export function combinacoes(tamanhos: readonly string[], cores: readonly string[]): Combinacao[] {
  return [...tamanhos]
    .sort(compararTamanhos)
    .flatMap((tamanho) => cores.map((cor) => ({ chave: chaveSku(tamanho, cor), tamanho, cor })));
}

/** Quantidade inteira de 0 a 100.000, só dígitos; qualquer outra coisa (vazio, vírgula, sinal) vale null. */
export function inteiroOuNulo(texto: string): number | null {
  const t = texto.trim();
  if (!/^\d{1,6}$/.test(t)) return null;
  const n = Number(t);
  return n <= ESTOQUE_MAXIMO ? n : null;
}

export interface LinhaEstoque {
  inicial: string;
  minimo: string;
}

/**
 * Estoque inicial e mínimo de cada SKU (RF-PRO-01/05). O mínimo é obrigatório: linha em branco ou inválida fica
 * pendente, e enquanto houver pendência nenhum SKU é devolvido (nada de enviar pela metade).
 */
export function skusDoFormulario(
  tamanhos: readonly string[],
  cores: readonly string[],
  linhas: Readonly<Record<string, LinhaEstoque>>,
): { skus: SkuNovo[]; pendentes: number } {
  const todas = combinacoes(tamanhos, cores);
  if (todas.length === 0) return { skus: [], pendentes: 1 };
  const skus: SkuNovo[] = [];
  let pendentes = 0;
  for (const c of todas) {
    const linha = linhas[c.chave];
    const inicial = linha ? inteiroOuNulo(linha.inicial) : null;
    const minimo = linha ? inteiroOuNulo(linha.minimo) : null;
    if (inicial === null || minimo === null) {
      pendentes += 1;
      continue;
    }
    skus.push({ tamanho: c.tamanho, cor: c.cor, estoque_inicial: inicial, estoque_minimo: minimo });
  }
  return pendentes === 0 ? { skus, pendentes } : { skus: [], pendentes };
}

export interface Precos {
  custo: number | null;
  preco: number | null;
  sugerido: number | null;
}

/** Custo e preço digitados (em reais, com vírgula) e a sugestão custo × (1 + markup) (RN-05). */
export function precosDoFormulario(custoTexto: string, precoTexto: string, markupBps: number): Precos {
  const custo = custoTexto.trim() === '' ? null : reaisParaCentavos(custoTexto);
  const preco = precoTexto.trim() === '' ? null : reaisParaCentavos(precoTexto);
  let sugerido: number | null = null;
  if (custo !== null && custo > 0 && custo <= PRECO_MAXIMO_CENTAVOS) {
    const s = precoSugeridoCentavos(custo, markupBps);
    sugerido = s <= PRECO_MAXIMO_CENTAVOS ? s : null;
  }
  return { custo, preco, sugerido };
}
