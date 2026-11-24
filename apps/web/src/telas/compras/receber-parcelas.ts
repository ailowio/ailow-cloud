import { parcelasFecham } from '@ailow/shared/puro';
import { reaisParaCentavos } from '../../lib/dinheiro';

export type LinhaParcela = { valorTexto: string; vencimento: string };

export type ErroParcelasUi = 'sem_parcelas' | 'parcelas_divergem' | 'parcela_invalida' | 'vencimentos_duplicados';

export type ParcelasParaApi =
  | { ok: true; parcelas: { valor_centavos: number; vencimento: string }[] }
  | { ok: false; erro: ErroParcelasUi };

/** Soma meses a um "AAAA-MM-DD" em UTC civil (sem fuso local). */
export function somarMesesIso(data: string, meses: number): string {
  const [y, m, d] = data.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1 + meses, d));
  return dt.toISOString().slice(0, 10);
}

/** Converte o formulário de receber em corpo da API; RN-11 via parcelasFecham. */
export function montarParcelasParaApi(totalCentavos: number, linhas: LinhaParcela[]): ParcelasParaApi {
  if (linhas.length === 0) return { ok: false, erro: 'sem_parcelas' };
  const parcelas: { valor_centavos: number; vencimento: string }[] = [];
  for (const l of linhas) {
    const valor = reaisParaCentavos(l.valorTexto);
    if (valor === null || valor < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(l.vencimento)) {
      return { ok: false, erro: 'parcela_invalida' };
    }
    parcelas.push({ valor_centavos: valor, vencimento: l.vencimento });
  }
  if (new Set(parcelas.map((p) => p.vencimento)).size !== parcelas.length) {
    return { ok: false, erro: 'vencimentos_duplicados' };
  }
  const fecha = parcelasFecham(
    totalCentavos,
    parcelas.map((p) => p.valor_centavos),
  );
  if (!fecha.ok) return { ok: false, erro: fecha.erro };
  return { ok: true, parcelas };
}

export function resumoContasAPagar(n: number): string {
  return n === 1 ? 'Gera 1 conta a pagar' : `Gera ${n} contas a pagar`;
}

export const MSG_PARCELAS: Record<ErroParcelasUi, string> = {
  sem_parcelas: 'Inclua ao menos uma parcela.',
  parcelas_divergem: 'A soma das parcelas tem de ser igual ao total do pedido.',
  parcela_invalida: 'Cada parcela precisa de valor e vencimento válidos.',
  vencimentos_duplicados: 'Cada parcela precisa de uma data de vencimento diferente.',
};
