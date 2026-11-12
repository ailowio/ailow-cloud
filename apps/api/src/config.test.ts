import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  AUTH_PEPPER: 'pepper-de-teste-com-pelo-menos-32-caracteres',
  // Sorteada a cada execução: nenhum literal de chave no repositório.
  TOTP_CHAVE: randomBytes(32).toString('base64'),
};

describe('loadConfig', () => {
  it('aplica defaults seguros para as opcionais', () => {
    expect(loadConfig(base)).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      AUTH_PEPPER: base.AUTH_PEPPER,
      TOTP_CHAVE: base.TOTP_CHAVE,
      COOKIE_SECURE: true,
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('falha citando o NOME da variável obrigatória ausente, sem vazar valores', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('falha citando AUTH_PEPPER se ausente ou curto demais, sem vazar o valor', () => {
    expect(() => loadConfig({ DATABASE_URL: base.DATABASE_URL })).toThrow(/AUTH_PEPPER/);
    expect(() => loadConfig({ ...base, AUTH_PEPPER: 'curto-secreto' })).toThrow(/AUTH_PEPPER/);
    expect(() => loadConfig({ ...base, AUTH_PEPPER: 'curto-secreto' })).not.toThrow(/curto-secreto/);
  });

  it('TOTP_CHAVE é obrigatória e precisa ser base64 de 32 bytes, sem vazar o valor (SEC-17)', () => {
    const { TOTP_CHAVE: _, ...semChave } = base;
    expect(() => loadConfig(semChave)).toThrow(/TOTP_CHAVE/);
    const curta = randomBytes(16).toString('base64');
    expect(() => loadConfig({ ...base, TOTP_CHAVE: curta })).toThrow(/TOTP_CHAVE/);
    expect(() => loadConfig({ ...base, TOTP_CHAVE: curta })).not.toThrow(new RegExp(curta.replace(/[+/=]/g, '.')));
    expect(() => loadConfig({ ...base, TOTP_CHAVE: 'a'.repeat(44) })).toThrow(/TOTP_CHAVE/);
  });

  it('LOGIN_RATE_MAX, LOGIN_RATE_JANELA_S e TRUST_PROXY são opcionais e validados', () => {
    const c = loadConfig(base);
    expect([c.LOGIN_RATE_MAX, c.LOGIN_RATE_JANELA_S, c.TRUST_PROXY]).toEqual([undefined, undefined, undefined]);
    const ok = loadConfig({
      ...base,
      LOGIN_RATE_MAX: '20',
      LOGIN_RATE_JANELA_S: '120',
      TRUST_PROXY: '10.0.0.0/8, 172.16.0.0/12,::1',
    });
    expect([ok.LOGIN_RATE_MAX, ok.LOGIN_RATE_JANELA_S, ok.TRUST_PROXY]).toEqual([20, 120, '10.0.0.0/8, 172.16.0.0/12,::1']);
    // Vazio (cópia do .env.example) vale como ausente.
    expect(loadConfig({ ...base, TRUST_PROXY: '' }).TRUST_PROXY).toBeUndefined();
    for (const [nome, ruim] of [
      ['LOGIN_RATE_MAX', '0'],
      ['LOGIN_RATE_MAX', 'muitas'],
      ['LOGIN_RATE_JANELA_S', '0'],
      ['TRUST_PROXY', 'true'], // "confiar em todos" não é aceito
      ['TRUST_PROXY', '*'],
      ['TRUST_PROXY', '10.0.0.0/33'],
      ['TRUST_PROXY', '10.0.0.0/8/2'],
      ['TRUST_PROXY', '1'], // número de saltos não funciona no Fastify 5
    ] as const) {
      expect(() => loadConfig({ ...base, [nome]: ruim })).toThrow(new RegExp(nome));
    }
  });

  it('METRICS_TOKEN é opcional (ausente = /metrics desligada) e, se vier, exige 16+ caracteres sem vazar o valor', () => {
    expect(loadConfig(base).METRICS_TOKEN).toBeUndefined();
    // `METRICS_TOKEN=` vazio (cópia do .env.example) é o mesmo que ausente, não um erro.
    expect(loadConfig({ ...base, METRICS_TOKEN: '' }).METRICS_TOKEN).toBeUndefined();
    expect(loadConfig({ ...base, METRICS_TOKEN: 'a'.repeat(16) }).METRICS_TOKEN).toBe('a'.repeat(16));
    expect(() => loadConfig({ ...base, METRICS_TOKEN: 'curto-segredo' })).toThrow(/METRICS_TOKEN/);
    expect(() => loadConfig({ ...base, METRICS_TOKEN: 'curto-segredo' })).not.toThrow(/curto-segredo/);
  });

  it('DB_POOL_MAX é opcional (ausente ou vazio = padrão do pool, 10) e, se vier, é inteiro de 1 a 50', () => {
    expect(loadConfig(base).DB_POOL_MAX).toBeUndefined();
    expect(loadConfig({ ...base, DB_POOL_MAX: '' }).DB_POOL_MAX).toBeUndefined();
    expect(loadConfig({ ...base, DB_POOL_MAX: '20' }).DB_POOL_MAX).toBe(20);
    for (const ruim of ['0', '51', '2.5', 'dez', '-1']) {
      expect(() => loadConfig({ ...base, DB_POOL_MAX: ruim })).toThrow(/DB_POOL_MAX/);
    }
  });

  it('COOKIE_SECURE aceita true/false e rejeita outro valor', () => {
    expect(loadConfig({ ...base, COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(false);
    expect(loadConfig({ ...base, COOKIE_SECURE: 'true' }).COOKIE_SECURE).toBe(true);
    expect(() => loadConfig({ ...base, COOKIE_SECURE: 'talvez' })).toThrow(/COOKIE_SECURE/);
  });

  it('rejeita DATABASE_URL que não é postgres', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('rejeita PORT fora do intervalo', () => {
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejeita LOG_LEVEL desconhecido', () => {
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'barulho' })).toThrow(/LOG_LEVEL/);
  });

  it('não inclui o valor do segredo na mensagem de erro', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://usuario:senha-secreta@x' })).not.toThrow(
      /senha-secreta/,
    );
  });
});
