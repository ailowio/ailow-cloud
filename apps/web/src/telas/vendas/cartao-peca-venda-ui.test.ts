import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cartao = readFileSync(new URL('./CartaoPecaVenda.tsx', import.meta.url), 'utf8');
const montar = readFileSync(new URL('./MontarVenda.tsx', import.meta.url), 'utf8');
const carrinho = readFileSync(new URL('./carrinho.ts', import.meta.url), 'utf8');
const selo = readFileSync(new URL('./selo-estoque-venda.ts', import.meta.url), 'utf8');

describe('CartaoPecaVenda (V02)', () => {
  it('mostra preço, estoque e data-toque=peca', () => {
    expect(cartao).toContain('Valor');
    expect(cartao).toContain('precoCentavos');
    expect(cartao).toContain('estoque');
    expect(cartao).toContain('data-toque="peca"');
    expect(cartao).toMatch(/data-estoque/);
    expect(cartao).toMatch(/data-tom=\{tom\}/);
  });

  it('coluna direita: preço acima e stepper −/qtd/+ abaixo (alvo ≥ 40)', () => {
    expect(cartao).toContain('qtdNoCarrinho');
    expect(cartao).toContain('aoMudarQtd');
    expect(cartao).toContain('stopPropagation');
    expect(cartao).toContain('data-stepper-qtd');
    expect(cartao).toMatch(/size=\{40\}/);
    expect(cartao).toMatch(/aria-label=\{`Menos/);
    expect(cartao).toMatch(/aria-label=\{`Mais/);
    // Stepper e preço na mesma Stack alinhada à direita (não na linha do selo)
    expect(cartao).toMatch(/align="flex-end"[\s\S]*Valor[\s\S]*data-stepper-qtd/);
  });

  it('selo usa tom ok/baixo/zerado (teal/âmbar/vermelho)', () => {
    expect(cartao).toContain('tomEstoqueVenda');
    expect(cartao).toContain('corBadgeEstoque');
    expect(cartao).toMatch(/IconAlert|alerta/);
    expect(selo).toMatch(/TomEstoqueVenda\s*=\s*'ok'\s*\|\s*'baixo'\s*\|\s*'zerado'/);
    expect(selo).toContain("return 'teal'");
    expect(selo).toContain("return 'ambar'");
    expect(selo).toContain("return 'red'");
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
