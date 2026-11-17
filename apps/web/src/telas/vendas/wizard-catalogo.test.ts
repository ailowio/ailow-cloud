import { describe, expect, it } from 'vitest';
import type { Categoria, Produto } from '@ailow/shared';
import {
  PASSOS_CATALOGO,
  categoriasComEstoque,
  passoAnterior,
  produtosDaCategoria,
  skusDoTamanho,
  tamanhosComEstoque,
} from './wizard-catalogo';

function sku(partial: Partial<Produto['skus'][number]> & Pick<Produto['skus'][number], 'id' | 'codigo' | 'tamanho' | 'cor' | 'estoque'>) {
  return partial;
}

function produto(p: Partial<Produto> & Pick<Produto, 'id' | 'nome' | 'categoria_id' | 'skus'>): Produto {
  return {
    porte: 'slim',
    atributos: [],
    preco_centavos: 9900,
    ...p,
  } as Produto;
}

const catA: Categoria = { id: '11111111-1111-4111-8111-111111111111', nome: 'Sutiã', tipo: 'produto', atributos: [], ativa: true };
const catB: Categoria = { id: '22222222-2222-4222-8222-222222222222', nome: 'Calcinha', tipo: 'produto', atributos: [], ativa: true };
const catFin: Categoria = { id: '33333333-3333-4333-8333-333333333333', nome: 'Aluguel', tipo: 'financeira', atributos: [], ativa: true };

describe('wizard-catalogo', () => {
  it('tem 4 passos na ordem categoria → produto → tamanho → cor', () => {
    expect(PASSOS_CATALOGO).toEqual(['categoria', 'produto', 'tamanho', 'cor']);
    expect(passoAnterior('categoria')).toBeNull();
    expect(passoAnterior('cor')).toBe('tamanho');
  });

  it('categoriasComEstoque ignora financeira e categoria sem estoque', () => {
    const produtos = [
      produto({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        nome: 'A',
        categoria_id: catA.id,
        skus: [sku({ id: 's1', codigo: 'A', tamanho: 'M', cor: 'Preto', estoque: 2 })],
      }),
      produto({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        nome: 'B',
        categoria_id: catB.id,
        skus: [sku({ id: 's2', codigo: 'B', tamanho: 'M', cor: 'Preto', estoque: 0 })],
      }),
    ];
    const r = categoriasComEstoque([catA, catB, catFin], produtos);
    expect(r.map((c) => c.id)).toEqual([catA.id]);
  });

  it('produtosDaCategoria só com estoque, ordenados por nome', () => {
    const produtos = [
      produto({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        nome: 'Zebra',
        categoria_id: catA.id,
        skus: [sku({ id: 's1', codigo: 'Z', tamanho: 'M', cor: 'Preto', estoque: 1 })],
      }),
      produto({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        nome: 'Alpha',
        categoria_id: catA.id,
        skus: [sku({ id: 's2', codigo: 'A', tamanho: 'M', cor: 'Preto', estoque: 1 })],
      }),
      produto({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        nome: 'Sem',
        categoria_id: catA.id,
        skus: [sku({ id: 's3', codigo: 'S', tamanho: 'M', cor: 'Preto', estoque: 0 })],
      }),
    ];
    expect(produtosDaCategoria(produtos, catA.id).map((p) => p.nome)).toEqual(['Alpha', 'Zebra']);
  });

  it('tamanhos e cores só com estoque', () => {
    const p = produto({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      nome: 'X',
      categoria_id: catA.id,
      skus: [
        sku({ id: '1', codigo: '1', tamanho: 'G', cor: 'Azul', estoque: 1 }),
        sku({ id: '2', codigo: '2', tamanho: 'P', cor: 'Preto', estoque: 2 }),
        sku({ id: '3', codigo: '3', tamanho: 'M', cor: 'Rosa', estoque: 0 }),
        sku({ id: '4', codigo: '4', tamanho: 'P', cor: 'Branco', estoque: 0 }),
      ],
    });
    expect(tamanhosComEstoque(p)).toEqual(['P', 'G']);
    expect(skusDoTamanho(p, 'P').map((s) => s.cor)).toEqual(['Preto']);
  });
});
