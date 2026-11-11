// Etiquetas (S08, RF-PRO-06, ADR 003): regras puras, sem Zod (o web usa por `@ailow/shared/puro`).

/** A bobina do Pedro é de 3 colunas (33 × 22 mm): cada página do PDF é uma fileira. */
export const ETIQUETAS_POR_FILEIRA = 3;

/** Teto por PDF: 333 fileiras. Acima disso, o Dono gera mais de um PDF. */
export const MAX_ETIQUETAS_POR_PDF = 999;

export const fileirasDeEtiquetas = (total: number): number => Math.ceil(total / ETIQUETAS_POR_FILEIRA);

/** Etiquetas da última fileira que saem sem impressão (a impressora avança a fileira inteira). */
export const etiquetasEmBranco = (total: number): number => fileirasDeEtiquetas(total) * ETIQUETAS_POR_FILEIRA - total;
