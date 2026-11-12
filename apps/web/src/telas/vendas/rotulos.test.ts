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
});
