import { expect, test } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, saldo, sufixoUnico } from './apoio';

// Fluxo crítico: cancelar venda (RF-VEN-08). Vende 1 peça pela tela e cancela pelo comprovante: o estoque volta
// ao que era e a venda fica marcada como cancelada. A evidência vem da API (banco), não do texto da tela.
test('cancelar venda devolve o estoque e marca a venda como cancelada', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const peca = await criarPeca(api, sufixo, 5);
  const celular = `119${sufixo}`;
  const cliente = await api.post('/clientes', { data: { nome: `E2E ${sufixo}`, celular, aviso_lgpd: false } });
  expect(cliente.status()).toBe(201);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).click();
  await page.getByLabel('Buscar').fill(peca.codigo);
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByLabel('Celular do cliente').fill(celular);
  await expect(page.getByText(`E2E ${sufixo}`)).toBeVisible();
  await page.getByRole('button', { name: 'Pix' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.getByText(/^Venda \d+/).first()).toBeVisible();
  expect(await saldo(api, peca.skuId), 'a venda baixou 1 peça').toBe(4);

  await page.getByRole('button', { name: 'Cancelar venda' }).click();
  await page.getByLabel('Motivo').fill('Cliente desistiu (E2E)');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(page.getByText(/Cancelada\./)).toBeVisible();

  expect(await saldo(api, peca.skuId), 'o cancelamento devolveu a peça').toBe(5);
});
