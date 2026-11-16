import { describe, expect, it } from 'vitest';
import {
  MARKUP_MAXIMO_BPS,
  ajustarMarkupBps,
  bpsParaTexto,
  digitosParaCentavos,
  markupBpsDoPreco,
  mascaraCentavos,
  percentualParaBps,
  precoPorMarkup,
} from './valores-produto';

// S10: contas do passo "Custo e preço" (campo monetário por dígitos e markup editável). Tudo em centavos
// inteiros (RN-01) e em pontos-base (1% = 100); a API valida de novo.

describe('campo monetário por dígitos', () => {
  it('só os dígitos contam: "4" vira 0,04 e "4500" vira 45,00', () => {
    expect(digitosParaCentavos('4')).toBe(4);
    expect(digitosParaCentavos('4500')).toBe(4500);
  });
  it('ignora tudo que não é dígito (letras, R$, vírgula, ponto, sinal)', () => {
    expect(digitosParaCentavos('R$ 1.234,56')).toBe(123_456);
    expect(digitosParaCentavos('-5')).toBe(5);
    expect(digitosParaCentavos('abc')).toBeNull();
  });
  it('vazio ou zeros à esquerda: vazio é null, "000" é 0', () => {
    expect(digitosParaCentavos('')).toBeNull();
    expect(digitosParaCentavos('000')).toBe(0);
    expect(digitosParaCentavos('0045')).toBe(45);
  });
  it('trava no teto de R$ 20 milhões (nunca passa do máximo)', () => {
    expect(digitosParaCentavos('99999999999999')).toBe(2_000_000_000);
  });
  it('a máscara mostra milhar e duas casas, e nada quando vazio', () => {
    expect(mascaraCentavos(null)).toBe('');
    expect(mascaraCentavos(0)).toBe('0,00');
    expect(mascaraCentavos(5)).toBe('0,05');
    expect(mascaraCentavos(4500)).toBe('45,00');
    expect(mascaraCentavos(123_456)).toBe('1.234,56');
    expect(mascaraCentavos(2_000_000_000)).toBe('20.000.000,00');
  });
  it('máscara e dígitos fecham o ciclo (digitar o que a máscara mostra não muda o valor)', () => {
    for (const c of [0, 1, 99, 100, 4500, 123_456, 2_000_000_000]) {
      expect(digitosParaCentavos(mascaraCentavos(c))).toBe(c);
    }
  });
});

describe('markup a partir do custo e do preço', () => {
  it('preço a partir do markup: custo 45,00 com 80% dá 81,00', () => {
    expect(precoPorMarkup(4500, 8000)).toBe(8100);
  });
  it('markup 0%: o preço é o custo', () => {
    expect(precoPorMarkup(4500, 0)).toBe(4500);
  });
  it('arredonda o centavo para o mais próximo (metade para cima)', () => {
    expect(precoPorMarkup(1, 5000)).toBe(2); // 1,5
    expect(precoPorMarkup(3333, 5000)).toBe(5000); // 4999,5
  });
  it('custo 0 não tem markup: nem preço nem percentual (nada de NaN/Infinity)', () => {
    expect(precoPorMarkup(0, 5000)).toBeNull();
    expect(markupBpsDoPreco(0, 8990)).toBeNull();
  });
  it('valor grande que estoura o teto devolve null', () => {
    expect(precoPorMarkup(1_500_000_000, 10_000)).toBeNull();
    expect(precoPorMarkup(2_000_000_000, 0)).toBe(2_000_000_000);
  });
  it('markup a partir do preço: 45,00 -> 89,90 é 99,78%', () => {
    expect(markupBpsDoPreco(4500, 8990)).toBe(9978);
  });
  it('preço igual ao custo é 0%; preço abaixo do custo nunca vira negativo (vale 0)', () => {
    expect(markupBpsDoPreco(4500, 4500)).toBe(0);
    expect(markupBpsDoPreco(4500, 1000)).toBe(0);
  });
  it('sem preço digitado não há markup', () => {
    expect(markupBpsDoPreco(4500, null)).toBeNull();
  });
  it('valores grandes não perdem precisão', () => {
    expect(markupBpsDoPreco(100_000_000, 2_000_000_000)).toBe(190_000); // 1900%
  });
  it('ida e volta: editar o markup e ler de volta devolve o mesmo percentual (custo com bastante centavo)', () => {
    for (const bps of [0, 500, 3550, 8000, 12_345]) {
      const preco = precoPorMarkup(100_000, bps) as number;
      expect(markupBpsDoPreco(100_000, preco)).toBe(bps);
    }
  });
});

describe('texto do percentual', () => {
  it('lê inteiro, vírgula, ponto e o sinal de %', () => {
    expect(percentualParaBps('35')).toBe(3500);
    expect(percentualParaBps('35,5')).toBe(3550);
    expect(percentualParaBps('35.25')).toBe(3525);
    expect(percentualParaBps(' 80 % ')).toBe(8000);
    expect(percentualParaBps('0')).toBe(0);
  });
  it('recusa vazio, negativo, letras, 3 casas e acima do máximo', () => {
    for (const t of ['', '-5', 'abc', '1,234', '1,2,3', String(MARKUP_MAXIMO_BPS / 100 + 1)]) {
      expect(percentualParaBps(t), t).toBeNull();
    }
  });
  it('mostra sem zeros sobrando', () => {
    expect(bpsParaTexto(8000)).toBe('80');
    expect(bpsParaTexto(3550)).toBe('35,5');
    expect(bpsParaTexto(3525)).toBe('35,25');
    expect(bpsParaTexto(0)).toBe('0');
  });
  it('os botões de ajuste somam e subtraem sem passar de 0 nem do máximo', () => {
    expect(ajustarMarkupBps(8000, 500)).toBe(8500);
    expect(ajustarMarkupBps(300, -500)).toBe(0);
    expect(ajustarMarkupBps(MARKUP_MAXIMO_BPS - 100, 500)).toBe(MARKUP_MAXIMO_BPS);
  });
});
