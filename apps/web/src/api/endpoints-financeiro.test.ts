import { describe, expect, it } from 'vitest';
import { criarCliente } from './cliente';
import { criarApi } from './endpoints';

// O app só fala com a API pelos caminhos e corpos do contrato (RF-FIN-02…05).
function apiComEspiao(resposta: { status?: number; corpo?: unknown } = {}) {
  const chamadas: { url: string; metodo?: string; corpo?: unknown }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const status = resposta.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(resposta.corpo ?? {}), { status });
  }) as typeof fetch;
  return { api: criarApi(criarCliente({ fetch: fetchFalso })), chamadas };
}

describe('endpoints do Financeiro', () => {
  const despesa = {
    descricao: 'Condomínio',
    categoria: 'Aluguel',
    valor_centavos: 150_000,
    vencimento: '2026-11-20',
    forma_pagamento: null,
    paga: false,
  };

  it('nova despesa: POST com o corpo do contrato', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: 'x' } });
    await api.novaDespesa(despesa);
    expect(chamadas).toEqual([{ url: '/financeiro/despesas', metodo: 'POST', corpo: despesa }]);
  });

  it('contas a pagar: GET', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { hoje: '2026-11-11', contas: [] } });
    expect(await api.contasAPagar()).toEqual({ hoje: '2026-11-11', contas: [] });
    expect(chamadas).toEqual([{ url: '/financeiro/contas-a-pagar', metodo: 'GET', corpo: undefined }]);
  });

  it('marcar como pago: POST com a forma de pagamento', async () => {
    const { api, chamadas } = apiComEspiao({ status: 204 });
    await api.pagar('abc', 'pix');
    expect(chamadas).toEqual([{ url: '/financeiro/lancamentos/abc/pagar', metodo: 'POST', corpo: { forma_pagamento: 'pix' } }]);
  });

  it('estornar: POST com o motivo', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: 'y' } });
    await api.estornar('abc', 'Cobrado em duplicidade');
    expect(chamadas).toEqual([
      { url: '/financeiro/lancamentos/abc/estornar', metodo: 'POST', corpo: { motivo: 'Cobrado em duplicidade' } },
    ]);
  });

  it('estornar venda inteira: POST na rota da venda, com o motivo', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { ids: ['a', 'b'] } });
    expect(await api.estornarVenda('venda-1', 'Cliente devolveu')).toEqual({ ids: ['a', 'b'] });
    expect(chamadas).toEqual([
      { url: '/financeiro/vendas/venda-1/estornar', metodo: 'POST', corpo: { motivo: 'Cliente devolveu' } },
    ]);
  });

  it('categorias: sem tipo pede as duas listas; com tipo filtra na URL', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { categorias: [] } });
    await api.categorias();
    await api.categorias('financeira');
    await api.categorias('produto');
    expect(chamadas.map((c) => [c.metodo, c.url])).toEqual([
      ['GET', '/categorias'],
      ['GET', '/categorias?tipo=financeira'],
      ['GET', '/categorias?tipo=produto'],
    ]);
  });

  it('criar categoria financeira: o tipo vai no corpo', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: 'x' } });
    await api.criarCategoria({ nome: 'Aluguel', atributos: [], tipo: 'financeira' });
    expect(chamadas).toEqual([
      { url: '/categorias', metodo: 'POST', corpo: { nome: 'Aluguel', atributos: [], tipo: 'financeira' } },
    ]);
  });

  it('extrato e relatório: GET com a data e o período na URL', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: {} });
    await api.extrato('2026-11-11');
    await api.relatorio('mes', '2026-11-01');
    expect(chamadas.map((c) => [c.metodo, c.url])).toEqual([
      ['GET', '/financeiro/extrato?data=2026-11-11'],
      ['GET', '/financeiro/relatorio?periodo=mes&data=2026-11-01'],
    ]);
  });
});
