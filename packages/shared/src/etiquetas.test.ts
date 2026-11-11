import { describe, expect, it } from 'vitest';
import {
  ETIQUETAS_POR_FILEIRA,
  MAX_ETIQUETAS_POR_PDF,
  etiquetasEmBranco,
  etiquetasPedidoSchema,
  fileirasDeEtiquetas,
} from './index.js';

// S08 / RF-PRO-06, ADR 003: o Dono escolhe SKUs e quantidades; a bobina é de 3 colunas (33 × 22 mm).
const SKU_A = '7b0e8a52-3c1f-4f7e-9a51-0c2b6f1d9e01';
const SKU_B = '7b0e8a52-3c1f-4f7e-9a51-0c2b6f1d9e02';

describe('pedido de etiquetas (RF-PRO-06)', () => {
  it('aceita um SKU com uma etiqueta', () => {
    expect(etiquetasPedidoSchema.safeParse({ itens: [{ sku_id: SKU_A, quantidade: 1 }] }).success).toBe(true);
  });

  it('recusa um pedido sem itens', () => {
    expect(etiquetasPedidoSchema.safeParse({ itens: [] }).success).toBe(false);
  });

  it.each([0, -1, 1.5])('recusa a quantidade %s', (quantidade) => {
    expect(etiquetasPedidoSchema.safeParse({ itens: [{ sku_id: SKU_A, quantidade }] }).success).toBe(false);
  });

  it('recusa um id de SKU que não é uuid', () => {
    expect(etiquetasPedidoSchema.safeParse({ itens: [{ sku_id: '0001-40-CHO', quantidade: 1 }] }).success).toBe(false);
  });

  it('recusa o mesmo SKU duas vezes (a quantidade é uma só por SKU)', () => {
    const r = etiquetasPedidoSchema.safeParse({
      itens: [
        { sku_id: SKU_A, quantidade: 1 },
        { sku_id: SKU_A, quantidade: 2 },
      ],
    });
    expect(r.success).toBe(false);
  });

  it(`aceita exatamente ${MAX_ETIQUETAS_POR_PDF} etiquetas no total e recusa uma a mais`, () => {
    const ate = (b: number) => ({
      itens: [
        { sku_id: SKU_A, quantidade: 500 },
        { sku_id: SKU_B, quantidade: b },
      ],
    });
    expect(etiquetasPedidoSchema.safeParse(ate(MAX_ETIQUETAS_POR_PDF - 500)).success).toBe(true);
    expect(etiquetasPedidoSchema.safeParse(ate(MAX_ETIQUETAS_POR_PDF - 499)).success).toBe(false);
  });
});

describe('fileiras da bobina de 3 colunas', () => {
  it('a bobina tem 3 etiquetas por fileira', () => {
    expect(ETIQUETAS_POR_FILEIRA).toBe(3);
  });

  it.each([
    [0, 0, 0],
    [1, 1, 2],
    [2, 1, 1],
    [3, 1, 0],
    [4, 2, 2],
    [999, 333, 0],
  ])('%i etiquetas ocupam %i fileiras e deixam %i em branco', (total, fileiras, branco) => {
    expect(fileirasDeEtiquetas(total)).toBe(fileiras);
    expect(etiquetasEmBranco(total)).toBe(branco);
  });
});
