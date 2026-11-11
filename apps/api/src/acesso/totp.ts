import { randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';

const PERIODO = 30;

const novoTotp = (segredo: string, conta = 'admin') =>
  new OTPAuth.TOTP({
    issuer: 'Ailow Cloud',
    label: conta,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIODO,
    secret: OTPAuth.Secret.fromBase32(segredo),
  });

// 20 bytes aleatórios (160 bits, o tamanho recomendado pela RFC 4226) em base32.
export function novoSegredoTotp(): string {
  return new OTPAuth.Secret({ buffer: new Uint8Array(randomBytes(20)).buffer }).base32;
}

export function uriTotp(conta: string, segredo: string): string {
  return novoTotp(segredo, conta).toString();
}

// Devolve o passo (contador) aceito ou null. `ultimoPasso` bloqueia reuso do mesmo código.
// Janela 1 = aceita o passo anterior e o seguinte (tolerância de relógio de ±30 s).
export function validarTotp(
  segredo: string,
  codigo: string,
  agoraMs: number,
  ultimoPasso: number,
): number | null {
  const delta = novoTotp(segredo).validate({
    token: codigo,
    timestamp: agoraMs,
    window: 1,
    afterCounter: ultimoPasso,
  });
  return delta === null ? null : Math.floor(agoraMs / 1000 / PERIODO) + delta;
}
