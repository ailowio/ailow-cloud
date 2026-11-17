import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = () => readFileSync(new URL('./Inicio.tsx', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../tema/tema.css', import.meta.url), 'utf8');

describe('home DnD — grip discreto e pouso suave', () => {
  it('transição de pouso dura ≥250ms com easing suave', () => {
    const s = fonte();
    const m = s.match(/TRANSICAO_POUSO_MODULO\s*=\s*'([^']+)'/);
    expect(m?.[1]).toBeTruthy();
    const valor = m![1]!;
    expect(valor).toMatch(/transform\s+3\d{2}ms/);
    expect(valor).toMatch(/cubic-bezier/);
    const ms = Number(valor.match(/(\d+)ms/)?.[1] ?? 0);
    expect(ms).toBeGreaterThanOrEqual(250);
  });

  it('handle usa ícone pequeno, classe discreta e DragOverlay', () => {
    const s = fonte();
    expect(s).toContain('ailow-reordenar');
    expect(s).toMatch(/IconGripVertical\s+size=\{14\}/);
    expect(s).toContain('DragOverlay');
    expect(s).toContain('dropAnimation');
    expect(css()).toMatch(/\.ailow-reordenar\s*\{[^}]*opacity:\s*0\.2[0-9]/);
  });
});
