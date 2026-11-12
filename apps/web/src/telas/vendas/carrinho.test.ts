import { describe, expect, it } from 'vitest';
import { MENSAGEM_SEM_ESTOQUE, acrescentar, mudarQuantidade, subtotalCentavos } from './carrinho';

const peca = {
  skuId: '11111111-1111-4111-8111-111111111111',
  codigo: '0001-M-PRE',
  nome: 'Tomara que caia',
  detalhe: 'M · Preto',
  precoCentavos: 8990,
  estoque: 2,
};

describe('carrinho da venda (RF-VEN-03/04)', () => {
  it('a primeira leitura entra com quantidade 1', () => {
    const r = acrescentar([], peca);
    expect(r.aviso).toBeNull();
    expect(r.itens).toEqual([{ ...peca, qtd: 1 }]);
  });

  it('ler de novo a mesma peça soma 1', () => {
    const primeiro = acrescentar([], peca);
    const segundo = acrescentar(primeiro.itens, peca);
    expect(segundo.itens[0]?.qtd).toBe(2);
    expect(subtotalCentavos(segundo.itens)).toBe(17980);
  });

  it('sem estoque não entra e a mensagem pede o Dono', () => {
    const cheio = acrescentar(acrescentar([], peca).itens, peca);
    const bloqueado = acrescentar(cheio.itens, peca);
    expect(bloqueado.aviso).toBe(MENSAGEM_SEM_ESTOQUE);
    expect(bloqueado.itens).toBe(cheio.itens);
    expect(acrescentar([], { ...peca, estoque: 0 }).aviso).toBe(MENSAGEM_SEM_ESTOQUE);
  });

  it('diminuir até zero tira a peça do carrinho', () => {
    const um = acrescentar([], peca).itens;
    expect(mudarQuantidade(um, peca.codigo, -1).itens).toEqual([]);
  });

  it('aumentar além do estoque não muda a quantidade', () => {
    const um = acrescentar([], { ...peca, estoque: 1 }).itens;
    const r = mudarQuantidade(um, peca.codigo, 1);
    expect(r.aviso).toBe(MENSAGEM_SEM_ESTOQUE);
    expect(r.itens[0]?.qtd).toBe(1);
  });
});
