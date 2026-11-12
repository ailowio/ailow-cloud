import { describe, expect, it } from 'vitest';
import {
  linkPedidoWhatsApp,
  normalizarCnpj,
  parcelasFecham,
  textoDoPedido,
  totalDoPedido,
} from './compras-calculos.js';

// RF-COM-03/04, RN-01/11. Totais feitos na mão: 2 × R$ 45,00 = R$ 90,00.

describe('total do pedido (RN-01)', () => {
  it('soma quantidade × custo em centavos', () => {
    expect(totalDoPedido([{ quantidade: 2, custoCentavos: 4500 }])).toEqual({ ok: true, totalCentavos: 9000 });
  });

  it('sem itens não fecha', () => {
    expect(totalDoPedido([])).toEqual({ ok: false, erro: 'sem_itens' });
  });
});

describe('parcelas do recebimento (RN-11)', () => {
  it('duas parcelas somam o total', () => {
    expect(parcelasFecham(9000, [5000, 4000])).toEqual({ ok: true });
  });

  it('parcela que não fecha o total é recusada (a mais ou a menos)', () => {
    expect(parcelasFecham(9000, [9001])).toEqual({ ok: false, erro: 'parcelas_divergem' });
    expect(parcelasFecham(9000, [8999])).toEqual({ ok: false, erro: 'parcelas_divergem' });
  });

  it('sem parcelas ou valor zero é recusado', () => {
    expect(parcelasFecham(9000, [])).toEqual({ ok: false, erro: 'sem_parcelas' });
    expect(parcelasFecham(9000, [0])).toEqual({ ok: false, erro: 'parcela_invalida' });
  });
});

describe('texto e link do WhatsApp (RF-COM-03)', () => {
  it('lista código, cor e quantidade', () => {
    expect(
      textoDoPedido({
        numero: 3,
        itens: [
          { codigo: '0001-M-PRE', cor: 'Preto', quantidade: 2 },
          { codigo: '0001-G-BRA', cor: 'Branco', quantidade: 1 },
        ],
      }),
    ).toBe('Pedido 3\n0001-M-PRE · Preto · 2\n0001-G-BRA · Branco · 1');
  });

  it('monta o wa.me com o texto codificado', () => {
    const texto = 'Pedido 1\n0001-M-PRE · Preto · 2';
    expect(linkPedidoWhatsApp('11987654321', texto)).toBe(
      `https://wa.me/5511987654321?text=${encodeURIComponent(texto)}`,
    );
  });
});

describe('CNPJ opcional', () => {
  it('aceita máscara e devolve 14 dígitos', () => {
    expect(normalizarCnpj('12.345.678/0001-95')).toBe('12345678000195');
  });

  it('vazio vira null; tamanho errado também', () => {
    expect(normalizarCnpj('')).toBeNull();
    expect(normalizarCnpj('123')).toBeNull();
  });
});
