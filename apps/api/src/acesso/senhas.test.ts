import { describe, expect, it } from 'vitest';
import { criarHasher } from './senhas.js';

const PEPPER = 'pepper-de-teste-com-pelo-menos-32-caracteres';

describe('hash de senha e PIN (argon2id + pepper)', () => {
  const hasher = criarHasher(PEPPER);

  it('gera um hash argon2id, nunca o texto puro', async () => {
    const h = await hasher.hash('1234');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(h).not.toContain('1234');
  });

  it('confere o segredo correto e rejeita o errado', async () => {
    const h = await hasher.hash('senha-bem-longa');
    expect(await hasher.verificar(h, 'senha-bem-longa')).toBe(true);
    expect(await hasher.verificar(h, 'senha-bem-longa!')).toBe(false);
  });

  it('o mesmo segredo gera hashes diferentes (salt por hash)', async () => {
    expect(await hasher.hash('1234')).not.toBe(await hasher.hash('1234'));
  });

  it('com outro pepper o hash não confere (vazar só o banco não basta para quebrar o PIN)', async () => {
    const h = await hasher.hash('1234');
    const outro = criarHasher('outro-pepper-com-pelo-menos-32-caracteres!');
    expect(await outro.verificar(h, '1234')).toBe(false);
  });

  it('hash malformado ou vazio não confere e não lança erro', async () => {
    expect(await hasher.verificar('lixo', '1234')).toBe(false);
    expect(await hasher.verificar('', '1234')).toBe(false);
  });

  it('exige pepper com ao menos 32 caracteres', () => {
    expect(() => criarHasher('curto')).toThrow(/32/);
  });
});
