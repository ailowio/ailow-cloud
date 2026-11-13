// Busca ampla e pura para listas (UXM-09): sem acento nem caixa, vários termos em qualquer ordem, e cada termo
// aceita caracteres soltos (subsequência: "cms" acha "camiseta"). Cobre código/SKU, nome e preço.

export interface CamposBusca {
  /** Textos pesquisáveis (código, nome, ...). Cada termo precisa casar INTEIRO dentro de um deles. */
  textos: readonly string[];
  /** Preço em centavos inteiros (RN-01), quando o item tem. */
  precoCentavos?: number;
}

/** Minúsculas, sem acento, espaços aparados. */
export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * O termo é um preço que bate com `centavos`? Aceita "49,9", "49.90" (reais) e "4990" (centavos); inteiro sem
 * separador também vale como reais ("49" acha R$ 49,00).
 */
export function precoCasa(termo: string, centavos: number): boolean {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(termo);
  if (!m) return false;
  const inteiro = Number(m[1]);
  if (m[2] !== undefined) return inteiro * 100 + Number(m[2].padEnd(2, '0')) === centavos;
  return inteiro === centavos || inteiro * 100 === centavos;
}

function ehSubsequencia(termo: string, texto: string): boolean {
  let i = 0;
  for (const c of texto) {
    if (c === termo[i]) i++;
    if (i === termo.length) return true;
  }
  return termo.length === 0;
}

// Menor é melhor: 0 exato · 1 prefixo (do campo ou de uma palavra) · 2 contém · 3 caracteres soltos · -1 não casa.
function notaNoTexto(termo: string, texto: string): number {
  if (texto === termo) return 0;
  if (texto.startsWith(termo) || texto.split(/[\s\-_/.,]+/).some((p) => p.startsWith(termo))) return 1;
  if (texto.includes(termo)) return 2;
  return ehSubsequencia(termo, texto) ? 3 : -1;
}

function notaDoTermo(termo: string, textos: readonly string[], precoCentavos: number | undefined): number {
  let melhor = -1;
  for (const t of textos) {
    const n = notaNoTexto(termo, t);
    if (n >= 0 && (melhor < 0 || n < melhor)) melhor = n;
  }
  if (precoCentavos !== undefined && precoCasa(termo, precoCentavos) && (melhor < 0 || melhor > 1)) melhor = 1;
  return melhor;
}

/** Filtra e ordena por relevância (estável: empate mantém a ordem original). Consulta vazia devolve tudo. */
export function filtrarPorBusca<T>(itens: readonly T[], consulta: string, campos: (item: T) => CamposBusca): T[] {
  const termos = normalizarBusca(consulta).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return [...itens];
  const pontuados: { item: T; nota: number; pos: number }[] = [];
  itens.forEach((item, pos) => {
    const c = campos(item);
    const textos = c.textos.map(normalizarBusca);
    let nota = 0;
    for (const termo of termos) {
      const n = notaDoTermo(termo, textos, c.precoCentavos);
      if (n < 0) return;
      nota += n;
    }
    pontuados.push({ item, nota, pos });
  });
  return pontuados.sort((a, b) => a.nota - b.nota || a.pos - b.pos).map((p) => p.item);
}
