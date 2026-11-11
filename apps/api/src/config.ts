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
