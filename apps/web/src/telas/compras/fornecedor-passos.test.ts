import { describe, expect, it } from 'vitest';
import { PASSOS_FORNECEDOR, type RascunhoFornecedor, fornecedorParaApi, validarPassoFornecedor } from './fornecedor-passos';

const base: RascunhoFornecedor = { nome: 'Malhas Sul', whatsapp: '(11) 91234-5678', cnpj: '12.345.678/0001-95' };

describe('assistente de fornecedor: passos', () => {
  it('tem nome, contato e confirmar, nessa ordem', () => {
    expect(PASSOS_FORNECEDOR).toEqual(['nome', 'contato', 'confirmar']);
  });

  it('passo nome: vazio é recusado', () => {
    expect(validarPassoFornecedor('nome', { ...base, nome: '  ' })).toMatch(/nome/i);
    expect(validarPassoFornecedor('nome', base)).toBeNull();
  });

  it('passo nome: acima de 80 caracteres é recusado', () => {
    expect(validarPassoFornecedor('nome', { ...base, nome: 'a'.repeat(81) })).toMatch(/80/);
  });

  it('passo contato: WhatsApp vazio ou inválido é recusado', () => {
    expect(validarPassoFornecedor('contato', { ...base, whatsapp: '' })).toMatch(/WhatsApp/);
    expect(validarPassoFornecedor('contato', { ...base, whatsapp: '123' })).toMatch(/DDD/);
    expect(validarPassoFornecedor('contato', base)).toBeNull();
  });

  it('passo contato: CNPJ é opcional, mas se vier precisa de 14 dígitos', () => {
    expect(validarPassoFornecedor('contato', { ...base, cnpj: '' })).toBeNull();
    expect(validarPassoFornecedor('contato', { ...base, cnpj: '123' })).toMatch(/CNPJ/);
    expect(validarPassoFornecedor('contato', { ...base, cnpj: '12345678000195' })).toBeNull();
  });

  it('monta o corpo da API: CNPJ vazio vira null e os textos são aparados', () => {
    expect(fornecedorParaApi({ ...base, nome: ' Malhas Sul ', cnpj: '  ' })).toEqual({
      nome: 'Malhas Sul',
      whatsapp: '(11) 91234-5678',
      cnpj: null,
    });
    expect(fornecedorParaApi({ ...base, whatsapp: '' })).toBeNull();
  });
});
