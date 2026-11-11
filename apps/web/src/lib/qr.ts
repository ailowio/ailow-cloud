import { encode } from 'uqr';

// RF-PRO-02: o QR de cada SKU leva só o código curto (P2). Gerado aqui, no aparelho, com a biblioteca `uqr`
// (zero dependências); nada sai da loja. Correção de erro M (15%), zona de silêncio de 4 módulos.

export const BORDA_QR = 4;

/** Módulos do QR (true = escuro). Lança se o texto for vazio. */
export function matrizQr(texto: string): boolean[][] {
  if (texto === '') throw new Error('texto do QR vazio');
  return encode(texto, { ecc: 'M', border: 0 }).data;
}

/**
 * Caminho SVG do QR: um retângulo por trecho contínuo de módulos escuros em cada linha, já deslocado pela zona de
 * silêncio. Desenhar o caminho (e não injetar HTML) mantém a tela livre de `dangerouslySetInnerHTML`.
 */
export function caminhoDoQr(matriz: boolean[][]): string {
  const partes: string[] = [];
  matriz.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (!linha[x]) {
        x += 1;
        continue;
      }
      let fim = x;
      while (fim < linha.length && linha[fim]) fim += 1;
      const largura = fim - x;
      partes.push(`M${x + BORDA_QR} ${y + BORDA_QR}h${largura}v1h-${largura}z`);
      x = fim;
    }
  });
  return partes.join('');
}
