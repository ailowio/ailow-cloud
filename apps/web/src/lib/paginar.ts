// Fatia uma lista em páginas (paginação no cliente, UXM-09). Página fora do limite é presa em [1, total].
export function paginar<T>(itens: readonly T[], pagina: number, tamanho: number) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / tamanho));
  const atual = Number.isFinite(pagina) ? Math.min(totalPaginas, Math.max(1, Math.floor(pagina))) : 1;
  return { itens: itens.slice((atual - 1) * tamanho, atual * tamanho), pagina: atual, totalPaginas };
}
