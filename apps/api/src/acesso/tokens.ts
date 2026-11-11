import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

// Token = [<empresa_id>.]<segredo>. O prefixo só diz ONDE procurar (a RLS exige a empresa);
// quem vale é o segredo: o banco guarda apenas o SHA-256 dele. Segredo de 256 bits aleatórios
// dispensa hash lento (não dá para adivinhar nem fazer força bruta).
const BYTES = 32;
const TAMANHO_SEGREDO = Math.ceil((BYTES * 8) / 6); // 43 caracteres em base64url
const SEGREDO = new RegExp(`^[A-Za-z0-9_-]{${TAMANHO_SEGREDO}}$`);
const uuid = z.uuid();

const sha256 = (s: string) => createHash('sha256').update(s).digest();

export function novoToken(empresaId?: string): { token: string; hash: Buffer } {
  const segredo = randomBytes(BYTES).toString('base64url');
  return { token: empresaId ? `${empresaId}.${segredo}` : segredo, hash: sha256(segredo) };
}

export function lerToken(
  valor: string | undefined,
  comEmpresa = true,
): { empresaId?: string; hash: Buffer } | null {
  if (!valor || valor.length > 100) return null;
  if (!comEmpresa) return SEGREDO.test(valor) ? { hash: sha256(valor) } : null;
  const [empresaId, segredo, resto] = valor.split('.');
  if (resto !== undefined || !empresaId || !segredo) return null;
  if (!uuid.safeParse(empresaId).success || !SEGREDO.test(segredo)) return null;
  return { empresaId, hash: sha256(segredo) };
}
