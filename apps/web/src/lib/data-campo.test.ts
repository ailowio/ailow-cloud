import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { normalizarDataIso, rotuloDoCampoData } from './data-campo';

// O CampoData fala "AAAA-MM-DD" com o app e o Mantine 9 também (sem Date no meio do caminho). Mesmo assim, o
// Mantine usa o dayjs por dentro: o teste prova que o dia não anda por causa do fuso do aparelho (UTC-3 e UTC+14).
const DIAS = ['2028-02-29', '2026-12-31', '2027-01-01', '2026-11-12', '2024-02-29', '2026-03-08', '2026-10-18'];

describe.each(['America/Sao_Paulo', 'UTC', 'Pacific/Kiritimati'])('ida e volta AAAA-MM-DD <-> Date no fuso %s', (fuso) => {
  it('não muda o dia (29/02/2028, 31/12, virada de ano, horário de verão)', () => {
    const antes = process.env.TZ;
    process.env.TZ = fuso;
    try {
      for (const dia of DIAS) {
        const data = dayjs(dia).toDate();
        expect(dayjs(data).format('YYYY-MM-DD'), `${dia} em ${fuso}`).toBe(dia);
        expect(normalizarDataIso(dayjs(data).format('YYYY-MM-DD'))).toBe(dia);
      }
    } finally {
      if (antes === undefined) delete process.env.TZ;
      else process.env.TZ = antes;
    }
  });
});

describe('normalizarDataIso', () => {
  it('aceita só datas reais no formato AAAA-MM-DD', () => {
    expect(normalizarDataIso('2028-02-29')).toBe('2028-02-29');
    expect(normalizarDataIso('2026-12-31')).toBe('2026-12-31');
  });
  it('29/02 de ano não bissexto, mês 13, dia 0 e 32 não existem', () => {
    expect(normalizarDataIso('2026-02-29')).toBeNull();
    expect(normalizarDataIso('2100-02-29')).toBeNull();
    expect(normalizarDataIso('2026-13-01')).toBeNull();
    expect(normalizarDataIso('2026-11-00')).toBeNull();
    expect(normalizarDataIso('2026-11-31')).toBeNull();
  });
  it('vazio, nulo, texto solto e data com hora viram nulo', () => {
    expect(normalizarDataIso('')).toBeNull();
    expect(normalizarDataIso(null)).toBeNull();
    expect(normalizarDataIso(undefined)).toBeNull();
    expect(normalizarDataIso('12/11/2026')).toBeNull();
    expect(normalizarDataIso('2026-11-12T10:00:00Z')).toBeNull();
    expect(normalizarDataIso('2026-1-2')).toBeNull();
  });
});

describe('rotuloDoCampoData', () => {
  it('mostra dia/mês/ano, sem Date, e o texto de apoio quando vazio', () => {
    expect(rotuloDoCampoData('2028-02-29')).toBe('29/02/2028');
    expect(rotuloDoCampoData('')).toBe('Escolher o dia');
    expect(rotuloDoCampoData('2026-02-30')).toBe('Escolher o dia');
  });
});
