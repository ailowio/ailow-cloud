import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./WizardCatalogo.tsx', import.meta.url), 'utf8');

describe('WizardCatalogo UI (UX voz 17/11)', () => {
  it('categorias e produtos em grade de 2 colunas', () => {
    expect(fonte).toMatch(/SimpleGrid[\s\S]*cols=\{2\}/);
    expect(fonte).toContain('chaveIconeCategoria');
    expect(fonte).toContain('resumoEstoqueProduto');
  });

  it('Opcao de produto mostra preço e estoque', () => {
    expect(fonte).toContain('Valor');
    expect(fonte).toMatch(/rotuloEstoqueVenda|em estoque/);
  });
});
