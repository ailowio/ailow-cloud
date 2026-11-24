import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./MontarVenda.tsx', import.meta.url), 'utf8');
const vendas = readFileSync(new URL('./Vendas.tsx', import.meta.url), 'utf8');

describe('MontarVenda UI (V03)', () => {
  it('paginação padrão continua 5', () => {
    expect(fonte).toMatch(/POR_PAGINA_PADRAO\s*=\s*5/);
  });

  it('1ª fileira Escanear · Novo produto (dono) · Catálogo; depois Gerenciar/Finalizar', () => {
    expect(fonte).toContain("id: 'novo-produto'");
    expect(fonte).toContain("rotulo: 'Novo produto'");
    expect(fonte).toContain('IconPlus');
    expect(fonte).toMatch(/perfil\s*===\s*'dono'/);
    expect(fonte).toMatch(/densidade="compacta"/);
    expect(fonte).toMatch(/cols=\{3\}/);
    expect(fonte).not.toMatch(/cols=\{4\}/);
    const ids = [...fonte.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(ids.filter((id) => ['escanear', 'novo-produto', 'catalogo', 'gerenciar', 'fechar'].includes(id as string))).toEqual([
      'escanear',
      'novo-produto',
      'catalogo',
      'gerenciar',
      'fechar',
    ]);
    expect(fonte).toContain('WizardCatalogo');
    expect(fonte).toMatch(/id:\s*'fechar'[\s\S]*?destaque:\s*true/);
  });

  it('Novo produto abre no fluxo da venda sem desmontar o carrinho (estado em Vendas)', () => {
    expect(vendas).toContain('NovoProduto');
    expect(vendas).toContain('criandoProduto');
    expect(vendas).toMatch(/useState<ItemVenda\[\]>\(\[\]\)/);
  });

  it('busca vazia usa sugestões e CartaoPecaVenda (amostra no card)', () => {
    expect(fonte).toContain('sugestoesVenda');
    expect(fonte).toContain('CartaoPecaVenda');
    expect(fonte).toContain('amostraDaCor');
  });

  it('Buscar não tem autoFocus (teclado só ao tocar no campo)', () => {
    expect(fonte).toMatch(/label="Buscar"/);
    expect(fonte).not.toMatch(/\bautoFocus\b/);
  });
});
