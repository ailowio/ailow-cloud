import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ambiente de DESENVOLVIMENTO sem Docker (ENV-13: banco próprio, separado do banco efêmero dos testes).
// Tudo fica em `.dev-data/` na raiz do repositório (ignorado pelo git). Os segredos são gerados na
// primeira execução, nunca vão para o repositório e valem só nesta máquina.
export const PASTA_DEV = fileURLToPath(new URL('../../../.dev-data/', import.meta.url));
export const PASTA_MIGRACOES = fileURLToPath(new URL('../migrations', import.meta.url));

export interface AmbienteDev {
  porta: number;
  usuario: string;
  banco: string;
  senhaDb: string;
  // Mesmo pepper em toda execução: trocá-lo invalidaria as senhas e PINs já gravados no banco de dev.
  pepper: string;
  // Chave que cifra o segredo TOTP do Admin (base64, 32 bytes). Mesma regra do pepper: trocá-la inutiliza os Admins de dev.
  totpChave: string;
}

const ARQUIVO = join(PASTA_DEV, 'ambiente.json');

export function lerAmbienteDev(): AmbienteDev {
  if (existsSync(ARQUIVO)) {
    const lido = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as Partial<AmbienteDev> & Omit<AmbienteDev, 'totpChave'>;
    if (lido.totpChave) return lido as AmbienteDev;
    // Arquivo de antes da cifra do TOTP (S14): acrescenta a chave sem mexer nos outros campos. Admins de dev criados
    // antes dela têm o segredo em claro no banco e precisam ser recriados (npm run admin:criar).
    const completo: AmbienteDev = { ...lido, totpChave: randomBytes(32).toString('base64') };
    writeFileSync(ARQUIVO, JSON.stringify(completo, null, 2));
    return completo;
  }
  const ambiente: AmbienteDev = {
    porta: 54329, // longe da 5432 padrão e da porta aleatória dos testes
    usuario: 'ailow_dev',
    banco: 'ailow_dev',
    senhaDb: randomBytes(18).toString('hex'),
    pepper: randomBytes(32).toString('hex'),
    totpChave: randomBytes(32).toString('base64'),
  };
  mkdirSync(PASTA_DEV, { recursive: true });
  writeFileSync(ARQUIVO, JSON.stringify(ambiente, null, 2));
  return ambiente;
}

export const urlBanco = (a: AmbienteDev) =>
  `postgresql://${a.usuario}:${a.senhaDb}@127.0.0.1:${a.porta}/${a.banco}`;

// Estas ferramentas nunca devem rodar contra um ambiente real.
export function recusarEmProducao(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Script exclusivo de desenvolvimento: recusado com NODE_ENV=production.');
  }
}
