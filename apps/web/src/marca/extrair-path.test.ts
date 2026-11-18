import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extrairPathMarca, extrairPathsMarca } from './extrair-path';

const logo = readFileSync(new URL('../../public/logo.svg', import.meta.url), 'utf8');

describe('extrairPathsMarca', () => {
  it('lê viewBox e os 5 paths oficiais de public/logo.svg', () => {
    const { viewBox, paths } = extrairPathsMarca(logo);
    expect(viewBox).toBe('0 0 10000 10000');
    expect(paths).toHaveLength(5);
    expect(paths[0]).toMatch(/^M7200\.09/);
    expect(paths[1]).toMatch(/^M5455\.51/);
    expect(paths[4]).toMatch(/^M3171\.89/);
    for (const d of paths) expect(d).not.toMatch(/\s{2,}/);
  });

  it('extrairPathMarca devolve o primeiro path', () => {
    const { d } = extrairPathMarca(logo);
    expect(d).toMatch(/^M7200\.09/);
  });

  it('falha se faltar viewBox', () => {
    expect(() => extrairPathsMarca('<svg><path d="M0 0"/></svg>')).toThrow(/viewBox/);
  });

  it('falha se faltar path d', () => {
    expect(() => extrairPathsMarca('<svg viewBox="0 0 1 1"></svg>')).toThrow(/path/);
  });
});
