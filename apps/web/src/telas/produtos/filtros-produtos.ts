import { chaveCor } from '@ailow/shared/puro';
import type { ConsultaProdutos } from '../../api/endpoints';

/** Filtros da lista de Produtos (P02). A categoria leva o nome para o chip; a cor casa exato pela chave (D-A7). */
export interface FiltrosProdutos {
  categoria?: { id: string; nome: string };
  cor?: string;
}

export function quantosFiltros(f: FiltrosProdutos): number {
  return (f.categoria ? 1 : 0) + (f.cor ? 1 : 0);
}

export function consultaDosFiltros(f: FiltrosProdutos): Pick<ConsultaProdutos, 'categoria_id' | 'cor'> {
  return { ...(f.categoria && { categoria_id: f.categoria.id }), ...(f.cor && { cor: f.cor }) };
}

/**
 * Categorias oferecidas no filtro: as ativas da empresa (só o Dono lê /categorias) mais as dos produtos carregados,
 * sem repetir o id, em ordem alfabética.
 */
export function categoriasDoFiltro(
  daEmpresa: readonly { id: string; nome: string; ativa: boolean }[] | null,
  produtos: readonly { categoria_id: string; categoria_nome: string }[],
): { id: string; nome: string }[] {
  const porId = new Map<string, string>();
  for (const c of daEmpresa ?? []) if (c.ativa) porId.set(c.id, c.nome);
  for (const p of produtos) if (!porId.has(p.categoria_id)) porId.set(p.categoria_id, p.categoria_nome);
  return [...porId].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Cores oferecidas no filtro: as ativas da grade da empresa (só o Dono lê /opcoes-grade) mais as que já estão nos SKUs,
 * sem repetir pela chave da cor (a primeira grafia vence), em ordem alfabética.
 */
export function coresDoFiltro(
  grade: readonly { nome: string; ativa: boolean }[] | null,
  produtos: readonly { skus: readonly { cor: string }[] }[],
): string[] {
  const porChave = new Map<string, string>();
  const nomes = [...(grade ?? []).filter((c) => c.ativa).map((c) => c.nome), ...produtos.flatMap((p) => p.skus.map((s) => s.cor))];
  for (const nome of nomes) {
    const chave = chaveCor(nome);
    if (chave !== '' && !porChave.has(chave)) porChave.set(chave, nome);
  }
  return [...porChave.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
