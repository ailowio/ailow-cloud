import { describe, expect, it } from 'vitest';
import { criarCliente } from './cliente';
import { criarApi } from './endpoints';

// O app só fala com a API pelos caminhos e corpos do contrato (RF-PRO-01…05).
function apiComEspiao(resposta: { status?: number; corpo?: unknown } = {}) {
  const chamadas: { url: string; metodo?: string; corpo?: unknown }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    const status = resposta.status ?? 200;
    return new Response(status === 204 ? null : JSON.stringify(resposta.corpo ?? {}), { status });
  }) as typeof fetch;
  return { api: criarApi(criarCliente({ fetch: fetchFalso })), chamadas };
}

describe('endpoints de Produtos', () => {
  const produto = {
    nome: 'Tomara que caia',
    categoria_id: '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11',
    porte: 'slim' as const,
    atributos: ['Bojo'],
    fornecedor: null,
    custo_centavos: 4500,
    preco_centavos: 8990,
    skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: 3, estoque_minimo: 1 }],
  };

  it('lista sem busca: GET /produtos', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false } });
    expect(await api.produtos()).toEqual({ produtos: [], truncado: false });
    expect(chamadas).toEqual([{ url: '/produtos', metodo: 'GET', corpo: undefined }]);
  });

  it('busca: o texto vai codificado na query (acento, espaço, vírgula, &, #)', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false } });
    await api.produtos('sutiã 89,90 & #1');
    expect(chamadas[0]?.url).toBe(`/produtos?q=${encodeURIComponent('sutiã 89,90 & #1')}`);
  });

  it('busca em branco vira a lista inteira', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false } });
    await api.produtos('   ');
    expect(chamadas[0]?.url).toBe('/produtos');
  });

  it('criar produto: POST com o corpo do contrato', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: 'x', numero: 1, skus: [] } });
    await api.criarProduto(produto);
    expect(chamadas).toEqual([{ url: '/produtos', metodo: 'POST', corpo: produto }]);
  });

  it('entrada/ajuste de estoque: POST em /skus/{id}/estoque', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { estoque: 7 } });
    const ajuste = { tipo: 'ajuste' as const, quantidade: -2, motivo: 'Peça com defeito' };
    expect(await api.ajustarEstoque('abc', ajuste)).toEqual({ estoque: 7 });
    expect(chamadas).toEqual([{ url: '/skus/abc/estoque', metodo: 'POST', corpo: ajuste }]);
  });

  it('histórico do SKU: GET /skus/{id}/movimentos', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { movimentos: [] } });
    await api.movimentos('abc');
    expect(chamadas).toEqual([{ url: '/skus/abc/movimentos', metodo: 'GET', corpo: undefined }]);
  });

  it('alertas de estoque: GET /estoque/alertas', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { total: 0, itens: [] } });
    expect(await api.alertasEstoque()).toEqual({ total: 0, itens: [] });
    expect(chamadas).toEqual([{ url: '/estoque/alertas', metodo: 'GET', corpo: undefined }]);
  });
});

describe('endpoint de Etiquetas (S08, RF-PRO-06)', () => {
  it('POST /etiquetas com os itens do contrato e devolve o PDF', async () => {
    const chamadas: { url: string; metodo?: string; corpo?: unknown }[] = [];
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, metodo: init?.method, corpo: JSON.parse(String(init?.body)) });
      return new Response(new Uint8Array([1]), { status: 200, headers: { 'content-type': 'application/pdf' } });
    }) as typeof fetch;
    const itens = [{ sku_id: 'abc', quantidade: 3 }];
    const blob = await criarApi(criarCliente({ fetch: fetchFalso })).etiquetasPdf(itens);
    expect(blob.type).toBe('application/pdf');
    expect(chamadas).toEqual([{ url: '/etiquetas', metodo: 'POST', corpo: { itens } }]);
  });
});
