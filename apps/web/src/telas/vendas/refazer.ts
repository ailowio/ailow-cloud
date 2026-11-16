import type { SkuParaVenda, Venda } from '@ailow/shared';
import type { ItemVenda } from './carrinho';

/**
 * ADR 014 (opção 1, "cancelar e refazer"): monta o carrinho a partir da venda cancelada. Mesmas peças e quantidades,
 * com o preço e o estoque ATUAIS (a API recalcula ao finalizar). Peça não achada (arquivada) ou sem estoque fica de
 * fora e vai para `faltando` (nome + tamanho · cor), para o app avisar.
 */
export function itensParaRefazer(venda: Pick<Venda, 'itens'>, skus: readonly SkuParaVenda[]): { itens: ItemVenda[]; faltando: string[] } {
  const porId = new Map(skus.map((s) => [s.id, s]));
  const itens: ItemVenda[] = [];
  const faltando: string[] = [];
  for (const i of venda.itens) {
    const s = porId.get(i.sku_id);
    if (!s || s.estoque < 1) {
      faltando.push(`${i.nome} (${i.tamanho} · ${i.cor})`);
      continue;
    }
    itens.push({
      skuId: s.id,
      codigo: s.codigo,
      nome: s.nome,
      detalhe: `${s.tamanho} · ${s.cor}`,
      precoCentavos: s.preco_centavos,
      estoque: s.estoque,
      qtd: Math.min(i.quantidade, s.estoque),
    });
  }
  return { itens, faltando };
}
