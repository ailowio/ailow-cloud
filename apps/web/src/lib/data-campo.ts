// Data do CampoData: sempre texto "AAAA-MM-DD" (o mesmo contrato de lib/datas.ts e da API). Nada aqui cria Date a
// partir de texto local, então o dia nunca anda por causa do fuso do aparelho.
import { formatarData } from './datas';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

const ehBissexto = (ano: number): boolean => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;

function diasDoMes(ano: number, mes: number): number {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

/** "2028-02-29" -> o mesmo texto; vazio, nulo, com hora ou inexistente (29/02/2026, mês 13) -> null. */
export function normalizarDataIso(valor: string | null | undefined): string | null {
  const m = valor ? FORMATO.exec(valor) : null;
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDoMes(ano, mes)) return null;
  return valor as string;
}

/** Texto que o campo mostra: "29/02/2028", ou o convite quando não há data válida. */
export function rotuloDoCampoData(valor: string | null | undefined): string {
  const v = normalizarDataIso(valor);
  return v ? formatarData(v) : 'Escolher o dia';
}
