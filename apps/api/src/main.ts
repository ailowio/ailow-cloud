import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig(process.env);
} catch (err) {
  // ENV-05: mensagem curta com o NOME da variável, sem stack e sem valores.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
const pool = createPool(config.DATABASE_URL);
const app = await buildApp({
  pool,
  logger: { level: config.LOG_LEVEL },
  authPepper: config.AUTH_PEPPER,
  cookieSecure: config.COOKIE_SECURE,
  metricsToken: config.METRICS_TOKEN,
});

// Encerramento limpo (SIGTERM do Docker): para de aceitar conexões e fecha o pool.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app
      .close()
      .then(() => pool.end())
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error({ err }, 'falha ao encerrar');
        process.exit(1);
      });
  });
}

await app.listen({ host: '0.0.0.0', port: config.PORT });
