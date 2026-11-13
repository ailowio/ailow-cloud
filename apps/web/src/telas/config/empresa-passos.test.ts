import { describe, expect, it } from 'vitest';
import { PASSOS_EMPRESA, type RascunhoEmpresa, empresaParaApi, validarPassoEmpresa } from './empresa-passos';

const base: RascunhoEmpresa = { nome: 'Loja da Ana', telefone: '(11) 98765-4321', endereco: 'Rua A, 10', minutos: 15 };

describe('assistente de dados da empresa: passos', () => {
  it('tem nome, contato, trava e confirmar, nessa ordem', () => {
    expect(PASSOS_EMPRESA).toEqual(['nome', 'contato', 'trava', 'confirmar']);
  });

  it('passo nome: vazio é recusado', () => {
    expect(validarPassoEmpresa('nome', { ...base, nome: ' ' })).toMatch(/nome/i);
    expect(validarPassoEmpresa('nome', base)).toBeNull();
  });

  it('passo contato: telefone é opcional, mas se vier precisa de DDD + 8 ou 9 dígitos', () => {
    expect(validarPassoEmpresa('contato', { ...base, telefone: '' })).toBeNull();
    expect(validarPassoEmpresa('contato', { ...base, telefone: '12345' })).toMatch(/DDD/);
    expect(validarPassoEmpresa('contato', { ...base, telefone: '(11) 3456-7890' })).toBeNull();
    expect(validarPassoEmpresa('contato', { ...base, telefone: '11 9876a4321' })).toMatch(/DDD/);
  });

  it('passo trava: minutos inteiros entre 1 e 120', () => {
    expect(validarPassoEmpresa('trava', { ...base, minutos: 0 })).toMatch(/1 e 120/);
    expect(validarPassoEmpresa('trava', { ...base, minutos: 121 })).toMatch(/1 e 120/);
    expect(validarPassoEmpresa('trava', { ...base, minutos: 1.5 })).toMatch(/1 e 120/);
    expect(validarPassoEmpresa('trava', { ...base, minutos: '' })).toMatch(/1 e 120/);
    expect(validarPassoEmpresa('trava', { ...base, minutos: 120 })).toBeNull();
  });

  it('monta o corpo: vazio vira null e minutos viram número', () => {
    expect(empresaParaApi({ ...base, telefone: '', endereco: '  ', minutos: 30 })).toEqual({
      nome: 'Loja da Ana',
      telefone: null,
      endereco: null,
      inatividade_minutos: 30,
    });
    expect(empresaParaApi({ ...base, nome: '' })).toBeNull();
  });
});
