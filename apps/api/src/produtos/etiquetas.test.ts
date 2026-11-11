import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import {
  type DadosEtiqueta,
  GEOMETRIA_PADRAO,
  caberTexto,
  gerarPdfEtiquetas,
  layoutDaEtiqueta,
  matrizQr,
  precoDaEtiqueta,
} from './etiquetas.js';

// S08 / RF-PRO-06, ADR 003. O PDF é lido por um leitor INDEPENDENTE (pdfjs-dist, o motor do Firefox), não pelo
// pdfkit que o gerou. Bobina do Pedro: 33 × 22 mm em 3 colunas; cada página do PDF é uma fileira.
const MM = 72 / 25.4;
const PONTO_TERMICO_MM = 25.4 / 203; // 1 ponto de uma térmica de 203 dpi

const etiqueta = (n: number, extra: Partial<DadosEtiqueta> = {}): DadosEtiqueta => ({
  codigo: `00${String(n).padStart(2, '0')}-46-CHO`,
  nome: 'Sutiã Renda Açaí',
  tamanho: '46',
  cor: 'Chocolate',
  preco_centavos: 8990,
  ...extra,
});

interface Texto {
  str: string;
  x: number;
  y: number;
  largura: number;
}
interface Pagina {
  largura: number;
  altura: number;
  textos: Texto[];
}

async function lerPdf(pdf: Buffer): Promise<Pagina[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const paginas: Pagina[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const p = await doc.getPage(i);
    const [, , largura, altura] = p.view as [number, number, number, number];
    const conteudo = await p.getTextContent();
    const textos = conteudo.items
      .filter((it) => 'str' in it && it.str.trim() !== '')
      .map((it) => {
        const t = it as { str: string; transform: number[]; width: number };
        return { str: t.str, x: t.transform[4] as number, y: t.transform[5] as number, largura: t.width };
      });
    paginas.push({ largura, altura, textos });
  }
  return paginas;
}

const textoDa = (p: Pagina) => p.textos.map((t) => t.str).join(' ');

describe('preço na etiqueta (RN-01: só aritmética inteira)', () => {
  it.each([
    [8990, 'R$ 89,90'],
    [5, 'R$ 0,05'],
    [100, 'R$ 1,00'],
    [129990, 'R$ 1.299,90'],
    [123456789, 'R$ 1.234.567,89'],
  ])('%i centavos -> %s', (centavos, texto) => {
    expect(precoDaEtiqueta(centavos)).toBe(texto);
  });

  it('recusa valor fracionário ou negativo', () => {
    expect(() => precoDaEtiqueta(10.5)).toThrow();
    expect(() => precoDaEtiqueta(-1)).toThrow();
  });
});

describe('QR do SKU (P2: só o código, correção M)', () => {
  it('o maior código possível (PPPP-TTT-CCC) cabe na versão 1, 21 × 21 módulos', () => {
    expect(matrizQr('9999-GGG-VE2')).toHaveLength(21);
    expect(matrizQr('0042-46-CHO')).toHaveLength(21);
  });

  it('recusa texto vazio', () => {
    expect(() => matrizQr('')).toThrow();
  });

  it('usa a correção de erro M (15%), não a L do padrão de outras bibliotecas', () => {
    expect(matrizQr('0042-46-CHO')).toEqual(encode('0042-46-CHO', { ecc: 'M', border: 0 }).data);
    expect(matrizQr('0042-46-CHO')).not.toEqual(encode('0042-46-CHO', { ecc: 'L', border: 0 }).data);
  });
});

