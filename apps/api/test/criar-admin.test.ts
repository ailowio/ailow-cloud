import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarHasher } from '../src/acesso/senhas.js';
import { criarAdmin, lerEntradaAdmin } from '../src/admin/criar-admin.js';
import { createPool } from '../src/db.js';
import { TEST_PEPPER, adminPool } from './helpers.js';

// Bootstrap do Admin (acesso privilegiado, com 2º fator desde o primeiro dia).
describe('criarAdmin', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  const hasher = criarHasher(TEST_PEPPER);

  beforeAll(() => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
  });
  afterAll(async () => {
    await pool.end();
    await owner.end();
  });

  it('grava hash argon2id da senha e o segredo TOTP; devolve a URI de provisionamento', async () => {
    const r = await criarAdmin(pool, hasher, { email: 'Novo.Admin@Ailow.test ', senha: 'senha-admin-bem-longa' });
    expect(r.uri.startsWith('otpauth://totp/')).toBe(true);
    const row = await owner.query('SELECT email, senha_hash, totp_segredo FROM admins WHERE id = $1', [r.id]);
    expect(row.rows[0].email).toBe('novo.admin@ailow.test');
    expect(row.rows[0].senha_hash.startsWith('$argon2id$')).toBe(true);
    expect(row.rows[0].totp_segredo).toBe(r.segredo);
  });

  it('recusa e-mail repetido e senha curta', async () => {
    await criarAdmin(pool, hasher, { email: 'dup@ailow.test', senha: 'senha-admin-bem-longa' });
    await expect(criarAdmin(pool, hasher, { email: 'dup@ailow.test', senha: 'senha-admin-bem-longa' })).rejects.toThrow();
    await expect(criarAdmin(pool, hasher, { email: 'outro@ailow.test', senha: 'curta' })).rejects.toThrow(/senha/i);
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
