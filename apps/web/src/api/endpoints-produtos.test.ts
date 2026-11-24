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
    skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: 3, estoque_minimo: 1, extras: [] }],
  };

  it('lista sem busca: GET /produtos', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false } });
    expect(await api.produtos()).toEqual({ produtos: [], truncado: false });
    expect(chamadas).toEqual([{ url: '/produtos', metodo: 'GET', corpo: undefined }]);
  });

  it('sugestões da venda: GET /produtos/sugestoes-venda', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [] } });
    expect(await api.sugestoesVenda()).toEqual({ produtos: [] });
    expect(chamadas).toEqual([{ url: '/produtos/sugestoes-venda', metodo: 'GET', corpo: undefined }]);
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

  it('P02: filtros por categoria e cor vão na query, combinados com a busca e o cursor', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false, proximo: null } });
    await api.produtos({ q: ' renda ', depois: 'abc', categoria_id: 'c1', cor: 'Azul marinho' });
    expect(chamadas[0]?.url).toBe('/produtos?q=renda&depois=abc&categoria_id=c1&cor=Azul%20marinho');
  });

  it('P02: filtro vazio não entra na query', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { produtos: [], truncado: false, proximo: null } });
    await api.produtos({ categoria_id: undefined, cor: '' });
    expect(chamadas[0]?.url).toBe('/produtos');
  });

  it('criar produto: POST com o corpo do contrato', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: 'x', numero: 1, skus: [] } });
    await api.criarProduto(produto);
    expect(chamadas).toEqual([{ url: '/produtos', metodo: 'POST', corpo: produto }]);
  });

  it('editar produto: PUT /produtos/{id} com o corpo do contrato (S09)', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: 'abc' } });
    const { skus: _skus, ...edicao } = produto;
    expect(await api.editarProduto('abc', edicao)).toEqual({ id: 'abc' });
    expect(chamadas).toEqual([{ url: '/produtos/abc', metodo: 'PUT', corpo: edicao }]);
  });

  it('opções da grade (ADR 017): GET, POST com tipo e PUT com nome, amostra e ativa', async () => {
    const lido = apiComEspiao({ corpo: { tamanhos: [], cores: [] } });
    expect(await lido.api.opcoesGrade()).toEqual({ tamanhos: [], cores: [] });
    expect(lido.chamadas).toEqual([{ url: '/opcoes-grade', metodo: 'GET', corpo: undefined }]);

    const criado = apiComEspiao({ status: 201, corpo: { id: 'n' } });
    await criado.api.criarOpcaoGrade({ tipo: 'cor', nome: 'Lilás', amostra: '#c8a2c8' });
    expect(criado.chamadas).toEqual([{ url: '/opcoes-grade', metodo: 'POST', corpo: { tipo: 'cor', nome: 'Lilás', amostra: '#c8a2c8' } }]);

    const alterado = apiComEspiao({ status: 204 });
    await alterado.api.alterarOpcaoGrade('o1', { nome: 'XG', amostra: null, ativa: false });
    expect(alterado.chamadas).toEqual([{ url: '/opcoes-grade/o1', metodo: 'PUT', corpo: { nome: 'XG', amostra: null, ativa: false } }]);
  });

  it('eixos de grade: GET biblioteca, POST eixo, valores e eixos da categoria', async () => {
    const lido = apiComEspiao({ corpo: { eixos: [] } });
    expect(await lido.api.eixosGrade()).toEqual({ eixos: [] });
    expect(lido.chamadas).toEqual([{ url: '/eixos-grade', metodo: 'GET', corpo: undefined }]);

    const criado = apiComEspiao({ status: 201, corpo: { id: 'e1', slug: 'taca' } });
    await criado.api.criarEixoGrade({ nome: 'Taça', tipo_valor: 'texto' });
    expect(criado.chamadas).toEqual([{ url: '/eixos-grade', metodo: 'POST', corpo: { nome: 'Taça', tipo_valor: 'texto' } }]);

    const valor = apiComEspiao({ status: 201, corpo: { id: 'v1' } });
    await valor.api.criarValorEixo('e1', { nome: 'A' });
    expect(valor.chamadas).toEqual([{ url: '/eixos-grade/e1/valores', metodo: 'POST', corpo: { nome: 'A' } }]);

    const cat = apiComEspiao({ corpo: { eixos: [] } });
    await cat.api.eixosDaCategoria('c1');
    expect(cat.chamadas).toEqual([{ url: '/categorias/c1/eixos', metodo: 'GET', corpo: undefined }]);

    const def = apiComEspiao({ status: 204 });
    await def.api.definirEixosDaCategoria('c1', { eixos: [{ eixo_id: 'e1', seq: 0 }] });
    expect(def.chamadas).toEqual([
      { url: '/categorias/c1/eixos', metodo: 'PUT', corpo: { eixos: [{ eixo_id: 'e1', seq: 0 }] } },
    ]);
  });

  it('arquivar produto: POST /produtos/{id}/arquivar (S09)', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: 'abc' } });
    await api.arquivarProduto('abc');
    expect(chamadas).toEqual([{ url: '/produtos/abc/arquivar', metodo: 'POST', corpo: undefined }]);
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
