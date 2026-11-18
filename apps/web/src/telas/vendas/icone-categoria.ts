/** Chave estável do ícone da categoria (mapeada no Wizard para um ícone Tabler). */
export type ChaveIconeCategoria =
  | 'sutia'
  | 'calcinha'
  | 'bebida'
  | 'acessorio'
  | 'body'
  | 'pijama'
  | 'meia'
  | 'geral';

/**
 * Escolhe um ícone pelo nome da categoria (heurística por palavras-chave).
 * Fallback: geral (tag).
 */
export function chaveIconeCategoria(nome: string): ChaveIconeCategoria {
  const n = nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  if (/sutia|soutien|suti/.test(n)) return 'sutia';
  if (/calcinha|calca/.test(n)) return 'calcinha';
  if (/bebida|drink|agua|café|cafe|suco/.test(n)) return 'bebida';
  if (/acessor|bijuter|protetor|mamilo/.test(n)) return 'acessorio';
  if (/body|bodies/.test(n)) return 'body';
  if (/pijama|camisol/.test(n)) return 'pijama';
  if (/meia|meias/.test(n)) return 'meia';
  return 'geral';
}

/** Estoque somado dos SKUs com saldo > 0; mínimo do SKU mais crítico (quando existir). */
export function resumoEstoqueProduto(produto: {
  skus: readonly { estoque: number; estoque_minimo?: number }[];
  preco_centavos: number;
}): { estoque: number; estoqueMinimo?: number; precoCentavos: number; baixo: boolean } {
  const comSaldo = produto.skus.filter((s) => s.estoque > 0);
  const estoque = comSaldo.reduce((s, sku) => s + sku.estoque, 0);
  const comMinimo = comSaldo.filter((s) => s.estoque_minimo !== undefined);
  let estoqueMinimo: number | undefined;
  let baixo = false;
  for (const s of comMinimo) {
    const min = s.estoque_minimo;
    if (min === undefined) continue;
    if (estoqueMinimo === undefined || min < estoqueMinimo) estoqueMinimo = min;
    if (s.estoque < min) baixo = true;
  }
  return { estoque, estoqueMinimo, precoCentavos: produto.preco_centavos, baixo };
}
