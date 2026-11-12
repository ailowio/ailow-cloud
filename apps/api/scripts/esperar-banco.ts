import pg from 'pg';

// Parte de scripts/lib/ambiente-efemero.sh (S13b): espera o Postgres responder a uma consulta de verdade PELA PORTA
// publicada no host, que é por onde as migrações e a API vão falar. O pg_isready dentro do contêiner não basta: logo
// depois do initdb a porta publicada pode aceitar a conexão e derrubá-la ("Connection terminated unexpectedly").
const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error('defina DATABASE_URL');
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error('só espera banco local');

const PRAZO_MS = 60_000;
const inicio = Date.now();
let ultimoErro = '';
for (;;) {
  const cliente = new pg.Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
  // Sem 'error' tratado, o pg derruba o processo quando o servidor reseta a conexão.
  cliente.on('error', () => {});
  try {
    await cliente.connect();
    await cliente.query('SELECT 1');
    await cliente.end();
    break;
  } catch (err) {
    ultimoErro = err instanceof Error ? err.message : String(err);
    await cliente.end().catch(() => {});
    if (Date.now() - inicio > PRAZO_MS) throw new Error(`banco não respondeu em ${PRAZO_MS / 1000}s: ${ultimoErro}`);
    await new Promise((r) => setTimeout(r, 500));
  }
}
