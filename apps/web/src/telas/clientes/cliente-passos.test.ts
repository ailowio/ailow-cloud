import { describe, expect, it } from 'vitest';
import { PASSOS_CLIENTE, type RascunhoCliente, clienteParaApi, validarPassoCliente } from './cliente-passos';

const base: RascunhoCliente = { nome: 'Ana Souza', celular: '(21) 98888-0001', aviso: true };

describe('assistente de novo cliente: passos', () => {
  it('tem nome, celular, aviso e confirmar, nessa ordem', () => {
    expect(PASSOS_CLIENTE).toEqual(['nome', 'celular', 'aviso', 'confirmar']);
  });

  it('passo nome: vazio ou só espaços é recusado', () => {
    expect(validarPassoCliente('nome', { ...base, nome: '' })).toMatch(/nome/i);
    expect(validarPassoCliente('nome', { ...base, nome: '   ' })).toMatch(/nome/i);
    expect(validarPassoCliente('nome', base)).toBeNull();
  });

  it('passo celular: vazio, curto, fixo e com letras são recusados; máscara e +55 passam', () => {
    expect(validarPassoCliente('celular', { ...base, celular: '' })).toMatch(/celular/i);
    expect(validarPassoCliente('celular', { ...base, celular: '2198888' })).toMatch(/DDD/);
    expect(validarPassoCliente('celular', { ...base, celular: '(21) 3888-0001' })).toMatch(/DDD/);
    expect(validarPassoCliente('celular', { ...base, celular: '21 9888a0001' })).toMatch(/DDD/);
    expect(validarPassoCliente('celular', base)).toBeNull();
    expect(validarPassoCliente('celular', { ...base, celular: '+55 21 98888-0001' })).toBeNull();
  });

  it('passo aviso: nunca bloqueia (avisar é opcional no cadastro)', () => {
    expect(validarPassoCliente('aviso', { ...base, aviso: false })).toBeNull();
  });

  it('passo confirmar: revalida tudo e aponta o primeiro problema', () => {
    expect(validarPassoCliente('confirmar', { ...base, nome: '' })).toMatch(/nome/i);
    expect(validarPassoCliente('confirmar', { ...base, celular: '1' })).toMatch(/DDD/);
    expect(validarPassoCliente('confirmar', base)).toBeNull();
  });

  it('monta o corpo da API com nome aparado e aviso_lgpd', () => {
    expect(clienteParaApi({ ...base, nome: '  Ana Souza ', aviso: false })).toEqual({
      nome: 'Ana Souza',
      celular: '(21) 98888-0001',
      aviso_lgpd: false,
    });
    expect(clienteParaApi({ ...base, nome: '' })).toBeNull();
  });
});
