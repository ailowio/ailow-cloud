import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/**
 * UXM-07: transição = LogoA do Remotion (vídeo do projeto final).
 * Marca oficial = 5 paths de brand/logo-ailow.svg; stroke-dash só funciona
 * nesses paths sólidos (não no SVG evenodd antigo de 1 path).
 */
describe('transição UXM-07: marca oficial + animação LogoA', () => {
  it('CSS anima traço e preenchimento como no Remotion', () => {
    const css = ler('./transicao.css');
    expect(css).toMatch(/stroke-dasharray:\s*1/);
    expect(css).toMatch(/ailow-transicao-traco/);
    expect(css).toMatch(/ailow-transicao-preenche/);
    expect(css).toMatch(/stroke-width:\s*90/);
  });

  it('TransicaoUsuario usa os paths oficiais (LogoA) sem o SVG simplificado antigo', () => {
    const fonte = ler('./TransicaoUsuario.tsx');
    expect(fonte).toContain('logo.svg?raw');
    expect(fonte).toContain('extrairPathsMarca');
    expect(fonte).toContain('pathLength={1}');
    expect(fonte).toContain('VIEWBOX_TRANSICAO');
    expect(fonte).not.toContain('M189 42');
  });

  it('Logo e TransicaoUsuario leem a mesma fonte (logo.svg oficial)', () => {
    const logo = ler('./Logo.tsx');
    const transicao = ler('./TransicaoUsuario.tsx');
    const svg = ler('../../public/logo.svg');
    expect(logo).toContain("from '../../public/logo.svg?raw'");
    expect(transicao).toContain("from '../../public/logo.svg?raw'");
    expect(logo).toContain('extrairPathsMarca');
    expect(svg).toContain('M7200.09');
    expect(svg.match(/\bd="/g)?.length).toBe(5);
  });
});
