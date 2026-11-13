import { expect, test, type Locator, type Page } from '@playwright/test';
import { hojeEmSaoPaulo } from '../src/lib/datas';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// UXM-10 / S06: o seletor de data é do tema do app (nunca o nativo cinza). Tudo medido no navegador real, 360×640,
// nos dois temas, com toque. 1 login só (limite de 10/min por IP). Cores comparadas com os TOKENS computados.
test.use({ hasTouch: true });

const TEMAS = ['light', 'dark'] as const;

async function usarTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

/** Cor computada de um token CSS do app (resolve var() pelo próprio navegador). */
async function token(page: Page, propriedade: 'background-color' | 'color', valor: string): Promise<string> {
  return page.evaluate(
    ([p, v]) => {
      const e = document.createElement('div');
      e.style.setProperty(p as string, v as string);
      document.body.append(e);
      const r = getComputedStyle(e).getPropertyValue(p as string);
      e.remove();
      return r;
    },
    [propriedade, valor],
  );
}

const continuar = (page: Page) => page.locator('[data-botao="principal"]').click();
const dialogo = (page: Page) => page.getByRole('dialog', { name: 'Escolher o dia' });
const dia = (alvo: Locator, n: number) => alvo.locator('.mantine-DatePicker-day:not([data-outside]):not([data-disabled])').getByText(String(n), { exact: true });

async function semRolagemDePagina(page: Page, onde: string) {
  const m = await page.evaluate(() => {
    const e = document.documentElement;
    return { sh: e.scrollHeight, ih: window.innerHeight, sw: e.scrollWidth, cw: e.clientWidth };
  });
  expect(m.sh, `${onde}: scrollHeight ${m.sh} > ${m.ih}`).toBeLessThanOrEqual(m.ih);
  expect(m.sw, `${onde}: scrollWidth ${m.sw} > ${m.cw}`).toBeLessThanOrEqual(m.cw);
}

/** Abre o seletor pelo campo, mede (viewport, cores, alvos, idioma) e devolve o diálogo. */
async function abrirEMedir(page: Page, rotulo: string, tema: string): Promise<Locator> {
  const campo = page.getByRole('textbox', { name: rotulo });
  await expect(campo, 'campo é somente leitura: o teclado do sistema não abre').toHaveAttribute('readonly', '');
  await campo.tap();
  const d = dialogo(page);
  await expect(d).toBeVisible();
  const conteudo = d; // o próprio role=dialog é o conteúdo do Modal
  await expect(page.locator('.mantine-DatePicker-day').first()).toBeVisible();
  await page.waitForTimeout(400); // fim da animação de entrada

  // (c) dentro do viewport de 360 px e sem rolagem de página
  const caixa = await conteudo.boundingBox();
  expect(caixa, `${tema}: caixa do pop-up`).not.toBeNull();
  expect(caixa!.x, `${tema}: x`).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width, `${tema}: x+largura`).toBeLessThanOrEqual(360);
  expect(caixa!.y + caixa!.height, `${tema}: y+altura`).toBeLessThanOrEqual(640);
  await semRolagemDePagina(page, `${tema}/${rotulo}`);

  // (d) fundo = token de superfície; dia selecionado = token da marca; texto sobre ela = token "sobre ação"
  const superficie = await token(page, 'background-color', 'var(--ailow-superficie)');
  expect(await conteudo.evaluate((e) => getComputedStyle(e).backgroundColor), `${tema}: fundo do pop-up`).toBe(superficie);
  const sel = d.locator('.mantine-DatePicker-day[data-selected]');
  await expect(sel).toHaveCount(1);
  expect(await sel.evaluate((e) => getComputedStyle(e).backgroundColor), `${tema}: dia selecionado`).toBe(
    await token(page, 'background-color', 'var(--ailow-acao)'),
  );
  expect(await sel.evaluate((e) => getComputedStyle(e).color), `${tema}: texto do dia selecionado`).toBe(
    await token(page, 'color', 'var(--ailow-sobre-acao)'),
  );
  // hoje (quando não é o selecionado, o realce é o anel da marca; aqui hoje = selecionado, então basta o atributo)
  await expect(d.locator('.mantine-DatePicker-day[data-today]')).toHaveCount(1);

  // alvos de toque >= 44 px
  const alvo = await d.locator('.mantine-DatePicker-day').first().boundingBox();
  expect(alvo!.width, `${tema}: largura do dia`).toBeGreaterThanOrEqual(44);
  expect(alvo!.height, `${tema}: altura do dia`).toBeGreaterThanOrEqual(44);

  // nada do calendário (7 colunas, setas, título) fica cortado: tudo dentro da caixa do pop-up
  const celulas = d.locator('.mantine-DatePicker-day, .mantine-DatePicker-weekday, .mantine-DatePicker-calendarHeaderControl');
  const total = await celulas.count();
  expect(total, `${tema}: células do calendário`).toBeGreaterThanOrEqual(35);
  for (let i = 0; i < total; i++) {
    const c = (await celulas.nth(i).boundingBox())!;
    expect(c.x, `${tema}: célula ${i} à esquerda`).toBeGreaterThanOrEqual(caixa!.x);
    expect(c.x + c.width, `${tema}: célula ${i} à direita`).toBeLessThanOrEqual(caixa!.x + caixa!.width);
  }

  // pt-BR, semana começando no domingo
  await expect(d.locator('.mantine-DatePicker-weekday').first()).toHaveText(/^dom/i);
  await expect(d.locator('.mantine-DatePicker-calendarHeaderLevel')).toHaveText(/(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i);
  return d;
}

