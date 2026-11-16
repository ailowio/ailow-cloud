import { describe, expect, it } from 'vitest';
import { PASSOS_PEDIDO, type RascunhoPedido, pedidoParaApi, validarPassoPedido } from './pedido-passos';

const linha = { sku_id: 'sku-1', rotulo: 'Sutiã · M · Preto', quantidade: 2, custoTexto: '40,00' };
const base: RascunhoPedido = { fornecedorId: 'forn-1', linhas: [linha] };

describe('assistente de novo pedido: passos', () => {
  it('tem fornecedor, peças e confirmar, nessa ordem', () => {
    expect(PASSOS_PEDIDO).toEqual(['fornecedor', 'pecas', 'confirmar']);
  });

  it('passo fornecedor: sem escolha é recusado', () => {
    expect(validarPassoPedido('fornecedor', { ...base, fornecedorId: null })).toMatch(/fornecedor/i);
    expect(validarPassoPedido('fornecedor', base)).toBeNull();
  });

  it('passo peças: sem nenhuma peça é recusado', () => {
    expect(validarPassoPedido('pecas', { ...base, linhas: [] })).toMatch(/peça/i);
  });

  it('passo peças: custo vazio, zero ou inválido é recusado', () => {
    expect(validarPassoPedido('pecas', { ...base, linhas: [{ ...linha, custoTexto: '' }] })).toMatch(/custo/i);
    expect(validarPassoPedido('pecas', { ...base, linhas: [{ ...linha, custoTexto: '0' }] })).toMatch(/custo/i);
    expect(validarPassoPedido('pecas', { ...base, linhas: [{ ...linha, custoTexto: 'abc' }] })).toMatch(/custo/i);
  });

  it('passo peças: quantidade menor que 1 é recusada', () => {
    expect(validarPassoPedido('pecas', { ...base, linhas: [{ ...linha, quantidade: 0 }] })).toMatch(/quantidade/i);
    expect(validarPassoPedido('pecas', base)).toBeNull();
  });

  it('passo confirmar: revalida tudo', () => {
    expect(validarPassoPedido('confirmar', { ...base, fornecedorId: null })).toMatch(/fornecedor/i);
    expect(validarPassoPedido('confirmar', { ...base, linhas: [] })).toMatch(/peça/i);
    expect(validarPassoPedido('confirmar', base)).toBeNull();
  });

  it('monta o corpo da API com custo em centavos inteiros', () => {
    expect(pedidoParaApi(base)).toEqual({
      fornecedor_id: 'forn-1',
      itens: [{ sku_id: 'sku-1', quantidade: 2, custo_centavos: 4000 }],
    });
    expect(pedidoParaApi({ ...base, linhas: [] })).toBeNull();
  });
});
