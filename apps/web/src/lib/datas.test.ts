import { describe, expect, it } from 'vitest';
import { deslocarPeriodo, formatarData, hojeEmSaoPaulo, horaEmSaoPaulo, rotuloDoPeriodo } from './datas';

describe('datas do Financeiro (AAAA-MM-DD, fuso de São Paulo)', () => {
  it('"hoje" é a data de São Paulo, não a UTC (01:30Z de 12/11 ainda é 11/11 à noite)', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-12T01:30:00.000Z'))).toBe('2026-11-11');
    expect(hojeEmSaoPaulo(new Date('2026-11-12T03:00:00.000Z'))).toBe('2026-11-12');
    expect(hojeEmSaoPaulo(new Date('2026-12-31T23:59:00.000Z'))).toBe('2026-12-31');
  });

  it('formata dia/mês/ano por texto, sem criar Date (nada de fuso)', () => {
    expect(formatarData('2026-11-05')).toBe('05/11/2026');
    expect(formatarData('2028-02-29')).toBe('29/02/2028');
  });

  it('hora do pagamento no relógio de São Paulo (UTC-3), com 2 dígitos', () => {
    expect(horaEmSaoPaulo('2026-11-12T01:30:00.000Z')).toBe('22:30');
    expect(horaEmSaoPaulo('2026-11-11T12:05:00.000Z')).toBe('09:05');
    expect(horaEmSaoPaulo('2026-11-11T03:00:00.000Z')).toBe('00:00');
  });

  describe('rótulo do período', () => {
    it('dia em formato brasileiro', () => {
      expect(rotuloDoPeriodo('dia', '2026-11-11')).toBe('11/11/2026');
    });
    it('mês por extenso, com o primeiro mês e o último', () => {
      expect(rotuloDoPeriodo('mes', '2026-11-11')).toBe('novembro de 2026');
      expect(rotuloDoPeriodo('mes', '2027-01-31')).toBe('janeiro de 2027');
      expect(rotuloDoPeriodo('mes', '2026-12-01')).toBe('dezembro de 2026');
    });
  });

  describe('deslocar o período (botões anterior/próximo)', () => {
    it.each([
      ['dia', '2026-03-01', -1, '2026-02-28'],
      ['dia', '2028-03-01', -1, '2028-02-29'],
      ['dia', '2026-12-31', 1, '2027-01-01'],
      ['dia', '2026-11-11', 0, '2026-11-11'],
      ['mes', '2026-01-31', -1, '2025-12-01'],
      ['mes', '2026-12-15', 1, '2027-01-01'],
      ['mes', '2026-03-31', 1, '2026-04-01'],
    ] as const)('%s: %s %i -> %s', (periodo, data, passo, esperado) => {
      expect(deslocarPeriodo(periodo, data, passo)).toBe(esperado);
    });
  });
});
