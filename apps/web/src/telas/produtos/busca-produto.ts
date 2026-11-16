import type { Produto } from '@ailow/shared';
import type { CamposBusca } from '../../lib/busca';

/** Itens por página nas listas de produtos (UXM-09). Etiquetas usa menos: cada cartão traz controles por SKU. */
export const PRODUTOS_POR_PAGINA = 20;
export const ETIQUETAS_POR_PAGINA = 6;

/** O que a busca ampla enxerga de um produto: nome, categoria, nº, código/tamanho/cor de cada SKU e o preço. */
export function camposDoProduto(p: Produto): CamposBusca {
  return {
    textos: [p.nome, p.categoria_nome, String(p.numero), ...p.skus.flatMap((s) => [s.codigo, `${s.tamanho} ${s.cor}`])],
    precoCentavos: p.preco_centavos,
  };
}
