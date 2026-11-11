import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarTravaInatividade } from './inatividade';

// RF-ACE-04: o app trava após N minutos sem uso, no mesmo limite que o servidor aplica à sessão.
const MIN = 60_000;

describe('trava por inatividade', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  function montar(minutos = 5, extra: { intervaloManterVivoMs?: number } = {}) {
    const aoTravar = vi.fn();
    const aoManterVivo = vi.fn();
    const trava = criarTravaInatividade({ minutos, aoTravar, aoManterVivo, ...extra });
    return { trava, aoTravar, aoManterVivo };
  }

  it('trava exatamente após N minutos sem atividade', () => {
    const { aoTravar } = montar(5);
    vi.advanceTimersByTime(5 * MIN - 1);
    expect(aoTravar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(aoTravar).toHaveBeenCalledTimes(1);
  });

  it('atividade zera a contagem', () => {
    const { trava, aoTravar } = montar(5);
    vi.advanceTimersByTime(4 * MIN);
    trava.atividade();
    vi.advanceTimersByTime(4 * MIN);
    expect(aoTravar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1 * MIN);
    expect(aoTravar).toHaveBeenCalledTimes(1);
  });

  it('trava só uma vez, mesmo com atividade depois de travar', () => {
    const { trava, aoTravar } = montar(1);
    vi.advanceTimersByTime(2 * MIN);
    trava.atividade();
    vi.advanceTimersByTime(5 * MIN);
    expect(aoTravar).toHaveBeenCalledTimes(1);
  });

  it('verificar() trava se o relógio andou enquanto os timers estavam congelados (celular dormindo)', () => {
    const { trava, aoTravar } = montar(5);
    vi.setSystemTime(new Date('2026-11-11T12:06:00Z')); // saltou 6 min sem disparar timers
    trava.verificar();
    expect(aoTravar).toHaveBeenCalledTimes(1);
  });

  it('verificar() não trava antes do limite', () => {
    const { trava, aoTravar } = montar(5);
    vi.setSystemTime(new Date('2026-11-11T12:04:00Z'));
    trava.verificar();
    expect(aoTravar).not.toHaveBeenCalled();
  });

  it('com uso contínuo, mantém a sessão do servidor viva no máximo uma vez por intervalo', () => {
    // O servidor foi contactado ao abrir a sessão (t=0); o próximo aviso só vale após o intervalo.
    const { trava, aoManterVivo } = montar(5, { intervaloManterVivoMs: 60_000 });
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(10_000);
      trava.atividade(); // 10 toques em 100 s
    }
    expect(aoManterVivo).toHaveBeenCalledTimes(1); // no toque de t=60 s
  });

  it('o intervalo padrão é 60 s, ou metade do limite se este for menor', () => {
    const longo = montar(5);
    vi.advanceTimersByTime(59_000);
    longo.trava.atividade();
    expect(longo.aoManterVivo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    longo.trava.atividade();
    expect(longo.aoManterVivo).toHaveBeenCalledTimes(1);
    longo.trava.parar();

    const curto = montar(1); // limite 60 s -> aviso a cada 30 s
    vi.advanceTimersByTime(29_000);
    curto.trava.atividade();
    expect(curto.aoManterVivo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    curto.trava.atividade();
    expect(curto.aoManterVivo).toHaveBeenCalledTimes(1);
  });

  it('parar() cancela a trava', () => {
    const { trava, aoTravar } = montar(1);
    trava.parar();
    vi.advanceTimersByTime(10 * MIN);
    expect(aoTravar).not.toHaveBeenCalled();
  });
});
