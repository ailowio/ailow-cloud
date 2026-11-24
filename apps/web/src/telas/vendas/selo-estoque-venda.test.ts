import { describe, expect, it } from 'vitest';
import { contraste } from '../../tema/contraste';
import {
  corBadgeEstoque,
  estoqueBaixo,
  rotuloEstoqueVenda,
  tomEstoqueVenda,
} from './selo-estoque-venda';

describe('selo de estoque na venda (V02)', () => {
  it('tom: ok, baixo, zerado + limite = mínimo é ok', () => {
    expect(tomEstoqueVenda(12, undefined)).toBe('ok');
    expect(tomEstoqueVenda(5, 5)).toBe('ok');
    expect(tomEstoqueVenda(3, 5)).toBe('baixo');
    expect(tomEstoqueVenda(0, 5)).toBe('zerado');
    expect(tomEstoqueVenda(0, undefined)).toBe('zerado');
    expect(tomEstoqueVenda(-1, 2)).toBe('zerado');
  });

  it('rótulos por tom', () => {
    expect(rotuloEstoqueVenda(12, undefined)).toBe('12 em estoque');
    expect(rotuloEstoqueVenda(5, 5)).toBe('5 em estoque');
    expect(rotuloEstoqueVenda(3, 5)).toBe('Baixo · 3');
    expect(rotuloEstoqueVenda(0, 1)).toBe('Zerado');
  });

  it('estoqueBaixo só no tom baixo; cores do badge', () => {
    expect(estoqueBaixo(3, 5)).toBe(true);
    expect(estoqueBaixo(5, 5)).toBe(false);
    expect(estoqueBaixo(2, undefined)).toBe(false);
    expect(estoqueBaixo(0, 1)).toBe(false);
    expect(corBadgeEstoque('ok')).toBe('teal');
    expect(corBadgeEstoque('baixo')).toBe('ambar');
    expect(corBadgeEstoque('zerado')).toBe('red');
  });

  // Teal escuro (claro) / teal claro (escuro) — AA ≥ 4,5:1 sobre fundos do app (D-A5).
  it('verde (teal) do selo ok tem contraste AA sobre fundo claro e escuro', () => {
    expect(contraste('#0b7285', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(contraste('#0b7285', '#eeeeeb')).toBeGreaterThanOrEqual(4.5);
    expect(contraste('#63e6be', '#111214')).toBeGreaterThanOrEqual(4.5);
  });
});
