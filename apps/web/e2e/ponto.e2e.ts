import { expect, test } from '@playwright/test';
import { abrirInicio, entrarComoDono } from './apoio';

// Fluxo crítico: bater ponto (RF-PES-01). O Dono bate a entrada pela tela; a API passa a esperar uma saída e o
// espelho do mês mostra a marca. O ponto é por pessoa e a empresa de teste é descartável: se o usuário já tiver
// uma entrada aberta (banco de desenvolvimento reaproveitado), o teste bate a saída em vez de falhar.
test('bater ponto registra a marca e inverte o próximo tipo', async ({ page }) => {
  const api = await entrarComoDono(page);
  const antes = (await (await api.get('/pontos/estado')).json()) as { proximo: 'entrada' | 'saida' };
  const rotulo = antes.proximo === 'entrada' ? 'Bater entrada' : 'Bater saída';
  const tipo = antes.proximo === 'entrada' ? 'Entrada' : 'Saída';

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: rotulo }).click();
  await expect(page.getByText(`${tipo} registrada.`)).toBeVisible();

  const depois = (await (await api.get('/pontos/estado')).json()) as { proximo: 'entrada' | 'saida' };
  expect(depois.proximo, 'o próximo ponto é o oposto do que foi batido').toBe(antes.proximo === 'entrada' ? 'saida' : 'entrada');
  await expect(page.getByRole('button', { name: antes.proximo === 'entrada' ? 'Bater saída' : 'Bater entrada' })).toBeVisible();
});
