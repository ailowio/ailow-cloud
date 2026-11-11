import { describe, expect, it } from 'vitest';
import { reaisParaCentavos } from './dinheiro';

// RN-01: o que a pessoa digita ("12,50") vira centavos inteiros por texto, sem passar por ponto flutuante.
describe('reaisParaCentavos (entrada digitada)', () => {
  it.each([
    ['10', 1000],
    ['10,5', 1050],
    ['10,50', 1050],
    ['0,99', 99],
    [',5', 50],
    ['1.234,56', 123_456],
    ['1.234', 123_400],
    ['12.345.678,90', 1_234_567_890],
    ['  R$ 25,00 ', 2500],
    ['R$25', 2500],
    ['0', 0],
  ])('"%s" vira %i centavos', (texto, centavos) => {
    expect(reaisParaCentavos(texto)).toBe(centavos);
  });

  it.each([
    ['ponto usado como vírgula (12.5)', '12.5', 1250],
    ['ponto usado como vírgula (12.50)', '12.50', 1250],
  ])('aceita %s', (_nome, texto, centavos) => {
    expect(reaisParaCentavos(texto)).toBe(centavos);
  });

  it('é exato onde o ponto flutuante erra: 0,29 e 1,15 e 19,99', () => {
    // 0.29 * 100 = 28.999999999999996 e 1.15 * 100 = 114.99999999999999 em float.
    expect(reaisParaCentavos('0,29')).toBe(29);
    expect(reaisParaCentavos('1,15')).toBe(115);
    expect(reaisParaCentavos('19,99')).toBe(1999);
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['letras', 'abc'],
    ['três casas decimais', '10,555'],
    ['duas vírgulas', '1,2,3'],
    ['negativo', '-5'],
    ['agrupamento de milhar errado', '1.23.456'],
    ['milhar e ponto decimal juntos', '1,234.56'],
    ['notação científica', '1e3'],
    ['grande demais (10 dígitos inteiros)', '1234567890'],
    ['só a vírgula', ','],
  ])('recusa %s', (_nome, texto) => {
    expect(reaisParaCentavos(texto)).toBeNull();
  });

  it('o resultado é sempre um inteiro seguro', () => {
    const v = reaisParaCentavos('999.999.999,99');
    expect(Number.isSafeInteger(v)).toBe(true);
  });
});
