import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };

describe('loadConfig', () => {
  it('aplica defaults seguros para as opcionais', () => {
    expect(loadConfig(base)).toEqual({
      DATABASE_URL: base.DATABASE_URL,
      PORT: 3000,
      LOG_LEVEL: 'info',
    });
  });

  it('falha citando o NOME da variável obrigatória ausente, sem vazar valores', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('rejeita DATABASE_URL que não é postgres', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('rejeita PORT fora do intervalo', () => {
    expect(() => loadConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejeita LOG_LEVEL desconhecido', () => {
    expect(() => loadConfig({ ...base, LOG_LEVEL: 'barulho' })).toThrow(/LOG_LEVEL/);
  });

  it('não inclui o valor do segredo na mensagem de erro', () => {
    expect(() => loadConfig({ DATABASE_URL: 'mysql://usuario:senha-secreta@x' })).not.toThrow(
      /senha-secreta/,
    );
  });
});
