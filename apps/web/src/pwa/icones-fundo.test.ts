import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// M01 (plano aprimoramentos-voz-2026-11-23): ícone e abertura do PWA num fundo único #111214,
// sem moldura de outra cor, com o A ciano (#07BDD5) do logo.svg centrado e inteiro.
const FUNDO = '#111214';
const CIANO = '#07bdd5';

const publico = (nome: string) => new URL(`../../public/${nome}`, import.meta.url);

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const hex = ([r, g, b]: number[]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

interface Imagem {
  largura: number;
  altura: number;
  /** RGBA, 4 bytes por pixel. */
  px: Uint8Array;
}

/** Decodifica PNG 8 bits RGB/RGBA não entrelaçado (o que os ícones usam), só com zlib do Node. */
function decodificarPng(buf: Buffer): Imagem {
  expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let pos = 8;
  let largura = 0;
  let altura = 0;
  let tipoCor = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos);
    const tipo = buf.toString('ascii', pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + tam);
    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      expect(dados[8], 'profundidade de bits').toBe(8);
      tipoCor = dados[9] ?? 0;
      expect([2, 6], 'tipo de cor (RGB ou RGBA)').toContain(tipoCor);
      expect(dados[12], 'entrelaçamento').toBe(0);
    } else if (tipo === 'IDAT') idat.push(dados);
    else if (tipo === 'IEND') break;
    pos += 12 + tam;
  }
  const canais = tipoCor === 6 ? 4 : 3;
  const bruto = inflateSync(Buffer.concat(idat));
  const passo = largura * canais;
  const linhas = new Uint8Array(altura * passo);
  for (let y = 0; y < altura; y++) {
    const filtro = bruto[y * (passo + 1)];
    const ini = y * (passo + 1) + 1;
    for (let i = 0; i < passo; i++) {
      const x = bruto[ini + i] ?? 0;
      const a = i >= canais ? (linhas[y * passo + i - canais] ?? 0) : 0;
      const b = y > 0 ? (linhas[(y - 1) * passo + i] ?? 0) : 0;
      const c = y > 0 && i >= canais ? (linhas[(y - 1) * passo + i - canais] ?? 0) : 0;
      let v: number;
      if (filtro === 0) v = x;
      else if (filtro === 1) v = x + a;
      else if (filtro === 2) v = x + b;
      else if (filtro === 3) v = x + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      linhas[y * passo + i] = v & 0xff;
    }
  }
  const px = new Uint8Array(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) {
    px[i * 4] = linhas[i * canais] ?? 0;
    px[i * 4 + 1] = linhas[i * canais + 1] ?? 0;
    px[i * 4 + 2] = linhas[i * canais + 2] ?? 0;
    px[i * 4 + 3] = canais === 4 ? (linhas[i * canais + 3] ?? 0) : 255;
  }
  return { largura, altura, px };
}

const pixel = (img: Imagem, x: number, y: number) => {
  const o = (y * img.largura + x) * 4;
  return { cor: hex([img.px[o] ?? 0, img.px[o + 1] ?? 0, img.px[o + 2] ?? 0]), alfa: img.px[o + 3] ?? 0 };
};

/** Fração de ciano do pixel (0 = fundo, 1 = A), ou null se a cor não for uma mistura fundo↔ciano. */
function fracaoCiano(img: Imagem, x: number, y: number): number | null {
  const o = (y * img.largura + x) * 4;
  const f = rgb(FUNDO);
  const c = rgb(CIANO);
  const t = ((img.px[o + 2] ?? 0) - f[2]) / (c[2] - f[2]);
  for (let k = 0; k < 3; k++) {
    const esperado = f[k] + t * (c[k] - f[k]);
    if (Math.abs((img.px[o + k] ?? 0) - esperado) > 3) return null;
  }
  return Math.min(1, Math.max(0, t));
}

const ICONES: Array<[arquivo: string, lado: number]> = [
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
  ['icons/icon-maskable-512.png', 512],
  ['icons/apple-touch-icon.png', 180],
];

