import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// TEST-12/17, RNF-06, RN-10: cada tabela nova de negócio isola as empresas (ADR 002).
const TABELAS_DE_NEGOCIO = ['usuarios', 'aparelhos', 'sessoes', 'eventos_acesso'] as const;
// Tabelas da plataforma: não têm empresa_id de negócio e o papel de runtime não as enxerga.
const TABELAS_DA_PLATAFORMA = ['admins', 'admin_sessoes', 'diretorio_login'] as const;

describe('isolamento das tabelas de acesso (RLS)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresaA: string;
  let empresaB: string;
  const ids: Record<string, { a: string; b: string }> = {};

  async function semear(empresaId: string, sufixo: string) {
    const usuarioId = randomUUID();
    const aparelhoId = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, $3, 'dono', $4, 'x', 'x')`,
      [usuarioId, empresaId, `Dono ${sufixo}`, `dono-${sufixo}@teste.com`],
    );
    await admin.query(
      `INSERT INTO aparelhos (id, empresa_id, token_hash, criado_por) VALUES ($1, $2, $3, $4)`,
      [aparelhoId, empresaId, Buffer.from(`ap-${sufixo}`), usuarioId],
    );
    const sessaoId = randomUUID();
    await admin.query(
      `INSERT INTO sessoes (id, empresa_id, usuario_id, aparelho_id, token_hash, expira_em)
       VALUES ($1, $2, $3, $4, $5, now() + interval '1 hour')`,
      [sessaoId, empresaId, usuarioId, aparelhoId, Buffer.from(`se-${sufixo}`)],
    );
    await admin.query(
      `INSERT INTO eventos_acesso (empresa_id, ator_tipo, ator_id, tipo) VALUES ($1, 'usuario', $2, 'login')`,
      [empresaId, usuarioId],
    );
    return { usuarioId, aparelhoId, sessaoId };
  }

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Acesso A');
    empresaB = await criarEmpresa(admin, 'Acesso B');
    const a = await semear(empresaA, 'a');
    const b = await semear(empresaB, 'b');
    ids.usuarios = { a: a.usuarioId, b: b.usuarioId };
    ids.aparelhos = { a: a.aparelhoId, b: b.aparelhoId };
    ids.sessoes = { a: a.sessaoId, b: b.sessaoId };
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  it.each(TABELAS_DE_NEGOCIO)('%s: empresa A enxerga só as próprias linhas', async (tabela) => {
    const rows = await withEmpresa(app, empresaA, async (c) => {
      const r = await c.query(`SELECT empresa_id FROM ${tabela}`);
      return r.rows;
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.empresa_id === empresaA)).toBe(true);
  });

  it.each(TABELAS_DE_NEGOCIO)('%s: sem empresa definida não retorna nada (falha fechada)', async (tabela) => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ailow_app');
      const r = await client.query(`SELECT 1 FROM ${tabela}`);
      expect(r.rowCount).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it.each(['usuarios', 'aparelhos', 'sessoes'] as const)(
    '%s: empresa A não altera nem apaga a linha da B',
    async (tabela) => {
      const idB = ids[tabela]?.b;
      const res = await withEmpresa(app, empresaA, async (c) => {
        const upd = await c.query(`UPDATE ${tabela} SET empresa_id = empresa_id WHERE id = $1`, [idB]);
        const del = await c.query(`DELETE FROM ${tabela} WHERE id = $1`, [idB]);
        return { upd: upd.rowCount, del: del.rowCount };
      });
      expect(res).toEqual({ upd: 0, del: 0 });
    },
  );

  it('usuarios: empresa A não insere usuário em nome da B', async () => {
    await expect(
      withEmpresa(app, empresaA, (c) =>
        c.query(
          `INSERT INTO usuarios (empresa_id, nome, perfil, pin_hash) VALUES ($1, 'invasor', 'vendedor', 'x')`,
          [empresaB],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('sessoes: FK composta impede sessão da empresa A apontar para usuário da B', async () => {
    // O dono do schema ignora RLS: só a FK composta (empresa_id, usuario_id) segura aqui.
    await expect(
      admin.query(
        `INSERT INTO sessoes (empresa_id, usuario_id, aparelho_id, token_hash, expira_em)
         VALUES ($1, $2, $3, $4, now() + interval '1 hour')`,
        [empresaA, ids.usuarios?.b, ids.aparelhos?.a, Buffer.from('cruzada')],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('eventos_acesso: trilha é só-acréscimo para o papel de runtime (sem UPDATE/DELETE)', async () => {
    await expect(
      withEmpresa(app, empresaA, (c) => c.query(`UPDATE eventos_acesso SET tipo = 'x'`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withEmpresa(app, empresaA, (c) => c.query('DELETE FROM eventos_acesso')),
    ).rejects.toThrow(/permission denied/);
  });

  it.each(TABELAS_DA_PLATAFORMA)('%s: o papel de runtime não tem acesso', async (tabela) => {
    await expect(withEmpresa(app, empresaA, (c) => c.query(`SELECT 1 FROM ${tabela}`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('registrar_login: empresa A não registra login em nome da B', async () => {
    await expect(
      withEmpresa(app, empresaA, (c) =>
        c.query('SELECT registrar_login($1, $2, $3)', ['x@teste.com', empresaB, randomUUID()]),
      ),
    ).rejects.toThrow(/empresa/i);
  });

  it('registrar_login: e-mail já usado é rejeitado (e-mail é único na plataforma)', async () => {
    const email = `unico-${randomUUID()}@teste.com`;
    await withEmpresa(app, empresaA, (c) =>
      c.query('SELECT registrar_login($1, $2, $3)', [email, empresaA, ids.usuarios?.a]),
    );
    await expect(
      withEmpresa(app, empresaB, (c) =>
        c.query('SELECT registrar_login($1, $2, $3)', [email.toUpperCase(), empresaB, ids.usuarios?.b]),
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('buscar_login: não é executável pelo papel de runtime; o dono do schema acha pelo e-mail', async () => {
    await expect(
      withEmpresa(app, empresaA, (c) => c.query('SELECT * FROM buscar_login($1)', ['x@teste.com'])),
    ).rejects.toThrow(/permission denied/);
    const r = await admin.query('SELECT * FROM buscar_login($1)', ['  DONO-A@teste.com ']);
    expect(r.rows).toEqual([]);
  });
});
