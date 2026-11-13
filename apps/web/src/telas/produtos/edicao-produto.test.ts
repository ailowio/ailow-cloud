import { describe, expect, it } from 'vitest';
import { corpoDaEdicao, formularioDoProduto } from './edicao-produto';

// S09: o formulário de editar produto confere o que dá antes de ir à API (que valida tudo de novo).
const base = {
  nome: 'Tomara que caia',
  categoria_id: '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11',
  porte: 'slim' as const,
  atributos: ['Bojo'],
  fornecedor: 'Fina Paixão',
  custoTexto: '45,00',
  precoTexto: '89,90',
};

describe('corpoDaEdicao', () => {
  it('monta o corpo do contrato com centavos inteiros e fornecedor em branco virando null', () => {
    const r = corpoDaEdicao({ ...base, fornecedor: '   ', nome: '  Sutiã  ' });
    expect(r).toEqual({
      ok: true,
      corpo: {
        nome: 'Sutiã',
        categoria_id: base.categoria_id,
        porte: 'slim',
        atributos: ['Bojo'],
        fornecedor: null,
        custo_centavos: 4500,
        preco_centavos: 8990,
      },
    });
  });

  it.each([
    ['nome vazio', { nome: '   ' }, 'nome'],
    ['nome com 81 letras', { nome: 'x'.repeat(81) }, 'nome'],
    ['preço vazio', { precoTexto: '' }, 'preco'],
    ['preço zero', { precoTexto: '0,00' }, 'preco'],
    ['preço negativo', { precoTexto: '-5' }, 'preco'],
    ['preço com letras', { precoTexto: 'abc' }, 'preco'],
    ['preço acima de R$ 20 milhões', { precoTexto: '20.000.000,01' }, 'preco'],
    ['custo vazio', { custoTexto: '' }, 'custo'],
    ['custo negativo', { custoTexto: '-1' }, 'custo'],
  ])('recusa %s e diz qual campo', (_n, extra, campo) => {
    const r = corpoDaEdicao({ ...base, ...extra });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.erros)).toContain(campo);
      expect(r.mensagem.length).toBeGreaterThan(5);
    }
  });

  it('custo zero vale (brinde); preço zero não', () => {
    expect(corpoDaEdicao({ ...base, custoTexto: '0' }).ok).toBe(true);
  });
});

describe('formularioDoProduto', () => {
  it('preenche o formulário com o produto do Dono: custo e preço em reais com vírgula', () => {
    const f = formularioDoProduto({
      id: 'x',
      numero: 3,
      nome: 'Sutiã',
      categoria_id: base.categoria_id,
      categoria_nome: 'Sutiã',
      porte: 'plus',
      atributos: ['Aro'],
      preco_centavos: 12_990,
      ativo: true,
      custo_centavos: 5005,
      fornecedor: null,
      skus: [],
    });
    expect(f).toMatchObject({ nome: 'Sutiã', porte: 'plus', atributos: ['Aro'], fornecedor: '', custoTexto: '50,05', precoTexto: '129,90' });
  });

  it('produto sem custo (resposta do Vendedor) não vira formulário', () => {
    const f = formularioDoProduto({
      id: 'x',
      numero: 3,
      nome: 'Sutiã',
      categoria_id: base.categoria_id,
      categoria_nome: 'Sutiã',
      porte: 'plus',
      atributos: [],
      preco_centavos: 12_990,
      ativo: true,
      skus: [],
    });
    expect(f).toBeNull();
  });
});
