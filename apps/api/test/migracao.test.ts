import { randomBytes } from 'node:crypto';
import { runner } from 'node-pg-migrate';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';

// OPS-11: toda migração tem caminho de volta. Usa um banco novo no mesmo cluster
// (não mexe no banco compartilhado pelos outros testes).
describe('migrações', () => {
  const base = new URL(process.env.DATABASE_URL_TEST as string);
  const nome = `mig_${randomBytes(4).toString('hex')}`;
  const url = new URL(base);
  url.pathname = `/${nome}`;
  const admin = new pg.Client({ connectionString: base.toString() });

  const rodar = (direction: 'up' | 'down', count?: number) =>
    runner({
      databaseUrl: url.toString(),
      dir: 'migrations',
      migrationsTable: 'pgmigrations',
      direction,
      count: count ?? Number.POSITIVE_INFINITY,
      log: () => {},
    });

  const TABELAS = [
    'categorias',
    'empresas',
    'fornecedores',
    'itens_pedido_compra',
    'itens_venda',
    'lancamentos',
    'movimentos_estoque',
    'pagamentos_venda',
    'parcelas_pedido_compra',
    'pedido_compra_sequencia',
    'pedidos_compra',
    'pontos',
    'pontos_ajustes',
    'produtos',
    'skus',
    'venda_sequencia',
    'vendas',
  ];

  const tabelas = async () => {
    const c = new pg.Client({ connectionString: url.toString() });
    await c.connect();
    try {
      const r = await c.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('empresas','categorias','lancamentos','produtos','skus','movimentos_estoque','vendas','itens_venda','pagamentos_venda','venda_sequencia','fornecedores','pedido_compra_sequencia','pedidos_compra','itens_pedido_compra','parcelas_pedido_compra','pontos','pontos_ajustes') ORDER BY 1",
      );
      return r.rows.map((x) => x.tablename);
    } finally {
      await c.end();
    }
  };

  afterAll(async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${nome} WITH (FORCE)`);
    await admin.end();
  });

  it('sobe, desce e sobe de novo sem deixar resíduos', async () => {
    await admin.connect();
    await admin.query(`CREATE DATABASE ${nome}`);

    await rodar('up');
    expect(await tabelas()).toEqual(TABELAS);

    await rodar('down');
    expect(await tabelas()).toEqual([]);

    await rodar('up');
    expect(await tabelas()).toEqual(TABELAS);
  });
});
