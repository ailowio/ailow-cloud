import { describe, expect, it } from 'vitest';
import { centavosParaTexto, reaisParaCentavos } from './dinheiro';

// O campo de preço é texto digitado ("89,90"); este é o caminho de volta, para preencher o campo com a sugestão.
describe('centavosParaTexto', () => {
  it.each([
    [8990, '89,90'],
    [100, '1,00'],
    [5, '0,05'],
    [50, '0,50'],
    [0, '0,00'],
    [123_456, '1234,56'],
    [2_000_000_000, '20000000,00'],
  ])('%s centavos viram "%s"', (centavos, texto) => {
    expect(centavosParaTexto(centavos)).toBe(texto);
  });

  it('ida e volta: o texto gerado é lido de volta pelo mesmo valor', () => {
    for (const c of [1, 9, 10, 99, 100, 101, 8990, 123_456, 999_999_999]) {
      expect(reaisParaCentavos(centavosParaTexto(c))).toBe(c);
    }
  });

  it('rejeita valor não inteiro ou negativo (RN-01)', () => {
    expect(() => centavosParaTexto(10.5)).toThrow('centavos');
    expect(() => centavosParaTexto(-1)).toThrow('centavos');
  });
});
