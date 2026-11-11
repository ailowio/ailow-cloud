import { describe, expect, it } from 'vitest';
import { formatarReais } from './dinheiro';

const nbsp = ' ';

describe('formatarReais', () => {
  it('formata centavos inteiros em reais com vírgula', () => {
    expect(formatarReais(123456)).toBe(`R$${nbsp}1.234,56`);
  });
  it('formata zero', () => {
    expect(formatarReais(0)).toBe(`R$${nbsp}0,00`);
  });
  it('formata valor negativo (estorno)', () => {
    expect(formatarReais(-2900)).toBe(`-R$${nbsp}29,00`);
  });
  it('rejeita valor não inteiro (RN-01: nada de ponto flutuante)', () => {
    expect(() => formatarReais(10.5)).toThrow('centavos');
  });
});
