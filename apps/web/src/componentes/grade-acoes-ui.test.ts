import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./GradeAcoes.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../tema/tema.css', import.meta.url), 'utf8');

describe('GradeAcoes CTA (UX voz 17/11)', () => {
  it('ação pode marcar destaque', () => {
    expect(fonte).toMatch(/destaque\?:\s*boolean/);
    expect(fonte).toContain('data-destaque');
  });

  it('tile em destaque usa a cor de ação da marca', () => {
    expect(css).toMatch(/\.ailow-acao-grade\[data-destaque='true'\][\s\S]*--ailow-acao/);
  });
});
