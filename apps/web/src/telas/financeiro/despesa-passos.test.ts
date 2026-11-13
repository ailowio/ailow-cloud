import { describe, expect, it } from 'vitest';
import { PASSOS_DESPESA, type RascunhoDespesa, despesaParaApi, validarPasso } from './despesa-passos';

// S11: regras de cada passo do assistente "Nova despesa". A mensagem devolvida vira toast (sem mover o layout).
const base: RascunhoDespesa = {
  categoria: 'Aluguel',
  descricao: 'Aluguel de novembro',
  valor: 150000,
  vencimento: '2026-11-28',
  paga: false,
  forma: null,
};

describe('passos da nova despesa', () => {
  it('a ordem é categoria, valor, quando e confirmar', () => {
    expect(PASSOS_DESPESA).toEqual(['categoria', 'valor', 'quando', 'confirmar']);
  });

  it('categoria: exige uma escolhida', () => {
    expect(validarPasso('categoria', { ...base, categoria: '' })).toMatch(/tipo/i);
    expect(validarPasso('categoria', base)).toBeNull();
  });

  it('valor: vazio, zero e acima de R$ 20 milhões são recusados com texto claro', () => {
    expect(validarPasso('valor', { ...base, valor: null })).toMatch(/valor/i);
    expect(validarPasso('valor', { ...base, valor: 0 })).toMatch(/maior que zero/i);
    expect(validarPasso('valor', { ...base, valor: -500 })).toMatch(/maior que zero/i);
    expect(validarPasso('valor', { ...base, valor: 2_000_000_001 })).toMatch(/20 milhões/);
    expect(validarPasso('valor', { ...base, valor: 1 })).toBeNull();
    expect(validarPasso('valor', { ...base, valor: 2_000_000_000 })).toBeNull();
  });

  it('valor: valor com centavos quebrados (não inteiro) é recusado', () => {
    expect(validarPasso('valor', { ...base, valor: 99.5 })).not.toBeNull();
  });

  it('valor: descrição vazia ou só espaços é recusada', () => {
    expect(validarPasso('valor', { ...base, descricao: '   ' })).toMatch(/o que é/i);
  });

  it('quando: vencimento vazio, fora do formato ou inexistente é recusado', () => {
    expect(validarPasso('quando', { ...base, vencimento: '' })).toMatch(/dia/i);
    expect(validarPasso('quando', { ...base, vencimento: '28/11/2026' })).toMatch(/dia/i);
    expect(validarPasso('quando', { ...base, vencimento: '2026-02-30' })).toMatch(/dia/i);
    expect(validarPasso('quando', { ...base, vencimento: '2026-02-29' })).toMatch(/dia/i);
    expect(validarPasso('quando', { ...base, vencimento: '2028-02-29' })).toBeNull();
  });

  it('quando: já paga exige a forma de pagamento', () => {
    expect(validarPasso('quando', { ...base, paga: true, forma: null })).toMatch(/como foi pago/i);
    expect(validarPasso('quando', { ...base, paga: true, forma: 'pix' })).toBeNull();
  });

  it('confirmar: revalida tudo e aponta o primeiro problema', () => {
    expect(validarPasso('confirmar', base)).toBeNull();
    expect(validarPasso('confirmar', { ...base, valor: 0 })).toMatch(/maior que zero/i);
  });

  it('o corpo da API leva o valor em centavos exatos, texto aparado e forma só quando paga', () => {
    expect(despesaParaApi({ ...base, descricao: '  Aluguel  ', forma: 'pix' })).toEqual({
      descricao: 'Aluguel',
      categoria: 'Aluguel',
      valor_centavos: 150000,
      vencimento: '2026-11-28',
      forma_pagamento: null,
      paga: false,
    });
    expect(despesaParaApi({ ...base, paga: true, forma: 'pix', valor: 29 })?.forma_pagamento).toBe('pix');
    expect(despesaParaApi({ ...base, valor: 0 })).toBeNull();
  });
});
