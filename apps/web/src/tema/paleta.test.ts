import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contraste, hexNormalizado, lerCor, saturacaoHsl } from './contraste';
import { temaAilow } from './tema';

// UXM-08: a paleta nasce da cor do "A" da logo. Tudo é lido dos arquivos reais (logo.svg, tema.css, tema.ts):
// nenhuma cor é repetida à mão aqui (L-0017). A prova no navegador está em e2e/paleta.e2e.ts.
const aqui = (arquivo: string) => readFileSync(new URL(arquivo, import.meta.url), 'utf8');
const css = aqui('./tema.css');
const logo = aqui('../../public/logo.svg');

function tokens(esquema: 'light' | 'dark'): Record<string, string> {
  const bloco = new RegExp(`:root\\[data-mantine-color-scheme='${esquema}'\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!bloco) throw new Error(`bloco ${esquema} ausente em tema.css`);
  const comum = /(?:^|\n):root\s*\{([^}]*)\}/.exec(css);
  const mapa: Record<string, string> = {};
  // `:root { … }` vale para os dois temas; o bloco do tema vem depois e prevalece (como na cascata).
  for (const texto of [comum?.[1] ?? '', bloco[1] as string]) {
    for (const m of texto.matchAll(/(--[\w-]+):\s*([^;]+);/g)) mapa[m[1] as string] = (m[2] as string).trim();
  }
  return mapa;
}

const corDoA = /fill="(#[0-9a-fA-F]{6})"/.exec(logo)?.[1] as string;

describe('paleta única derivada do A da logo (UXM-08)', () => {
  it('a logo tem uma cor de preenchimento legível', () => {
    expect(corDoA).toMatch(/^#[0-9a-f]{6}$/i);
  });

  for (const esquema of ['light', 'dark'] as const) {
    describe(`tema ${esquema}`, () => {
      const t = tokens(esquema);

      it('--ailow-marca é exatamente a cor do A da logo', () => {
        expect(hexNormalizado(t['--ailow-marca'] as string)).toBe(hexNormalizado(corDoA));
      });

      it('a escala `marca` do tema tem a cor da logo no tom 5', () => {
        expect(hexNormalizado(temaAilow.colors?.marca?.[5] as string)).toBe(hexNormalizado(corDoA));
      });

      const pares: [string, string, number][] = [
        ['--ailow-texto', '--mantine-color-body', 4.5],
        ['--ailow-texto', '--ailow-superficie', 4.5],
        ['--ailow-texto', '--ailow-superficie-2', 4.5],
        ['--ailow-apagado', '--mantine-color-body', 4.5],
        ['--ailow-apagado', '--ailow-superficie', 4.5],
        ['--ailow-marca-texto', '--mantine-color-body', 4.5],
        ['--ailow-marca-texto', '--ailow-superficie', 4.5],
        ['--ailow-secundario-texto', '--mantine-color-body', 4.5],
        ['--ailow-secundario-texto', '--ailow-superficie', 4.5],
        ['--ailow-sobre-acao', '--ailow-acao', 4.5],
        ['--ailow-acao', '--mantine-color-body', 3],
        ['--ailow-acao', '--ailow-superficie', 3],
      ];
      for (const [a, b, minimo] of pares) {
        it(`${a} sobre ${b} >= ${minimo}:1`, () => {
          const razao = contraste(t[a] as string, t[b] as string);
          expect(razao, `${a} ${t[a]} sobre ${b} ${t[b]} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo);
        });
      }
    });
  }

  it('tema escuro é cinza chumbo: fundo e superfícies com saturação HSL <= 15% (e não preto puro)', () => {
    const t = tokens('dark');
    for (const nome of ['--mantine-color-body', '--ailow-superficie', '--ailow-superficie-2', '--ailow-borda', '--ailow-topo']) {
      expect(saturacaoHsl(t[nome] as string), `${nome} ${t[nome]}`).toBeLessThanOrEqual(15);
      expect(Math.max(...lerCor(t[nome] as string)), `${nome} não pode ser preto puro`).toBeGreaterThan(16);
    }
  });

  it('o azul antigo (#2448FF) é só a cor secundária: nunca é a primária nem o fundo', () => {
    expect(temaAilow.primaryColor).toBe('marca');
    for (const esquema of ['light', 'dark'] as const) {
      expect(hexNormalizado(tokens(esquema)['--ailow-secundario'] as string)).toBe('#2448ff');
    }
  });
});
