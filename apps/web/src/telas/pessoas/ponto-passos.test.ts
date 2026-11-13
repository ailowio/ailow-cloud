import { describe, expect, it } from 'vitest';
import { PASSOS_PONTO, type RascunhoPonto, pontoParaApi, validarPassoPonto } from './ponto-passos';

const agora = { hoje: '2026-11-13', hora: '15:30' };
const base: RascunhoPonto = {
  pessoa: '8a4f1c52-6f0f-4a53-9a39-2f1f7c1d3b11',
  tipo: 'entrada',
  data: '2026-11-13',
  hora: '08:00',
  motivo: 'Esqueceu de bater',
};

describe('assistente de adicionar ponto: passos', () => {
  it('tem pessoa, quando, motivo e confirmar, nessa ordem', () => {
    expect(PASSOS_PONTO).toEqual(['pessoa', 'quando', 'motivo', 'confirmar']);
  });

  it('passo pessoa: sem pessoa escolhida é recusado', () => {
    expect(validarPassoPonto('pessoa', { ...base, pessoa: '' }, agora)).toMatch(/pessoa/i);
    expect(validarPassoPonto('pessoa', base, agora)).toBeNull();
  });

  it('passo quando: hora vazia ou inválida é recusada', () => {
    expect(validarPassoPonto('quando', { ...base, hora: '' }, agora)).toMatch(/hora/i);
    expect(validarPassoPonto('quando', { ...base, hora: '25:00' }, agora)).toMatch(/hora/i);
    expect(validarPassoPonto('quando', { ...base, hora: '8:00' }, agora)).toMatch(/hora/i);
    expect(validarPassoPonto('quando', base, agora)).toBeNull();
  });

  it('passo quando: dia vazio é recusado', () => {
    expect(validarPassoPonto('quando', { ...base, data: '' }, agora)).toMatch(/dia/i);
  });

  it('passo quando: horário que ainda não chegou é recusado (dia futuro e hoje mais tarde)', () => {
    expect(validarPassoPonto('quando', { ...base, data: '2026-11-14' }, agora)).toMatch(/ainda não chegou/);
    expect(validarPassoPonto('quando', { ...base, hora: '15:31' }, agora)).toMatch(/ainda não chegou/);
    expect(validarPassoPonto('quando', { ...base, hora: '15:30' }, agora)).toBeNull();
    expect(validarPassoPonto('quando', { ...base, data: '2026-11-12', hora: '23:59' }, agora)).toBeNull();
  });

  it('passo motivo: só espaços é recusado', () => {
    expect(validarPassoPonto('motivo', { ...base, motivo: '   ' }, agora)).toMatch(/motivo/i);
    expect(validarPassoPonto('motivo', base, agora)).toBeNull();
  });

  it('passo confirmar: revalida tudo e devolve o primeiro problema', () => {
    expect(validarPassoPonto('confirmar', { ...base, pessoa: '' }, agora)).toMatch(/pessoa/i);
    expect(validarPassoPonto('confirmar', base, agora)).toBeNull();
  });

  it('pontoParaApi monta o corpo da API com motivo aparado e devolve null se faltar algo', () => {
    expect(pontoParaApi({ ...base, motivo: '  Esqueceu  ' }, agora)).toEqual({
      usuario_id: base.pessoa,
      tipo: 'entrada',
      data: '2026-11-13',
      hora: '08:00',
      motivo: 'Esqueceu',
    });
    expect(pontoParaApi({ ...base, hora: '' }, agora)).toBeNull();
  });
});
