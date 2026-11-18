import { describe, expect, it } from 'vitest';
import { rotuloEstoqueVenda, estoqueBaixo } from './selo-estoque-venda';

describe('selo de estoque na venda', () => {
  it('mostra a quantidade em estoque', () => {
    expect(rotuloEstoqueVenda(12, undefined)).toBe('12 em estoque');
    expect(rotuloEstoqueVenda(3, 5)).toBe('Baixo · 3');
  });

  it('estoque baixo só quando o mínimo veio e atual < mínimo', () => {
    expect(estoqueBaixo(3, 5)).toBe(true);
    expect(estoqueBaixo(5, 5)).toBe(false);
    expect(estoqueBaixo(2, undefined)).toBe(false);
    expect(estoqueBaixo(0, 1)).toBe(true);
  });
});
