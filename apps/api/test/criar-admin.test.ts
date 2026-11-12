import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarHasher } from '../src/acesso/senhas.js';
import { criarAdmin, lerEntradaAdmin } from '../src/admin/criar-admin.js';
import { createPool } from '../src/db.js';
import { criarCifraTotp } from '../src/acesso/cifra-totp.js';
import { TEST_PEPPER, TEST_TOTP_CHAVE, adminPool } from './helpers.js';

// Bootstrap do Admin (acesso privilegiado, com 2º fator desde o primeiro dia).
describe('criarAdmin', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  const hasher = criarHasher(TEST_PEPPER);
  const cifra = criarCifraTotp(TEST_TOTP_CHAVE);

  beforeAll(() => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
  });
  afterAll(async () => {
    await pool.end();
    await owner.end();
  });

  it('grava hash argon2id da senha e o segredo TOTP CIFRADO; devolve a URI de provisionamento (SEC-17)', async () => {
    const r = await criarAdmin(pool, hasher, { email: 'Novo.Admin@Ailow.test ', senha: 'senha-admin-bem-longa' }, cifra);
    expect(r.uri.startsWith('otpauth://totp/')).toBe(true);
    const row = await owner.query('SELECT email, senha_hash, totp_segredo FROM admins WHERE id = $1', [r.id]);
    expect(row.rows[0].email).toBe('novo.admin@ailow.test');
    expect(row.rows[0].senha_hash.startsWith('$argon2id$')).toBe(true);
    // No banco nunca o segredo em claro; quem tem a chave do ambiente recupera o mesmo segredo devolvido ao Admin.
    expect(row.rows[0].totp_segredo).not.toContain(r.segredo);
    expect(cifra.decifrar(row.rows[0].totp_segredo)).toBe(r.segredo);
  });

  it('recusa e-mail repetido e senha curta', async () => {
    await criarAdmin(pool, hasher, { email: 'dup@ailow.test', senha: 'senha-admin-bem-longa' }, cifra);
    await expect(
      criarAdmin(pool, hasher, { email: 'dup@ailow.test', senha: 'senha-admin-bem-longa' }, cifra),
    ).rejects.toThrow();
    await expect(criarAdmin(pool, hasher, { email: 'outro@ailow.test', senha: 'curta' }, cifra)).rejects.toThrow(/senha/i);
  });

  describe('lerEntradaAdmin (CLI)', () => {
    const env = { ADMIN_EMAIL: 'a@ailow.test', ADMIN_SENHA: 'senha-admin-bem-longa' };

    it('lê e-mail e senha das variáveis de ambiente (nunca de argumentos de linha de comando)', () => {
      expect(lerEntradaAdmin(env)).toEqual({ email: 'a@ailow.test', senha: 'senha-admin-bem-longa' });
    });

    it.each(['ADMIN_EMAIL', 'ADMIN_SENHA'])('falha citando o NOME de %s ausente, sem vazar a senha', (nome) => {
      const { [nome]: _removida, ...resto } = env as Record<string, string>;
      expect(() => lerEntradaAdmin(resto)).toThrow(new RegExp(nome));
      expect(() => lerEntradaAdmin(resto)).not.toThrow(/senha-admin-bem-longa/);
    });
  });
});
