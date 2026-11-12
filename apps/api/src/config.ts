import { z } from 'zod';

// ENV-04/05: falha cedo, citando o NOME da variável (nunca o valor).
const configSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'obrigatória' })
    .refine((v) => /^postgres(ql)?:\/\//.test(v), { error: 'deve começar com postgresql://' }),
  // Segredo do servidor misturado ao hash de senha/PIN (ADR 004). Fora do banco; trocá-lo invalida todos os hashes.
  AUTH_PEPPER: z
    .string({ error: 'obrigatória' })
    .min(32, { error: 'deve ter ao menos 32 caracteres' }),
  // Cookies só trafegam por HTTPS. Em desenvolvimento local sem HTTPS: COOKIE_SECURE=false.
  COOKIE_SECURE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Token Bearer de GET /metrics (S13b). Ausente = a rota não existe (404). Aleatório, 16+ caracteres, FORA do repositório.
  // Vazio (cópia do .env.example) vale como ausente.
  METRICS_TOKEN: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(16, { error: 'deve ter ao menos 16 caracteres' }).optional(),
  ),
  // Conexões simultâneas da API com o Postgres (S13b2). Ausente ou vazio = 10 (padrão do createPool). Soma de todas as
  // instâncias da API tem de caber em max_connections do Postgres; o teto 50 evita esgotá-lo por engano.
  DB_POOL_MAX: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().min(1).max(50).optional(),
  ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const problemas = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`)
      .join('; ');
    throw new Error(`Configuração inválida — ${problemas}`);
  }
  return parsed.data;
}
