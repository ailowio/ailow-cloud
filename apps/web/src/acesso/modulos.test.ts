import { describe, expect, it } from 'vitest';
import { modulosPara } from './modulos';

// RN-10: Vendedor nunca acessa Financeiro, Compras, Configurações nem custo. A tela inicial é 3 por linha (RNF-05).
describe('módulos da tela inicial por perfil', () => {
  it('Dono vê os 7 módulos, com Vendas primeiro (canto superior esquerdo, RF-VEN-01)', () => {
    const ids = modulosPara('dono').map((m) => m.id);
    expect(ids).toEqual(['vendas', 'produtos', 'compras', 'clientes', 'financeiro', 'pessoas', 'configuracoes']);
  });

  it('Vendedor não vê Financeiro, Compras nem Configurações', () => {
    const ids = modulosPara('vendedor').map((m) => m.id);
    expect(ids).toEqual(['vendas', 'produtos', 'clientes', 'pessoas']);
    for (const proibido of ['financeiro', 'compras', 'configuracoes']) expect(ids).not.toContain(proibido);
  });

  it('rótulos são uma palavra só (D4) e únicos', () => {
    const rotulos = modulosPara('dono').map((m) => m.rotulo);
    for (const r of rotulos) expect(r).not.toMatch(/\s/);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });

  it('nesta fase todos os módulos estão prontos, para o Dono e para o Vendedor (Pessoas abre para os dois, RF-PES-01/02)', () => {
    const prontos = modulosPara('dono').filter((m) => m.pronto).map((m) => m.id);
    expect(prontos).toEqual(['vendas', 'produtos', 'compras', 'clientes', 'financeiro', 'pessoas', 'configuracoes']);
    expect(modulosPara('vendedor').every((m) => m.pronto)).toBe(true);
  });

  it('o Vendedor abre Clientes (cadastra e consulta, RF-CLI-01/02)', () => {
    const clientes = modulosPara('vendedor').find((m) => m.id === 'clientes');
    expect(clientes?.pronto).toBe(true);
  });

  it('o Vendedor abre Produtos (consulta de produto, preço e estoque, RF-PRO-07)', () => {
    const produtos = modulosPara('vendedor').find((m) => m.id === 'produtos');
    expect(produtos?.pronto).toBe(true);
  });
});
