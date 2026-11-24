import { describe, expect, it } from 'vitest';
import { montarParcelasParaApi, resumoContasAPagar } from './receber-parcelas';

// F02: Receber pedido com N parcelas — soma fecha o total (parcelasFecham) e o resumo fala em contas a pagar.
describe('receber-parcelas (F02)', () => {
  it('uma parcela no total: ok e "Gera 1 conta a pagar"', () => {
    const r = montarParcelasParaApi(9000, [{ valorTexto: '90,00', vencimento: '2026-11-30' }]);
    expect(r).toEqual({
      ok: true,
      parcelas: [{ valor_centavos: 9000, vencimento: '2026-11-30' }],
    });
    expect(resumoContasAPagar(1)).toBe('Gera 1 conta a pagar');
  });

  it('três parcelas que fecham: ok e "Gera 3 contas a pagar"', () => {
    const r = montarParcelasParaApi(9000, [
      { valorTexto: '30,00', vencimento: '2026-11-30' },
      { valorTexto: '30,00', vencimento: '2026-12-30' },
      { valorTexto: '30,00', vencimento: '2027-01-30' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parcelas).toHaveLength(3);
    expect(resumoContasAPagar(3)).toBe('Gera 3 contas a pagar');
  });

  it('soma divergente: erro parcelas_divergem', () => {
    expect(
      montarParcelasParaApi(9000, [
        { valorTexto: '50,00', vencimento: '2026-11-30' },
        { valorTexto: '30,00', vencimento: '2026-12-30' },
      ]),
    ).toEqual({ ok: false, erro: 'parcelas_divergem' });
  });

  it('valor inválido ou vencimento vazio: parcela_invalida', () => {
    expect(montarParcelasParaApi(9000, [{ valorTexto: 'abc', vencimento: '2026-11-30' }])).toEqual({
      ok: false,
      erro: 'parcela_invalida',
    });
    expect(montarParcelasParaApi(9000, [{ valorTexto: '90,00', vencimento: '' }])).toEqual({
      ok: false,
      erro: 'parcela_invalida',
    });
  });

  it('vencimentos iguais: vencimentos_duplicados', () => {
    expect(
      montarParcelasParaApi(9000, [
        { valorTexto: '45,00', vencimento: '2026-11-30' },
        { valorTexto: '45,00', vencimento: '2026-11-30' },
      ]),
    ).toEqual({ ok: false, erro: 'vencimentos_duplicados' });
  });
});
