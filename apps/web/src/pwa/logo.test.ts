import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Marca em public/logo.png (+ logo.svg espelho escalável). Fora de /icons e /assets:
// o service worker não pode guardar a logo (troca não apareceria).
const png = readFileSync(new URL('../../public/logo.png', import.meta.url));
const svg = readFileSync(new URL('../../public/logo.svg', import.meta.url), 'utf8');

describe('logo (marca Ailow)', () => {
  it('logo.png é um PNG válido', () => {
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([378, 378]);
  });

  it('logo.svg tem viewBox e é seguro: sem script, sem eventos e sem referência externa', () => {
    expect(svg).toMatch(/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/);
    expect(svg).toMatch(/viewBox="[^"]+"/);
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(svg).not.toMatch(/(href|src)\s*=\s*"(?!#)/i);
    expect(svg).not.toMatch(/url\(\s*['"]?https?:/i);
  });

  it('fica fora de /icons e /assets: o service worker guarda esses caminhos em cache e a logo nova não apareceria', () => {
    const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
    expect(sw).not.toContain('logo.png');
    expect(sw).not.toContain('logo.svg');
    expect(sw).toMatch(/startsWith\('\/assets\/'\)/);
    expect('/logo.png'.startsWith('/assets/') || '/logo.png'.startsWith('/icons/')).toBe(false);
    expect('/logo.svg'.startsWith('/assets/') || '/logo.svg'.startsWith('/icons/')).toBe(false);
  });
});
