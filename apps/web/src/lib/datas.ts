// Datas do Financeiro são "AAAA-MM-DD" (sem hora): o dia do negócio é o de São Paulo, o mesmo do servidor
// (ADR 005). Por isso nada aqui cria Date a partir de texto local: a conta de calendário é feita em UTC.

const FUSO = 'America/Sao_Paulo';
// 'en-CA' devolve AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

export const hojeEmSaoPaulo = (agora: Date = new Date()): string => formatoDia.format(agora);

const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Instante ISO (ex.: "2026-11-12T01:30:00.000Z") -> "22:30", no relógio de São Paulo. */
export const horaEmSaoPaulo = (iso: string): string => formatoHora.format(new Date(iso));

/** "2026-11-05" -> "05/11/2026", só por texto. */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export type Periodo = 'dia' | 'mes';

export function rotuloDoPeriodo(periodo: Periodo, data: string): string {
  if (periodo === 'dia') return formatarData(data);
  const mes = Number(data.slice(5, 7));
  return `${MESES[mes - 1]} de ${data.slice(0, 4)}`;
}

/** Anda `passo` dias ou meses (negativo = para trás). No modo mês devolve o dia 1. */
export function deslocarPeriodo(periodo: Periodo, data: string, passo: number): string {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));
  const dia = Number(data.slice(8, 10));
  const alvo = periodo === 'dia' ? Date.UTC(ano, mes - 1, dia + passo) : Date.UTC(ano, mes - 1 + passo, 1);
  return new Date(alvo).toISOString().slice(0, 10);
}
