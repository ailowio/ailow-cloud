/** Rótulo curto de estoque nos cards da venda (sugestões / catálogo). */
export function rotuloEstoqueVenda(atual: number, minimo?: number): string {
  if (minimo !== undefined && atual < minimo) return `Baixo · ${atual}`;
  return `${atual} em estoque`;
}

/** Alerta visual só quando o mínimo veio da API (Dono) e o saldo está abaixo. */
export function estoqueBaixo(atual: number, minimo?: number): boolean {
  return minimo !== undefined && atual < minimo;
}
