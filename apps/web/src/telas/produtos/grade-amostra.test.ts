import { describe, expect, it } from 'vitest';
import { CORES_SUGERIDAS, amostraDaCor } from './grade';

describe('amostra de cor dos chips (S10)', () => {
  it('toda cor sugerida tem amostra', () => {
    for (const c of CORES_SUGERIDAS) expect(amostraDaCor(c), c).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('ignora maiúsculas e espaços; cor digitada à mão fica sem amostra', () => {
    expect(amostraDaCor(' PRETO ')).toBe(amostraDaCor('Preto'));
    expect(amostraDaCor('Rosa chá')).toBeNull();
  });
});
