import type { VendaResumo } from '@ailow/shared';
import { describe, expect, it } from 'vitest';
import { filtrarPorBusca } from '../../lib/busca';
import { camposBuscaVenda } from './lista-vendas';

const venda = (numero: number, nome: string | null, celular: string, total: number): VendaResumo => ({
  id: `id-${numero}`,
  numero,
  status: 'finalizada',
  total_centavos: total,
  cliente: nome ? { nome, celular } : null,
  vendedor_nome: 'Dono',
  formas: ['pix'],
  criado_em: '2026-11-13T12:00:00.000Z',
});

const lista = [venda(101, 'Ana Souza', '11988887777', 8990), venda(102, 'Bia Lima', '11955554444', 15000), venda(103, null, '', 4990)];
const achar = (q: string) => filtrarPorBusca(lista, q, camposBuscaVenda).map((v) => v.numero);

describe('busca de vendas (UXM-09)', () => {
  it('acha pelo número da venda, com ou sem #', () => {
    expect(achar('102')).toEqual([102]);
    expect(achar('#103')).toEqual([103]);
  });
  it('acha pelo nome, mesmo com caracteres soltos e sem acento', () => {
    expect(achar('ana')).toEqual([101]);
    expect(achar('bl')).toEqual([102]);
  });
  it('acha pelo celular e pelo valor', () => {
    expect(achar('7777')).toEqual([101]);
    expect(achar('150,00')).toEqual([102]);
  });
  it('venda sem cliente aparece só sem consulta ou por número', () => {
    expect(achar('')).toHaveLength(3);
    expect(achar('ana')).not.toContain(103);
  });
});
