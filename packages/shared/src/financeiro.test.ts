import { describe, expect, it } from 'vitest';
import {
  FORMAS_PAGAMENTO,
  dataSchema,
  despesaEntradaSchema,
  estornarEntradaSchema,
  estornoVendaResponseSchema,
  formaPagamentoSchema,
  lancamentoNovoSchema,
  lancamentoSchema,
  valorCentavosSchema,
} from './financeiro.js';

const ID = '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11';

describe('contrato do Financeiro', () => {
  describe('formas de pagamento', () => {
    it('são as quatro do PRD, nesta ordem; boleto está fora do v1', () => {
      expect(FORMAS_PAGAMENTO).toEqual(['dinheiro', 'pix', 'debito', 'credito']);
      expect(formaPagamentoSchema.safeParse('boleto').success).toBe(false);
    });
  });

  describe('estorno de venda (RN-08)', () => {
    it('o corpo exige o motivo, como no estorno de um lançamento', () => {
      expect(estornarEntradaSchema.safeParse({ motivo: 'Cliente devolveu' }).success).toBe(true);
      expect(estornarEntradaSchema.safeParse({ motivo: 'ok' }).success).toBe(false);
    });
    it('a resposta lista os ids dos estornos criados (um por pagamento da venda)', () => {
      expect(estornoVendaResponseSchema.safeParse({ ids: [ID, ID] }).success).toBe(true);
      expect(estornoVendaResponseSchema.safeParse({ ids: [] }).success).toBe(false);
    });
  });

  describe('valor em centavos inteiros (RN-01)', () => {
    it.each([1, 100, 2_000_000_000])('aceita %i', (v) => {
      expect(valorCentavosSchema.safeParse(v).success).toBe(true);
    });
    it.each([
      ['zero', 0],
      ['negativo', -100],
      ['fracionário (float)', 10.5],
      ['acima do teto de R$ 20 milhões', 2_000_000_001],
      ['NaN', Number.NaN],
      ['texto', '100'],
    ])('recusa %s', (_nome, v) => {
      expect(valorCentavosSchema.safeParse(v).success).toBe(false);
    });
  });

  describe('data de calendário', () => {
    it.each(['2026-11-11', '2028-02-29', '2026-12-31'])('aceita %s', (d) => {
      expect(dataSchema.safeParse(d).success).toBe(true);
    });
    it.each([
      ['29/02 em ano não bissexto', '2026-02-29'],
      ['mês 13', '2026-13-01'],
      ['dia 31 de abril', '2026-04-31'],
      ['formato brasileiro', '11/11/2026'],
      ['sem zero à esquerda', '2026-1-1'],
      ['com hora', '2026-11-11T10:00:00Z'],
    ])('recusa %s', (_nome, d) => {
      expect(dataSchema.safeParse(d).success).toBe(false);
    });
  });

  describe('nova despesa (RF-FIN-02)', () => {
    const base = {
      descricao: 'Condomínio',
      categoria: 'Aluguel',
      valor_centavos: 150_000,
      vencimento: '2026-11-20',
      forma_pagamento: null,
      paga: false,
    };

    it('aceita despesa em aberto, sem forma de pagamento ainda', () => {
      expect(despesaEntradaSchema.safeParse(base).success).toBe(true);
    });
    it('já paga exige a forma de pagamento', () => {
      expect(despesaEntradaSchema.safeParse({ ...base, paga: true }).success).toBe(false);
      expect(despesaEntradaSchema.safeParse({ ...base, paga: true, forma_pagamento: 'pix' }).success).toBe(true);
    });
    it('aparar espaços e recusar descrição ou categoria vazias', () => {
      expect(despesaEntradaSchema.safeParse({ ...base, descricao: '   ' }).success).toBe(false);
      expect(despesaEntradaSchema.safeParse({ ...base, categoria: '' }).success).toBe(false);
      expect(despesaEntradaSchema.parse({ ...base, descricao: '  Água  ' }).descricao).toBe('Água');
    });
    it('recusa forma de pagamento desconhecida e valor com centavos quebrados', () => {
      expect(despesaEntradaSchema.safeParse({ ...base, forma_pagamento: 'cheque' }).success).toBe(false);
      expect(despesaEntradaSchema.safeParse({ ...base, valor_centavos: 99.9 }).success).toBe(false);
    });
  });

  describe('interface pública para outros módulos (RF-FIN-01/06)', () => {
    const venda = {
      tipo: 'entrada',
      origem_tipo: 'venda',
      origem_id: ID,
      descricao: null,
      categoria: 'Sutiã',
      valor_centavos: 8990,
      forma_pagamento: 'pix',
      vencimento: '2026-11-11',
      paga: true,
    };

    it('aceita a venda paga e a compra em aberto', () => {
      expect(lancamentoNovoSchema.safeParse(venda).success).toBe(true);
      expect(
        lancamentoNovoSchema.safeParse({
          ...venda,
          tipo: 'saida',
          origem_tipo: 'compra',
          forma_pagamento: null,
          paga: false,
        }).success,
      ).toBe(true);
    });
    it('venda é sempre entrada; compra e despesa são sempre saída', () => {
      expect(lancamentoNovoSchema.safeParse({ ...venda, tipo: 'saida' }).success).toBe(false);
      expect(lancamentoNovoSchema.safeParse({ ...venda, origem_tipo: 'compra' }).success).toBe(false);
    });
    it('venda e compra exigem o id de origem; despesa não tem', () => {
      expect(lancamentoNovoSchema.safeParse({ ...venda, origem_id: null }).success).toBe(false);
      const despesa = { ...venda, tipo: 'saida', origem_tipo: 'despesa', descricao: 'Luz' };
      expect(lancamentoNovoSchema.safeParse({ ...despesa, origem_id: ID }).success).toBe(false);
      expect(lancamentoNovoSchema.safeParse({ ...despesa, origem_id: null }).success).toBe(true);
    });
    it('não existe origem "estorno" na criação: estorno só pela função de estornar', () => {
      expect(lancamentoNovoSchema.safeParse({ ...venda, origem_tipo: 'estorno' }).success).toBe(false);
    });
    it('pago exige forma de pagamento', () => {
      expect(lancamentoNovoSchema.safeParse({ ...venda, forma_pagamento: null }).success).toBe(false);
    });
  });

  it('estorno exige motivo com texto', () => {
    expect(estornarEntradaSchema.safeParse({ motivo: '' }).success).toBe(false);
    expect(estornarEntradaSchema.safeParse({ motivo: '  ' }).success).toBe(false);
    expect(estornarEntradaSchema.safeParse({ motivo: 'Cobrado em duplicidade' }).success).toBe(true);
  });

  it('o lançamento da resposta pode ser serializado de volta (sem transformação de mão única)', () => {
    const l = {
      id: ID,
      tipo: 'entrada',
      origem_tipo: 'venda',
      origem_id: ID,
      descricao: null,
      categoria: null,
      valor_centavos: 100,
      forma_pagamento: 'dinheiro',
      vencimento: '2026-11-11',
      pago_em: '2026-11-11T15:00:00.000Z',
      status: 'pago',
      estorno_de: null,
      estorno_motivo: null,
    };
    expect(() => lancamentoSchema.encode(l as never)).not.toThrow();
  });
});
