import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_FINANCEIRAS_PADRAO,
  TIPOS_CATEGORIA,
  categoriaAlterarSchema,
  categoriaCorpoSchema,
  empresaEntradaSchema,
  empresaSchema,
} from './configuracoes.js';

const base = { nome: 'Marcant', telefone: null, endereco: null, markup_bps: 0, inatividade_minutos: 5 };

describe('contrato de Configurações', () => {
  it('a entrada normaliza o telefone para dígitos; a resposta exige dígitos', () => {
    expect(empresaEntradaSchema.parse({ ...base, telefone: '(11) 98765-4321' }).telefone).toBe('11987654321');
    expect(empresaSchema.safeParse({ ...base, telefone: '(11) 98765-4321' }).success).toBe(false);
  });

  it('a resposta pode ser serializada de volta (sem transformação de mão única, que o Zod 4 não codifica)', () => {
    // Regressão: um .transform() no schema de resposta derrubava o serializador da API com 500.
    expect(() => empresaSchema.encode({ ...base, telefone: '11987654321' })).not.toThrow();
  });

  it.each([
    ['markup acima de 1000%', { markup_bps: 100_001 }],
    ['markup fracionário', { markup_bps: 1.5 }],
    ['trava de 0 minutos', { inatividade_minutos: 0 }],
    ['telefone com 9 dígitos', { telefone: '987654321' }],
  ])('recusa %s', (_nome, parte) => {
    expect(empresaEntradaSchema.safeParse({ ...base, ...parte }).success).toBe(false);
  });

  it('atributos repetidos, sem diferenciar maiúsculas, são recusados', () => {
    expect(categoriaCorpoSchema.safeParse({ nome: 'Sutiã', atributos: ['Aro', 'aro'] }).success).toBe(false);
    expect(categoriaCorpoSchema.safeParse({ nome: 'Sutiã', atributos: ['aro', 'bojo'] }).success).toBe(true);
  });

  describe('dois tipos de categoria: produto e financeira', () => {
    it('sem tipo informado, a categoria é de produto (compatível com quem já usa a API)', () => {
      expect(categoriaCorpoSchema.parse({ nome: 'Sutiã', atributos: [] }).tipo).toBe('produto');
    });

    it('só existem os tipos produto e financeira', () => {
      expect(TIPOS_CATEGORIA).toEqual(['produto', 'financeira']);
      expect(categoriaCorpoSchema.safeParse({ nome: 'X', atributos: [], tipo: 'outro' }).success).toBe(false);
    });

    it('categoria financeira não tem atributos (atributo é coisa de produto)', () => {
      expect(categoriaCorpoSchema.safeParse({ nome: 'Aluguel', atributos: [], tipo: 'financeira' }).success).toBe(true);
      expect(categoriaCorpoSchema.safeParse({ nome: 'Aluguel', atributos: ['bojo'], tipo: 'financeira' }).success).toBe(false);
    });

    it('a alteração não permite trocar o tipo: ele é definido na criação', () => {
      const r = categoriaAlterarSchema.parse({ nome: 'Aluguel', atributos: [], ativa: true, tipo: 'produto' });
      expect(r).not.toHaveProperty('tipo');
    });

    it('as categorias financeiras padrão são nomes únicos (sem diferenciar maiúsculas) e cabem no limite do nome', () => {
      const minusculas = CATEGORIAS_FINANCEIRAS_PADRAO.map((n) => n.toLowerCase());
      expect(new Set(minusculas).size).toBe(minusculas.length);
      for (const n of CATEGORIAS_FINANCEIRAS_PADRAO) {
        expect(categoriaCorpoSchema.safeParse({ nome: n, atributos: [], tipo: 'financeira' }).success, n).toBe(true);
      }
    });
  });
});
