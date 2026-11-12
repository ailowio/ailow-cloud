import { describe, expect, it } from 'vitest';
import { contemNul } from './entrada-segura.js';

// S13a (achado do Schemathesis, ST101): o Postgres recusa o caractere nulo em texto e a API respondia 500.

describe('contemNul', () => {
  it('acha o caractere nulo em texto, em objeto, em lista e até em nome de campo', () => {
    expect(contemNul('a\u0000b')).toBe(true);
    expect(contemNul({ nome: 'a\u0000' })).toBe(true);
    expect(contemNul({ itens: [{ codigo: 'x' }, { codigo: '\u0000' }] })).toBe(true);
    expect(contemNul({ ['campo\u0000']: 1 })).toBe(true);
  });
  it('texto normal, vazio, números, nulo e não-objetos passam', () => {
    expect(contemNul('olá, ação · 😀')).toBe(false);
    expect(contemNul('')).toBe(false);
    expect(contemNul({ a: 1, b: null, c: [true, 2.5, undefined], d: { e: 'ok' } })).toBe(false);
    expect(contemNul(null)).toBe(false);
    expect(contemNul(undefined)).toBe(false);
    expect(contemNul(42)).toBe(false);
  });
});
