import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A logo é um arquivo único em public/logo.svg: o Pedro troca por uma de verdade depois.
// Este teste guarda o que não pode quebrar na troca.
const svg = readFileSync(new URL('../../public/logo.svg', import.meta.url), 'utf8');

describe('logo (placeholder trocável)', () => {
  it('é um SVG com viewBox, para escalar em qualquer tamanho sem distorcer', () => {
    expect(svg).toMatch(/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/);
    expect(svg).toMatch(/viewBox="[^"]+"/);
  });

  it('é seguro: sem script, sem manipuladores de evento e sem referência externa', () => {
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(svg).not.toMatch(/(href|src)\s*=\s*"(?!#)/i);
    expect(svg).not.toMatch(/url\(\s*['"]?https?:/i);
  });

  it('fica fora de /icons e /assets: o service worker guarda esses caminhos em cache e a logo nova não apareceria', () => {
    const sw = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
    expect(sw).not.toContain('logo.svg');
    expect(sw).toMatch(/startsWith\('\/assets\/'\)/);
    // /logo.svg não começa com nenhum dos prefixos guardados:
    expect('/logo.svg'.startsWith('/assets/') || '/logo.svg'.startsWith('/icons/')).toBe(false);
  });
});
