import { ETIQUETAS_POR_FILEIRA } from '@ailow/shared';
import PDFDocument from 'pdfkit';
import { encode } from 'uqr';

// PDF das etiquetas (S08, RF-PRO-06, ADR 003). Bobina do Pedro: 33 × 22 mm em 3 colunas. Cada PÁGINA do PDF é uma
// FILEIRA da bobina (3 etiquetas lado a lado): é assim que o driver de uma térmica trata etiqueta multicoluna.
// O QR leva só o código do SKU (P2), vetorial, correção M e zona de silêncio de 4 módulos. Nada de custo aqui:
// `DadosEtiqueta` nem tem o campo (RF-PRO-07).

export interface DadosEtiqueta {
  codigo: string;
  nome: string;
  tamanho: string;
  cor: string;
  preco_centavos: number;
}

/** Medidas em milímetros. Espaço entre colunas e margem lateral dependem da bobina: calibrar na 1ª impressão. */
export interface Geometria {
  larguraMm: number;
  alturaMm: number;
  colunas: number;
  espacoEntreColunasMm: number;
  margemLateralMm: number;
  /** Lado do módulo do QR. 0,5 mm = 4 pontos de uma térmica de 203 dpi (o mais comum). */
  moduloMm: number;
  /** Folga dentro da etiqueta para o desvio de registro da impressora. */
  folgaMm: number;
}

export const GEOMETRIA_PADRAO: Geometria = {
  larguraMm: 33,
  alturaMm: 22,
  colunas: ETIQUETAS_POR_FILEIRA,
  espacoEntreColunasMm: 2,
  margemLateralMm: 1,
  moduloMm: 0.5,
  folgaMm: 0.5,
};

const PT_POR_MM = 72 / 25.4;
const pt = (mm: number) => mm * PT_POR_MM;
const BORDA_QR = 4;
const ENTRELINHA = 1.15;
const RETICENCIAS = '…';

// ------------------------------------------------------------------------------------------------ peças puras

