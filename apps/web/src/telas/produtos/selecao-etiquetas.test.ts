import { describe, expect, it } from 'vitest';
import { ErroApi } from '../../api/cliente';
import {
  mensagemEtiquetas,
  mudarQuantidade,
  quantidadesDoEstoque,
  resumoDasEtiquetas,
  textoDoResumo,
} from './selecao-etiquetas';

// S08 / RF-PRO-06: o Dono escolhe SKUs e quantidades; a bobina tem 3 etiquetas por fileira; até 999 por PDF.

describe('quantidades por SKU', () => {
  it('muda a quantidade de um SKU sem mexer nos outros', () => {
    expect(mudarQuantidade({ a: 2 }, 'b', 3)).toEqual({ a: 2, b: 3 });
  });

  it('zero tira o SKU da seleção', () => {
    expect(mudarQuantidade({ a: 2, b: 1 }, 'a', 0)).toEqual({ b: 1 });
  });

  it.each([
    [-3, 0],
    [2.7, 2],
    [5000, 999],
    [Number.NaN, 0],
  ])('quantidade %s vira %s', (pedida, fica) => {
    expect(mudarQuantidade({}, 'a', pedida)).toEqual(fica === 0 ? {} : { a: fica });
  });

  it('"usar o estoque" põe em cada SKU do produto a quantidade em estoque e mantém os outros produtos', () => {
    const skus = [
      { id: 'p', estoque: 4 },
      { id: 'm', estoque: 0 },
    ];
    expect(quantidadesDoEstoque({ outro: 2, m: 7 }, skus)).toEqual({ outro: 2, p: 4 });
  });
});

describe('resumo da seleção', () => {
  it('soma as etiquetas, conta as fileiras e as que sobram em branco, na ordem da escolha', () => {
    expect(resumoDasEtiquetas({ b: 1, a: 3 })).toEqual({
      total: 4,
      fileiras: 2,
      emBranco: 2,
      acimaDoLimite: false,
      itens: [
        { sku_id: 'b', quantidade: 1 },
        { sku_id: 'a', quantidade: 3 },
      ],
    });
  });

  it('acima de 999 avisa e não deixa gerar', () => {
    expect(resumoDasEtiquetas({ a: 999, b: 1 }).acimaDoLimite).toBe(true);
    expect(resumoDasEtiquetas({ a: 999 }).acimaDoLimite).toBe(false);
  });

  it.each([
    [0, 'Nenhuma etiqueta escolhida'],
    [1, '1 etiqueta · 1 fileira (2 em branco)'],
    [3, '3 etiquetas · 1 fileira'],
    [4, '4 etiquetas · 2 fileiras (2 em branco)'],
    [5, '5 etiquetas · 2 fileiras (1 em branco)'],
  ])('%i -> "%s"', (total, texto) => {
    expect(textoDoResumo(resumoDasEtiquetas(total === 0 ? {} : { a: total }))).toBe(texto);
  });
});

describe('mensagens de erro (sem código técnico)', () => {
  it('peça que sumiu da lista', () => {
    expect(mensagemEtiquetas(new ErroApi(404, 'nao_encontrado'))).toMatch(/não foi encontrada/);
  });

  it('sem conexão usa a mensagem comum', () => {
    expect(mensagemEtiquetas(new ErroApi(0, 'sem_conexao'))).toMatch(/conex/i);
  });
});
