import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const catalogo = readFileSync(new URL('./CatalogoProdutos.tsx', import.meta.url), 'utf8');
const produtos = readFileSync(new URL('./Produtos.tsx', import.meta.url), 'utf8');

describe('Produtos: visão Catálogo (P02)', () => {
  it('reaproveita o tile e os ícones de categoria do catálogo da venda, em 2 colunas, sem carrinho', () => {
    expect(catalogo).toMatch(/import \{[^}]*Opcao[^}]*\} from '\.\.\/vendas\/WizardCatalogo'/);
    expect(catalogo).toContain('chaveIconeCategoria');
    expect(catalogo).toMatch(/SimpleGrid[\s\S]*cols=\{2\}/);
    expect(catalogo).not.toMatch(/carrinho|aoEscolher/i);
  });

  it('com filtros ativos, toda carga da lista passa categoria_id/cor para a API (1ª página, Carregar mais e busca)', () => {
    const chamadas = produtos.match(/props\.api\.produtos\([^)]*\)/g) ?? [];
    expect(chamadas.length).toBeGreaterThanOrEqual(3);
    for (const c of chamadas) expect(c).toContain('props.consulta');
  });

  it('Produtos.tsx continua abaixo de 300 linhas', () => {
    expect(produtos.split('\n').length).toBeLessThan(300);
  });
});
