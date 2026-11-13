import { expect, test, type Page } from '@playwright/test';
import { contraste, hexNormalizado, saturacaoHsl } from '../src/tema/contraste';
import { abrirInicio, entrarComoDono } from './apoio';

// UXM-08 e UXM-11 em navegador real (360×640): tokens COMPUTADOS, cor do A lida de /logo.svg servido pelo app,
// razões de contraste e saturação calculadas em código, e overflow horizontal medido nos dois temas (L-0015, L-0017).
// 1 login só (limite de 10/min por IP).
const TEMAS = ['light', 'dark'] as const;

async function usarTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

async function semOverflowHorizontal(page: Page, tela: string, tema: string) {
  const m = await page.evaluate(() => {
    const e = document.documentElement;
    return { sw: e.scrollWidth, cw: e.clientWidth, bw: document.body.scrollWidth };
  });
  expect(m.sw, `${tela}/${tema}: scrollWidth ${m.sw} > clientWidth ${m.cw}`).toBeLessThanOrEqual(m.cw);
  expect(m.bw, `${tela}/${tema}: body.scrollWidth ${m.bw} > ${m.cw}`).toBeLessThanOrEqual(m.cw);
}

test('UXM-08: marca = cor do A da logo; dark em cinza chumbo; contraste AA; sem overflow a 360 px', async ({ page }) => {
  const svg = await (await page.request.get('/logo.svg')).text();
  const corDoA = hexNormalizado(/fill="(#[0-9a-fA-F]{6})"/.exec(svg)?.[1] as string);

  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const lerTokens = () =>
    page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const g = (n: string) => cs.getPropertyValue(n).trim();
      return {
        marca: g('--ailow-marca'),
        acao: g('--ailow-acao'),
        sobreAcao: g('--ailow-sobre-acao'),
        marcaTexto: g('--ailow-marca-texto'),
        secundario: g('--ailow-secundario'),
        secundarioTexto: g('--ailow-secundario-texto'),
        fundo: g('--mantine-color-body'),
        superficie: g('--ailow-superficie'),
        superficie2: g('--ailow-superficie-2'),
        textoCalculado: getComputedStyle(document.body).color,
        apagado: g('--mantine-color-dimmed'),
      };
    });

  for (const tema of TEMAS) {
    await usarTema(page, tema);
    const t = await lerTokens();
    expect(hexNormalizado(t.marca), `${tema}: --ailow-marca`).toBe(corDoA);
    expect(hexNormalizado(t.secundario), `${tema}: secundário`).toBe('#2448ff');
    if (tema === 'dark') {
      for (const [nome, valor] of Object.entries({ fundo: t.fundo, superficie: t.superficie, superficie2: t.superficie2 })) {
        expect(saturacaoHsl(valor), `dark ${nome} ${valor}: saturação HSL`).toBeLessThanOrEqual(15);
      }
    }
    const pares: [string, string, string, number][] = [
      ['texto/fundo', t.textoCalculado, t.fundo, 4.5],
      ['texto/superfície', t.textoCalculado, t.superficie, 4.5],
      ['apagado/fundo', t.apagado, t.fundo, 4.5],
      ['apagado/superfície', t.apagado, t.superficie, 4.5],
      ['marca-texto/fundo', t.marcaTexto, t.fundo, 4.5],
      ['marca-texto/superfície', t.marcaTexto, t.superficie, 4.5],
      ['secundário-texto/fundo', t.secundarioTexto, t.fundo, 4.5],
      ['sobre-ação/ação', t.sobreAcao, t.acao, 4.5],
      ['ação/fundo (componente)', t.acao, t.fundo, 3],
    ];
    for (const [nome, a, b, minimo] of pares) {
      const razao = contraste(a, b);
      expect(razao, `${tema} ${nome}: ${a} sobre ${b} = ${razao.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimo);
    }
    await semOverflowHorizontal(page, 'Entrar', tema);
  }

  await entrarComoDono(page);
  for (const tema of TEMAS) {
    await usarTema(page, tema);
    await abrirInicio(page);
    await semOverflowHorizontal(page, 'Início', tema);
    await page.getByRole('button', { name: 'Vendas' }).click();
    await expect(page.getByLabel('Buscar')).toBeVisible();
    await semOverflowHorizontal(page, 'Vendas', tema);
    await page.goto('/');
  }
});
