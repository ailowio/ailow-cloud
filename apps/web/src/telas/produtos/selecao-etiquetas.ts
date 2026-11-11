import { MAX_ETIQUETAS_POR_PDF, etiquetasEmBranco, fileirasDeEtiquetas } from '@ailow/shared/puro';
import { mensagemGenerica } from '../../acesso/mensagens';
import type { ErroApi } from '../../api/cliente';

// Regras da tela "Etiquetas" (S08, RF-PRO-06). Quantidades por id do SKU; zero = fora da seleção.
export type Quantidades = Record<string, number>;

export function mudarQuantidade(q: Quantidades, skuId: string, pedida: number): Quantidades {
  const n = Number.isFinite(pedida) ? Math.min(MAX_ETIQUETAS_POR_PDF, Math.max(0, Math.floor(pedida))) : 0;
  const { [skuId]: _antes, ...resto } = q;
  return n === 0 ? resto : { ...resto, [skuId]: n };
}

/** "Usar o estoque": uma etiqueta por peça em estoque de cada SKU do produto. */
export function quantidadesDoEstoque(q: Quantidades, skus: readonly { id: string; estoque: number }[]): Quantidades {
  return skus.reduce((acc, s) => mudarQuantidade(acc, s.id, s.estoque), q);
}

export interface ResumoEtiquetas {
  total: number;
  fileiras: number;
  emBranco: number;
  acimaDoLimite: boolean;
  itens: { sku_id: string; quantidade: number }[];
}

export function resumoDasEtiquetas(q: Quantidades): ResumoEtiquetas {
  const itens = Object.entries(q).map(([sku_id, quantidade]) => ({ sku_id, quantidade }));
  const total = itens.reduce((t, i) => t + i.quantidade, 0);
  return {
    total,
    fileiras: fileirasDeEtiquetas(total),
    emBranco: etiquetasEmBranco(total),
    acimaDoLimite: total > MAX_ETIQUETAS_POR_PDF,
    itens,
  };
}

export function textoDoResumo(r: ResumoEtiquetas): string {
  if (r.total === 0) return 'Nenhuma etiqueta escolhida';
  const etiquetas = r.total === 1 ? '1 etiqueta' : `${r.total} etiquetas`;
  const fileiras = r.fileiras === 1 ? '1 fileira' : `${r.fileiras} fileiras`;
  return `${etiquetas} · ${fileiras}${r.emBranco > 0 ? ` (${r.emBranco} em branco)` : ''}`;
}

export function mensagemEtiquetas(e: ErroApi): string {
  if (e.status === 404) return 'Uma das peças escolhidas não foi encontrada. Busque de novo e refaça a seleção.';
  return mensagemGenerica(e);
}
