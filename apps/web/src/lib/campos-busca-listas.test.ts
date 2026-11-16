import { describe, expect, it } from 'vitest';
import { filtrarPorBusca } from './busca';
import { camposDaConta, camposDoCliente, camposDoFornecedor, camposDoPedido } from './campos-busca-listas';

describe('busca ampla nas listas de cadastro e contas', () => {
  const clientes = [
    { nome: 'Maria Aparecida', celular: '11999990000' },
    { nome: 'João Pedro', celular: '21988887777' },
  ];
  it('cliente: caracteres soltos no nome, pedaço do celular e celular com máscara', () => {
    const achar = (q: string) => filtrarPorBusca(clientes, q, camposDoCliente).map((c) => c.nome);
    expect(achar('mapr')).toEqual(['Maria Aparecida']);
    expect(achar('joao')).toEqual(['João Pedro']);
    expect(achar('9999')).toEqual(['Maria Aparecida']);
    expect(achar('(21) 98888')).toEqual(['João Pedro']);
    expect(achar('zzz')).toEqual([]);
  });

  it('fornecedor: nome, whatsapp e CNPJ (com ou sem pontuação)', () => {
    const lista = [
      { nome: 'Malhas Sul', whatsapp: '11911112222', cnpj: '12.345.678/0001-95' },
      { nome: 'Tecidos Norte', whatsapp: '11933334444', cnpj: null },
    ];
    const achar = (q: string) => filtrarPorBusca(lista, q, camposDoFornecedor).map((f) => f.nome);
    expect(achar('mlh')).toEqual(['Malhas Sul']);
    expect(achar('12345678')).toEqual(['Malhas Sul']);
    expect(achar('3333')).toEqual(['Tecidos Norte']);
  });

  it('pedido: número com ou sem "Pedido"/"#", fornecedor, status e valor', () => {
    const lista = [
      { numero: 7, status: 'enviado' as const, total_centavos: 123456, fornecedor_nome: 'Malhas Sul' },
      { numero: 8, status: 'rascunho' as const, total_centavos: 5000, fornecedor_nome: 'Tecidos Norte' },
    ];
    const rotulo = (s: string) => (s === 'enviado' ? 'Enviado' : 'Rascunho');
    const achar = (q: string) => filtrarPorBusca(lista, q, (p) => camposDoPedido(p, rotulo(p.status))).map((p) => p.numero);
    expect(achar('#8')).toEqual([8]);
    expect(achar('pedido 7')).toEqual([7]);
    expect(achar('enviado')).toEqual([7]);
    expect(achar('mlh')).toEqual([7]);
    expect(achar('1234,56')).toEqual([7]);
  });

  it('conta: descrição solta, categoria, vencimento dd/mm/aaaa e valor', () => {
    const lista = [
      { descricao: 'Aluguel da loja', categoria: 'Fixas', vencimento: '2026-12-05', valor_centavos: 250000 },
      { descricao: null, categoria: null, vencimento: '2026-11-20', valor_centavos: 9990 },
    ];
    const achar = (q: string) => filtrarPorBusca(lista, q, (c) => camposDaConta(c, 'Depois')).map((c) => c.vencimento);
    expect(achar('alug')).toEqual(['2026-12-05']);
    expect(achar('05/12/2026')).toEqual(['2026-12-05']);
    expect(achar('2500')).toEqual(['2026-12-05']);
    expect(achar('99,90')).toEqual(['2026-11-20']);
    expect(achar('conta')).toEqual(['2026-11-20']);
  });
});
