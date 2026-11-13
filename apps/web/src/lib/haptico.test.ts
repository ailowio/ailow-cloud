import { afterEach, describe, expect, it, vi } from 'vitest';
import { vibrarToque } from './haptico';

// UXM-05: o toque vibra se o aparelho suporta; sem suporte (desktop, iOS, teste) não faz nada e não quebra.
describe('vibrarToque', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('chama navigator.vibrate uma vez com 10 ms', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(vibrarToque()).toBe(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  it('aceita outra duração', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    vibrarToque(25);
    expect(vibrate).toHaveBeenCalledWith(25);
  });

  it('sem navigator.vibrate: devolve false e não lança', () => {
    vi.stubGlobal('navigator', {});
    expect(() => vibrarToque()).not.toThrow();
    expect(vibrarToque()).toBe(false);
  });

  it('sem navigator: devolve false e não lança', () => {
    vi.stubGlobal('navigator', undefined);
    expect(vibrarToque()).toBe(false);
  });

  it('vibrate que lança (permissão negada) não propaga o erro', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('negado');
      },
    });
    expect(vibrarToque()).toBe(false);
  });
});
