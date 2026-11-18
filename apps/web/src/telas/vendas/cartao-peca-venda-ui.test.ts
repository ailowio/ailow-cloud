import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cartao = readFileSync(new URL('./CartaoPecaVenda.tsx', import.meta.url), 'utf8');
const montar = readFileSync(new URL('./MontarVenda.tsx', import.meta.url), 'utf8');
const carrinho = readFileSync(new URL('./carrinho.ts', import.meta.url), 'utf8');

describe('CartaoPecaVenda (UX voz 17/11)', () => {
  it('mostra preço, estoque e data-toque=peca', () => {
    expect(cartao).toContain('Valor');
    expect(cartao).toContain('precoCentavos');
    expect(cartao).toContain('estoque');
    expect(cartao).toContain('data-toque="peca"');
    expect(cartao).toMatch(/em estoque|Baixo ·|data-estoque/);
  });

  it('com qtd no carrinho oferece − / + com stopPropagation', () => {
    expect(cartao).toContain('qtdNoCarrinho');
    expect(cartao).toContain('aoMudarQtd');
    expect(cartao).toContain('stopPropagation');
    expect(cartao).toMatch(/aria-label=\{`Menos/);
    expect(cartao).toMatch(/aria-label=\{`Mais/);
  });

  it('alerta de estoque baixo quando abaixo do mínimo', () => {
    expect(cartao).toContain('estoqueMinimo');
    expect(cartao).toMatch(/IconAlert|alerta/);
  });

  it('MontarVenda usa CartaoPecaVenda e propaga qtd do carrinho', () => {
    expect(montar).toContain('CartaoPecaVenda');
    expect(montar).toContain('qtdNoCarrinho');
    expect(montar).not.toMatch(/pag\.itens\.map\(\(\{ key, peca, amostra \}\) => \(\s*<UnstyledButton/);
  });

  it('ItemVenda carrega estoqueMinimo opcional', () => {
    expect(carrinho).toMatch(/estoqueMinimo\?:\s*number/);
  });
});
