// Carrinho da venda (RF-VEN-03/04). A peça só entra se houver estoque; ler de novo soma 1. Sem item avulso.

export const MENSAGEM_SEM_ESTOQUE = 'Peça sem estoque — chame o Dono';

export interface ItemVenda {
  skuId: string;
  codigo: string;
  nome: string;
  detalhe: string;
  precoCentavos: number;
  estoque: number;
  qtd: number;
}

export interface PassoCarrinho {
  itens: ItemVenda[];
  aviso: string | null;
}

export function subtotalCentavos(itens: ItemVenda[]): number {
  return itens.reduce((s, i) => s + i.precoCentavos * i.qtd, 0);
}

export function acrescentar(itens: ItemVenda[], peca: Omit<ItemVenda, 'qtd'>): PassoCarrinho {
  const i = itens.findIndex((item) => item.skuId === peca.skuId);
  if (i < 0) {
    if (peca.estoque < 1) return { itens, aviso: MENSAGEM_SEM_ESTOQUE };
    return { itens: [...itens, { ...peca, qtd: 1 }], aviso: null };
  }
  const atual = itens[i] as ItemVenda;
  if (atual.qtd + 1 > atual.estoque) return { itens, aviso: MENSAGEM_SEM_ESTOQUE };
  const copia = itens.slice();
  copia[i] = { ...atual, qtd: atual.qtd + 1 };
  return { itens: copia, aviso: null };
}

export function mudarQuantidade(itens: ItemVenda[], codigo: string, delta: number): PassoCarrinho {
  const i = itens.findIndex((item) => item.codigo === codigo);
  if (i < 0) return { itens, aviso: null };
  const atual = itens[i] as ItemVenda;
  const qtd = atual.qtd + delta;
  if (qtd <= 0) return { itens: itens.filter((item) => item.codigo !== codigo), aviso: null };
  if (qtd > atual.estoque) return { itens, aviso: MENSAGEM_SEM_ESTOQUE };
  const copia = itens.slice();
  copia[i] = { ...atual, qtd };
  return { itens: copia, aviso: null };
}
