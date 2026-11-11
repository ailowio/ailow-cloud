import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Conexão do DONO do schema (migrador). Só os testes a usam, para semear dados.
export function adminPool(): pg.Pool {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('DATABASE_URL_TEST ausente: o globalSetup não rodou');
  return new pg.Pool({ connectionString: url, max: 4 });
}

export async function criarEmpresa(admin: pg.Pool, nome: string): Promise<string> {
  const id = randomUUID();
  await admin.query('INSERT INTO empresas (id, nome) VALUES ($1, $2)', [id, nome]);
  return id;
}