describe(`ícones do PWA no fundo único ${FUNDO} (M01)`, () => {
  for (const [arquivo, lado] of ICONES) {
    describe(arquivo, () => {
      const img = decodificarPng(readFileSync(publico(arquivo)));

      it(`tem ${lado}x${lado} px e o pixel (0,0) é ${FUNDO} opaco`, () => {
        expect([img.largura, img.altura]).toEqual([lado, lado]);
        expect(pixel(img, 0, 0)).toEqual({ cor: FUNDO, alfa: 255 });
      });

      it(`a borda inteira (4 lados, inclusive o centro de cada lado) é ${FUNDO} opaco: sem moldura de outra cor`, () => {
        const meio = Math.floor(lado / 2);
        for (const [x, y] of [[meio, 0], [meio, lado - 1], [0, meio], [lado - 1, meio]] as const) {
          expect(pixel(img, x, y), `centro-borda (${x},${y})`).toEqual({ cor: FUNDO, alfa: 255 });
        }
        const fora: string[] = [];
        for (let i = 0; i < lado; i++) {
          for (const [x, y] of [[i, 0], [i, lado - 1], [0, i], [lado - 1, i]] as const) {
            const p = pixel(img, x, y);
            if (p.cor !== FUNDO || p.alfa !== 255) fora.push(`(${x},${y})=${p.cor}/${p.alfa}`);
          }
        }
        expect(fora.slice(0, 5), `${fora.length} pixels de borda fora do fundo`).toEqual([]);
      });

      it('só tem fundo e o A ciano (cada pixel é mistura fundo↔ciano), com o A centrado e inteiro', () => {
        let outros = 0;
        let cheios = 0;
        let [x0, y0, x1, y1] = [lado, lado, -1, -1];
        for (let y = 0; y < lado; y++) {
          for (let x = 0; x < lado; x++) {
            const t = fracaoCiano(img, x, y);
            if (t === null) {
              outros++;
              continue;
            }
            if (t > 0.98) cheios++;
            if (t > 0.5) {
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
          }
        }
        expect(outros, 'pixels de outra cor').toBe(0);
        expect(cheios / (lado * lado), 'área do A em ciano puro').toBeGreaterThan(0.05);
        // Inteiro: não encosta na borda. Centrado: centro da caixa do A a ≤ 2% do lado do centro da imagem.
        expect(x0).toBeGreaterThan(0);
        expect(y0).toBeGreaterThan(0);
        expect(x1).toBeLessThan(lado - 1);
        expect(y1).toBeLessThan(lado - 1);
        expect(Math.abs((x0 + x1) / 2 - (lado - 1) / 2)).toBeLessThanOrEqual(lado * 0.02);
        expect(Math.abs((y0 + y1) / 2 - (lado - 1) / 2)).toBeLessThanOrEqual(lado * 0.02);
      });
    });
  }

  it('maskable: todo o A fica dentro da zona segura (círculo de 80% de diâmetro, centrado)', () => {
    const img = decodificarPng(readFileSync(publico('icons/icon-maskable-512.png')));
    const raio = 0.4 * img.largura;
    const centro = img.largura / 2;
    let fora = 0;
    for (let y = 0; y < img.altura; y++) {
      for (let x = 0; x < img.largura; x++) {
        const t = fracaoCiano(img, x, y);
        if (t !== null && t > 0 && Math.hypot(x + 0.5 - centro, y + 0.5 - centro) > raio) fora++;
      }
    }
    expect(fora, 'pixels do A fora da zona segura').toBe(0);
  });

  it(`manifest (background_color e theme_color) e <meta name="theme-color"> usam ${FUNDO}`, () => {
    const manifest = JSON.parse(readFileSync(publico('manifest.webmanifest'), 'utf8')) as {
      background_color: string;
      theme_color: string;
    };
    expect(manifest.background_color.toLowerCase()).toBe(FUNDO);
    expect(manifest.theme_color.toLowerCase()).toBe(FUNDO);
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    const meta = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/);
    expect(meta?.[1]?.toLowerCase()).toBe(FUNDO);
  });
});
