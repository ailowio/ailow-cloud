import { describe, expect, it } from 'vitest';
import {
  calcularFechamento,
  celularSuspeito,
  linkComprovanteWhatsApp,
  textoDoComprovante,
  totaisDaVenda,
} from './vendas-calculos.js';

// RN-01/02/05/07, RF-VEN-05/06/07/09. Os totais abaixo foram feitos na mão (TEST-07): 8.990 × 10% = 899.

describe('fechamento da venda (RN-02)', () => {
  const umaPeca = [{ precoCentavos: 8990, quantidade: 1 }];

  it('10% de R$ 89,90 vira R$ 8,99 de desconto e o Pix fecha em R$ 80,91', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'percentual', percentual: 10 }, [8091])).toEqual({
      ok: true,
      subtotalCentavos: 8990,
      descontoCentavos: 899,
      totalCentavos: 8091,
    });
  });

  it('desconto em reais (R$ 10,00) sai do subtotal e duas formas somam o total', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'valor', centavos: 1000 }, [4000, 3990])).toEqual({
      ok: true,
      subtotalCentavos: 8990,
      descontoCentavos: 1000,
      totalCentavos: 7990,
    });
  });

  it('sem desconto, o total é a soma das peças (2 × R$ 89,90)', () => {
    expect(calcularFechamento([{ precoCentavos: 8990, quantidade: 2 }], { tipo: 'nenhum' }, [17980])).toEqual({
      ok: true,
      subtotalCentavos: 17980,
      descontoCentavos: 0,
      totalCentavos: 17980,
    });
  });

  it('1% de R$ 0,50 não gera centavo (trunca; nunca ponto flutuante)', () => {
    expect(calcularFechamento([{ precoCentavos: 50, quantidade: 1 }], { tipo: 'percentual', percentual: 1 }, [50])).toEqual({
      ok: true,
      subtotalCentavos: 50,
      descontoCentavos: 0,
      totalCentavos: 50,
    });
  });

  it('os totais existem antes de o pagamento fechar a conta', () => {
    expect(totaisDaVenda(umaPeca, { tipo: 'nenhum' })).toEqual({
      ok: true,
      subtotalCentavos: 8990,
      descontoCentavos: 0,
      totalCentavos: 8990,
    });
  });

  it('desconto de 100% fecha com total zero e sem pagamento', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'percentual', percentual: 100 }, [])).toEqual({
      ok: true,
      subtotalCentavos: 8990,
      descontoCentavos: 8990,
      totalCentavos: 0,
    });
  });

  it('recusa desconto maior que o subtotal (o total não fica negativo)', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'valor', centavos: 8991 }, [])).toEqual({
      ok: false,
      erro: 'desconto_acima_do_subtotal',
    });
  });

  it('recusa pagamento que não soma o total, inclusive a falta de um centavo', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'nenhum' }, [8989])).toEqual({ ok: false, erro: 'pagamentos_divergem' });
    expect(calcularFechamento(umaPeca, { tipo: 'nenhum' }, [8991])).toEqual({ ok: false, erro: 'pagamentos_divergem' });
    expect(calcularFechamento(umaPeca, { tipo: 'nenhum' }, [])).toEqual({ ok: false, erro: 'pagamentos_divergem' });
  });

  it('total zero não aceita pagamento, e carrinho vazio não fecha', () => {
    expect(calcularFechamento(umaPeca, { tipo: 'percentual', percentual: 100 }, [1])).toEqual({
      ok: false,
      erro: 'pagamentos_divergem',
    });
    expect(calcularFechamento([], { tipo: 'nenhum' }, [])).toEqual({ ok: false, erro: 'sem_itens' });
  });
});

describe('celular suspeito no relatório (RF-VEN-09, D8)', () => {
  it('marca número com o final todo igual ou em sequência', () => {
    expect(celularSuspeito('11911111111')).toBe(true);
    expect(celularSuspeito('99999999999')).toBe(true);
    expect(celularSuspeito('11912345678')).toBe(true);
    expect(celularSuspeito('11987654321')).toBe(true);
  });

  it('não marca um celular comum', () => {
    expect(celularSuspeito('11987651234')).toBe(false);
    expect(celularSuspeito('21998877665')).toBe(false);
  });
});

describe('texto do comprovante (RF-VEN-07)', () => {
  it('leva o número da venda, a peça e o total em reais, sem dado a mais', () => {
    const texto = textoDoComprovante({
      numero: 12,
      itens: [{ nome: 'Tomara que caia', quantidade: 1, totalCentavos: 8990 }],
      totalCentavos: 8990,
    });
    expect(texto).toContain('Venda 12');
    expect(texto).toContain('Tomara que caia');
    expect(texto).toContain('R$ 89,90');
    expect(texto).not.toContain('custo');
  });

  it('o link do WhatsApp abre a conversa com esse texto', () => {
    const link = linkComprovanteWhatsApp('11987651234', 'Venda 12');
    expect(link.startsWith('https://wa.me/5511987651234?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1] ?? '')).toBe('Venda 12');
  });
});
