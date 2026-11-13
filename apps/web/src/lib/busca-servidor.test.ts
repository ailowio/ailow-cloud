import { describe, expect, it } from 'vitest';
import type { CamposBusca } from './busca';
import { AVISO_CORTE, avisoDeCorte, mesclarBusca, termoParaServidor } from './busca-servidor';

interface Item {
  id: string;
  nome: string;
  preco?: number;
}
const campos = (i: Item): CamposBusca => ({ textos: [i.nome], precoCentavos: i.preco });
const chave = (i: Item) => i.id;
const mesclar = (locais: Item[], servidor: Item[], consulta: string) =>
  mesclarBusca(locais, servidor, consulta, campos, chave).map((i) => i.id);

const A: Item = { id: 'a', nome: 'Camiseta azul' };
const B: Item = { id: 'b', nome: 'Camiseta branca' };
const Z: Item = { id: 'z', nome: 'Zebra xcamiseta' };

describe('termoParaServidor', () => {
  it('escolhe o termo mais longo (o servidor só entende um pedaço contínuo)', () => {
    expect(termoParaServidor('cm bra camiseta')).toBe('camiseta');
  });
  it('empate fica com o primeiro', () => expect(termoParaServidor('azul rosa')).toBe('azul'));
  it('ignora acento e caixa', () => expect(termoParaServidor('  CAMISÉTA ')).toBe('camiseta'));
  it('vazio ou só 1 caractere por termo não consulta o servidor', () => {
    expect(termoParaServidor('')).toBeNull();
    expect(termoParaServidor('   ')).toBeNull();
    expect(termoParaServidor('e a')).toBeNull();
  });
});

describe('avisoDeCorte', () => {
  it('lista cortada sem busca: avisa', () => expect(avisoDeCorte(true, '', false)).toBe(true));
  it('lista cortada com busca que o servidor respondeu inteira: não avisa', () => expect(avisoDeCorte(true, 'azul', false)).toBe(false));
  it('a resposta do servidor também cortada: avisa', () => expect(avisoDeCorte(true, 'azul', true)).toBe(true));
  it('lista completa nunca avisa', () => expect(avisoDeCorte(false, '', true)).toBe(false));
  it('o texto manda refinar a busca', () => expect(AVISO_CORTE).toBe('Mostrando os primeiros 200; refine a busca.'));
});

describe('mesclarBusca', () => {
  it('consulta vazia devolve só a lista local, na ordem original', () => {
    expect(mesclar([B, A], [Z], '')).toEqual(['b', 'a']);
  });
  it('sem resultado do servidor devolve a busca local', () => {
    expect(mesclar([A, B], [], 'branca')).toEqual(['b']);
  });
  it('une o que só o servidor achou ao que a lista local já tinha', () => {
    expect(mesclar([A], [Z], 'camiseta')).toEqual(['a', 'z']);
  });
  it('não repete: o mesmo id local e do servidor aparece uma vez, com os dados do servidor', () => {
    const novo: Item = { id: 'a', nome: 'Camiseta azul (atualizada)' };
    const r = mesclarBusca([A, B], [novo], 'camiseta', campos, chave);
    expect(r.map((i) => i.id)).toEqual(['a', 'b']);
    expect(r[0]?.nome).toBe('Camiseta azul (atualizada)');
  });
  it('ordena por relevância; no empate o servidor vem antes do local', () => {
    // Todos casam "camiseta" por prefixo/contém: Z (contém) fica depois; A e B (prefixo) empatam.
    expect(mesclar([A], [B, Z], 'camiseta')).toEqual(['b', 'a', 'z']);
  });
  it('vários termos: o resultado do servidor passa pelo filtro local completo', () => {
    // Z casa "camiseta" mas não "azul": fica de fora.
    expect(mesclar([], [A, Z], 'azul camiseta')).toEqual(['a']);
  });
  it('um termo só: o servidor é a palavra final (ex.: faixa de preço "89" que a busca local não casa)', () => {
    const caro: Item = { id: 'c', nome: 'Jaqueta', preco: 8950 };
    expect(mesclar([], [caro], '89')).toEqual(['c']);
  });
});
