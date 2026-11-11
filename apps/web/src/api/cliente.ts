/*
 * Cliente HTTP da API. A autenticação é por cookies httpOnly na MESMA origem (proxy do Vite em dev,
 * proxy HTTPS em produção): o JavaScript nunca vê, guarda nem envia token — só `credentials: 'same-origin'`.
 */

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    // Texto do servidor para erros de validação (400); nunca contém o valor enviado.
    readonly detalhe?: string,
    readonly tentativasRestantes?: number,
  ) {
    super(codigo);
    this.name = 'ErroApi';
  }
}

export interface OpcoesCliente {
  fetch?: typeof fetch;
  // Chamado quando uma chamada autenticada volta 401 `nao_autenticado` (sessão expirou ou foi derrubada).
  aoSessaoExpirar?: () => void;
}

export type Cliente = ReturnType<typeof criarCliente>;

export function criarCliente(opcoes: OpcoesCliente = {}) {
  // Resolvido na chamada (não na criação) para respeitar um fetch trocado em testes.
  const buscar = (...args: Parameters<typeof fetch>) => (opcoes.fetch ?? globalThis.fetch)(...args);

  async function pedir<T = undefined>(metodo: 'GET' | 'POST' | 'PUT', caminho: string, corpo?: unknown): Promise<T> {
    const init: RequestInit = { method: metodo, credentials: 'same-origin' };
    if (corpo !== undefined) {
      init.body = JSON.stringify(corpo);
      init.headers = { 'content-type': 'application/json' };
    }

    let resposta: Response;
    try {
      resposta = await buscar(caminho, init);
    } catch {
      throw new ErroApi(0, 'sem_conexao');
    }

    if (resposta.status === 204) return undefined as T;

    const texto = await resposta.text().catch(() => '');
    let json: unknown;
    try {
      json = texto ? JSON.parse(texto) : undefined;
    } catch {
      json = undefined;
    }

    if (!resposta.ok) {
      const e = (json ?? {}) as { erro?: string; mensagem?: string; tentativas_restantes?: number };
      const codigo = typeof e.erro === 'string' ? e.erro : 'erro_servidor';
      if (resposta.status === 401 && codigo === 'nao_autenticado') opcoes.aoSessaoExpirar?.();
      throw new ErroApi(
        resposta.status,
        codigo,
        typeof e.mensagem === 'string' ? e.mensagem : undefined,
        typeof e.tentativas_restantes === 'number' ? e.tentativas_restantes : undefined,
      );
    }
    return json as T;
  }

  return { pedir };
}
