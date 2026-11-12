import { describe, expect, it } from 'vitest';
import { TOQUES_ATE_FINALIZAR_PIX } from './toques';

// RNF-04: de Vendas até finalizar 1 peça, cliente já cadastrado, Pix. Digitar código e celular não é toque.
describe('toques da venda no Pix (RNF-04)', () => {
  it('cabe em 8 toques', () => {
    expect(TOQUES_ATE_FINALIZAR_PIX.length).toBeLessThanOrEqual(8);
    expect(TOQUES_ATE_FINALIZAR_PIX[0]).toBe('Vendas');
    expect(TOQUES_ATE_FINALIZAR_PIX).toContain('Pix');
    expect(TOQUES_ATE_FINALIZAR_PIX.at(-1)).toBe('Finalizar');
  });
});
