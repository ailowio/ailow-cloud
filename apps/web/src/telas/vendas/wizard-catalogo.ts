import type { Categoria, Produto } from '@ailow/shared';
import { TAMANHOS_PADRAO } from '@ailow/shared';

/** Passos do wizard Catálogo (opção A): Categoria → Produto → Tamanho → Cor. */
export const PASSOS_CATALOGO = ['categoria', 'produto', 'tamanho', 'cor'] as const;
export type PassoCatalogo = (typeof PASSOS_CATALOGO)[number];

export const TITULOS_CATALOGO: Record<PassoCatalogo, string> = {
  categoria: 'Escolha a categoria',
  produto: 'Escolha o produto',
  tamanho: 'Escolha o tamanho',
  cor: 'Escolha a cor',
};

export function skusComEstoque(produto: Produto): Produto['skus'] {
  return produto.skus.filter((s) => s.estoque > 0);
}

export function produtoTemEstoque(produto: Produto): boolean {
  return skusComEstoque(produto).length > 0;
}

/** Categorias de produto que ainda têm ao menos um SKU com estoque. */
export function categoriasComEstoque(categorias: readonly Categoria[], produtos: readonly Produto[]): Categoria[] {
  const comEstoque = new Set(
    produtos.filter(produtoTemEstoque).map((p) => p.categoria_id),
  );
  return categorias.filter((c) => c.tipo === 'produto' && c.ativa !== false && comEstoque.has(c.id));
}

export function produtosDaCategoria(produtos: readonly Produto[], categoriaId: string): Produto[] {
  return produtos
    .filter((p) => p.categoria_id === categoriaId && produtoTemEstoque(p))
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

const ORDEM = new Map(TAMANHOS_PADRAO.map((t, i) => [t, i]));

function compararTamanho(a: string, b: string): number {
  const ia = ORDEM.get(a as (typeof TAMANHOS_PADRAO)[number]);
  const ib = ORDEM.get(b as (typeof TAMANHOS_PADRAO)[number]);
  if (ia !== undefined && ib !== undefined) return ia - ib;
  if (ia !== undefined) return -1;
  if (ib !== undefined) return 1;
  return a.localeCompare(b, 'pt-BR', { numeric: true });
}

/** Tamanhos com estoque, na ordem da grade. */
export function tamanhosComEstoque(produto: Produto): string[] {
  const set = new Set(skusComEstoque(produto).map((s) => s.tamanho));
  return [...set].sort(compararTamanho);
}

/** SKUs do tamanho com estoque, por nome de cor. */
export function skusDoTamanho(produto: Produto, tamanho: string): Produto['skus'] {
  return skusComEstoque(produto)
    .filter((s) => s.tamanho === tamanho)
    .slice()
    .sort((a, b) => a.cor.localeCompare(b.cor, 'pt-BR'));
}

export function indicePasso(passo: PassoCatalogo): number {
  return PASSOS_CATALOGO.indexOf(passo);
}

export function passoAnterior(passo: PassoCatalogo): PassoCatalogo | null {
  const i = indicePasso(passo);
  return i <= 0 ? null : PASSOS_CATALOGO[i - 1]!;
}
