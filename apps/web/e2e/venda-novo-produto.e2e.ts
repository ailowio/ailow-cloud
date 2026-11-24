import { expect, test } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

test('V03: Dono vê Novo produto no centro; cancelar mantém o carrinho', async ({ page }) => {
  const api = await entrarComoDono(page);
  const peca = await criarPeca(api, sufixoUnico(), 5);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).click();

  const grade = page.locator('[data-grade-acoes]').first();
  await expect(grade.getByRole('button', { name: 'Escanear' })).toBeVisible();
  await expect(grade.getByRole('button', { name: 'Novo produto' })).toBeVisible();
  // Catálogo usa descricao como aria-label ("Todos os produtos")
  await expect(grade.getByRole('button', { name: 'Todos os produtos' })).toBeVisible();

  // Ordem na 1ª linha: Escanear · Novo produto · Catálogo
  const rotulos = await grade.getByRole('button').evaluateAll((els) =>
    els.map((e) => (e.getAttribute('aria-label') ?? e.textContent ?? '').trim()),
  );
  expect(rotulos.slice(0, 3)).toEqual(['Escanear', 'Novo produto', 'Todos os produtos']);

  await page.getByLabel('Buscar').fill(peca.codigo);
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await expect(page.getByTestId('barra-carrinho')).toBeVisible();
  await expect(page.locator('[data-qtd-carrinho]')).toHaveText('1');

  await page.getByRole('button', { name: 'Novo produto' }).click();
  await expect(page.getByRole('heading', { name: 'Novo produto' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Que tipo de peça é?' })).toBeVisible();

  await page.getByRole('button', { name: /Voltar/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Nova venda' })).toBeVisible();
  await expect(page.getByTestId('barra-carrinho')).toBeVisible();
  await expect(page.locator('[data-qtd-carrinho]')).toHaveText('1');
});

test('V03: Vendedor não vê Novo produto na venda', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const nome = `Ana E2E ${sufixo}`;
  const criado = await api.post('/usuarios', { data: { nome, pin: '1357' } });
  expect(criado.status()).toBe(201);
  await api.post('/acesso/sair');

  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nome) }).click();
  for (const d of '1357') await page.getByRole('button', { name: d, exact: true }).click();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();

  await page.getByRole('button', { name: 'Vendas' }).click();
  await expect(page.getByRole('button', { name: 'Escanear' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Todos os produtos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo produto' })).toHaveCount(0);
});
