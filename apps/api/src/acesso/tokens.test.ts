import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { lerToken, novoToken } from './tokens.js';

describe('tokens de sessão e aparelho', () => {
  it('o token tem a empresa como prefixo e o hash confere com o lido de volta', () => {
    const empresa = randomUUID();
    const { token, hash } = novoToken(empresa);
    expect(token.startsWith(`${empresa}.`)).toBe(true);
    const lido = lerToken(token);
    expect(lido?.empresaId).toBe(empresa);
    expect(lido?.hash.equals(hash)).toBe(true);
  });

  it('dois tokens nunca são iguais e o hash não revela o segredo', () => {
    const empresa = randomUUID();
    const a = novoToken(empresa);
    const b = novoToken(empresa);
    expect(a.token).not.toBe(b.token);
    expect(a.token).not.toContain(a.hash.toString('base64url'));
  });

  it.each([undefined, '', 'sem-ponto', 'nao-uuid.abc', `${randomUUID()}.curto`, `${randomUUID()}.${'x'.repeat(200)}`])(
    'token inválido %j é recusado',
    (v) => {
      expect(lerToken(v)).toBeNull();
    },
  );

  it('token sem empresa (Admin) também é lido', () => {
    const { token, hash } = novoToken();
    expect(token.includes('.')).toBe(false);
    expect(lerToken(token, false)?.hash.equals(hash)).toBe(true);
  });
});