describe('geometria da etiqueta 33 × 22 mm', () => {
  const g = GEOMETRIA_PADRAO;
  const l = layoutDaEtiqueta(g);

  it('o módulo do QR é um número inteiro de pontos de uma térmica de 203 dpi', () => {
    const pontos = g.moduloMm / PONTO_TERMICO_MM;
    expect(Math.abs(pontos - Math.round(pontos))).toBeLessThan(0.02);
  });

  it('o QR tem zona de silêncio de 4 módulos e fica dentro da etiqueta com folga', () => {
    expect(l.qr.x - 4 * g.moduloMm).toBeGreaterThanOrEqual(g.folgaMm);
    expect(l.qr.y - 4 * g.moduloMm).toBeGreaterThanOrEqual(g.folgaMm);
    expect(l.qr.x + 21 * g.moduloMm + 4 * g.moduloMm).toBeLessThanOrEqual(g.larguraMm - g.folgaMm);
  });

  it('as caixas de texto da coluna da direita não se sobrepõem (nome, tamanho, cor, preço)', () => {
    const coluna = [l.nome, l.tamanho, l.cor, l.preco];
    for (let i = 1; i < coluna.length; i += 1) {
      const antes = coluna[i - 1] as { y: number; altura: number };
      expect((coluna[i] as { y: number }).y).toBeGreaterThanOrEqual(antes.y + antes.altura - 1e-9);
    }
  });

  it('nenhuma caixa de texto invade a zona de silêncio do QR nem sai da etiqueta', () => {
    const fimQr = { x: l.qr.x + 25 * g.moduloMm, y: l.qr.y + 25 * g.moduloMm };
    for (const caixa of [l.nome, l.tamanho, l.cor, l.preco, l.codigo]) {
      expect(caixa.x).toBeGreaterThanOrEqual(g.folgaMm);
      expect(caixa.y).toBeGreaterThanOrEqual(g.folgaMm);
      expect(caixa.x + caixa.largura).toBeLessThanOrEqual(g.larguraMm - g.folgaMm + 1e-9);
      expect(caixa.y + caixa.altura).toBeLessThanOrEqual(g.alturaMm - g.folgaMm + 1e-9);
      const sobrepoeQr = caixa.x < fimQr.x && caixa.y < fimQr.y;
      expect(sobrepoeQr).toBe(false);
    }
  });
});

describe('ajuste do texto à caixa', () => {
  // Medida simples e previsível: cada caractere tem 0,5 × o corpo da fonte.
  const medir = (t: string, pt: number) => t.length * pt * 0.5;

  it('texto que cabe fica inteiro, numa linha, no corpo máximo', () => {
    expect(caberTexto('Sutiã', { largura: 100, ptMax: 8, ptMin: 5, maxLinhas: 2 }, medir)).toEqual({
      pt: 8,
      linhas: ['Sutiã'],
    });
  });

  it('quebra nas palavras antes de diminuir a fonte', () => {
    // 'Calcinha Renda' = 14 caracteres × 4 = 56 > 40; cada palavra cabe numa linha no corpo 8.
    expect(caberTexto('Calcinha Renda', { largura: 40, ptMax: 8, ptMin: 5, maxLinhas: 2 }, medir)).toEqual({
      pt: 8,
      linhas: ['Calcinha', 'Renda'],
    });
  });

  it('diminui a fonte quando as linhas não bastam', () => {
    // No corpo 8 dá 3 linhas (Calcinha / Renda Fio / Dental); no 5,5 cabe em 2.
    const r = caberTexto('Calcinha Renda Fio Dental', { largura: 40, ptMax: 8, ptMin: 5, maxLinhas: 2 }, medir);
    expect(r.pt).toBeLessThan(8);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas.join(' ')).toBe('Calcinha Renda Fio Dental');
  });

  it('no corpo mínimo, corta a última linha com reticências e nunca passa da largura', () => {
    const caixa = { largura: 30, ptMax: 6, ptMin: 5, maxLinhas: 2 };
    const r = caberTexto('Tomara que caia Essência com renda francesa e bojo removível', caixa, medir);
    expect(r.pt).toBe(5);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas[1]?.endsWith('…')).toBe(true);
    for (const linha of r.linhas) expect(medir(linha, r.pt)).toBeLessThanOrEqual(caixa.largura);
  });

  it('diminui a fonte antes de partir uma palavra', () => {
    // 'Chocolate' no corpo 8 = 36 > 30; no 6,5 = 29,25: inteira, numa linha.
    expect(caberTexto('Chocolate', { largura: 30, ptMax: 8, ptMin: 5, maxLinhas: 2 }, medir)).toEqual({
      pt: 6.5,
      linhas: ['Chocolate'],
    });
  });

  it('palavra maior que a linha no corpo mínimo é partida (não estoura a etiqueta)', () => {
    const caixa = { largura: 20, ptMax: 5, ptMin: 5, maxLinhas: 3 };
    const r = caberTexto('Supercalifragilístico', caixa, medir);
    for (const linha of r.linhas) expect(medir(linha, r.pt)).toBeLessThanOrEqual(caixa.largura);
    expect(r.linhas.join('').replace('…', '').length).toBeGreaterThan(0);
  });
});

