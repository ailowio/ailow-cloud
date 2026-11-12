import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// TEST-12/17, RF-CLI-01/04, D8: clientes isolam as empresas (ADR 002); o celular é único por empresa e some na
// anonimização sem apagar a linha; o papel de runtime não apaga nem reescreve o que não deve (ADR 007).
// Só afirmamos sobre ids criados aqui (L-0008): os arquivos de teste rodam em paralelo no mesmo Postgres.
describe('clientes: isolamento e restrições (banco)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresaA: string;
  let empresaB: string;
  let usuarioA: string;
  let usuarioB: string;
  let clienteA: string;
  let clienteB: string;
  let seq = 0;

  const celular = (): string => `119${String(10_000_000 + ++seq).padStart(8, '0')}`;

  async function semearUsuario(empresaId: string, sufixo: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, $3, 'dono', $4, 'x', 'x')`,
      [id, empresaId, `Dono ${sufixo}`, `dono-cli-${sufixo}-${id}@teste.com`],
    );
    return id;
  }

  // As chaves vêm do código do teste (nunca de entrada externa); os valores são parâmetros.
  async function inserir(empresaId: string, linha: Record<string, unknown>): Promise<string> {
    const base = { nome: 'Ana Souza', celular: celular(), criado_por: empresaId === empresaA ? usuarioA : usuarioB, ...linha };
    const colunas = ['empresa_id', ...Object.keys(base)];
    const valores = [empresaId, ...Object.values(base)];
    const marcas = valores.map((_, i) => `$${i + 1}`).join(', ');
    return withEmpresa(app, empresaId, async (c) => {
      const r = await c.query(`INSERT INTO clientes (${colunas.join(', ')}) VALUES (${marcas}) RETURNING id`, valores);
      return r.rows[0].id as string;
    });
  }

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Cli A');
    empresaB = await criarEmpresa(admin, 'Cli B');
    usuarioA = await semearUsuario(empresaA, 'a');
    usuarioB = await semearUsuario(empresaB, 'b');
    clienteA = await inserir(empresaA, {});
    clienteB = await inserir(empresaB, {});
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  describe('isolamento (ADR 002, TEST-17)', () => {
    it('a empresa A enxerga só os próprios clientes', async () => {
      const rows = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT id, empresa_id FROM clientes')).rows);
      expect(rows.map((r) => r.id)).toContain(clienteA);
      expect(rows.map((r) => r.id)).not.toContain(clienteB);
      expect(rows.every((r) => r.empresa_id === empresaA)).toBe(true);
    });

    it('sem empresa definida a tabela não retorna nada (falha fechada)', async () => {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE ailow_app');
        expect((await client.query('SELECT 1 FROM clientes')).rowCount).toBe(0);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('a empresa A não altera o cliente da B (a RLS esconde a linha)', async () => {
      const afetadas = await withEmpresa(app, empresaA, async (c) => (await c.query(`UPDATE clientes SET nome = 'Invasor' WHERE id = $1`, [clienteB])).rowCount);
      expect(afetadas).toBe(0);
      const nome = await withEmpresa(app, empresaB, async (c) => (await c.query('SELECT nome FROM clientes WHERE id = $1', [clienteB])).rows[0].nome);
      expect(nome).toBe('Ana Souza');
    });

    it('a empresa A não grava cliente com o empresa_id da B (WITH CHECK)', async () => {
      await expect(
        withEmpresa(app, empresaA, (c) =>
          c.query(`INSERT INTO clientes (empresa_id, nome, celular, criado_por) VALUES ($1, 'x', $2, $3)`, [empresaB, celular(), usuarioB]),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('cliente da A não aponta para usuário da B (chave estrangeira composta)', async () => {
      await expect(inserir(empresaA, { criado_por: usuarioB })).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('celular único por empresa (RF-CLI-01, D8)', () => {
    it('recusa o mesmo celular duas vezes na mesma empresa', async () => {
      const numero = celular();
      await inserir(empresaA, { celular: numero });
      await expect(inserir(empresaA, { celular: numero })).rejects.toMatchObject({ code: '23505' });
    });

    it('empresas diferentes podem ter o mesmo celular', async () => {
      const numero = celular();
      await inserir(empresaA, { celular: numero });
      await expect(inserir(empresaB, { celular: numero })).resolves.toEqual(expect.any(String));
    });

    it.each([
      ['curto', '1191234567'],
      ['fixo', '1132345678'],
      ['com máscara', '(11) 91234-5678'],
      ['DDD com zero', '01912345678'],
    ])('o banco recusa celular %s', async (_nome, valor) => {
      await expect(inserir(empresaA, { celular: valor })).rejects.toMatchObject({ code: '23514' });
    });

    it.each([
      ['vazio', ''],
      ['só espaços', '   '],
      ['com 81 letras', 'a'.repeat(81)],
    ])('o banco recusa nome %s', async (_nome, valor) => {
      await expect(inserir(empresaA, { nome: valor })).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('celular obrigatório e sem restos da anonimização (S09b)', () => {
    it('cliente sem celular é recusado (not null)', async () => {
      await expect(inserir(empresaA, { celular: null })).rejects.toMatchObject({ code: '23502' });
    });

    it('a coluna anonimizado_em não existe mais', async () => {
      const r = await admin.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'anonimizado_em'`);
      expect(r.rowCount).toBe(0);
    });
  });

  describe('inativar e excluir (RF-CLI-04)', () => {
    const marcar = (empresaId: string, id: string, ativo: boolean) =>
      withEmpresa(app, empresaId, (c) => c.query('UPDATE clientes SET ativo = $2 WHERE id = $1', [id, ativo]));
    const existe = (empresaId: string, id: string) =>
      withEmpresa(app, empresaId, async (c) => (await c.query('SELECT 1 FROM clientes WHERE id = $1', [id])).rowCount === 1);

    it('o cliente nasce ativo', async () => {
      const id = await inserir(empresaA, {});
      const r = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT ativo FROM clientes WHERE id = $1', [id])).rows[0]);
      expect(r.ativo).toBe(true);
    });

    it('inativar e reativar mudam só a situação; o número continua reservado', async () => {
      const numero = celular();
      const id = await inserir(empresaA, { celular: numero });
      await marcar(empresaA, id, false);
      const r = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT ativo, celular FROM clientes WHERE id = $1', [id])).rows[0]);
      expect(r).toEqual({ ativo: false, celular: numero });
      await expect(inserir(empresaA, { celular: numero })).rejects.toMatchObject({ code: '23505' });
      await marcar(empresaA, id, true);
      expect(await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT ativo FROM clientes WHERE id = $1', [id])).rows[0].ativo)).toBe(true);
    });

    it('excluir tira a linha do banco e libera o número', async () => {
      const numero = celular();
      const id = await inserir(empresaA, { celular: numero });
      await withEmpresa(app, empresaA, (c) => c.query('DELETE FROM clientes WHERE id = $1', [id]));
      expect(await existe(empresaA, id)).toBe(false);
      expect((await admin.query('SELECT 1 FROM clientes WHERE id = $1', [id])).rowCount).toBe(0);
      await expect(inserir(empresaA, { celular: numero })).resolves.toEqual(expect.any(String));
    });

    it('a empresa A não exclui nem inativa o cliente da B (a RLS esconde a linha)', async () => {
      const id = await inserir(empresaB, {});
      const apagadas = await withEmpresa(app, empresaA, async (c) => (await c.query('DELETE FROM clientes WHERE id = $1', [id])).rowCount);
      const alteradas = await withEmpresa(app, empresaA, async (c) => (await c.query('UPDATE clientes SET ativo = false WHERE id = $1', [id])).rowCount);
      expect(apagadas).toBe(0);
      expect(alteradas).toBe(0);
      expect(await existe(empresaB, id)).toBe(true);
    });
  });

  describe('o que o papel de runtime pode fazer (menor privilégio)', () => {
    it('não esvazia a tabela', async () => {
      await expect(withEmpresa(app, empresaA, (c) => c.query('TRUNCATE clientes'))).rejects.toMatchObject({ code: '42501' });
    });

    it.each(['criado_em', 'criado_por', 'empresa_id', 'id'])('não reescreve a coluna %s', async (coluna) => {
      const valor = coluna === 'criado_em' ? 'now()' : coluna === 'criado_por' ? `'${usuarioA}'` : coluna === 'empresa_id' ? `'${empresaA}'` : 'gen_random_uuid()';
      await expect(
        withEmpresa(app, empresaA, (c) => c.query(`UPDATE clientes SET ${coluna} = ${valor} WHERE id = $1`, [clienteA])),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('corrige nome e celular (RF-CLI-05)', async () => {
      const id = await inserir(empresaA, {});
      const novo = celular();
      await withEmpresa(app, empresaA, (c) => c.query(`UPDATE clientes SET nome = 'Ana Corrigida', celular = $2 WHERE id = $1`, [id, novo]));
      const r = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT nome, celular FROM clientes WHERE id = $1', [id])).rows[0]);
      expect(r).toEqual({ nome: 'Ana Corrigida', celular: novo });
    });

    it('trocar o celular para o de outro cliente da mesma empresa é recusado', async () => {
      const numero = celular();
      await inserir(empresaA, { celular: numero });
      const outro = await inserir(empresaA, {});
      await expect(
        withEmpresa(app, empresaA, (c) => c.query('UPDATE clientes SET celular = $2 WHERE id = $1', [outro, numero])),
      ).rejects.toMatchObject({ code: '23505' });
    });

    it('registra a data do aviso de finalidade (LGPD)', async () => {
      const id = await inserir(empresaA, {});
      await withEmpresa(app, empresaA, (c) => c.query(`UPDATE clientes SET aviso_lgpd_em = '2026-11-11T12:00:00Z' WHERE id = $1`, [id]));
      const r = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT aviso_lgpd_em FROM clientes WHERE id = $1', [id])).rows[0]);
      expect(r.aviso_lgpd_em).not.toBeNull();
    });
  });
});