/** RN-01: "R$ 1.299,90" só com aritmética inteira. */
export function precoDaEtiqueta(centavos: number): string {
  if (!Number.isInteger(centavos) || centavos < 0) throw new Error('preço deve ser inteiro em centavos, não negativo');
  const reais = String(Math.floor(centavos / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(centavos % 100).padStart(2, '0')}`;
}

/** Módulos do QR (true = escuro), correção M, sem borda. Lança se o texto for vazio. */
export function matrizQr(texto: string): boolean[][] {
  if (texto === '') throw new Error('texto do QR vazio');
  return encode(texto, { ecc: 'M', border: 0 }).data;
}

export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

export interface LayoutEtiqueta {
  /** Canto superior esquerdo do 1º módulo (já dentro da zona de silêncio). */
  qr: { x: number; y: number };
  nome: Caixa;
  tamanho: Caixa;
  cor: Caixa;
  preco: Caixa;
  codigo: Caixa;
}

/**
 * Onde cada coisa fica, em mm a partir do canto superior esquerdo da etiqueta: QR à esquerda (com a zona de
 * silêncio inteira dentro da etiqueta) e o código embaixo dele; à direita, nome (2 linhas), o TAMANHO em destaque
 * (é o que o vendedor procura na arara), a cor e, embaixo, o preço.
 */
export function layoutDaEtiqueta(g: Geometria): LayoutEtiqueta {
  const quieta = BORDA_QR * g.moduloMm;
  const ladoComBorda = (21 + 2 * BORDA_QR) * g.moduloMm;
  const fimQr = g.folgaMm + ladoComBorda;
  const xTexto = fimQr + 0.2;
  const larguraTexto = g.larguraMm - g.folgaMm - xTexto;
  const yPreco = fimQr + 0.4;
  const coluna = (y: number, altura: number): Caixa => ({ x: xTexto, y, largura: larguraTexto, altura });
  return {
    qr: { x: g.folgaMm + quieta, y: g.folgaMm + quieta },
    nome: coluna(g.folgaMm, 5),
    tamanho: coluna(g.folgaMm + 5, 4.3),
    cor: coluna(g.folgaMm + 9.3, yPreco - g.folgaMm - 9.3),
    preco: { x: xTexto, y: yPreco, largura: larguraTexto, altura: g.alturaMm - g.folgaMm - yPreco },
    codigo: { x: g.folgaMm, y: fimQr + 0.2, largura: ladoComBorda, altura: 2.8 },
  };
}

export interface AjusteTexto {
  largura: number;
  ptMax: number;
  ptMin: number;
  maxLinhas: number;
}

type Medir = (texto: string, corpo: number) => number;

// Quebra gulosa por palavra; palavra maior que a linha é partida por caractere (e `partiu` avisa).
function quebrar(texto: string, largura: number, corpo: number, medir: Medir): { linhas: string[]; partiu: boolean } {
  const linhas: string[] = [];
  let partiu = false;
  let atual = '';
  for (const palavra of texto.split(/\s+/).filter((p) => p !== '')) {
    const junto = atual === '' ? palavra : `${atual} ${palavra}`;
    if (medir(junto, corpo) <= largura) {
      atual = junto;
      continue;
    }
    if (atual !== '') linhas.push(atual);
    atual = '';
    let resto = palavra;
    while (medir(resto, corpo) > largura) {
      let n = resto.length - 1;
      while (n > 1 && medir(resto.slice(0, n), corpo) > largura) n -= 1;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
      partiu = true;
    }
    atual = resto;
  }
  if (atual !== '') linhas.push(atual);
  return { linhas, partiu };
}

/**
 * Cabe o texto na caixa: primeiro quebra em linhas, depois diminui o corpo (de 0,5 em 0,5 pt); só no corpo
 * mínimo parte palavra ou corta a última linha com reticências. A etiqueta tem 33 mm: o nome inteiro pode não
 * caber; o código do SKU e o QR é que identificam a peça.
 */
export function caberTexto(texto: string, a: AjusteTexto, medir: Medir): { pt: number; linhas: string[] } {
  for (let corpo = a.ptMax; corpo >= a.ptMin; corpo -= 0.5) {
    const { linhas, partiu } = quebrar(texto, a.largura, corpo, medir);
    const minimo = corpo - 0.5 < a.ptMin;
    if (linhas.length <= a.maxLinhas && (!partiu || minimo)) return { pt: corpo, linhas };
  }
  const { linhas } = quebrar(texto, a.largura, a.ptMin, medir);
  const ficam = linhas.slice(0, a.maxLinhas - 1);
  let ultima = linhas.slice(a.maxLinhas - 1).join(' ');
  while (ultima !== '' && medir(`${ultima}${RETICENCIAS}`, a.ptMin) > a.largura) ultima = ultima.slice(0, -1);
  return { pt: a.ptMin, linhas: [...ficam, `${ultima.replace(/[\s,.;:-]+$/, '')}${RETICENCIAS}`] };
}

// ------------------------------------------------------------------------------------------------ desenho

type Alinhar = 'esquerda' | 'centro' | 'direita';
type Fonte = 'Helvetica' | 'Helvetica-Bold';

interface Bloco {
  texto: string;
  caixa: Caixa;
  fonte: Fonte;
  ajuste: Omit<AjusteTexto, 'largura'>;
  alinhar: Alinhar;
  embaixo?: boolean;
}

function escrever(doc: PDFKit.PDFDocument, x0: number, b: Bloco): void {
  const medir: Medir = (t, corpo) => doc.font(b.fonte).fontSize(corpo).widthOfString(t);
  const largura = pt(b.caixa.largura);
  const { pt: corpo, linhas } = caberTexto(b.texto, { ...b.ajuste, largura }, medir);
  const passo = corpo * ENTRELINHA;
  const topo = b.embaixo ? pt(b.caixa.y + b.caixa.altura) - passo * linhas.length : pt(b.caixa.y);
  doc.font(b.fonte).fontSize(corpo).fillColor('black');
  linhas.forEach((linha, i) => {
    const w = doc.widthOfString(linha);
    const sobra = largura - w;
    const dx = b.alinhar === 'direita' ? sobra : b.alinhar === 'centro' ? sobra / 2 : 0;
    // lineBreak: false = sem quebra automática nem página nova: a posição é toda calculada aqui.
    doc.text(linha, x0 + pt(b.caixa.x) + dx, topo + i * passo, { lineBreak: false });
  });
}

function desenharQr(doc: PDFKit.PDFDocument, x: number, y: number, modulo: number, matriz: boolean[][]): void {
  // Um retângulo por trecho contínuo de módulos escuros em cada linha; um único preenchimento no fim.
  matriz.forEach((linha, iy) => {
    let ix = 0;
    while (ix < linha.length) {
      if (!linha[ix]) {
        ix += 1;
        continue;
      }
      let fim = ix;
      while (fim < linha.length && linha[fim]) fim += 1;
      doc.rect(x + ix * modulo, y + iy * modulo, (fim - ix) * modulo, modulo);
      ix = fim;
    }
  });
  doc.fill('black');
}

function desenharEtiqueta(doc: PDFKit.PDFDocument, x0: number, e: DadosEtiqueta, g: Geometria): void {
  const l = layoutDaEtiqueta(g);
  desenharQr(doc, x0 + pt(l.qr.x), pt(l.qr.y), pt(g.moduloMm), matrizQr(e.codigo));
  const blocos: Bloco[] = [
    { texto: e.nome, caixa: l.nome, fonte: 'Helvetica', ajuste: { ptMax: 6, ptMin: 5, maxLinhas: 2 }, alinhar: 'esquerda' },
    { texto: e.tamanho, caixa: l.tamanho, fonte: 'Helvetica-Bold', ajuste: { ptMax: 10, ptMin: 10, maxLinhas: 1 }, alinhar: 'esquerda' },
    { texto: e.cor, caixa: l.cor, fonte: 'Helvetica-Bold', ajuste: { ptMax: 7, ptMin: 5.5, maxLinhas: 2 }, alinhar: 'esquerda' },
    {
      texto: precoDaEtiqueta(e.preco_centavos),
      caixa: l.preco,
      fonte: 'Helvetica-Bold',
      ajuste: { ptMax: 11, ptMin: 6, maxLinhas: 1 },
      alinhar: 'direita',
      embaixo: true,
    },
    { texto: e.codigo, caixa: l.codigo, fonte: 'Helvetica', ajuste: { ptMax: 6.5, ptMin: 5, maxLinhas: 1 }, alinhar: 'centro' },
  ];
  for (const b of blocos) escrever(doc, x0, b);
}

/** Gera o PDF: uma página por fileira; a última fileira pode ter colunas em branco. */
export async function gerarPdfEtiquetas(etiquetas: DadosEtiqueta[], g: Geometria = GEOMETRIA_PADRAO): Promise<Buffer> {
  if (etiquetas.length === 0) throw new Error('nenhuma etiqueta para gerar');
  const tamanho: [number, number] = [
    pt(2 * g.margemLateralMm + g.colunas * g.larguraMm + (g.colunas - 1) * g.espacoEntreColunasMm),
    pt(g.alturaMm),
  ];
  const doc = new PDFDocument({
    size: tamanho,
    margin: 0,
    autoFirstPage: false,
    info: { Title: 'Etiquetas', Creator: 'Ailow Cloud', Producer: 'Ailow Cloud' },
  });
  const partes: Buffer[] = [];
  doc.on('data', (b: Buffer) => partes.push(b));
  const terminou = new Promise<void>((resolve, reject) => {
    doc.on('end', () => resolve());
    doc.on('error', reject);
  });
  etiquetas.forEach((e, i) => {
    const coluna = i % g.colunas;
    if (coluna === 0) doc.addPage({ size: tamanho, margin: 0 });
    desenharEtiqueta(doc, pt(g.margemLateralMm + coluna * (g.larguraMm + g.espacoEntreColunasMm)), e, g);
  });
  doc.end();
  await terminou;
  return Buffer.concat(partes);
}
