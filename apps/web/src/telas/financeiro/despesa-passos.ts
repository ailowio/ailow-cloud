import type { DespesaEntrada, FormaPagamento } from '@ailow/shared';

// S11: regras de cada passo do assistente "Nova despesa". Funções puras: a mensagem devolvida vira toast.

export type PassoDespesa = 'categoria' | 'valor' | 'quando' | 'confirmar';
export const PASSOS_DESPESA: PassoDespesa[] = ['categoria', 'valor', 'quando', 'confirmar'];

export const VALOR_MAXIMO_DESPESA = 2_000_000_000; // R$ 20 milhões, o teto do lançamento (ADR 005)

export interface RascunhoDespesa {
  categoria: string;
  descricao: string;
  /** Centavos inteiros (RN-01). */
  valor: number | null;
  /** AAAA-MM-DD. */
  vencimento: string;
  paga: boolean;
  forma: FormaPagamento | null;
}

/** Dia real do calendário em AAAA-MM-DD (rejeita 30/02 e 29/02 de ano comum). */
function diaValido(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

/** ADR 015: o mesmo assistente lança despesa (saída) ou receita (entrada); só os textos mudam. */
export type Sentido = 'despesa' | 'receita';

const TEXTOS: Record<Sentido, { tipo: string; valor: string; oQue: string; dia: string; forma: string }> = {
  despesa: {
    tipo: 'Escolha o tipo da despesa.',
    valor: 'Digite o valor da despesa.',
    oQue: 'Diga o que é a despesa.',
    dia: 'Escolha o dia do vencimento.',
    forma: 'Escolha como foi pago.',
  },
  receita: {
    tipo: 'Escolha o tipo da receita.',
    valor: 'Digite o valor da receita.',
    oQue: 'Diga o que é a receita.',
    dia: 'Escolha o dia em que recebe.',
    forma: 'Escolha como foi recebido.',
  },
};

type Regra = (r: RascunhoDespesa, t: (typeof TEXTOS)[Sentido]) => string | null;
const PROBLEMAS: Record<Exclude<PassoDespesa, 'confirmar'>, Regra> = {
  categoria: (r, t) => (r.categoria.trim() === '' ? t.tipo : null),
  valor: (r, t) => {
    if (r.valor === null || !Number.isInteger(r.valor)) return t.valor;
    if (r.valor < 1) return 'O valor precisa ser maior que zero.';
    if (r.valor > VALOR_MAXIMO_DESPESA) return 'O valor máximo é R$ 20 milhões.';
    if (r.descricao.trim() === '') return t.oQue;
    return null;
  },
  quando: (r, t) => {
    if (!diaValido(r.vencimento)) return t.dia;
    if (r.paga && r.forma === null) return t.forma;
    return null;
  },
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPasso(passo: PassoDespesa, r: RascunhoDespesa, sentido: Sentido = 'despesa'): string | null {
  const t = TEXTOS[sentido];
  if (passo !== 'confirmar') return PROBLEMAS[passo](r, t);
  for (const p of ['categoria', 'valor', 'quando'] as const) {
    const m = PROBLEMAS[p](r, t);
    if (m) return m;
  }
  return null;
}

/** Corpo do POST /financeiro/despesas, ou null se o rascunho ainda tem problema. */
export function despesaParaApi(r: RascunhoDespesa): DespesaEntrada | null {
  if (validarPasso('confirmar', r) !== null || r.valor === null) return null;
  return {
    descricao: r.descricao.trim(),
    categoria: r.categoria.trim(),
    valor_centavos: r.valor,
    vencimento: r.vencimento,
    forma_pagamento: r.paga ? r.forma : null,
    paga: r.paga,
  };
}
