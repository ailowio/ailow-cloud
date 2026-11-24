import type { FormaPagamento } from '@ailow/shared';
import { formatarReais } from '../../lib/dinheiro';
import { ROTULOS_FORMA } from './rotulos';

/** F02: linha do Fechamento/comprovante — o que a venda joga no caixa hoje (à vista, D-A2). */
export function textoEntraNoFinanceiroHoje(
  pagamentos: { forma: FormaPagamento; valor_centavos: number }[],
): string | null {
  const ok = pagamentos.filter((p) => Number.isInteger(p.valor_centavos) && p.valor_centavos > 0);
  if (ok.length === 0) return null;
  const partes = ok.map((p) => `${formatarReais(p.valor_centavos)} (${ROTULOS_FORMA[p.forma]})`);
  return `Entra no financeiro hoje: ${partes.join(' · ')}`;
}
