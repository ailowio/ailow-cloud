import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('aceita api e banco saudáveis', () => {
    expect(healthResponseSchema.parse({ status: 'ok', db: 'ok' })).toEqual({ status: 'ok', db: 'ok' });
  });

  it('aceita api degradada com banco fora', () => {
    expect(healthResponseSchema.parse({ status: 'degraded', db: 'down' })).toEqual({
      status: 'degraded',
      db: 'down',
    });
  });

  it('rejeita status desconhecido', () => {
    expect(() => healthResponseSchema.parse({ status: 'talvez', db: 'ok' })).toThrow();
  });
});
