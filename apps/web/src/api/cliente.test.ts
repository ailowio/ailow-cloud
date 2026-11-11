import { describe, expect, it, vi } from 'vitest';
import { ErroApi, criarCliente } from './cliente';
import { criarApi } from './endpoints';

const json = (status: number, corpo?: unknown) =>
  new Response(corpo === undefined ? null : JSON.stringify(corpo), {
    status,
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
  });

function fetchFalso(resposta: () => Response | Promise<Response>) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return resposta();
  });
  return { fn: fn as unknown as typeof fetch, chamadas };
}

describe('cliente da API (cookies httpOnly, nenhum token no JavaScript)', () => {
  it('GET usa credentials same-origin, sem corpo e sem cabeçalho de autorização', async () => {
    const { fn, chamadas } = fetchFalso(() => json(200, { ok: true }));
    const r = await criarCliente({ fetch: fn }).pedir<{ ok: boolean }>('GET', '/acesso/eu');
    expect(r).toEqual({ ok: true });
    expect(chamadas[0]?.url).toBe('/acesso/eu');
    expect(chamadas[0]?.init.credentials).toBe('same-origin');
    expect(chamadas[0]?.init.body).toBeUndefined();
    const cab = new Headers(chamadas[0]?.init.headers);
    expect(cab.has('authorization')).toBe(false);
    expect(cab.has('content-type')).toBe(false);
  });

  it('POST envia JSON com content-type', async () => {
    const { fn, chamadas } = fetchFalso(() => json(200, {}));
    await criarCliente({ fetch: fn }).pedir('POST', '/acesso/pin', { usuario_id: 'u', pin: '1234' });
    expect(chamadas[0]?.init.method).toBe('POST');
    expect(chamadas[0]?.init.body).toBe(JSON.stringify({ usuario_id: 'u', pin: '1234' }));
    expect(new Headers(chamadas[0]?.init.headers).get('content-type')).toBe('application/json');
  });

  it('204 devolve undefined', async () => {
    const { fn } = fetchFalso(() => json(204));
    expect(await criarCliente({ fetch: fn }).pedir('POST', '/acesso/sair')).toBeUndefined();
  });

  it('PIN errado (401) carrega as tentativas restantes', async () => {
    const { fn } = fetchFalso(() => json(401, { erro: 'pin_invalido', tentativas_restantes: 3 }));
    const erro = await criarCliente({ fetch: fn }).pedir('POST', '/acesso/pin', {}).catch((e) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect(erro).toMatchObject({ status: 401, codigo: 'pin_invalido', tentativasRestantes: 3 });
  });

  it('usuário bloqueado (423)', async () => {
    const { fn } = fetchFalso(() => json(423, { erro: 'usuario_bloqueado' }));
    const erro = await criarCliente({ fetch: fn }).pedir('POST', '/acesso/pin', {}).catch((e) => e);
    expect(erro).toMatchObject({ status: 423, codigo: 'usuario_bloqueado' });
  });

  it('erro sem JSON (ex.: 502 do proxy) vira erro_servidor, sem vazar o corpo', async () => {
    const { fn } = fetchFalso(() => new Response('<html>Bad Gateway</html>', { status: 502 }));
    const erro = await criarCliente({ fetch: fn }).pedir('GET', '/empresa').catch((e) => e);
    expect(erro).toMatchObject({ status: 502, codigo: 'erro_servidor' });
    expect(String(erro.message)).not.toContain('html');
  });

  it('falha de rede vira sem_conexao (status 0)', async () => {
    const fn = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const erro = await criarCliente({ fetch: fn }).pedir('GET', '/empresa').catch((e) => e);
    expect(erro).toMatchObject({ status: 0, codigo: 'sem_conexao' });
  });

  it('sessão expirada (401 nao_autenticado) avisa o app uma vez; credenciais erradas não', async () => {
    const aoExpirar = vi.fn();
    const expirada = fetchFalso(() => json(401, { erro: 'nao_autenticado' }));
    await criarCliente({ fetch: expirada.fn, aoSessaoExpirar: aoExpirar }).pedir('GET', '/usuarios').catch(() => {});
    expect(aoExpirar).toHaveBeenCalledTimes(1);

    const errada = fetchFalso(() => json(401, { erro: 'credenciais_invalidas' }));
    await criarCliente({ fetch: errada.fn, aoSessaoExpirar: aoExpirar }).pedir('POST', '/acesso/entrar', {}).catch(() => {});
    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });
});

describe('endpoints: método, caminho e corpo de cada chamada', () => {
  const id = '3f1c2a4e-0000-4000-8000-000000000001';
  const casos: [string, (a: ReturnType<typeof criarApi>) => Promise<unknown>, string, string, unknown][] = [
    ['entrar', (a) => a.entrar('d@x.com', 'segredo-longo'), 'POST', '/acesso/entrar', { email: 'd@x.com', senha: 'segredo-longo' }],
    ['quemUsa', (a) => a.quemUsa(), 'GET', '/acesso/usuarios', undefined],
    ['pin', (a) => a.pin(id, '1234'), 'POST', '/acesso/pin', { usuario_id: id, pin: '1234' }],
    ['eu', (a) => a.eu(), 'GET', '/acesso/eu', undefined],
    ['sair', (a) => a.sair(), 'POST', '/acesso/sair', undefined],
    ['definirMeuPin', (a) => a.definirMeuPin('segredo-longo', '4321'), 'PUT', '/acesso/meu-pin', { senha: 'segredo-longo', pin: '4321' }],
    ['usuarios', (a) => a.usuarios(), 'GET', '/usuarios', undefined],
    ['criarVendedor', (a) => a.criarVendedor('Ana', '1357'), 'POST', '/usuarios', { nome: 'Ana', pin: '1357' }],
    ['redefinirPin', (a) => a.redefinirPin(id, '2468'), 'PUT', `/usuarios/${id}/pin`, { pin: '2468' }],
    ['desbloquear', (a) => a.desbloquear(id), 'POST', `/usuarios/${id}/desbloquear`, undefined],
    ['derrubarSessoes', (a) => a.derrubarSessoes(id), 'POST', `/usuarios/${id}/derrubar-sessoes`, undefined],
    ['desativar', (a) => a.desativar(id), 'POST', `/usuarios/${id}/desativar`, undefined],
    ['empresa', (a) => a.empresa(), 'GET', '/empresa', undefined],
    [
      'salvarEmpresa',
      (a) =>
        a.salvarEmpresa({ nome: 'M', telefone: null, endereco: null, markup_bps: 100, inatividade_minutos: 5 }),
      'PUT',
      '/empresa',
      { nome: 'M', telefone: null, endereco: null, markup_bps: 100, inatividade_minutos: 5 },
    ],
    ['categorias', (a) => a.categorias(), 'GET', '/categorias', undefined],
    ['criarCategoria', (a) => a.criarCategoria({ nome: 'Sutiã', atributos: ['aro'] }), 'POST', '/categorias', { nome: 'Sutiã', atributos: ['aro'] }],
    [
      'alterarCategoria',
      (a) => a.alterarCategoria(id, { nome: 'Sutiã', atributos: [], ativa: false }),
      'PUT',
      `/categorias/${id}`,
      { nome: 'Sutiã', atributos: [], ativa: false },
    ],
  ];

  it.each(casos)('%s', async (_nome, chamar, metodo, caminho, corpo) => {
    const { fn, chamadas } = fetchFalso(() => json(200, {}));
    await chamar(criarApi(criarCliente({ fetch: fn })));
    expect(chamadas[0]?.init.method).toBe(metodo);
    expect(chamadas[0]?.url).toBe(caminho);
    expect(chamadas[0]?.init.body).toBe(corpo === undefined ? undefined : JSON.stringify(corpo));
  });
});
