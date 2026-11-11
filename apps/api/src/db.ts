import pg from 'pg';
import { z } from 'zod';

const empresaIdSchema = z.uuid({ error: 'empresa_id inválido: esperado UUID' });

export function createPool(databaseUrl: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max });
}

// Executa `fn` numa transação em que o Postgres só enxerga as linhas da empresa informada (ADR 002).
// - SET LOCAL ROLE ailow_app: papel sem BYPASSRLS e sem ser dono das tabelas => as políticas valem.
// - set_config(..., true): a empresa vale só nesta transação e some ao COMMIT/ROLLBACK (não vaza no pool).
export async function withEmpresa<T>(
  pool: pg.Pool,
  empresaId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const id = empresaIdSchema.parse(empresaId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE ailow_app');
    await client.query("SELECT set_config('app.empresa_id', $1, true)", [id]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
