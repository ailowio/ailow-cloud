import { expect, test } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, saldo, sufixoUnico } from './apoio';

// ADR 014, opção 1 ("cancelar e refazer"; recomendação aplicada em 2026-11-16, a confirmar pelo Pedro): no detalhe
// da venda, "Refazer venda" cancela a venda (estoque volta, caixa estornado, nada apagado) e abre o carrinho com as
// mesmas peças. A prova vem da API: a venda original fica cancelada e a nova tem outro número (L-0017).
test('Refazer venda: cancela com motivo, o carrinho volta com as peças e a venda nova sai com outro número', async ({ page }) => {
  test.setTimeout(90_000);
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const letras = s.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const peca = await criarPeca(api, s, 5);
  const r = await api.post('/vendas', {
    data: {
      itens: [{ sku_id: peca.skuId, quantidade: 2 }],
      cliente: { celular: `119${s}`, nome: `Refaz ${letras}` },
      desconto: { tipo: 'nenhum' },
      pagamentos: [{ forma: 'pix', valor_centavos: 19800 }],
    },
  });
  expect(r.status(), 'venda original').toBe(201);
  const original = (await r.json()) as { id: string; numero: number };
  expect(await saldo(api, peca.skuId)).toBe(3);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).first().click();
  await page.getByRole('button', { name: /Gerenciar vendas/ }).click();
  await page.getByLabel('Buscar venda').fill(letras);
  await page.locator(`[data-venda="${original.numero}"]`).click();
  const modal = page.getByRole('dialog', { name: 'Detalhe da venda' });
  await modal.getByRole('button', { name: 'Refazer venda' }).click();

  const confirmar = page.getByRole('dialog', { name: 'Refazer esta venda' });
  await expect(confirmar).toContainText(`A venda ${original.numero} será cancelada`);
  await expect(confirmar.getByRole('button', { name: 'Cancelar e refazer' })).toBeDisabled();
  await confirmar.getByLabel('Motivo').fill('Peça trocada (E2E)');
  await confirmar.getByRole('button', { name: 'Cancelar e refazer' }).click();

  // Carrinho da venda nova com a mesma peça e a mesma quantidade.
  await expect(page).toHaveURL(/\/vendas$/);
  await expect(page.locator('.mantine-Notifications-root').getByText(/Venda \d+ cancelada/)).toBeVisible();
  // Os pop-ups do relatório somem (o "X" deles também se chama "Fechar"); o botão é o do carrinho, no conteúdo.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const fechar = page.getByRole('main').getByRole('button', { name: 'Fechar', exact: true });
  await expect(fechar).toBeVisible();
  // O carrinho mostra o nome da peça (criarPeca: "Peça E2E <sufixo>") e a quantidade da venda original (2).
  const nomePeca = `Peça E2E ${s}`;
  await expect(page.getByText(nomePeca, { exact: true })).toBeVisible();
  const linha = page.locator('.ailow-cartao').filter({ hasText: nomePeca });
  await expect(linha.getByRole('button', { name: `Menos ${nomePeca}` })).toBeVisible();
  await expect(linha.getByText('2', { exact: true })).toBeVisible();

  const v = (await (await api.get(`/vendas/${original.id}`)).json()) as { status: string; motivo_cancelamento: string };
  expect(v).toMatchObject({ status: 'cancelada', motivo_cancelamento: 'Peça trocada (E2E)' });
  expect(await saldo(api, peca.skuId), 'o cancelamento devolveu as 2 peças').toBe(5);

  // Fecha a venda nova: outro número, estoque baixa de novo.
  await fechar.click();
  // O cliente da venda original já vem no fechamento (o celular preenchido acha o cadastro).
  await expect(page.getByText(`Refaz ${letras}`)).toBeVisible();
  await page.getByRole('button', { name: 'Pix' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  // O número vem do comprovante (no conteúdo principal), não do toast "Venda N cancelada".
  await expect(page).toHaveURL(/\/vendas\/comprovante$/);
  const texto = await page.getByRole('main').getByText(/^Venda \d+/).first().innerText();
  const numeroNovo = Number(/Venda (\d+)/.exec(texto)?.[1]);
  expect(numeroNovo).not.toBe(original.numero);
  expect(await saldo(api, peca.skuId), 'a venda nova baixou as 2 peças').toBe(3);
});
