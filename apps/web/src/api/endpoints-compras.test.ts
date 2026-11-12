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

describe('endpoints de Compras', () => {
  it('lista e cria fornecedor', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: ID } });
    await api.fornecedores('atelier');
    await api.criarFornecedor({ nome: 'Atelier', whatsapp: '11987654321', cnpj: null });
    expect(chamadas.map((c) => c.url)).toEqual(['/fornecedores?q=atelier', '/fornecedores']);
    expect(chamadas[1]).toMatchObject({
      metodo: 'POST',
      corpo: { nome: 'Atelier', whatsapp: '11987654321', cnpj: null },
    });
  });

  it('cria, envia e recebe pedido; pede o relatório do mês', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.criarPedidoCompra({
      fornecedor_id: ID,
      itens: [{ sku_id: ID, quantidade: 2, custo_centavos: 4500 }],
    });
    await api.enviarPedidoCompra(ID);
    await api.receberPedidoCompra(ID, { parcelas: [{ valor_centavos: 9000, vencimento: '2026-11-20' }] });
    await api.relatorioCompras('2026-11-01');
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'POST /compras',
      `POST /compras/${ID}/enviar`,
      `POST /compras/${ID}/receber`,
      'GET /compras/relatorio?periodo=mes&data=2026-11-01',
    ]);
  });
});
