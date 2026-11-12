import { existsSync } from 'node:fs';
import { join } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { runner } from 'node-pg-migrate';
import { INITDB_FLAGS } from './embedded-flags.js';
import { PASTA_DEV, PASTA_MIGRACOES, lerAmbienteDev, recusarEmProducao, urlBanco } from './dev-ambiente.js';

// `npm run dev:db`: Postgres 18 embutido e PERSISTENTE para desenvolver sem Docker.
// Os dados ficam em `.dev-data/pg` e sobrevivem a reinícios; Ctrl+C para o banco com segurança.
recusarEmProducao();
const ambiente = lerAmbienteDev();
const diretorio = join(PASTA_DEV, 'pg');
const jaExiste = existsSync(join(diretorio, 'PG_VERSION'));

const pg = new EmbeddedPostgres({
  databaseDir: diretorio,
  user: ambiente.usuario,
  password: ambiente.senhaDb,
  port: ambiente.porta,
  persistent: true,
  initdbFlags: INITDB_FLAGS,
  onLog: () => {},
  onError: (e) => console.error(e),
});

if (!jaExiste) await pg.initialise();
await pg.start();
if (!jaExiste) await pg.createDatabase(ambiente.banco);

// As migrações são as mesmas do Compose/produção; rodar de novo é seguro (só aplica as pendentes).
await runner({
  databaseUrl: urlBanco(ambiente),
  dir: PASTA_MIGRACOES,
  migrationsTable: 'pgmigrations',
  direction: 'up',
  log: () => {},
});

console.log(`Postgres de desenvolvimento no ar em 127.0.0.1:${ambiente.porta} (banco "${ambiente.banco}"), migrações em dia.`);
console.log('Deixe esta janela aberta. Em outras janelas: npm run dev:seed (1ª vez), npm run dev:api e npm run dev:web.');

let encerrando = false;
async function encerrar() {
  if (encerrando) return;
  encerrando = true;
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());
// Mantém o processo vivo enquanto o banco roda.
setInterval(() => {}, 1 << 30);
