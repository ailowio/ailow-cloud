import type { Categoria, Produto } from '@ailow/shared';
import { TAMANHOS_PADRAO } from '@ailow/shared';

/** Passos fixos iniciais; depois um passo por eixo do produto (tamanho, cor, taça…). */
export const PASSOS_FIXOS = ['categoria', 'produto'] as const;
export type PassoFixo = (typeof PASSOS_FIXOS)[number];
export type PassoEixo = `eixo:${string}`;
/** Inclui `tamanho`/`cor` legados (PASSOS_CATALOGO / testes) além de `eixo:slug`. */
export type PassoCatalogo = PassoFixo | PassoEixo | 'tamanho' | 'cor';

/** Compat: testes e callers que ainda esperam a sequência clássica de 4 passos. */
export const PASSOS_CATALOGO = ['categoria', 'produto', 'tamanho', 'cor'] as const;

export const TITULOS_CATALOGO: Record<string, string> = {
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
  const comEstoque = new Set(produtos.filter(produtoTemEstoque).map((p) => p.categoria_id));
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

/** Eixos na ordem do SKU (ou tamanho→cor se o produto ainda não expõe `eixos`). */
export function eixosDoProduto(produto: Produto): { slug: string; nome: string }[] {
  const com = skusComEstoque(produto).find((s) => s.eixos && s.eixos.length > 0);
  if (com?.eixos?.length) {
    return com.eixos.map((e) => ({ slug: e.slug, nome: e.nome }));
  }
  return [
    { slug: 'tamanho', nome: 'Tamanho' },
    { slug: 'cor', nome: 'Cor' },
  ];
}

export function tituloDoEixo(slug: string, nome: string): string {
  return TITULOS_CATALOGO[slug] ?? `Escolha ${nome.toLowerCase()}`;
}

export function passosEixosDoProduto(produto: Produto): PassoEixo[] {
  return eixosDoProduto(produto).map((e) => `eixo:${e.slug}` as PassoEixo);
}

function valorDoEixo(sku: Produto['skus'][number], slug: string): string {
  const via = sku.eixos?.find((e) => e.slug === slug)?.valor;
  if (via !== undefined) return via;
  if (slug === 'tamanho') return sku.tamanho;
  if (slug === 'cor') return sku.cor;
  return '';
}

/** SKUs ainda compatíveis com as escolhas já feitas nos eixos anteriores. */
export function skusFiltrados(
  produto: Produto,
  escolhas: Readonly<Record<string, string>>,
): Produto['skus'] {
  return skusComEstoque(produto).filter((s) =>
    Object.entries(escolhas).every(([slug, valor]) => valorDoEixo(s, slug) === valor),
  );
}

/** Valores distintos do eixo atual, entre os SKUs ainda possíveis. */
export function opcoesDoEixo(
  produto: Produto,
  escolhasAnteriores: Readonly<Record<string, string>>,
  slug: string,
): string[] {
  const set = new Set(skusFiltrados(produto, escolhasAnteriores).map((s) => valorDoEixo(s, slug)));
  const vals = [...set].filter((v) => v !== '');
  if (slug === 'tamanho') return vals.sort(compararTamanho);
  return vals.sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Tamanhos com estoque, na ordem da grade (compat). */
export function tamanhosComEstoque(produto: Produto): string[] {
  return opcoesDoEixo(produto, {}, 'tamanho');
}

/** SKUs do tamanho com estoque, por nome de cor (compat). */
export function skusDoTamanho(produto: Produto, tamanho: string): Produto['skus'] {
  return skusFiltrados(produto, { tamanho })
    .slice()
    .sort((a, b) => a.cor.localeCompare(b.cor, 'pt-BR'));
}

export function indicePasso(passo: PassoCatalogo, eixos: readonly PassoEixo[]): number {
  if (passo === 'categoria') return 0;
  if (passo === 'produto') return 1;
  if (passo === 'tamanho' || passo === 'cor') {
    const i = eixos.indexOf(`eixo:${passo}` as PassoEixo);
    return i >= 0 ? 2 + i : PASSOS_CATALOGO.indexOf(passo);
  }
  const i = eixos.indexOf(passo);
  return i >= 0 ? 2 + i : -1;
}

export function passoAnterior(passo: PassoCatalogo, eixos: readonly PassoEixo[] = []): PassoCatalogo | null {
  if (passo === 'categoria') return null;
  if (passo === 'produto') return 'categoria';
  // Compat testes clássicos sem lista de eixos.
  if (passo === 'tamanho') return 'produto';
  if (passo === 'cor') return 'tamanho';
  const i = eixos.indexOf(passo as PassoEixo);
  if (i < 0) return 'produto';
  if (i === 0) return 'produto';
  return eixos[i - 1] ?? 'produto';
}
