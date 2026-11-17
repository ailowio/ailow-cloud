import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extrairPathMarca } from './extrair-path';

const logo = readFileSync(new URL('../../public/logo.svg', import.meta.url), 'utf8');

describe('extrairPathMarca', () => {
  it('lê viewBox e path d de public/logo.svg (fonte única da marca)', () => {
    const { viewBox, d } = extrairPathMarca(logo);
    expect(viewBox).toBe('0 0 378 378');
    expect(d).toContain('M189 42');
    expect(d).toContain('L318 336');
    expect(d).toContain('A22 22 0 1 1 168 212');
    expect(d).toMatch(/^M189 42/);
    expect(d).not.toMatch(/\s{2,}/);
  });

  it('falha se faltar viewBox', () => {
    expect(() => extrairPathMarca('<svg><path d="M0 0"/></svg>')).toThrow(/viewBox/);
  });

  it('falha se faltar path d', () => {
    expect(() => extrairPathMarca('<svg viewBox="0 0 1 1"></svg>')).toThrow(/path/);
  });
});
