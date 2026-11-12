import { describe, expect, it } from 'vitest';
import { criarCliente } from './cliente';
import { criarApi } from './endpoints';

// O app só fala com a API pelos caminhos e corpos do contrato (RF-CLI-01…04).
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

describe('endpoints de Clientes', () => {
  it('lista sem busca: GET /clientes', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { clientes: [], truncado: false } });
    expect(await api.clientes()).toEqual({ clientes: [], truncado: false });
    expect(chamadas).toEqual([{ url: '/clientes', metodo: 'GET', corpo: undefined }]);
  });

  it('busca: o texto vai codificado na query (acento, espaço, +, parênteses)', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { clientes: [], truncado: false } });
    await api.clientes('João +55 (21) 9');
    expect(chamadas[0]?.url).toBe(`/clientes?q=${encodeURIComponent('João +55 (21) 9')}`);
  });

  it('busca em branco vira a lista inteira', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { clientes: [], truncado: false } });
    await api.clientes('   ');
    expect(chamadas[0]?.url).toBe('/clientes');
  });

  it('cadastra: POST /clientes com nome, celular e o aviso', async () => {
    const { api, chamadas } = apiComEspiao({ status: 201, corpo: { id: ID } });
    expect(await api.criarCliente({ nome: 'Ana', celular: '(21) 98888-0001', aviso_lgpd: true })).toEqual({ id: ID });
    expect(chamadas).toEqual([
      { url: '/clientes', metodo: 'POST', corpo: { nome: 'Ana', celular: '(21) 98888-0001', aviso_lgpd: true } },
    ]);
  });

  it('ficha: GET /clientes/:id', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.cliente(ID);
    expect(chamadas[0]).toMatchObject({ url: `/clientes/${ID}`, metodo: 'GET' });
  });

  it('registra o aviso: POST /clientes/:id/aviso-lgpd', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.avisarCliente(ID);
    expect(chamadas[0]).toMatchObject({ url: `/clientes/${ID}/aviso-lgpd`, metodo: 'POST' });
  });

  it('lista os inativos (só o Dono): GET /clientes?situacao=inativos, com ou sem busca', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { clientes: [], truncado: false } });
    await api.clientes(undefined, 'inativos');
    await api.clientes('Ana', 'inativos');
    expect(chamadas.map((c) => c.url)).toEqual(['/clientes?situacao=inativos', `/clientes?q=Ana&situacao=inativos`]);
  });

  it('a lista padrão não manda situação (a API assume ativos)', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { clientes: [], truncado: false } });
    await api.clientes('Ana', 'ativos');
    expect(chamadas[0]?.url).toBe('/clientes?q=Ana');
  });

  it('edita: PUT /clientes/:id com nome e celular', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.editarCliente(ID, { nome: 'Ana', celular: '(21) 98888-0001' });
    expect(chamadas).toEqual([{ url: `/clientes/${ID}`, metodo: 'PUT', corpo: { nome: 'Ana', celular: '(21) 98888-0001' } }]);
  });

  it('inativa e reativa: POST /clientes/:id/inativar e /reativar', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.inativarCliente(ID);
    await api.reativarCliente(ID);
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([`POST /clientes/${ID}/inativar`, `POST /clientes/${ID}/reativar`]);
  });

  it('exclui: DELETE /clientes/:id (204 sem corpo)', async () => {
    const { api, chamadas } = apiComEspiao({ status: 204 });
    await api.excluirCliente(ID);
    expect(chamadas[0]).toMatchObject({ url: `/clientes/${ID}`, metodo: 'DELETE' });
  });
});
