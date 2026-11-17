import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const barra = readFileSync(new URL('./BarraCarrinho.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../tema/tema.css', import.meta.url), 'utf8');
const tela = readFileSync(new URL('./TelaCarrinho.tsx', import.meta.url), 'utf8');

describe('BarraCarrinho e resumo (itens 9–10, 12)', () => {
  it('barra usa preenchimento marca e pulse ao acrescentar', () => {
    expect(css).toMatch(/\.ailow-barra-carrinho\s*\{[\s\S]*background:\s*var\(--ailow-acao\)/);
    expect(barra).toContain('ailow-barra-carrinho--pulse');
    expect(barra).toContain('Toque para o resumo');
  });

  it('carrinho termina com Finalizar venda', () => {
    expect(tela).toContain('Finalizar venda');
    expect(tela).not.toContain('Fechar venda');
  });
});