describe('PDF das etiquetas (RF-PRO-06)', () => {
  const g = GEOMETRIA_PADRAO;
  const larguraFileiraMm = 2 * g.margemLateralMm + 3 * g.larguraMm + 2 * g.espacoEntreColunasMm;

  it('recusa gerar um PDF sem etiquetas', async () => {
    await expect(gerarPdfEtiquetas([])).rejects.toThrow();
  });

  it('cada página é uma fileira da bobina: 4 etiquetas viram 2 páginas do tamanho exato da fileira', async () => {
    const pdf = await gerarPdfEtiquetas([1, 2, 3, 4].map((n) => etiqueta(n)));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const paginas = await lerPdf(pdf);
    expect(paginas).toHaveLength(2);
    for (const p of paginas) {
      expect(p.largura).toBeCloseTo(larguraFileiraMm * MM, 1);
      expect(p.altura).toBeCloseTo(g.alturaMm * MM, 1);
    }
  });

  it('traz o texto legível: código, nome com acento, tamanho, cor e preço', async () => {
    const [p] = await lerPdf(await gerarPdfEtiquetas([etiqueta(42)]));
    const texto = textoDa(p as Pagina);
    for (const esperado of ['0042-46-CHO', 'Sutiã Renda Açaí', '46', 'Chocolate', 'R$ 89,90']) {
      expect(texto).toContain(esperado);
    }
  });

  it('preenche as colunas da esquerda para a direita, na ordem pedida', async () => {
    const paginas = await lerPdf(await gerarPdfEtiquetas([1, 2, 3, 4].map((n) => etiqueta(n))));
    const xDoCodigo = (p: Pagina, codigo: string) => p.textos.find((t) => t.str.includes(codigo))?.x ?? NaN;
    const [p1, p2] = paginas as [Pagina, Pagina];
    const coluna = (x: number) => Math.floor((x / MM - g.margemLateralMm) / (g.larguraMm + g.espacoEntreColunasMm));
    expect(coluna(xDoCodigo(p1, '0001-46-CHO'))).toBe(0);
    expect(coluna(xDoCodigo(p1, '0002-46-CHO'))).toBe(1);
    expect(coluna(xDoCodigo(p1, '0003-46-CHO'))).toBe(2);
    expect(coluna(xDoCodigo(p2, '0004-46-CHO'))).toBe(0);
    expect(p2.textos.filter((t) => t.str.includes('-46-CHO'))).toHaveLength(1);
  });

  it('nome de 80 caracteres não cria página extra e nenhum texto sai da sua etiqueta', async () => {
    const nome = 'Tomara que caia Essência com renda francesa, bojo removível e alça de silicone';
    const pdf = await gerarPdfEtiquetas([etiqueta(1, { nome, cor: 'Vermelho Bordô Escuro', preco_centavos: 129990 })]);
    const paginas = await lerPdf(pdf);
    expect(paginas).toHaveLength(1);
    const p = paginas[0] as Pagina;
    const inicio = g.margemLateralMm * MM;
    const fim = (g.margemLateralMm + g.larguraMm) * MM;
    for (const t of p.textos) {
      expect(t.x).toBeGreaterThanOrEqual(inicio - 0.01);
      expect(t.x + t.largura).toBeLessThanOrEqual(fim + 0.01);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThan(p.altura);
    }
    expect(textoDa(p)).toContain('R$ 1.299,90');
    expect(textoDa(p)).toContain('…');
  });
});