function esperado(n: number): string {
  const [ano, mes] = hojeEmSaoPaulo().split('-');
  return `${String(n).padStart(2, '0')}/${mes}/${ano}`;
}
function iso(n: number): string {
  const [ano, mes] = hojeEmSaoPaulo().split('-');
  return `${ano}-${mes}-${String(n).padStart(2, '0')}`;
}

test('seletor de data do tema: Nova despesa e Adicionar ponto, 2 temas, toque no dia', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const cat = await api.post('/categorias', { data: { nome: `Data ${s}`, atributos: [], tipo: 'financeira' } });
  expect(cat.status(), 'categoria financeira').toBe(201);

  for (const tema of TEMAS) {
    // --- Nova despesa -------------------------------------------------------------------------
    await page.goto('/');
    await usarTema(page, tema);
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Financeiro' }).click();
    await page.getByRole('button', { name: /Nova despesa/ }).click();
    // Wizard (S11): passo 1 tipo, passo 2 valor e "o que é", passo 3 vencimento.
    await page.getByRole('button', { name: `Data ${s}` }).click();
    await continuar(page);
    await page.getByLabel('Valor').fill('10,00');
    await page.getByLabel('O que é?').fill(`Data ${s} ${tema}`);
    await continuar(page);
    await expect(page.getByRole('textbox', { name: /Vence em/ })).toHaveValue(esperado(Number(hojeEmSaoPaulo().slice(8))));

    const d = await abrirEMedir(page, 'Vence em', tema);
    await dia(d, 28).tap();
    await expect(dialogo(page), 'tocar no dia fecha o pop-up').toBeHidden();
    await expect(page.getByRole('textbox', { name: /Vence em/ })).toHaveValue(esperado(28));

    // Voltar (UXM-03) com o seletor aberto: fecha só o seletor e mantém a tela
    await page.getByRole('textbox', { name: /Vence em/ }).tap();
    await expect(dialogo(page)).toBeVisible();
    await page.waitForTimeout(400); // o Voltar de gente: depois da animação de entrada (como em grade-popup)
    await page.goBack();
    await expect(dialogo(page)).toBeHidden();
    await expect(page.getByRole('textbox', { name: /Vence em/ })).toHaveValue(esperado(28));

    // (b) o valor GRAVADO (corpo do POST) é o dia tocado
    await continuar(page); // passo 3 -> 4 (confira e salve)
    const envio = page.waitForRequest((r) => r.url().includes('/financeiro/despesas') && r.method() === 'POST');
    await page.getByRole('button', { name: 'Salvar despesa' }).click();
    expect((await envio).postDataJSON().vencimento, `${tema}: vencimento gravado`).toBe(iso(28));

    // --- Adicionar ponto ----------------------------------------------------------------------
    await page.goto('/');
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Pessoas' }).click();
    await expect(page.getByText('Total no mês:')).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar ponto' }).click();
    await expect(page.getByRole('dialog', { name: 'Adicionar ponto' })).toBeVisible();
    const p = await abrirEMedir(page, 'Dia', tema);
    await dia(p, 1).tap();
    await expect(dialogo(page)).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Dia' })).toHaveValue(esperado(1));
  }
});
