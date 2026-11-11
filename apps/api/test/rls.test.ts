import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// TEST-12/17, RNF-06: a empresa A nunca lê nem altera dados da empresa B.
describe('isolamento entre empresas (RLS)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresaA: string;
  let empresaB: string;

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Empresa A');
    empresaB = await criarEmpresa(admin, 'Empresa B');
    await admin.query(
      'INSERT INTO categorias (empresa_id, nome) VALUES ($1, $2), ($3, $4)',
      [empresaA, 'Sutiãs A', empresaB, 'Sutiãs B'],
    );
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  it('a empresa A lista só as próprias categorias', async () => {
    const rows = await withEmpresa(app, empresaA, async (c) => {
      const r = await c.query('SELECT nome FROM categorias');
      return r.rows;
    });
    expect(rows).toEqual([{ nome: 'Sutiãs A' }]);
  });

  it('a empresa A não lê a linha da B nem filtrando pelo id da B', async () => {
    const rows = await withEmpresa(app, empresaA, async (c) => {
      const r = await c.query('SELECT nome FROM categorias WHERE empresa_id = $1', [empresaB]);
      return r.rows;
    });
    expect(rows).toEqual([]);
  });

  it('a empresa A enxerga só a si mesma na tabela empresas', async () => {
    const rows = await withEmpresa(app, empresaA, async (c) => {
      const r = await c.query('SELECT id FROM empresas');
      return r.rows;
    });
    expect(rows).toEqual([{ id: empresaA }]);
  });

  it('a empresa A não consegue inserir linha em nome da B', async () => {
    await expect(
      withEmpresa(app, empresaA, (c) =>
        c.query('INSERT INTO categorias (empresa_id, nome) VALUES ($1, $2)', [empresaB, 'invasora']),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('a empresa A não altera nem apaga linhas da B (0 linhas afetadas)', async () => {
    const afetadas = await withEmpresa(app, empresaA, async (c) => {
      const up = await c.query('UPDATE categorias SET nome = $1 WHERE empresa_id = $2', ['x', empresaB]);
      const del = await c.query('DELETE FROM categorias WHERE empresa_id = $1', [empresaB]);
      return [up.rowCount, del.rowCount];
    });
    expect(afetadas).toEqual([0, 0]);
    const intacta = await admin.query('SELECT nome FROM categorias WHERE empresa_id = $1', [empresaB]);
    expect(intacta.rows).toEqual([{ nome: 'Sutiãs B' }]);
  });

  it('sem empresa definida a consulta não retorna nada (falha fechada)', async () => {
    const client = await app.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE ailow_app');
      const r = await client.query('SELECT 1 FROM categorias');
      await client.query('ROLLBACK');
      expect(r.rowCount).toBe(0);
    } finally {
      client.release();
    }
  });

  it('a empresa não vaza para a próxima requisição na mesma conexão do pool', async () => {
    const unica = createPool(process.env.DATABASE_URL_TEST as string, 1);
    try {
      await withEmpresa(unica, empresaA, (c) => c.query('SELECT 1'));
      const r = await unica.query("SELECT nullif(current_setting('app.empresa_id', true), '') AS e");
      expect(r.rows[0].e).toBeNull();
    } finally {
      await unica.end();
    }
  });

  it('rejeita empresa_id que não é UUID antes de tocar no banco', async () => {
    await expect(withEmpresa(app, "x'; DROP TABLE empresas; --", async () => 1)).rejects.toThrow(
      /empresa_id/,
    );
  });

  it('o papel de runtime não é superusuário e não ignora RLS', async () => {
    const r = await admin.query(
      "SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'ailow_app'",
    );
    expect(r.rows).toEqual([{ rolsuper: false, rolbypassrls: false, rolcanlogin: false }]);
  });

  it('uma empresa inexistente (uuid válido) enxerga zero linhas', async () => {
    const rows = await withEmpresa(app, randomUUID(), async (c) => {
      const r = await c.query('SELECT 1 FROM categorias');
      return r.rows;
    });
    expect(rows).toEqual([]);
  });
});
