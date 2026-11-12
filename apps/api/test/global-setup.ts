import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { runner } from 'node-pg-migrate';
import { INITDB_FLAGS } from '../scripts/embedded-flags.js';

// TEST-12: os testes de integração usam Postgres REAL.
// - No CI: DATABASE_URL_TEST aponta para o serviço Postgres efêmero do job.
// - Local (sem Docker): sobe um Postgres embutido (mesma major do compose) em diretório temporário.
function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export default async function setup(): Promise<() => Promise<void>> {
  let url = process.env.DATABASE_URL_TEST;
  let pg: EmbeddedPostgres | undefined;
  let dir: string | undefined;

  if (!url) {
    dir = await mkdtemp(join(tmpdir(), 'ailow-pg-'));
    const port = await portaLivre();
    pg = new EmbeddedPostgres({
      databaseDir: dir,
      user: 'ailow_test',
      password: 'ailow_test',
      port,
      persistent: false,
      initdbFlags: INITDB_FLAGS,
      onLog: () => {},
      onError: () => {},
    });
    await pg.initialise();
    await pg.start();
    await pg.createDatabase('ailow_test');
    url = `postgresql://ailow_test:ailow_test@127.0.0.1:${port}/ailow_test`;
  }

  await runner({
    databaseUrl: url,
    dir: 'migrations',
    migrationsTable: 'pgmigrations',
    direction: 'up',
    log: () => {},
  });
  process.env.DATABASE_URL_TEST = url;

  return async () => {
    if (pg) await pg.stop();
    if (dir) await rm(dir, { recursive: true, force: true });
  };
}
