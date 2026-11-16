import { describe, expect, it } from 'vitest';
import type { Espelho } from '@ailow/shared';
import { filtrarHistorico, linhasDoHistorico, resumoRelatorio } from './historico-ponto';

// 13/11/2026 11:00Z = 08:00 em São Paulo; 15:00Z = 12:00.
const espelho: Espelho = {
  mes: '2026-11-01',
  usuarios: [
    {
      usuario_id: '11111111-1111-4111-8111-111111111111',
      nome: 'Ana Souza',
      total_segundos: 4 * 3600,
      dias: [
        {
          data: '2026-11-13',
          trabalhado_segundos: 4 * 3600,
          em_aberto: false,
          marcas: [
            { id: 'a1', tipo: 'entrada', registrado_em: '2026-11-13T11:00:00.000Z', ajustado: false },
            { id: 'a2', tipo: 'saida', registrado_em: '2026-11-13T15:00:00.000Z', ajustado: true },
          ],
        },
      ],
    },
    {
      usuario_id: '22222222-2222-4222-8222-222222222222',
      nome: 'Bruno Lima',
      total_segundos: 0,
      dias: [
        {
          data: '2026-11-12',
          trabalhado_segundos: 0,
          em_aberto: true,
          marcas: [{ id: 'b1', tipo: 'entrada', registrado_em: '2026-11-12T12:00:00.000Z', ajustado: false }],
        },
      ],
    },
  ],
};

describe('histórico de pontos', () => {
  it('junta as marcas de todos, da mais nova para a mais antiga, com nome, tipo, dia e hora de São Paulo', () => {
    const l = linhasDoHistorico(espelho);
    expect(l.map((x) => x.id)).toEqual(['a2', 'a1', 'b1']);
    expect(l[0]).toMatchObject({ nome: 'Ana Souza', tipo: 'saida', dia: '2026-11-13', hora: '12:00', ajustado: true });
    expect(l[1]).toMatchObject({ tipo: 'entrada', hora: '08:00' });
  });

  it('busca por nome, tipo, data e hora; vazia devolve tudo', () => {
    const l = linhasDoHistorico(espelho);
    expect(filtrarHistorico(l, '').length).toBe(3);
    expect(filtrarHistorico(l, 'bruno').map((x) => x.id)).toEqual(['b1']);
    expect(filtrarHistorico(l, 'saida').map((x) => x.id)).toEqual(['a2']);
    expect(filtrarHistorico(l, 'saída').map((x) => x.id)).toEqual(['a2']);
    expect(filtrarHistorico(l, '12/11').map((x) => x.id)).toEqual(['b1']);
    expect(filtrarHistorico(l, 'ana 08:00').map((x) => x.id)).toEqual(['a1']);
    expect(filtrarHistorico(l, 'zzz')).toEqual([]);
  });
});

describe('relatório de pontos', () => {
  it('soma horas por pessoa e por dia, conta dias trabalhados e sinaliza dia em aberto', () => {
    const r = resumoRelatorio(espelho);
    expect(r.total_segundos).toBe(4 * 3600);
    expect(r.pessoas.map((p) => p.nome)).toEqual(['Ana Souza', 'Bruno Lima']);
    expect(r.pessoas[0]).toMatchObject({ total_segundos: 4 * 3600, dias_trabalhados: 1 });
    expect(r.pessoas[0]?.dias[0]).toEqual({ data: '2026-11-13', trabalhado_segundos: 4 * 3600, em_aberto: false });
    expect(r.pessoas[1]).toMatchObject({ total_segundos: 0, dias_trabalhados: 0 });
    expect(r.pessoas[1]?.dias[0]?.em_aberto).toBe(true);
  });

  it('sem ninguém: total zero e lista vazia', () => {
    expect(resumoRelatorio({ mes: '2026-11-01', usuarios: [] })).toEqual({ total_segundos: 0, pessoas: [] });
  });
});
