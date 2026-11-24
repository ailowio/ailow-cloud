import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = () => readFileSync(new URL('./Inicio.tsx', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../tema/tema.css', import.meta.url), 'utf8');

describe('home DnD — toque longo no bloco (D-A1)', () => {
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

  it('PointerSensor usa delay 500 ms e tolerância 5 px (D-A1)', () => {
    const s = fonte();
    expect(s).toMatch(/TOQUE_LONGO_MS\s*=\s*500/);
    expect(s).toMatch(/TOLERANCIA_ARRASTE_PX\s*=\s*5/);
    expect(s).toMatch(
      /PointerSensor[\s\S]*activationConstraint:\s*\{\s*delay:\s*TOQUE_LONGO_MS\s*,\s*tolerance:\s*TOLERANCIA_ARRASTE_PX\s*\}/,
    );
    expect(s).toContain('KeyboardSensor');
  });

  it('listeners do sortable ficam no bloco inteiro; alça só visual no foco', () => {
    const s = fonte();
    // listeners no Box do módulo (data-modulo), não só no ActionIcon da alça
    expect(s).toMatch(/data-modulo=\{props\.id\}[\s\S]{0,400}\{\.\.\.listeners\}/);
    expect(s).toContain('ailow-reordenar');
    expect(s).toMatch(/IconGripVertical\s+size=\{14\}/);
    expect(s).toContain('DragOverlay');
    expect(s).toContain('dropAnimation');
    expect(s).toMatch(/WebkitTouchCallout:\s*'none'|webkit-touch-callout:\s*none/);
    expect(s).toMatch(/userSelect:\s*'none'|user-select:\s*none/);
    expect(css()).toMatch(/\.ailow-reordenar\s*\{[^}]*opacity:\s*0/);
    expect(css()).toMatch(/\.ailow-modulo-dnd:focus-within\s+\.ailow-reordenar|\.ailow-reordenar:focus-visible/);
  });
});
