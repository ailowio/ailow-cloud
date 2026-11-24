// Gera os ícones do PWA a partir da marca oficial (public/logo.svg, intocada), sem dependências:
//   node apps/web/scripts/gerar-icones.mjs
// Saída: public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png — o A ciano do logo
// (a cor do próprio SVG) centrado num quadrado cheio #111214, o mesmo fundo do manifest e do
// <meta name="theme-color"> (M01, plano aprimoramentos-voz-2026-11-23). Sem moldura nem cantos
// transparentes: Android e iOS recortam o formato sozinhos.
// Determinístico (mesma entrada = mesmos bytes). O resultado é commitado e conferido por
// src/pwa/icones-fundo.test.ts. O sharp não está no lockfile: o SVG é rasterizado aqui mesmo
// (os 5 paths usam só M/l/c/z; curvas achatadas em segmentos e preenchimento nonzero com
// antisserrilhado por sub-linhas).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const FUNDO = '#111214';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const logo = readFileSync(join(raiz, 'public', 'logo.svg'), 'utf8');
const caminhos = [...logo.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
if (caminhos.length !== 5) throw new Error(`a logo oficial tem 5 paths; achei ${caminhos.length}`);
const cores = new Set([...logo.matchAll(/<path\b[^>]*\bfill="(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase()));
if (cores.size !== 1) throw new Error(`esperava uma única cor nos paths do logo; achei ${[...cores].join(', ')}`);
const [CIANO] = cores;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Converte o atributo d em polígonos fechados (lista de [x, y]), achatando as cúbicas. */
function poligonos(d) {
  const tokens = d.match(/[MmLlHhVvCcZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const saida = [];
  let atual = [];
  let cmd = '';
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => Number(tokens[i++]);
  const fechar = () => {
    if (atual.length > 2) saida.push(atual);
    atual = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': {
        fechar();
        const nx = num();
        const ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        atual.push([x, y]);
        // Pares seguintes de um M são linhas.
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        const nx = num();
        const ny = num();
        x = rel ? x + nx : nx;
        y = rel ? y + ny : ny;
        atual.push([x, y]);
        break;
      }
      case 'H':
        x = rel ? x + num() : num();
        atual.push([x, y]);
        break;
      case 'V':
        y = rel ? y + num() : num();
        atual.push([x, y]);
        break;
      case 'C': {
        const v = [num(), num(), num(), num(), num(), num()];
        const [x1, y1, x2, y2, x3, y3] = rel ? v.map((n, k) => n + (k % 2 ? y : x)) : v;
        const PASSOS = 24;
        for (let s = 1; s <= PASSOS; s++) {
          const t = s / PASSOS;
          const u = 1 - t;
          atual.push([
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
          ]);
        }
        x = x3;
        y = y3;
        break;
      }
      case 'Z': {
        const inicio = atual[0];
        fechar();
        if (inicio) [x, y] = inicio;
        break;
      }
      default:
        throw new Error(`comando de path não suportado: ${cmd}`);
    }
  }
  fechar();
  return saida;
}

const formas = caminhos.map(poligonos);
const pontos = formas.flat(2);
const caixa = {
  x0: Math.min(...pontos.map((p) => p[0])),
  y0: Math.min(...pontos.map((p) => p[1])),
  x1: Math.max(...pontos.map((p) => p[0])),
  y1: Math.max(...pontos.map((p) => p[1])),
};

/** Cobertura (0..1) de cada pixel: o A ocupa `fracao` do lado (maior dimensão), centrado. */
function cobertura(lado, fracao) {
  const escala = (lado * fracao) / Math.max(caixa.x1 - caixa.x0, caixa.y1 - caixa.y0);
  const dx = (lado - (caixa.x1 - caixa.x0) * escala) / 2 - caixa.x0 * escala;
  const dy = (lado - (caixa.y1 - caixa.y0) * escala) / 2 - caixa.y0 * escala;
  // Arestas por forma (cada path é preenchido por si, nonzero; os paths se unem).
  const arestas = formas.map((polis) =>
    polis.flatMap((poli) =>
      poli.map((p, k) => {
        const q = poli[(k + 1) % poli.length];
        return [p[0] * escala + dx, p[1] * escala + dy, q[0] * escala + dx, q[1] * escala + dy];
      }),
    ),
  );
  const SUB = 16;
  const cob = new Float64Array(lado * lado);
  for (let py = 0; py < lado; py++) {
    for (let s = 0; s < SUB; s++) {
      const sy = py + (s + 0.5) / SUB;
      const vaos = [];
      for (const lista of arestas) {
        const cruzes = [];
        for (const [ax, ay, bx, by] of lista) {
          if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
            cruzes.push([ax + ((sy - ay) / (by - ay)) * (bx - ax), by > ay ? 1 : -1]);
          }
        }
        cruzes.sort((a, b) => a[0] - b[0]);
        let giro = 0;
        for (let k = 0; k < cruzes.length; k++) {
          const antes = giro;
          giro += cruzes[k][1];
          if (antes === 0 && giro !== 0) vaos.push([cruzes[k][0], null]);
          else if (antes !== 0 && giro === 0) vaos[vaos.length - 1][1] = cruzes[k][0];
        }
      }
      // União dos vãos de todos os paths.
      vaos.sort((a, b) => a[0] - b[0]);
      const unidos = [];
      for (const v of vaos) {
        const ult = unidos[unidos.length - 1];
        if (ult && v[0] <= ult[1]) ult[1] = Math.max(ult[1], v[1]);
        else unidos.push([v[0], v[1]]);
      }
      for (const [a0, b0] of unidos) {
        const a = Math.max(0, a0);
        const b = Math.min(lado, b0);
        for (let px = Math.floor(a); px < Math.ceil(b); px++) {
          const cobre = Math.min(b, px + 1) - Math.max(a, px);
          if (cobre > 0) cob[py * lado + px] += cobre / SUB;
        }
      }
    }
  }
  return cob;
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

/** PNG RGB opaco: cada pixel mistura fundo e ciano pela cobertura. */
function png(lado, fracao) {
  const cob = cobertura(lado, fracao);
  const f = rgb(FUNDO);
  const c = rgb(CIANO);
  const linhas = Buffer.alloc(lado * (1 + lado * 3));
  for (let y = 0; y < lado; y++) {
    const ini = y * (1 + lado * 3);
    linhas[ini] = 0; // filtro 0
    for (let x = 0; x < lado; x++) {
      const t = Math.min(1, cob[y * lado + x]);
      for (let k = 0; k < 3; k++) linhas[ini + 1 + x * 3 + k] = Math.round(f[k] + t * (c[k] - f[k]));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    bloco('IHDR', ihdr),
    bloco('IDAT', deflateSync(linhas, { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

// Fração do lado ocupada pelo A (maior dimensão). Maskable: 0,5 do lado deixa a caixa inteira do A
// dentro do círculo de 80% de diâmetro (zona segura); os demais seguem o ailow-index (0,66).
const icones = [
  ['icon-192.png', 192, 0.66],
  ['icon-512.png', 512, 0.66],
  ['icon-maskable-512.png', 512, 0.5],
  ['apple-touch-icon.png', 180, 0.66],
];
for (const [nome, lado, fracao] of icones) {
  writeFileSync(join(raiz, 'public', 'icons', nome), png(lado, fracao));
  console.log(`gerado ${nome} (${lado}x${lado}, fundo ${FUNDO}, A ${CIANO})`);
}
