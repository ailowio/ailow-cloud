import { describe, expect, it } from 'vitest';
import { categoriasDoFiltro, consultaDosFiltros, coresDoFiltro, quantosFiltros, type FiltrosProdutos } from './filtros-produtos';

describe('Filtros de Produtos (P02)', () => {
  it('cores: junta as da grade (só ativas) com as dos SKUs, sem repetir pela chave da cor, em ordem alfabética', () => {
    const grade = [
      { nome: 'Preto', ativa: true },
      { nome: 'Azul marinho', ativa: true },
      { nome: 'Bege', ativa: false },
    ];
    const produtos = [{ skus: [{ cor: 'preto' }, { cor: 'Vinho' }] }, { skus: [{ cor: 'azul  Marinho' }, { cor: 'Ébano' }] }];
    expect(coresDoFiltro(grade, produtos)).toEqual(['Azul marinho', 'Ébano', 'Preto', 'Vinho']);
  });

  it('cores: sem a grade (Vendedor não lê /opcoes-grade), usa só as cores dos SKUs', () => {
    expect(coresDoFiltro(null, [{ skus: [{ cor: 'Nude' }, { cor: 'Nude' }] }])).toEqual(['Nude']);
  });

  it('categorias: as ativas da empresa mais as dos produtos (Vendedor não lê /categorias), sem repetir o id', () => {
    const daEmpresa = [
      { id: 'c2', nome: 'Sutiã', ativa: true },
      { id: 'c3', nome: 'Antiga', ativa: false },
    ];
    const produtos = [
      { categoria_id: 'c2', categoria_nome: 'Sutiã', skus: [] },
      { categoria_id: 'c1', categoria_nome: 'Body', skus: [] },
    ];
    expect(categoriasDoFiltro(daEmpresa, produtos)).toEqual([
      { id: 'c1', nome: 'Body' },
      { id: 'c2', nome: 'Sutiã' },
    ]);
    expect(categoriasDoFiltro(null, produtos)).toEqual([
      { id: 'c1', nome: 'Body' },
      { id: 'c2', nome: 'Sutiã' },
    ]);
  });

  it('quantos filtros estão ativos', () => {
    expect(quantosFiltros({})).toBe(0);
    expect(quantosFiltros({ categoria: { id: 'c1', nome: 'Sutiã' } })).toBe(1);
    expect(quantosFiltros({ categoria: { id: 'c1', nome: 'Sutiã' }, cor: 'Preto' })).toBe(2);
  });

  it('consulta da API: categoria_id e cor só quando ativos', () => {
    const f: FiltrosProdutos = { categoria: { id: 'c1', nome: 'Sutiã' }, cor: 'Preto' };
    expect(consultaDosFiltros(f)).toEqual({ categoria_id: 'c1', cor: 'Preto' });
    expect(consultaDosFiltros({})).toEqual({});
    expect(consultaDosFiltros({ cor: 'Preto' })).toEqual({ cor: 'Preto' });
  });
});
