import { describe, expect, it } from 'vitest';
import { lerCursor, novoCursor } from './paginacao.js';

// ADR 016: o cursor é opaco para o app (base64url de [chave da ordem, desempate]); a API recusa o que não reconhece.
describe('cursor da paginação', () => {
  it('ida e volta: chave com acento/espaço e desempate número ou uuid', () => {
    expect(lerCursor(novoCursor(['peça pag 007', 7]), 'numero')).toEqual(['peça pag 007', 7]);
    const id = '3f1c2a4e-0000-4000-8000-000000000001';
    expect(lerCursor(novoCursor(['ana', id]), 'uuid')).toEqual(['ana', id]);
  });

  it('só caracteres seguros na URL', () => {
    expect(novoCursor(['a/b+c=?&', 1])).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('recusa (null) lixo, JSON de outro formato e desempate do tipo errado', () => {
    expect(lerCursor('nao-e-base64!', 'numero')).toBeNull();
    expect(lerCursor(Buffer.from('{"x":1}').toString('base64url'), 'numero')).toBeNull();
    expect(lerCursor(novoCursor(['a', 'texto']), 'numero')).toBeNull();
    expect(lerCursor(novoCursor(['a', 7]), 'uuid')).toBeNull();
    expect(lerCursor(novoCursor(['a', 1.5]), 'numero')).toBeNull();
    expect(lerCursor(novoCursor(['x'.repeat(300), 1]), 'numero')).toBeNull();
  });
});
