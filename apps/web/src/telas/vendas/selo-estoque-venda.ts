/** Tom visual do selo de estoque nos cards da venda (V02). */
export type TomEstoqueVenda = 'ok' | 'baixo' | 'zerado';

/**
 * ok = saldo saudável (inclui atual === mínimo); baixo = abaixo do mínimo;
 * zerado = atual ≤ 0 (tem prioridade sobre baixo).
 */
export function tomEstoqueVenda(atual: number, minimo?: number): TomEstoqueVenda {
  if (atual <= 0) return 'zerado';
  if (minimo !== undefined && atual < minimo) return 'baixo';
  return 'ok';
}

/** Rótulo curto de estoque nos cards da venda (sugestões / catálogo). */
export function rotuloEstoqueVenda(atual: number, minimo?: number): string {
  const tom = tomEstoqueVenda(atual, minimo);
  if (tom === 'zerado') return 'Zerado';
  if (tom === 'baixo') return `Baixo · ${atual}`;
  return `${atual} em estoque`;
}

/** Cor Mantine do Badge por tom (ok = teal/verde; baixo = âmbar; zerado = vermelho). */
export function corBadgeEstoque(tom: TomEstoqueVenda): 'teal' | 'ambar' | 'red' {
  if (tom === 'baixo') return 'ambar';
  if (tom === 'zerado') return 'red';
  return 'teal';
}

/** Alerta visual só no tom baixo (âmbar). Zerado usa vermelho sem ícone de alerta. */
export function estoqueBaixo(atual: number, minimo?: number): boolean {
  return tomEstoqueVenda(atual, minimo) === 'baixo';
}
