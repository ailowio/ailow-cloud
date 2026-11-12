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

  it('anonimiza: POST /clientes/:id/anonimizar', async () => {
    const { api, chamadas } = apiComEspiao({ corpo: { id: ID } });
    await api.anonimizarCliente(ID);
    expect(chamadas[0]).toMatchObject({ url: `/clientes/${ID}/anonimizar`, metodo: 'POST' });
  });
});
