// Uso (fora da API, por pessoa autorizada — ver README e ADR 004):
//   ADMIN_EMAIL=... ADMIN_SENHA=... DATABASE_URL=... AUTH_PEPPER=... TOTP_CHAVE=... node dist/admin/criar-admin-cli.js
// Imprime UMA vez a URI do TOTP (cadastre no app autenticador). Ela contém o segredo: não registre em log/chat.
import { criarCifraTotp } from '../acesso/cifra-totp.js';
import { criarHasher } from '../acesso/senhas.js';
import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { criarAdmin, lerEntradaAdmin } from './criar-admin.js';

let pool: ReturnType<typeof createPool> | undefined;
try {
  const config = loadConfig(process.env);
  const entrada = lerEntradaAdmin(process.env);
  pool = createPool(config.DATABASE_URL, 1);
  const { id, uri } = await criarAdmin(
    pool,
    criarHasher(config.AUTH_PEPPER),
    entrada,
    criarCifraTotp(config.TOTP_CHAVE),
  );
  console.log(`Admin criado: ${id}`);
  console.log('URI do TOTP (mostrada uma única vez):');
  console.log(uri);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool?.end();
}
