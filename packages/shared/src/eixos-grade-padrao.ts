// Eixos de sistema e valores padrão (sem Zod): web via `@ailow/shared/puro`.
// Reusa as listas da ADR 017; a biblioteca de eixos generaliza tamanho/cor.
export { TAMANHOS_PADRAO, CORES_PADRAO } from './opcoes-grade-padrao.js';

export const MAX_EIXOS_POR_CATEGORIA = 4;

/** Slugs reservados: não renomear nem apagar; espelham `skus.tamanho` / `skus.cor`. */
export const SLUGS_EIXO_SISTEMA = ['tamanho', 'cor'] as const;
export type SlugEixoSistema = (typeof SLUGS_EIXO_SISTEMA)[number];

export const TIPOS_VALOR_EIXO = ['tamanho', 'cor', 'texto'] as const;
export type TipoValorEixo = (typeof TIPOS_VALOR_EIXO)[number];
