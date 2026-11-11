import * as argon2 from 'argon2';

// argon2id com custo na faixa mínima recomendada (19 MiB, 2 passes, 1 thread) — ver ADR 004.
// O "pepper" (segredo do servidor, fora do banco) entra no hash: um PIN de 4 dígitos tem só
// 10 mil possibilidades, então sem o pepper quem vazasse o banco o quebraria offline em segundos.
const PARAMETROS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export interface Hasher {
  hash(segredo: string): Promise<string>;
  verificar(hash: string, segredo: string): Promise<boolean>;
}

export function criarHasher(pepper: string): Hasher {
  if (pepper.length < 32) throw new Error('o pepper deve ter ao menos 32 caracteres');
  const secret = Buffer.from(pepper, 'utf8');
  return {
    hash: (segredo) => argon2.hash(segredo, { ...PARAMETROS, secret }),
    async verificar(hash, segredo) {
      try {
        return await argon2.verify(hash, segredo, { secret });
      } catch {
        // Hash malformado/corrompido: tratar como "não confere", nunca como erro 500.
        return false;
      }
    },
  };
}
