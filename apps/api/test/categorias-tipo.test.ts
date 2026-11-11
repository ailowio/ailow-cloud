import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// Duas listas de categorias na mesma tabela: de produto e financeiras (banco). Só afirma sobre linhas criadas aqui (L-0008).
describe('categorias: tipo produto × financeira (banco)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresa: string;

  const inserir = (nome: string, tipo: string | null, atributos: string[] = []) =>
    withEmpresa(app, empresa, (c) =>
      tipo === null
        ? c.query('INSERT INTO categorias (empresa_id, nome, atributos) VALUES ($1, $2, $3)', [empresa, nome, atributos])
        : c.query('INSERT INTO categorias (empresa_id, nome, atributos, tipo) VALUES ($1, $2, $3, $4)', [empresa, nome, atributos, tipo]),
    );

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresa = await criarEmpresa(admin, 'Categorias tipo');
  });
  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  it('sem tipo informado, a categoria é de produto (as linhas que já existem continuam valendo)', async () => {
    await inserir('Sem tipo', null);
    const r = await withEmpresa(app, empresa, (c) => c.query("SELECT tipo FROM categorias WHERE nome = 'Sem tipo'"));
    expect(r.rows[0].tipo).toBe('produto');
  });

  it('o mesmo nome pode existir nos dois tipos, mas não repetir dentro do mesmo tipo', async () => {
    await inserir('Embalagem', 'produto');
    await inserir('Embalagem', 'financeira');
    await expect(inserir('embalagem ', 'produto')).rejects.toMatchObject({ code: '23505' });
    await expect(inserir(' EMBALAGEM', 'financeira')).rejects.toMatchObject({ code: '23505' });
  });

  it('tipo inventado é recusado', async () => {
    await expect(inserir('Estranha', 'servico')).rejects.toMatchObject({ code: '23514' });
  });

  it('categoria financeira não aceita atributos', async () => {
    await expect(inserir('Aluguel x', 'financeira', ['bojo'])).rejects.toMatchObject({ code: '23514' });
    await inserir('Aluguel y', 'financeira', []);
  });
});
