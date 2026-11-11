import { emailSchema, senhaSchema } from '@ailow/shared';
import type pg from 'pg';
import type { Hasher } from '../acesso/senhas.js';
import { novoSegredoTotp, uriTotp } from '../acesso/totp.js';

// Cria uma conta de Admin da plataforma já com 2º fator (RF-ACE-07): não existe Admin sem TOTP.
// Acesso privilegiado (AUD-06): quem chama é uma pessoa autorizada, fora da API; ver ADR 004.
export async function criarAdmin(
  pool: pg.Pool,
  hasher: Hasher,
  entrada: { email: string; senha: string },
): Promise<{ id: string; segredo: string; uri: string }> {
  const email = emailSchema.parse(entrada.email);
  const senha = senhaSchema.parse(entrada.senha);
  const segredo = novoSegredoTotp();
  const r = await pool.query(
    'INSERT INTO admins (email, senha_hash, totp_segredo) VALUES ($1, $2, $3) RETURNING id',
    [email, await hasher.hash(senha), segredo],
  );
  return { id: r.rows[0].id as string, segredo, uri: uriTotp(email, segredo) };
}

// O CLI lê e-mail e senha do ambiente (nunca de argumentos: argv aparece em lista de processos e histórico).
export function lerEntradaAdmin(env: Record<string, string | undefined>): { email: string; senha: string } {
  const faltando = ['ADMIN_EMAIL', 'ADMIN_SENHA'].filter((nome) => !env[nome]);
  if (faltando.length > 0) throw new Error(`Variáveis obrigatórias ausentes: ${faltando.join(', ')}`);
  return { email: env.ADMIN_EMAIL as string, senha: env.ADMIN_SENHA as string };
}
