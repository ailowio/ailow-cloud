import * as OTPAuth from 'otpauth';
import { describe, expect, it } from 'vitest';
import { novoSegredoTotp, uriTotp, validarTotp } from './totp.js';

const T0 = Date.UTC(2026, 10, 11, 12, 0, 0);

function codigo(segredo: string, timestamp: number): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(segredo), period: 30, digits: 6 }).generate({
    timestamp,
  });
}

describe('TOTP do Admin (RFC 6238)', () => {
  const segredo = novoSegredoTotp();

  it('o segredo novo é base32 com 160 bits ou mais', () => {
    expect(segredo).toMatch(/^[A-Z2-7]{32,}$/);
    expect(novoSegredoTotp()).not.toBe(segredo);
  });

  it('aceita o código do passo atual e devolve o passo', () => {
    const passo = validarTotp(segredo, codigo(segredo, T0), T0, 0);
    expect(passo).toBe(Math.floor(T0 / 1000 / 30));
  });

  it('aceita o passo anterior (relógio atrasado ≤ 30 s)', () => {
    expect(validarTotp(segredo, codigo(segredo, T0 - 30_000), T0, 0)).not.toBeNull();
  });

  it('rejeita código de dois passos atrás e código errado', () => {
    expect(validarTotp(segredo, codigo(segredo, T0 - 90_000), T0, 0)).toBeNull();
    const errado = codigo(segredo, T0) === '000000' ? '000001' : '000000';
    expect(validarTotp(segredo, errado, T0, 0)).toBeNull();
  });

  it('o mesmo código não vale duas vezes (anti-replay)', () => {
    const c = codigo(segredo, T0);
    const passo = validarTotp(segredo, c, T0, 0);
    expect(passo).not.toBeNull();
    expect(validarTotp(segredo, c, T0, passo as number)).toBeNull();
  });

  it('a URI de provisionamento traz emissor e conta', () => {
    const uri = uriTotp('admin@ailow.com', segredo);
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('issuer=Ailow%20Cloud');
  });
});
