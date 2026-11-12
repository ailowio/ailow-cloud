import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Cifra do segredo TOTP do Admin em repouso (SEC-17, threat model #5): AES-256-GCM com a chave TOTP_CHAVE, que fica
// no ambiente e não no banco. Quem lê só o banco (backup, dump, SQL injection) não obtém o segredo.
//
// Formato guardado: "v1." + base64url(iv[12] | tag[16] | cifrado). O prefixo de versão permite rotacionar a chave ou
// o algoritmo depois sem adivinhar o formato. Texto sem versão é recusado (nunca tratado como válido).
const VERSAO = 'v1.';
const TAM_IV = 12;
const TAM_TAG = 16;

export interface CifraTotp {
  cifrar(segredo: string): string;
  decifrar(guardado: string): string;
}

export function criarCifraTotp(chaveBase64: string): CifraTotp {
  const chave = Buffer.from(chaveBase64, 'base64');
  // Buffer.from é tolerante com base64 inválido: confere o tamanho E que o texto é base64 de verdade.
  if (chave.length !== 32 || chave.toString('base64') !== chaveBase64) {
    throw new Error('TOTP_CHAVE: deve ser base64 de exatamente 32 bytes (ex.: openssl rand -base64 32)');
  }

  return {
    cifrar(segredo) {
      const iv = randomBytes(TAM_IV);
      const c = createCipheriv('aes-256-gcm', chave, iv);
      const cifrado = Buffer.concat([c.update(segredo, 'utf8'), c.final()]);
      return VERSAO + Buffer.concat([iv, c.getAuthTag(), cifrado]).toString('base64url');
    },

    decifrar(guardado) {
      if (!guardado.startsWith(VERSAO)) throw new Error('segredo TOTP em formato desconhecido (esperado v1.)');
      const bruto = Buffer.from(guardado.slice(VERSAO.length), 'base64url');
      if (bruto.length <= TAM_IV + TAM_TAG) throw new Error('segredo TOTP em formato inválido (curto demais)');
      const d = createDecipheriv('aes-256-gcm', chave, bruto.subarray(0, TAM_IV));
      d.setAuthTag(bruto.subarray(TAM_IV, TAM_IV + TAM_TAG));
      return Buffer.concat([d.update(bruto.subarray(TAM_IV + TAM_TAG)), d.final()]).toString('utf8');
    },
  };
}
