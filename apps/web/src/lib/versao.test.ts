import { describe, expect, it } from 'vitest';
import { versaoDoApp } from './versao';

describe('versaoDoApp', () => {
  it('devolve uma string não vazia (dev no teste local; tag no build da imagem)', () => {
    const v = versaoDoApp();
    expect(v.length).toBeGreaterThan(0);
    expect(v).not.toMatch(/\s/);
  });
});
