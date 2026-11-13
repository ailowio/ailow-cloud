import { describe, expect, it } from 'vitest';
import { type CamposBusca, filtrarPorBusca, normalizarBusca, precoCasa } from './busca';

interface Item {
  id: number;
  codigo: string;
  nome: string;
  preco: number;
}
const campos = (i: Item): CamposBusca => ({ textos: [i.codigo, i.nome], precoCentavos: i.preco });

const ITENS: Item[] = [
  { id: 1, codigo: 'P-0001-M-BRA', nome: 'Camiseta branca', preco: 4990 },
  { id: 2, codigo: 'P-0002-G-PRE', nome: 'Calça preta', preco: 12990 },
  { id: 3, codigo: 'P-0003-P-AZU', nome: 'Jaqueta jeans azul', preco: 25000 },
  { id: 4, codigo: 'P-0004-M-VER', nome: 'Blusa Verão ção', preco: 8905 },
  { id: 5, codigo: 'P-0005-G-BRA', nome: 'Camisa branca social', preco: 7990 },
];
const ids = (consulta: string) => filtrarPorBusca(ITENS, consulta, campos).map((i) => i.id);

describe('normalizarBusca', () => {
  it('tira acento e caixa', () => expect(normalizarBusca('  CAMISÉTA Calça ÇÃO ')).toBe('camiseta calca cao'));
  it('texto vazio continua vazio', () => expect(normalizarBusca('   ')).toBe(''));
  it('unicode fora do latim não quebra', () => expect(normalizarBusca('Ωmega 😀')).toBe('ωmega 😀'));
});

describe('precoCasa', () => {
  it.each([
    ['49,9', 4990],
    ['49.90', 4990],
    ['4990', 4990],
    ['49', 4900],
    ['129,90', 12990],
  ])('"%s" casa com %i centavos', (t, c) => expect(precoCasa(t, c)).toBe(true));
  it.each([
    ['49,9', 4999],
    ['50', 4990],
    ['abc', 4990],
    ['4,99', 4990],
  ])('"%s" não casa com %i centavos', (t, c) => expect(precoCasa(t, c)).toBe(false));
});

describe('filtrarPorBusca', () => {
  it('consulta vazia devolve tudo, na ordem original', () => {
    expect(ids('')).toEqual([1, 2, 3, 4, 5]);
    expect(ids('   ')).toEqual([1, 2, 3, 4, 5]);
  });
  it('caracteres soltos: "cms bra" acha Camiseta branca (subsequência por token)', () => {
    expect(ids('cms bra')).toEqual([1, 5]);
  });
  it('tokens fora de ordem: "bra cms" acha o mesmo', () => {
    expect(ids('bra cms')).toEqual([1, 5]);
  });
  it('"cmz bra": z não existe em nenhum campo, então não casa (sem chute)', () => {
    expect(ids('cmz bra')).toEqual([]);
  });
  it('ignora acento e caixa dos dois lados', () => {
    expect(ids('CALCA')).toEqual([2]);
    expect(ids('verao')).toEqual([4]);
    expect(ids('cao')).toEqual([4, 5]);
  });
  it('por código/SKU', () => {
    expect(ids('p-0003')).toEqual([3]);
    expect(ids('0002')).toEqual([2]);
  });
  it('por preço com vírgula, ponto e centavos', () => {
    expect(ids('49,9')).toEqual([1]);
    expect(ids('49.90')).toEqual([1]);
    expect(ids('4990')).toEqual([1]);
    expect(ids('250')).toEqual([3]);
  });
  it('preço e nome juntos: "branca 79,90"', () => {
    expect(ids('branca 79,90')).toEqual([5]);
  });
  it('todo token precisa casar: "camiseta preta" não acha nada', () => {
    expect(ids('camiseta preta')).toEqual([]);
  });
  it('sem resultado devolve lista vazia', () => {
    expect(ids('xyzw')).toEqual([]);
  });
  it('ranking: prefixo antes de subsequência espalhada', () => {
    // "cam" é prefixo de Camiseta e Camisa; em "Calça preta" só casa espalhado (c-a-m não: sem m) -> fora.
    expect(ids('cam')).toEqual([1, 5]);
  });
  it('ranking: match exato/prefixo sobe acima de subsequência', () => {
    const lista = [
      { id: 10, codigo: 'x', nome: 'a b c bola', preco: 100 },
      { id: 11, codigo: 'y', nome: 'bola', preco: 100 },
    ];
    expect(filtrarPorBusca(lista, 'bola', campos).map((i) => i.id)).toEqual([10, 11].reverse());
  });
  it('empate mantém a ordem original (estável)', () => {
    expect(ids('bra')).toEqual([1, 5, 4]);
  });
  it('não muda a lista de entrada', () => {
    const copia = [...ITENS];
    filtrarPorBusca(ITENS, 'c', campos);
    expect(ITENS).toEqual(copia);
  });
  it('emoji e unicode na consulta não quebram', () => {
    expect(ids('😀')).toEqual([]);
    expect(ids('ωmega')).toEqual([]);
  });
});
