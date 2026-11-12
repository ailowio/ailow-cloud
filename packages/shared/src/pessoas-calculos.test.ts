import { describe, expect, it } from 'vitest';
import { INTERVALO_MINIMO_SEGUNDOS, diaDoPonto, formatarDuracao, montarDias, proximoTipo, sequenciaValida } from './pessoas-calculos.js';

// RF-PES-01/02. Horas feitas na mão. São Paulo = UTC−3 (sem horário de verão desde 2019).

const m = (id: string, tipo: 'entrada' | 'saida', iso: string) => ({ id, tipo, registrado_em: iso, ajustado: false });

describe('próxima batida alterna (RF-PES-01)', () => {
  it('sem batida nenhuma, a primeira é entrada', () => {
    expect(proximoTipo(null)).toBe('entrada');
  });
  it('depois de entrada vem saída, e depois de saída vem entrada', () => {
    expect(proximoTipo('entrada')).toBe('saida');
    expect(proximoTipo('saida')).toBe('entrada');
  });
  it('o intervalo mínimo entre duas batidas é 30 s', () => {
    expect(INTERVALO_MINIMO_SEGUNDOS).toBe(30);
  });
});

const s = (tipo: 'entrada' | 'saida', iso: string) => ({ tipo, registrado_em: iso });

describe('sequência válida depois de um ajuste do Dono (RF-PES-03)', () => {
  it('lista vazia, só entrada (em aberto) e pares completos são válidos', () => {
    expect(sequenciaValida([])).toEqual({ ok: true });
    expect(sequenciaValida([s('entrada', '2026-11-11T11:00:00.000Z')])).toEqual({ ok: true });
    expect(
      sequenciaValida([s('entrada', '2026-11-11T11:00:00.000Z'), s('saida', '2026-11-11T15:00:00.000Z')]),
    ).toEqual({ ok: true });
  });
  it('a ordem é a do relógio, não a da lista', () => {
    expect(
      sequenciaValida([s('saida', '2026-11-11T15:00:00.000Z'), s('entrada', '2026-11-11T11:00:00.000Z')]),
    ).toEqual({ ok: true });
  });
  it('a primeira marca tem de ser entrada', () => {
    expect(sequenciaValida([s('saida', '2026-11-11T11:00:00.000Z')])).toEqual({ ok: false, erro: 'comecar_com_entrada' });
  });
  it('duas entradas ou duas saídas seguidas não são aceitas', () => {
    expect(
      sequenciaValida([s('entrada', '2026-11-11T11:00:00.000Z'), s('entrada', '2026-11-11T12:00:00.000Z')]),
    ).toEqual({ ok: false, erro: 'nao_alterna' });
    expect(
      sequenciaValida([
        s('entrada', '2026-11-11T11:00:00.000Z'),
        s('saida', '2026-11-11T12:00:00.000Z'),
        s('saida', '2026-11-11T13:00:00.000Z'),
      ]),
    ).toEqual({ ok: false, erro: 'nao_alterna' });
  });
  it('duas marcas no mesmo instante são recusadas', () => {
    expect(
      sequenciaValida([s('entrada', '2026-11-11T11:00:00.000Z'), s('saida', '2026-11-11T11:00:00.000Z')]),
    ).toEqual({ ok: false, erro: 'horario_repetido' });
  });
});

describe('duração em horas e minutos', () => {
  it('formata como 8h30, com minutos de 2 dígitos e sem arredondar para cima', () => {
    expect(formatarDuracao(8.5 * 3600)).toBe('8h30');
    expect(formatarDuracao(0)).toBe('0h00');
    expect(formatarDuracao(59 * 60 + 59)).toBe('0h59');
    expect(formatarDuracao(3661)).toBe('1h01');
    expect(formatarDuracao(176 * 3600 + 5 * 60)).toBe('176h05');
  });
});

describe('dia do ponto no fuso de São Paulo', () => {
  it('23:30 em São Paulo ainda é o mesmo dia, apesar de já ser dia seguinte em UTC', () => {
    expect(diaDoPonto('2026-11-12T02:30:00.000Z')).toBe('2026-11-11');
  });
  it('00:00 em São Paulo já é o dia novo', () => {
    expect(diaDoPonto('2026-11-12T03:00:00.000Z')).toBe('2026-11-12');
  });
});

describe('espelho por dia (RF-PES-02)', () => {
  it('um par entrada→saída soma as horas exatas: 08:00–12:00 e 13:00–17:30 = 8h30', () => {
    const dias = montarDias([
      m('1', 'entrada', '2026-11-11T11:00:00.000Z'),
      m('2', 'saida', '2026-11-11T15:00:00.000Z'),
      m('3', 'entrada', '2026-11-11T16:00:00.000Z'),
      m('4', 'saida', '2026-11-11T20:30:00.000Z'),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.data).toBe('2026-11-11');
    expect(dias[0]?.trabalhado_segundos).toBe(8.5 * 3600);
    expect(dias[0]?.em_aberto).toBe(false);
    expect(dias[0]?.marcas.map((x) => x.id)).toEqual(['1', '2', '3', '4']);
  });

  it('entrada sem saída fica "em aberto" e não conta horas', () => {
    const dias = montarDias([
      m('1', 'entrada', '2026-11-11T11:00:00.000Z'),
      m('2', 'saida', '2026-11-11T15:00:00.000Z'),
      m('3', 'entrada', '2026-11-11T16:00:00.000Z'),
    ]);
    expect(dias[0]?.trabalhado_segundos).toBe(4 * 3600);
    expect(dias[0]?.em_aberto).toBe(true);
  });

  it('turno que passa da meia-noite pertence ao dia da entrada', () => {
    // entrada 22:00 de 11/11 (01:00Z de 12/11), saída 02:00 de 12/11 (05:00Z).
    const dias = montarDias([
      m('1', 'entrada', '2026-11-12T01:00:00.000Z'),
      m('2', 'saida', '2026-11-12T05:00:00.000Z'),
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.data).toBe('2026-11-11');
    expect(dias[0]?.trabalhado_segundos).toBe(4 * 3600);
    expect(dias[0]?.marcas).toHaveLength(2);
  });

  it('dias saem em ordem crescente e sem lista vazia devolve nada', () => {
    expect(montarDias([])).toEqual([]);
    const dias = montarDias([
      m('3', 'entrada', '2026-11-13T11:00:00.000Z'),
      m('4', 'saida', '2026-11-13T12:00:00.000Z'),
      m('1', 'entrada', '2026-11-11T11:00:00.000Z'),
      m('2', 'saida', '2026-11-11T12:00:00.000Z'),
    ]);
    expect(dias.map((d) => d.data)).toEqual(['2026-11-11', '2026-11-13']);
  });
});
