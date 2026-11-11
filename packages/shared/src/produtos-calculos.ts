// Regras puras de Produtos (S07), SEM dependências: o app web importa este módulo por `@ailow/shared/puro`
// sem levar o Zod ao navegador, e a API usa os mesmos cálculos (uma única fonte da regra, RN-05).

export const ESTOQUE_MAXIMO = 100_000;
export const MAX_SKUS_POR_PRODUTO = 144;
export const MAX_CORES_POR_PRODUTO = 12;
export const NUMERO_MAXIMO_PRODUTO = 9999;
// Mesmo teto de R$ 20 milhões do Financeiro (RN-01); o teste confere a igualdade com `VALOR_MAXIMO_CENTAVOS`.
export const PRECO_MAXIMO_CENTAVOS = 2_000_000_000;

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
export const letrasDaCor = (nome: string): string => semAcento(nome).toUpperCase().replace(/[^A-Z0-9]/g, '');

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
