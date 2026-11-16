// ADR 016: paginação por cursor (keyset). O cursor é a posição do último item da página, na mesma ordem do ORDER BY:
// [chave (o nome normalizado), desempate (número do produto ou id)]. Vai para o app em base64url e volta em `?depois=`.
// O app não interpreta o cursor; a API recusa (400) o que não reconhece. Ele não dá acesso a nada: a RLS continua
// decidindo o que cada empresa vê, o cursor só diz "continue depois deste ponto".

export type Cursor = [string, string | number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAVE_MAX = 200;

export function novoCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

/** Lê o cursor; `null` se não for um cursor desta API (formato, tamanho ou tipo do desempate errados). */
export function lerCursor(texto: string, desempate: 'numero' | 'uuid'): Cursor | null {
  if (!/^[A-Za-z0-9_-]{1,500}$/.test(texto)) return null;
  let valor: unknown;
  try {
    valor = JSON.parse(Buffer.from(texto, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(valor) || valor.length !== 2) return null;
  const [chave, segundo] = valor as unknown[];
  if (typeof chave !== 'string' || chave.length > CHAVE_MAX) return null;
  if (desempate === 'numero' && (typeof segundo !== 'number' || !Number.isInteger(segundo))) return null;
  if (desempate === 'uuid' && (typeof segundo !== 'string' || !UUID.test(segundo))) return null;
  return [chave, segundo as string | number];
}

/** Erro de cursor: a rota responde 400 `cursor_invalido`. */
export class CursorInvalido extends Error {
  constructor() {
    super('cursor_invalido');
    this.name = 'CursorInvalido';
  }
}
