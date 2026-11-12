import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../src/app.js';
import { createPool } from '../src/db.js';

// `npm run openapi:gerar`: escreve o contrato OpenAPI 3.1 em docs/openapi.json (artefato versionado e alvo do Spectral).
// Não conecta no banco: o pool só abre conexão na primeira consulta e a geração do contrato não faz nenhuma.
const destino = resolve(process.argv[2] ?? '../../docs/openapi.json');
const pool = createPool('postgres://sem-banco:sem-banco@127.0.0.1:1/sem_banco', 1);
const app = await buildApp({
  pool,
  authPepper: 'pepper-so-para-gerar-o-contrato-com-32-caracteres',
  cookieSecure: true,
  agora: () => new Date('2026-01-01T00:00:00.000Z'),
});
await app.ready();
const contrato = app.swagger() as { openapi: string; paths?: Record<string, unknown> };
await writeFile(destino, `${JSON.stringify(contrato, null, 2)}\n`, 'utf8');
await app.close();
await pool.end();
console.log(`OpenAPI ${contrato.openapi} (${Object.keys(contrato.paths ?? {}).length} caminhos) -> ${destino}`);
