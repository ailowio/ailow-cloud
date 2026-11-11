import { describe, expect, it } from 'vitest';
import { categoriaCorpoSchema, empresaEntradaSchema, empresaSchema } from './configuracoes.js';

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
});
