import { describe, expect, it } from 'vitest';
import { criarCliente } from './cliente';
import { criarApi } from './endpoints';

function apiComEspiao(resposta: { status?: number; corpo?: unknown } = {}) {
  const chamadas: { url: string; metodo?: string; corpo?: unknown }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const status = resposta.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(resposta.corpo ?? {}), { status });
  }) as typeof fetch;
  return { api: criarApi(criarCliente({ fetch: fetchFalso })), chamadas };
}

const ID = '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11';

describe('endpoints de Vendas', () => {
  it('busca a peça pelo código na query', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID, codigo: '0001-M-PRE' } });
    await api.skuPorCodigo('0001-M-PRE');
    expect(chamadas[0]?.url).toBe('/skus/por-codigo?codigo=0001-M-PRE');
  });

  it('finaliza com POST /vendas e o corpo, sem empresa e sem preço', async () => {
    const corpo = {
      itens: [{ sku_id: ID, quantidade: 1 }],
      cliente: { celular: '11987654321' },
      desconto: { tipo: 'nenhum' as const },
      pagamentos: [{ forma: 'pix' as const, valor_centavos: 8990 }],
    };
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: ID } });
    expect(await api.finalizarVenda(corpo)).toEqual({ id: ID });
    expect(chamadas).toEqual([{ url: '/vendas', metodo: 'POST', corpo }]);
  });

  it('lê o comprovante, cancela e pede o relatório do dia', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { vendas: 0 } });
    await api.venda(ID);
    await api.cancelarVenda(ID, 'Cliente devolveu');
    await api.relatorioVendas('dia', '2026-11-11');
    await api.comprasDoCliente(ID);
    expect(chamadas.map((c) => c.url)).toEqual([
      `/vendas/${ID}`,
      `/vendas/${ID}/cancelar`,
      '/vendas/relatorio?periodo=dia&data=2026-11-11',
      `/vendas/por-cliente/${ID}`,
    ]);
    expect(chamadas[1]).toMatchObject({ metodo: 'POST', corpo: { motivo: 'Cliente devolveu' } });
  });
});
