import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./Paginacao.tsx', import.meta.url), 'utf8');

describe('Paginacao discreta (UX voz 17/11)', () => {
  it('aceita itensTotais e esconde Por página quando cabe numa página', () => {
    expect(fonte).toContain('itensTotais');
    expect(fonte).toMatch(/totalPaginas\s*<=\s*1/);
    expect(fonte).toMatch(/menorOpcao|itensTotais\s*>/);
  });

  it('Por página usa tamanho compacto quando aparece', () => {
    expect(fonte).toMatch(/size="xs"|size=\{'xs'\}/);
  });
});
