import { describe, expect, it } from 'vitest';
import { BORDA_QR, caminhoDoQr, matrizQr } from './qr';

// RF-PRO-02: cada SKU tem um QR com o código curto (P2). Geração local, sem serviço externo.
describe('QR do código do SKU', () => {
  it('o código curto 0042-46-CHO cabe na versão 1 (21×21 módulos) com correção de erro M (P2 §modo alfanumérico)', () => {
    const m = matrizQr('0042-46-CHO');
    expect(m).toHaveLength(21);
    expect(m.every((linha) => linha.length === 21)).toBe(true);
  });

  it('é determinístico: o mesmo código dá sempre o mesmo desenho', () => {
    expect(matrizQr('0042-46-CHO')).toEqual(matrizQr('0042-46-CHO'));
  });

  it('códigos diferentes dão desenhos diferentes', () => {
    expect(matrizQr('0042-46-CHO')).not.toEqual(matrizQr('0042-46-PRE'));
  });

  it('o padrão de localização do canto superior esquerdo está lá (7 módulos escuros na 1ª linha)', () => {
    const m = matrizQr('0042-46-CHO');
    expect(m[0]?.slice(0, 7)).toEqual([true, true, true, true, true, true, true]);
    expect(m[0]?.[7]).toBe(false);
  });

  it('o caminho SVG junta os módulos escuros vizinhos da mesma linha e deixa a zona de silêncio de 4 módulos', () => {
    expect(BORDA_QR).toBe(4);
    const caminho = caminhoDoQr(matrizQr('0042-46-CHO'));
    // 1ª linha do desenho, deslocada pela borda: x = 4, y = 4, 7 módulos de largura.
    expect(caminho.startsWith('M4 4h7v1h-7z')).toBe(true);
    expect(caminho).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it('recusa texto vazio', () => {
    expect(() => matrizQr('')).toThrow();
  });
});
