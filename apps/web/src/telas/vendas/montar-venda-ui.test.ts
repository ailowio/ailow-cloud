import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./MontarVenda.tsx', import.meta.url), 'utf8');

describe('MontarVenda UI (itens 6–8, 11)', () => {
  it('paginação padrão continua 5', () => {
    expect(fonte).toMatch(/POR_PAGINA_PADRAO\s*=\s*5/);
  });

  it('grade tem 4 ações numa linha: Escanear, Catálogo, Gerenciar, Finalizar', () => {
    expect(fonte).toMatch(/GradeAcoes[\s\S]*?cols=\{4\}/);
    const grade = /GradeAcoes[\s\S]*?acoes=\{\[([\s\S]*?)\]\}/.exec(fonte)?.[1] ?? '';
    const ids = [...grade.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['escanear', 'catalogo', 'gerenciar', 'fechar']);
    expect(grade).toMatch(/rotulo:\s*'Finalizar'/);
    expect(fonte).toContain('WizardCatalogo');
  });

  it('busca vazia usa sugestões e CartaoPecaVenda (amostra no card)', () => {
    expect(fonte).toContain('sugestoesVenda');
    expect(fonte).toContain('CartaoPecaVenda');
    expect(fonte).toContain('amostraDaCor');
  });

  it('Finalizar da grade é CTA com destaque', () => {
    expect(fonte).toMatch(/id:\s*'fechar'[\s\S]*?destaque:\s*true/);
  });

  it('Buscar não tem autoFocus (teclado só ao tocar no campo)', () => {
    expect(fonte).toMatch(/label="Buscar"/);
    expect(fonte).not.toMatch(/\bautoFocus\b/);
  });
});
