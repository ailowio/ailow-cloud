import { expect, test, type Page } from '@playwright/test';
import { hojeEmSaoPaulo } from '../src/lib/datas';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// S11, celular da loja (360×640): Financeiro em menu de ícones, "Contas a pagar" abre sem erro e "Nova despesa"
// em passos curtos (botões principal x secundário, Passo X de N, Voltar recua um passo, erro em toast).
// Evidência do navegador real e da API (L-0017). Nova receita e Contas a receber NÃO existem: ver ADR 013.
test.use({ hasTouch: true });

const continuar = (page: Page) => page.locator('[data-botao="principal"]').click();
const progresso = (page: Page) => page.locator('[data-assistente] [data-progresso]');

async function abrirFinanceiro(page: Page, tema: 'dark' | 'light') {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Financeiro' }).first().click();
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
}

async function conferirPasso(page: Page, rotulo: string) {
  const m = await page.evaluate(() => {
    const pega = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, borda: cs.borderTopColor, w: r.width, h: r.height, dentro: r.left >= 0 && r.right <= window.innerWidth };
    };
    const raiz = document.scrollingElement ?? document.documentElement;
    return {
      p: pega('[data-botao="principal"]'),
      s: pega('[data-botao="secundario"]'),
      paginaRola: raiz.scrollHeight > window.innerHeight,
      larguraRola: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  const p = m.p as NonNullable<typeof m.p>;
  const s = m.s as NonNullable<typeof m.s>;
  expect(p, `${rotulo}: principal existe`).not.toBeNull();
  expect(s, `${rotulo}: secundário existe`).not.toBeNull();
  expect(p.bg, `${rotulo}: fundo distinto`).not.toBe(s.bg);
  expect(p.borda, `${rotulo}: borda distinta`).not.toBe(s.borda);
  expect(p.h, `${rotulo}: principal ≥ 48`).toBeGreaterThanOrEqual(48);
  expect(s.h, `${rotulo}: secundário ≥ 48`).toBeGreaterThanOrEqual(48);
  expect(p.w, `${rotulo}: principal domina`).toBeGreaterThan(s.w);
  expect(p.dentro && s.dentro, `${rotulo}: dentro da tela`).toBe(true);
  expect(m.paginaRola, `${rotulo}: a página não rola`).toBe(false);
  expect(m.larguraRola, `${rotulo}: sem rolagem lateral`).toBe(false);
}

test('(a) Contas a pagar abre sem erro de console, de página nem resposta 5xx', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const cat = await api.post('/categorias', { data: { nome: `Cp ${s}`, atributos: [], tipo: 'financeira' } });
  expect(cat.status()).toBe(201);
  const d = await api.post('/financeiro/despesas', {
    data: { descricao: `Conta ${s}`, categoria: `Cp ${s}`, valor_centavos: 1234, vencimento: hojeEmSaoPaulo(), forma_pagamento: null, paga: false },
  });
  expect(d.status()).toBe(201);

  const problemas: string[] = [];
  // O 404 de /empresa/logo é o fallback desenhado (empresa sem logo usa a marca do produto), não um erro da tela.
  const ehLogo = (u: string) => u.includes('/empresa/logo');
  page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('404')) problemas.push(`console.error: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 500 || (r.status() >= 400 && !ehLogo(r.url()))) problemas.push(`http ${r.status()} ${r.url()}`);
  });

  await abrirFinanceiro(page, 'light');
  const contas = page.waitForResponse((r) => r.url().includes('/financeiro/contas-a-pagar'));
  await page.getByRole('button', { name: 'Contas a pagar' }).click();
  expect((await contas).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Contas a pagar', level: 1 })).toBeVisible();
  // A lista é paginada (S14c): num banco com muitas contas a nova pode estar na página 2; a busca a traz.
  await page.getByLabel('Buscar conta').fill(`Conta ${s}`);
  await expect(page.getByText(`Conta ${s}`)).toBeVisible();
  await expect(page.getByText('Não foi possível carregar')).toHaveCount(0);
  expect(problemas, 'nada de erro ao abrir Contas a pagar').toEqual([]);
});

for (const tema of ['dark', 'light'] as const) {
  test(`(b)(c)(d)(e) menu em ícones e wizard de Nova despesa (${tema})`, async ({ page }) => {
    test.setTimeout(120_000);
    const api = await entrarComoDono(page);
    const s = sufixoUnico();
    const nomeCat = `Wiz ${s}`;
    expect((await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'financeira' } })).status()).toBe(201);
    await abrirFinanceiro(page, tema);

    // Menu: grade de ícones; só o que o backend permite (sem receita manual nem contas a receber: ADR 013).
    await expect(page.locator('[data-grade-acoes]')).toBeVisible();
    for (const r of ['Nova despesa', 'Contas a pagar', 'Relatório']) {
      await expect(page.locator('[data-grade-acoes]').getByRole('button', { name: r })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /Nova receita|Contas a receber/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), 'menu sem rolagem lateral').toBe(false);

    await page.getByRole('button', { name: 'Nova despesa' }).click();
    await expect(page.getByRole('heading', { name: 'Que tipo de despesa é?' })).toBeVisible();
    await expect(progresso(page)).toContainText('Passo 1 de 4');
    await conferirPasso(page, 'categoria');

    // (c) validação por toast, sem mover o layout.
    const antes = await page.locator('[data-botao="principal"]').boundingBox();
    const alturaAntes = await page.evaluate(() => document.getElementById('conteudo')?.scrollHeight);
    await continuar(page);
    await expect(page.getByText('Escolha o tipo da despesa.')).toBeVisible();
    expect(await page.locator('[data-botao="principal"]').boundingBox(), 'botão não se move com o toast').toEqual(antes);
    expect(await page.evaluate(() => document.getElementById('conteudo')?.scrollHeight), 'conteúdo não muda de altura').toBe(alturaAntes);
    await expect(page.getByRole('heading', { name: 'Que tipo de despesa é?' })).toBeVisible();

    await page.getByRole('button', { name: nomeCat }).click();
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Quanto é?' })).toBeVisible();
    await expect(progresso(page)).toContainText('Passo 2 de 4');
    await conferirPasso(page, 'valor');
    const valor = page.getByLabel('Valor');
    expect(await valor.getAttribute('inputmode')).toBe('numeric');
    // vazio, zero e "negativo" (o sinal é descartado: só dígitos contam).
    await page.getByLabel('O que é?').fill(`Despesa ${s} ${tema}`);
    await continuar(page);
    await expect(page.getByText('Digite o valor da despesa.')).toBeVisible();
    await valor.pressSequentially('000');
    await continuar(page);
    await expect(page.getByText('O valor precisa ser maior que zero.')).toBeVisible();
    await valor.fill('');
    await valor.pressSequentially('-5');
    await expect(valor).toHaveValue('0,05');
    await valor.fill('');
    await page.getByLabel('O que é?').fill('');
    await valor.pressSequentially('12345');
    await expect(valor).toHaveValue('123,45');
    await continuar(page);
    await expect(page.getByText('Diga o que é a despesa.')).toBeVisible();
    await page.getByLabel('O que é?').fill(`Despesa ${s} ${tema}`);
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Quando vence?' })).toBeVisible();
    await expect(progresso(page)).toContainText('Passo 3 de 4');
    await conferirPasso(page, 'quando');
    // Já paga sem forma: toast.
    await page.getByRole('switch', { name: /Já foi paga/ }).click();
    await continuar(page);
    await expect(page.getByText('Escolha como foi pago.')).toBeVisible();
    await page.getByRole('switch', { name: /Já foi paga/ }).click();

    // (d) Voltar do sistema recua um passo por vez e mantém o que foi digitado.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Quanto é?' })).toBeVisible();
    await expect(valor).toHaveValue('123,45');
    await continuar(page);
    await page.getByRole('textbox', { name: /Vence em/ }).tap();
    await page.waitForTimeout(400);
    await page.getByRole('dialog', { name: 'Escolher o dia' }).locator('.mantine-DatePicker-day:not([data-outside]):not([data-disabled])').getByText('28', { exact: true }).tap();
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Confira e salve' })).toBeVisible();
    await expect(progresso(page)).toContainText('Passo 4 de 4');
    await conferirPasso(page, 'confirmar');
    await expect(page.locator('[data-assistente]')).toContainText('R$ 123,45');
    await expect(page.locator('[data-assistente]')).toContainText(nomeCat);
    await expect(page.locator('[data-botao="principal"]')).toHaveText('Salvar despesa');

    const envio = page.waitForRequest((r) => r.url().includes('/financeiro/despesas') && r.method() === 'POST');
    await continuar(page);
    const corpo = (await envio).postDataJSON();
    expect(corpo.valor_centavos).toBe(12345);

    // Despesa em aberto leva às contas a pagar; a API confirma a persistência com os valores exatos.
    await expect(page.getByRole('heading', { name: 'Contas a pagar', level: 1 })).toBeVisible();
    const lista = (await (await api.get('/financeiro/contas-a-pagar')).json()) as {
      contas: { descricao: string; valor_centavos: number; vencimento: string; categoria: string; status: string }[];
    };
    const criada = lista.contas.find((c) => c.descricao === `Despesa ${s} ${tema}`);
    expect(criada, 'a despesa existe em contas a pagar').toBeTruthy();
    expect(criada?.valor_centavos).toBe(12345);
    expect(criada?.categoria).toBe(nomeCat);
    expect(criada?.vencimento).toBe(`${hojeEmSaoPaulo().slice(0, 8)}28`);
    expect(criada?.status).toBe('aberto');
  });
}
