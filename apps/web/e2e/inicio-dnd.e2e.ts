import { expect, test, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono } from './apoio';

/** Ordem dos módulos na grade (atributo semântico data-modulo). */
async function ordemModulos(page: Page): Promise<string[]> {
  return page.locator('[data-modulo]').evaluateAll((els) =>
    els.map((e) => e.getAttribute('data-modulo') ?? ''),
  );
}

/**
 * Segura o bloco de origem, espera `ms`, move até o destino e solta.
 * Coordenadas vêm do bounding box dos locators semânticos (não são fixas — L-0039).
 */
async function segurarMover(
  page: Page,
  origemId: string,
  destinoId: string,
  ms: number,
): Promise<void> {
  const origem = page.locator(`[data-modulo="${origemId}"]`);
  const destino = page.locator(`[data-modulo="${destinoId}"]`);
  await expect(origem).toBeVisible();
  await expect(destino).toBeVisible();
  const o = await origem.boundingBox();
  const d = await destino.boundingBox();
  expect(o, `bbox de ${origemId}`).toBeTruthy();
  expect(d, `bbox de ${destinoId}`).toBeTruthy();
  const ox = o!.x + o!.width / 2;
  const oy = o!.y + o!.height / 2;
  const dx = d!.x + d!.width / 2;
  const dy = d!.y + d!.height / 2;
  await page.mouse.move(ox, oy);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.move(dx, dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test('D-A1: toque curto (~100 ms) abre o módulo', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).click({ delay: 100 });
  await expect(page).toHaveURL(/\/vendas$/);
});

test('D-A1: segurar 600 ms + mover reordena e persiste após reload', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  const antes = await ordemModulos(page);
  expect(antes.length).toBeGreaterThanOrEqual(2);
  const primeiro = antes[0]!;
  const segundo = antes[1]!;

  await segurarMover(page, primeiro, segundo, 600);

  const depois = await ordemModulos(page);
  expect(depois[0], 'primeiro e segundo trocaram de lugar').toBe(segundo);
  expect(depois).toContain(primeiro);

  await page.reload();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  await expect.poll(async () => ordemModulos(page)).toEqual(depois);
});

test('D-A1 canário: segurar 200 ms + mover NÃO reordena', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  const antes = await ordemModulos(page);
  const primeiro = antes[0]!;
  const segundo = antes[1]!;

  await segurarMover(page, primeiro, segundo, 200);

  await expect.poll(async () => ordemModulos(page)).toEqual(antes);
});
