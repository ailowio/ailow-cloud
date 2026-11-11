import { describe, expect, it } from 'vitest';
import { bpsParaPercentual, exemploPrecoCentavos, formatarTelefone, percentualParaBps } from './formatos';

describe('telefone', () => {
  it('formata celular (11 dígitos) e fixo (10 dígitos)', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321');
    expect(formatarTelefone('1134567890')).toBe('(11) 3456-7890');
  });
  it('devolve como veio o que não tem 10 ou 11 dígitos, e vazio para null', () => {
    expect(formatarTelefone('123')).toBe('123');
    expect(formatarTelefone(null)).toBe('');
  });
});

describe('markup em pontos-base (1% = 100, sem float)', () => {
  it('converte percentual digitado para bps inteiro, sem erro de ponto flutuante', () => {
    expect(percentualParaBps(100)).toBe(10000);
    expect(percentualParaBps(33.33)).toBe(3333);
    expect(percentualParaBps(0.29)).toBe(29); // 0.29 * 100 = 28.999999999999996 em float
    expect(percentualParaBps(0)).toBe(0);
  });
  it('aceita texto vazio como 0 e limita a 0–1000%', () => {
    expect(percentualParaBps('')).toBe(0);
    expect(percentualParaBps(-5)).toBe(0);
    expect(percentualParaBps(5000)).toBe(100000);
  });
  it('converte bps para o percentual exibido', () => {
    expect(bpsParaPercentual(10000)).toBe(100);
    expect(bpsParaPercentual(3333)).toBe(33.33);
  });
  it('exemplo: peça de R$ 100,00 com markup de 80% sugere R$ 180,00 (em centavos)', () => {
    expect(exemploPrecoCentavos(8000)).toBe(18000);
    expect(exemploPrecoCentavos(0)).toBe(10000);
  });
});
