import { isIP } from 'node:net';
import { z } from 'zod';

function ipOuCidrValido(texto: string): boolean {
  const [ip, prefixo, ...resto] = texto.split('/');
  if (resto.length > 0 || !ip) return false;
  const versao = isIP(ip);
  if (versao === 0) return false;
  if (prefixo === undefined) return true;
  return /^\d{1,3}$/.test(prefixo) && Number(prefixo) <= (versao === 4 ? 32 : 128);
}

// ENV-04/05: falha cedo, citando o NOME da variável (nunca o valor).
const configSchema = z.object({
  DATABASE_URL: z
    .string({ error: 'obrigatória' })
    .refine((v) => /^postgres(ql)?:\/\//.test(v), { error: 'deve começar com postgresql://' }),
  // Segredo do servidor misturado ao hash de senha/PIN (ADR 004). Fora do banco; trocá-lo invalida todos os hashes.
  AUTH_PEPPER: z
    .string({ error: 'obrigatória' })
    .min(32, { error: 'deve ter ao menos 32 caracteres' }),
  // Chave AES-256 que cifra o segredo TOTP do Admin no banco (SEC-17): base64 de 32 bytes (openssl rand -base64 32).
  // Fora do banco e do repositório. Perdê-la = os Admins precisam refazer o TOTP; trocá-la exige recifrar (ADR 010).
  TOTP_CHAVE: z
    .string({ error: 'obrigatória' })
    .refine((v) => {
      const b = Buffer.from(v, 'base64');
      return b.length === 32 && b.toString('base64') === v;
    }, { error: 'deve ser base64 de exatamente 32 bytes' }),
  // Rate limit das rotas de senha (SEC-07). Ausente ou vazio = 10 tentativas por 60 s por IP (padrão do buildApp).
  LOGIN_RATE_MAX: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).optional()),
  LOGIN_RATE_JANELA_S: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(1).optional()),
  // IPs/CIDRs dos proxies confiáveis, separados por vírgula (ex.: a faixa privada da rede do Compose/Swarm). Ausente ou
  // vazio = nenhum: o IP é o da conexão. "true"/"*" (confiar em todos) é recusado: deixaria forjar o IP de origem.
  TRUST_PROXY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z
      .string()
      .refine((v) => v.split(',').every((p) => ipOuCidrValido(p.trim())), {
        error: 'deve ser uma lista de IPs ou CIDRs separada por vírgula (ex.: 10.0.0.0/8,172.16.0.0/12)',
      })
      .optional(),
  ),
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
