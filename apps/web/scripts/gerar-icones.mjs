// Gera os ícones do PWA (PNG) sem dependências: `node apps/web/scripts/gerar-icones.mjs`.
// Desenho: quadrado arredondado azul Ailow (#2448FF) com um "A" branco e um ponto laranja (#FF7043).
// O ícone "maskable" ocupa a área inteira e mantém o desenho na zona segura central (80%).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const saida = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(saida, { recursive: true });

const AZUL = [0x24, 0x48, 0xff];
const AZUL_ESCURO = [0x1b, 0x37, 0xd6];
const BRANCO = [0xff, 0xff, 0xff];
const LARANJA = [0xff, 0x70, 0x43];

// Distância de (px,py) ao segmento (ax,ay)-(bx,by).
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Dentro de um quadrado arredondado de lado 1 com raio r.
function dentroArredondado(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function cor(x, y, { arredondado, escala }) {
  if (arredondado && !dentroArredondado(x, y, 0.22)) return null; // transparente
  // Gradiente diagonal leve para dar volume.
  const g = (x + y) / 2;
  let c = AZUL.map((v, i) => Math.round(v + (AZUL_ESCURO[i] - v) * g));
  // Coordenadas do desenho (encolhido para a zona segura no maskable).
  const u = (x - 0.5) / escala + 0.5;
  const v = (y - 0.5) / escala + 0.5;
  const traco = 0.062;
  const perna =
    distSegmento(u, v, 0.5, 0.2, 0.28, 0.78) <= traco ||
    distSegmento(u, v, 0.5, 0.2, 0.72, 0.78) <= traco ||
    distSegmento(u, v, 0.36, 0.6, 0.64, 0.6) <= traco * 0.85;
  if (perna) c = BRANCO;
  if (Math.hypot(u - 0.79, v - 0.25) <= 0.065) c = LARANJA;
  return c;
}

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

function png(tamanho, opcoes) {
  const SS = 3; // supersampling 3x3 para bordas suaves
  const linhas = [];
  for (let py = 0; py < tamanho; py++) {
    const linha = Buffer.alloc(1 + tamanho * 4); // filtro 0 + RGBA
    for (let px = 0; px < tamanho; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = cor((px + (sx + 0.5) / SS) / tamanho, (py + (sy + 0.5) / SS) / tamanho, opcoes);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 1;
          }
        }
      }
      const o = 1 + px * 4;
      if (a > 0) {
        linha[o] = Math.round(r / a);
        linha[o + 1] = Math.round(g / a);
        linha[o + 2] = Math.round(b / a);
      }
      linha[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
    linhas.push(linha);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

const icones = [
  ['icon-192.png', 192, { arredondado: true, escala: 1 }],
  ['icon-512.png', 512, { arredondado: true, escala: 1 }],
  ['icon-maskable-512.png', 512, { arredondado: false, escala: 0.78 }],
  ['apple-touch-icon.png', 180, { arredondado: false, escala: 0.9 }],
];
for (const [nome, tamanho, opcoes] of icones) {
  writeFileSync(join(saida, nome), png(tamanho, opcoes));
  console.log(`gerado ${nome} (${tamanho}x${tamanho})`);
}
