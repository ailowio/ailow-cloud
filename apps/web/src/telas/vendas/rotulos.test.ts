import { describe, expect, it } from 'vitest';
import { ErroApi } from '../../api/cliente';
import { MENSAGEM_SEM_ESTOQUE } from './carrinho';
import { FORMAS, mensagemVenda } from './rotulos';

describe('textos da venda', () => {
  it('as quatro formas, com Pix no contrato', () => {
    expect(FORMAS).toEqual(['dinheiro', 'pix', 'debito', 'credito']);
  });

  it('sem estoque diz para chamar o Dono', () => {
    expect(mensagemVenda(new ErroApi(409, 'estoque_insuficiente'))).toContain(MENSAGEM_SEM_ESTOQUE.replace(/\.$/, ''));
  });

  it('celular cadastrado por outro balcão no meio da venda pede para finalizar de novo, sem chamar o Dono', () => {
    const texto = mensagemVenda(new ErroApi(409, 'cliente_ja_cadastrado'));
    expect(texto).toContain('Finalizar de novo');
    expect(texto).not.toContain('inativo');
  });
});
