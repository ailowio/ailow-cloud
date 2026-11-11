import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  AUTH_PEPPER: 'pepper-de-teste-com-pelo-menos-32-caracteres',
};

describe('loadConfig', () => {
  it('aplica defaults seguros para as opcionais', () => {
    expect(loadConfig(base)).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      AUTH_PEPPER: base.AUTH_PEPPER,
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
