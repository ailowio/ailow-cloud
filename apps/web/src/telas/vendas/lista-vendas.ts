import type { VendaResumo } from '@ailow/shared';
import type { CamposBusca } from '../../lib/busca';

/** Busca ampla da lista de vendas (UXM-09): nº (com ou sem #), nome, celular e valor. */
export function camposBuscaVenda(v: VendaResumo): CamposBusca {
  return {
    textos: [String(v.numero), `#${v.numero}`, v.cliente?.nome ?? '', v.cliente?.celular ?? ''],
    precoCentavos: v.total_centavos,
  };
}
