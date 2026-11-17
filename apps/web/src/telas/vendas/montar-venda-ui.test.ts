import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./MontarVenda.tsx', import.meta.url), 'utf8');

describe('MontarVenda UI (itens 6–8, 11)', () => {
  it('paginação padrão continua 5', () => {
    expect(fonte).toMatch(/POR_PAGINA_PADRAO\s*=\s*5/);
  });

  it('Finalizar é o último botão da grade e Gerenciar vem antes', () => {
    const grade = /GradeAcoes[\s\S]*?acoes=\{\[([\s\S]*?)\]\}/.exec(fonte)?.[1] ?? '';
    const ids = [...grade.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['escanear', 'gerenciar', 'fechar']);
    expect(grade).toMatch(/rotulo:\s*'Finalizar'/);
  });

  it('busca vazia usa sugestões e mostra amostra de cor', () => {
    expect(fonte).toContain('sugestoesVenda');
    expect(fonte).toContain('data-amostra-cor');
    expect(fonte).toContain('amostraDaCor');
  });
});
