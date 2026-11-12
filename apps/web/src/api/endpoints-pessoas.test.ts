import { describe, expect, it } from 'vitest';
import { criarCliente } from './cliente';
import { criarApi } from './endpoints';

function apiComEspiao() {
  const chamadas: { url: string; metodo?: string; corpo?: unknown }[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method, corpo: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;
  return { api: criarApi(criarCliente({ fetch: fetchFalso })), chamadas };
}

const ID = '0b6f5f9e-4c1d-4b0e-9a43-7d2f0f6f3a11';

describe('endpoints de Pessoas (ponto)', () => {
  it('lê o estado, bate o ponto sem mandar hora e pede o espelho do mês', async () => {
    const { api, chamadas } = apiComEspiao();
    await api.estadoDoPonto();
    await api.baterPonto();
    await api.espelhoDePonto('2026-11-01');
    await api.espelhoDePonto('2026-11-01', ID);
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'GET /pontos/estado',
      'POST /pontos',
      'GET /pontos/espelho?mes=2026-11-01',
      `GET /pontos/espelho?mes=2026-11-01&usuario_id=${ID}`,
    ]);
    // A hora é do servidor: o corpo da batida não carrega nada.
    expect(chamadas[1]?.corpo).toBeUndefined();
  });

  it('o Dono adiciona, edita e exclui ponto mandando dia, HH:MM e motivo (sem conta de fuso no app)', async () => {
    const { api, chamadas } = apiComEspiao();
    await api.adicionarPonto({ usuario_id: ID, tipo: 'entrada', data: '2026-11-10', hora: '08:00', motivo: 'esqueceu' });
    await api.editarPonto(ID, { data: '2026-11-10', hora: '08:30', motivo: 'chegou depois' });
    await api.excluirPonto(ID, { motivo: 'duplicado' });
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      'POST /pontos/manual',
      `PUT /pontos/${ID}`,
      `POST /pontos/${ID}/excluir`,
    ]);
    expect(chamadas[0]?.corpo).toEqual({ usuario_id: ID, tipo: 'entrada', data: '2026-11-10', hora: '08:00', motivo: 'esqueceu' });
    expect(chamadas[2]?.corpo).toEqual({ motivo: 'duplicado' });
  });
});
