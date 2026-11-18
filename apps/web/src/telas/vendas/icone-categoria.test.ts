import { describe, expect, it } from 'vitest';
import { chaveIconeCategoria, resumoEstoqueProduto } from './icone-categoria';

describe('icone-categoria', () => {
  it('mapeia nomes conhecidos e cai em geral', () => {
    expect(chaveIconeCategoria('Sutiã')).toBe('sutia');
    expect(chaveIconeCategoria('Calcinha')).toBe('calcinha');
    expect(chaveIconeCategoria('Bebidas')).toBe('bebida');
    expect(chaveIconeCategoria('Acessórios')).toBe('acessorio');
    expect(chaveIconeCategoria('Protetor de mamilo')).toBe('acessorio');
    expect(chaveIconeCategoria('Outros')).toBe('geral');
  });

  it('resume estoque e preço do produto', () => {
    const r = resumoEstoqueProduto({
      preco_centavos: 4990,
      skus: [
        { estoque: 3, estoque_minimo: 5 },
        { estoque: 2, estoque_minimo: 1 },
        { estoque: 0, estoque_minimo: 1 },
      ],
    });
    expect(r.estoque).toBe(5);
    expect(r.precoCentavos).toBe(4990);
    expect(r.baixo).toBe(true);
  });
});
