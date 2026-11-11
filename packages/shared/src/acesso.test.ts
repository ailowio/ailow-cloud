import { describe, expect, it } from 'vitest';
import { criarEmpresaBodySchema, emailSchema, pinSchema, senhaSchema } from './acesso.js';

describe('contrato de acesso', () => {
  it('PIN aceita 4 dígitos, inclusive com zero à esquerda', () => {
    expect(pinSchema.parse('0042')).toBe('0042');
  });

  it.each(['123', '12345', 'abcd', '12 4', '', '１２３４'])('PIN rejeita %j', (v) => {
    expect(pinSchema.safeParse(v).success).toBe(false);
  });

  it('PIN rejeita número (não string)', () => {
    expect(pinSchema.safeParse(1234).success).toBe(false);
  });

  it('e-mail é normalizado para minúsculas sem espaços nas pontas', () => {
    expect(emailSchema.parse('  Dona@Loja.COM ')).toBe('dona@loja.com');
  });

  it('e-mail inválido é rejeitado', () => {
    expect(emailSchema.safeParse('sem-arroba').success).toBe(false);
  });

  it('senha exige entre 10 e 128 caracteres', () => {
    expect(senhaSchema.safeParse('curta').success).toBe(false);
    expect(senhaSchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(senhaSchema.safeParse('x'.repeat(10)).success).toBe(true);
  });

  it('criar empresa exige nome, dono, e-mail e senha válidos', () => {
    const ok = {
      nome: 'Loja',
      dono: { nome: 'Dona', email: 'dona@loja.com', senha: 'senha-longa-123' },
    };
    expect(criarEmpresaBodySchema.safeParse(ok).success).toBe(true);
    expect(criarEmpresaBodySchema.safeParse({ ...ok, nome: '   ' }).success).toBe(false);
  });
});
