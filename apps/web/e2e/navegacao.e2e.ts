import { expect, test, type Page } from '@playwright/test';

// UXM-01..03 (harness/practices/ux-mobile.md), no celular da loja (360×640). A evidência vem do navegador real:
// medidas do documento, histórico e estilo calculado — nunca de constantes escritas à mão (L-0017).
// Poucos logins de propósito: a API limita a senha do Dono a 10 por minuto por IP e a suíte inteira divide esse limite.
import { abrirInicio, entrarComoDono } from './apoio';

async function semScrollDePagina(page: Page, tela: string) {
  const { rolagem, janela } = await page.evaluate(() => ({
    rolagem: (document.scrollingElement ?? document.documentElement).scrollHeight,
    janela: window.innerHeight,
  }));
  expect(rolagem, `${tela}: scrollHeight (${rolagem}) deve caber em innerHeight (${janela})`).toBeLessThanOrEqual(janela);
}

test('UXM-01: Entrar não rola a página', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await semScrollDePagina(page, 'Entrar');
});

test('UXM-01/02: QuemUsa, Início e Vendas sem rolagem de página e com overscroll none', async ({ page }) => {
  const api = await entrarComoDono(page);
  await api.post('/acesso/sair');
  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await semScrollDePagina(page, 'QuemUsa');

  await entrarComoDono(page);
  await abrirInicio(page);
  await semScrollDePagina(page, 'Início');
  await page.getByRole('button', { name: 'Vendas' }).click();
  await expect(page.getByLabel('Buscar')).toBeVisible();
  await semScrollDePagina(page, 'Vendas');

  const estilos = await page.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
    principal: getComputedStyle(document.querySelector('main') as Element).overscrollBehaviorY,
  }));
  expect(estilos).toEqual({ html: 'none', body: 'none', principal: 'none' });
});

test('UXM-03: Voltar retrocede um passo, nunca sai do app e a seta da Moldura faz o mesmo', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  const origem = new URL(page.url()).origin;

  await page.getByRole('button', { name: 'Vendas' }).click();
  await expect(page).toHaveURL(/\/vendas$/);
  await page.getByRole('button', { name: /Relat/ }).click();
  await expect(page).toHaveURL(/\/vendas\/relatorio$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/vendas$/);
  await page.goBack();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  // Um Voltar a mais na raiz também fica no app.
  await page.goBack();
  await page.waitForTimeout(300);
  expect(new URL(page.url()).origin).toBe(origem);
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();

  // A seta da Moldura usa o mesmo mecanismo: de Vendas volta ao Início.
  await page.getByRole('button', { name: 'Vendas' }).click();
  await expect(page).toHaveURL(/\/vendas$/);
  await page.getByRole('button', { name: /Voltar/ }).first().click();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
});

test('UXM-03: Voltar fecha o modal aberto sem mudar de tela', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.getByRole('button', { name: /Usuários/ }).click();
  await page.getByRole('button', { name: 'Novo vendedor' }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  const url = page.url();

  await page.goBack();
  await expect(dialogo).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.getByRole('button', { name: 'Novo vendedor' })).toBeVisible();
});
