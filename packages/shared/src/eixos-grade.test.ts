import { describe, expect, it } from 'vitest';
import {
  MAX_EIXOS_POR_CATEGORIA,
  SLUGS_EIXO_SISTEMA,
  TAMANHOS_PADRAO,
  CORES_PADRAO,
  eixoGradeNovoSchema,
  eixoGradeSchema,
  valorEixoNovoSchema,
  valorEixoSchema,
  valorEixoAlterarSchema,
  categoriaEixosDefinirSchema,
  categoriaEixosResponseSchema,
  validarNomeValorEixo,
  ehSlugSistema,
} from './eixos-grade.js';

const EIXO_ID = '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11';
const VALOR_ID = '5d1f0f6e-0c1d-4b0e-9a43-7d2f0f6f3a99';

describe('constantes de eixos de grade', () => {
  it('limita a 4 eixos por categoria', () => {
    expect(MAX_EIXOS_POR_CATEGORIA).toBe(4);
  });

  it('define slugs de sistema tamanho e cor', () => {
    expect(SLUGS_EIXO_SISTEMA).toEqual(['tamanho', 'cor']);
    expect(ehSlugSistema('tamanho')).toBe(true);
    expect(ehSlugSistema('cor')).toBe(true);
    expect(ehSlugSistema('taca')).toBe(false);
  });

  it('reexporta tamanhos e cores padrão (ADR 017)', () => {
    expect(TAMANHOS_PADRAO).toContain('P');
    expect(TAMANHOS_PADRAO).toContain('46');
    expect(CORES_PADRAO.some((c) => c.nome === 'Preto')).toBe(true);
  });
});

describe('eixoGradeNovoSchema (criar eixo)', () => {
  it('aceita eixo custom de texto', () => {
    expect(eixoGradeNovoSchema.safeParse({ nome: 'Taça', tipo_valor: 'texto' }).success).toBe(true);
  });

  it.each([
    ['nome vazio', { nome: '  ', tipo_valor: 'texto' }],
    ['tipo inventado', { nome: 'Taça', tipo_valor: 'numero' }],
    ['campo extra (strict)', { nome: 'Taça', tipo_valor: 'texto', slug: 'taca' }],
  ])('recusa %s', (_nome, corpo) => {
    expect(eixoGradeNovoSchema.safeParse(corpo).success).toBe(false);
  });
});

describe('eixoGradeSchema (resposta)', () => {
  it('aceita eixo sistema com valores', () => {
    expect(
      eixoGradeSchema.safeParse({
        id: EIXO_ID,
        nome: 'Tamanho',
        slug: 'tamanho',
        tipo_valor: 'tamanho',
        sistema: true,
        ativo: true,
        valores: [{ id: VALOR_ID, nome: 'P', amostra: null, ativa: true }],
      }).success,
    ).toBe(true);
  });

  it('recusa tipo_valor inventado', () => {
    expect(
      eixoGradeSchema.safeParse({
        id: EIXO_ID,
        nome: 'X',
        slug: 'x',
        tipo_valor: 'numero',
        sistema: false,
        ativo: true,
        valores: [],
      }).success,
    ).toBe(false);
  });
});

describe('valorEixoNovoSchema', () => {
  it('aceita valor texto curto', () => {
    expect(valorEixoNovoSchema.safeParse({ nome: 'A' }).success).toBe(true);
  });

  it('aceita valor cor com amostra', () => {
    expect(valorEixoNovoSchema.safeParse({ nome: 'Preto', amostra: '#111111' }).success).toBe(true);
  });

  it('recusa amostra fora do formato #rrggbb', () => {
    expect(valorEixoNovoSchema.safeParse({ nome: 'Preto', amostra: '111111' }).success).toBe(false);
  });
});

describe('valorEixoSchema e alterar', () => {
  it('aceita valor com amostra nula', () => {
    expect(
      valorEixoSchema.safeParse({
        id: VALOR_ID,
        nome: 'A',
        amostra: null,
        ativa: true,
      }).success,
    ).toBe(true);
  });

  it('alterar exige amostra (nullable) e ativa', () => {
    expect(valorEixoAlterarSchema.safeParse({ nome: 'B', amostra: null, ativa: false }).success).toBe(true);
    expect(valorEixoAlterarSchema.safeParse({ nome: 'B', ativa: false }).success).toBe(false);
  });
});

describe('categoriaEixosDefinirSchema (vincular)', () => {
  it('aceita até MAX eixos com seq', () => {
    const eixos = Array.from({ length: MAX_EIXOS_POR_CATEGORIA }, (_, i) => ({
      eixo_id: `0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a1${i}`,
      seq: i,
    }));
    expect(categoriaEixosDefinirSchema.safeParse({ eixos }).success).toBe(true);
  });

  it('recusa mais que MAX eixos', () => {
    const eixos = Array.from({ length: MAX_EIXOS_POR_CATEGORIA + 1 }, (_, i) => ({
      eixo_id: `0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a1${i}`,
      seq: i,
    }));
    expect(categoriaEixosDefinirSchema.safeParse({ eixos }).success).toBe(false);
  });

  it('recusa eixo_id repetido', () => {
    expect(
      categoriaEixosDefinirSchema.safeParse({
        eixos: [
          { eixo_id: EIXO_ID, seq: 0 },
          { eixo_id: EIXO_ID, seq: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('categoriaEixosResponseSchema', () => {
  it('aceita lista de eixos da categoria', () => {
    expect(
      categoriaEixosResponseSchema.safeParse({
        eixos: [
          {
            eixo_id: EIXO_ID,
            slug: 'tamanho',
            nome: 'Tamanho',
            tipo_valor: 'tamanho',
            seq: 0,
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('validarNomeValorEixo', () => {
  it('normaliza tamanho e texto; exige letra em cor', () => {
    expect(validarNomeValorEixo('tamanho', ' gg ')).toBe('GG');
    expect(validarNomeValorEixo('texto', 'a')).toBe('A');
    expect(validarNomeValorEixo('cor', 'Preto')).toBe('Preto');
    expect(() => validarNomeValorEixo('cor', '---')).toThrow();
  });
});
