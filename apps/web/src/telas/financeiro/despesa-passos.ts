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

const PROBLEMAS: Record<Exclude<PassoDespesa, 'confirmar'>, (r: RascunhoDespesa) => string | null> = {
  categoria: (r) => (r.categoria.trim() === '' ? 'Escolha o tipo da despesa.' : null),
  valor: (r) => {
    if (r.valor === null || !Number.isInteger(r.valor)) return 'Digite o valor da despesa.';
    if (r.valor < 1) return 'O valor precisa ser maior que zero.';
    if (r.valor > VALOR_MAXIMO_DESPESA) return 'O valor máximo é R$ 20 milhões.';
    if (r.descricao.trim() === '') return 'Diga o que é a despesa.';
    return null;
  },
  quando: (r) => {
    if (!diaValido(r.vencimento)) return 'Escolha o dia do vencimento.';
    if (r.paga && r.forma === null) return 'Escolha como foi pago.';
    return null;
  },
};

/** Mensagem do primeiro problema do passo (ou null se pode seguir). No passo de confirmar vale tudo. */
export function validarPasso(passo: PassoDespesa, r: RascunhoDespesa): string | null {
  if (passo !== 'confirmar') return PROBLEMAS[passo](r);
  for (const p of ['categoria', 'valor', 'quando'] as const) {
    const m = PROBLEMAS[p](r);
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
