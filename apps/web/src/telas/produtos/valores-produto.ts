import { PRECO_MAXIMO_CENTAVOS, precoSugeridoCentavos } from '@ailow/shared/puro';

// S10: contas do passo "Custo e preço" do assistente de novo produto. Dinheiro em centavos inteiros (RN-01) e
// markup em pontos-base (1% = 100), sem ponto flutuante. A regra do preço sugerido é a da API (RN-05).

/** Markup máximo aceito na tela: 100.000% (evita estouro; o preço ainda é limitado pelo teto de R$ 20 milhões). */
export const MARKUP_MAXIMO_BPS = 10_000_000;

/**
 * Campo monetário "por dígitos": só os números digitados contam e os dois últimos são os centavos
 * ("4" -> 0,04; "4500" -> 45,00). Sem dígito devolve null; acima do teto, trava no teto.
 */
export function digitosParaCentavos(texto: string): number | null {
  const digitos = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (digitos === '') return null;
  if (digitos.length > 10) return PRECO_MAXIMO_CENTAVOS;
  return Math.min(Number(digitos), PRECO_MAXIMO_CENTAVOS);
}

/** 123456 -> "1.234,56"; null -> "" (campo vazio mostra o placeholder). Só aritmética inteira. */
export function mascaraCentavos(centavos: number | null): string {
  if (centavos === null) return '';
  const reais = String(Math.floor(centavos / 100)).replace(/\B(?=(\d{3})+$)/g, '.');
  return `${reais},${String(centavos % 100).padStart(2, '0')}`;
}

/** Preço = custo × (1 + markup). Sem custo (0) não há base de cálculo; acima do teto também devolve null. */
export function precoPorMarkup(custo: number, markupBps: number): number | null {
  if (!Number.isInteger(custo) || custo <= 0 || custo > PRECO_MAXIMO_CENTAVOS) return null;
  if (!Number.isInteger(markupBps) || markupBps < 0) return null;
  const preco = precoSugeridoCentavos(custo, markupBps);
  return preco <= PRECO_MAXIMO_CENTAVOS ? preco : null;
}

/**
 * Markup que o preço digitado representa: (preço − custo) ÷ custo, arredondado ao ponto-base mais próximo.
 * Sem custo ou sem preço devolve null; preço no custo ou abaixo dele vale 0 (a tela avisa à parte).
 */
export function markupBpsDoPreco(custo: number, preco: number | null): number | null {
  if (preco === null || !Number.isInteger(custo) || !Number.isInteger(preco) || custo <= 0) return null;
  if (preco <= custo) return 0;
  return Math.min(MARKUP_MAXIMO_BPS, Math.floor(((preco - custo) * 20_000 + custo) / (2 * custo)));
}

/** "35", "35,5", "35.25", " 80 % " -> pontos-base; vazio, negativo, letra, 3 casas ou acima do máximo -> null. */
export function percentualParaBps(texto: string): number | null {
  const t = texto.replace(/%/g, '').trim();
  const m = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  const bps = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return bps <= MARKUP_MAXIMO_BPS ? bps : null;
}

/** 8000 -> "80"; 3550 -> "35,5"; 3525 -> "35,25". */
export function bpsParaTexto(bps: number): string {
  const inteiro = Math.floor(bps / 100);
  const frac = String(bps % 100).padStart(2, '0').replace(/0$/, '');
  return frac === '' || frac === '0' ? String(inteiro) : `${inteiro},${frac}`;
}

/** Botões − e + do markup: soma o passo e mantém o resultado entre 0 e o máximo. */
export function ajustarMarkupBps(atual: number, passoBps: number): number {
  return Math.max(0, Math.min(MARKUP_MAXIMO_BPS, atual + passoBps));
}
