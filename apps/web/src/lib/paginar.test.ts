import { describe, expect, it } from 'vitest';
import { paginar } from './paginar';

const lista = Array.from({ length: 45 }, (_, i) => i + 1);

describe('paginar', () => {
  it('primeira página tem `tamanho` itens', () => {
    const p = paginar(lista, 1, 20);
    expect(p.itens).toHaveLength(20);
    expect(p.itens[0]).toBe(1);
    expect(p.totalPaginas).toBe(3);
  });
  it('última página traz o resto', () => {
    const p = paginar(lista, 3, 20);
    expect(p.itens).toEqual([41, 42, 43, 44, 45]);
  });
  it('página fora do limite é presa nos extremos', () => {
    expect(paginar(lista, 99, 20).pagina).toBe(3);
    expect(paginar(lista, 0, 20).pagina).toBe(1);
    expect(paginar(lista, Number.NaN, 20).pagina).toBe(1);
  });
  it('lista vazia: 1 página, sem itens', () => {
    expect(paginar([], 1, 20)).toEqual({ itens: [], pagina: 1, totalPaginas: 1 });
  });
  it('múltiplo exato não cria página vazia', () => {
    expect(paginar(Array.from({ length: 40 }, (_, i) => i), 2, 20).totalPaginas).toBe(2);
  });
});
