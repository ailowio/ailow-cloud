export function formatarTelefone(digitos: string | null): string {
  if (!digitos) return '';
  const m = /^(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}

const MAX_BPS = 100_000; // 1000%, o mesmo limite do servidor

// Markup é guardado em pontos-base (1% = 100): inteiro, sem float em regra de dinheiro.
export function percentualParaBps(percentual: number | string): number {
  const n = typeof percentual === 'number' ? percentual : Number(percentual);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(Math.round(n * 100), 0), MAX_BPS);
}

export const bpsParaPercentual = (bps: number): number => bps / 100;

// Exemplo mostrado na tela de markup: peça que custa R$ 100,00 (10000 centavos).
export const exemploPrecoCentavos = (bps: number): number => (10_000 * (10_000 + bps)) / 10_000;
