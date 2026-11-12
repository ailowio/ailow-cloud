import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { criarCifraTotp } from './cifra-totp.js';

const chave = () => randomBytes(32).toString('base64');
const SEGREDO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

describe('cifra do segredo TOTP (SEC-17)', () => {
  it('decifra o que cifrou', () => {
    const cifra = criarCifraTotp(chave());
    expect(cifra.decifrar(cifra.cifrar(SEGREDO))).toBe(SEGREDO);
  });

  it('o texto cifrado não contém o segredo e leva o prefixo da versão', () => {
    const cifra = criarCifraTotp(chave());
    const guardado = cifra.cifrar(SEGREDO);
    expect(guardado.startsWith('v1.')).toBe(true);
    expect(guardado).not.toContain(SEGREDO);
  });

  it('cada cifragem usa um IV novo (mesmo segredo, textos diferentes)', () => {
    const cifra = criarCifraTotp(chave());
    expect(cifra.cifrar(SEGREDO)).not.toBe(cifra.cifrar(SEGREDO));
  });

  it('chave errada não decifra', () => {
    const guardado = criarCifraTotp(chave()).cifrar(SEGREDO);
    expect(() => criarCifraTotp(chave()).decifrar(guardado)).toThrow();
  });

  it('texto adulterado é recusado (GCM autentica)', () => {
    const cifra = criarCifraTotp(chave());
    const guardado = cifra.cifrar(SEGREDO);
    // Caractere do meio: o último do base64 pode carregar bits descartados e não mudar os bytes.
    const meio = Math.floor(guardado.length / 2);
    const troca = guardado[meio] === 'A' ? 'B' : 'A';
    expect(() => cifra.decifrar(guardado.slice(0, meio) + troca + guardado.slice(meio + 1))).toThrow();
  });

  it('texto em claro (sem versão) é recusado, nunca devolvido como se fosse válido', () => {
    expect(() => criarCifraTotp(chave()).decifrar(SEGREDO)).toThrow(/formato/i);
  });

  it('a chave precisa ter exatamente 32 bytes em base64, sem vazar o valor', () => {
    const curta = randomBytes(16).toString('base64');
    expect(() => criarCifraTotp(curta)).toThrow(/TOTP_CHAVE/);
    expect(() => criarCifraTotp(curta)).not.toThrow(new RegExp(curta.replace(/[+/=]/g, '.')));
    expect(() => criarCifraTotp('isto-nao-e-base64-de-32-bytes!!')).toThrow(/TOTP_CHAVE/);
  });
});
