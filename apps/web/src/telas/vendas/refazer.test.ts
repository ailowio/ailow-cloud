import { describe, expect, it } from 'vitest';
import type { SkuParaVenda, Venda } from '@ailow/shared';
import { itensParaRefazer } from './refazer';

// ADR 014 (opção 1, "cancelar e refazer"): a venda cancelada volta para o carrinho com as mesmas peças e quantidades,
// com o preço e o estoque ATUAIS (a API recalcula tudo ao finalizar). Peça que não existe mais fica de fora, com aviso.
const sku = (id: string, codigo: string, extra: Partial<SkuParaVenda> = {}): SkuParaVenda => ({
  id,
  codigo,
  nome: `Peça ${codigo}`,
  tamanho: 'M',
  cor: 'Preto',
  preco_centavos: 5000,
  estoque: 3,
  categoria_nome: 'Sutiã',
  ...extra,
});
const item = (sku_id: string, codigo: string, quantidade: number) => ({
  sku_id,
  codigo,
  nome: `Peça ${codigo}`,
  tamanho: 'M',
  cor: 'Preto',
  quantidade,
  preco_unitario_centavos: 4000,
});
const venda = (itens: Venda['itens']) => ({ itens }) as Pick<Venda, 'itens'>;

describe('itens para refazer a venda', () => {
  it('mesmas peças e quantidades, com preço e estoque atuais', () => {
    const r = itensParaRefazer(venda([item('a', 'A1', 2), item('b', 'B1', 1)]), [
      sku('a', 'A1', { preco_centavos: 5500, estoque: 4 }),
      sku('b', 'B1', { tamanho: 'G', cor: 'Nude' }),
    ]);
    expect(r.faltando).toEqual([]);
    expect(r.itens).toEqual([
      { skuId: 'a', codigo: 'A1', nome: 'Peça A1', detalhe: 'M · Preto', precoCentavos: 5500, estoque: 4, qtd: 2 },
      { skuId: 'b', codigo: 'B1', nome: 'Peça B1', detalhe: 'G · Nude', precoCentavos: 5000, estoque: 3, qtd: 1 },
    ]);
  });

  it('peça que não foi achada (arquivada) fica de fora e é avisada pelo nome', () => {
    const r = itensParaRefazer(venda([item('a', 'A1', 1), item('x', 'X9', 1)]), [sku('a', 'A1')]);
    expect(r.itens.map((i) => i.codigo)).toEqual(['A1']);
    expect(r.faltando).toEqual(['Peça X9 (M · Preto)']);
  });

  it('quantidade acima do estoque atual é limitada ao estoque (sem estoque: fica de fora e é avisada)', () => {
    const r = itensParaRefazer(venda([item('a', 'A1', 5), item('b', 'B1', 1)]), [sku('a', 'A1', { estoque: 2 }), sku('b', 'B1', { estoque: 0 })]);
    expect(r.itens).toEqual([expect.objectContaining({ codigo: 'A1', qtd: 2 })]);
    expect(r.faltando).toEqual(['Peça B1 (M · Preto)']);
  });
});
