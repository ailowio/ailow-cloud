import { expect, test, type Page } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// F02: assistentes mostram o financeiro; receber com N parcelas; soma divergente em toast.
const toast = (page: Page, texto: string | RegExp) =>
  page.locator('.mantine-Notifications-root').getByText(texto);

test('venda finalizada mostra "Entra no financeiro hoje" e a entrada aparece no extrato do dia', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const celular = `119${sufixo}`;
  // Preço único (L-0008): o extrato compartilhado não pode ser contado no total.
  const preco = 6100 + Number(sufixo.slice(-3));
  expect((await api.post('/clientes', { data: { nome: `F02 ${sufixo}`, celular, aviso_lgpd: false } })).status()).toBe(201);
  const cat = await api.post('/categorias', { data: { nome: `F02c ${sufixo}`, atributos: [], tipo: 'produto' } });
  expect(cat.status()).toBe(201);
  const { id: categoria_id } = (await cat.json()) as { id: string };
  const prod = await api.post('/produtos', {
    data: {
      nome: `Peça F02 ${sufixo}`,
      categoria_id,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 3000,
      preco_centavos: preco,
      skus: [{ tamanho: 'M', cor: `Cf${sufixo.slice(0, 4)}`, estoque_inicial: 5, estoque_minimo: 0 }],
    },
  });
  expect(prod.status()).toBe(201);
  const { skus } = (await prod.json()) as { skus: { id: string; codigo: string }[] };
  const peca = { skuId: skus[0]!.id, codigo: skus[0]!.codigo };

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).click();
  await page.getByLabel('Buscar').fill(peca.codigo);
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await page.getByLabel('Celular do cliente').fill(celular);
  await expect(page.getByText(`F02 ${sufixo}`)).toBeVisible();
  await page.getByRole('button', { name: 'Pix' }).click();
  await expect(page.locator('[data-financeiro-hoje]')).toContainText(/Entra no financeiro hoje/);
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.getByText(/^Venda \d+/).first()).toBeVisible();
  await expect(page.locator('[data-financeiro-hoje]')).toContainText(/Entra no financeiro hoje/);
  await expect(toast(page, /Financeiro/)).toBeVisible();

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const { lancamentos } = (await (await api.get(`/financeiro/extrato?data=${hoje}`)).json()) as {
    lancamentos: { origem_tipo: string; valor_centavos: number; forma_pagamento: string | null; tipo: string }[];
  };
  const entrada = lancamentos.find(
    (l) => l.origem_tipo === 'venda' && l.tipo === 'entrada' && l.valor_centavos === preco && l.forma_pagamento === 'pix',
  );
  expect(entrada, 'entrada da venda deste teste no extrato do dia').toBeTruthy();
});

test('receber com 3 parcelas gera 3 contas a pagar; soma divergente vira toast', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const peca = await criarPeca(api, sufixo, 2);
  const forn = await api.post('/fornecedores', {
    data: { nome: `Forn F02 ${sufixo}`, whatsapp: `11977${sufixo.slice(0, 6)}`, cnpj: null },
  });
  expect(forn.status()).toBe(201);
  const { id: fornecedor_id } = (await forn.json()) as { id: string };
  const TOTAL = 3 * 4000;
  const ped = await api.post('/compras', {
    data: { fornecedor_id, itens: [{ sku_id: peca.skuId, quantidade: 3, custo_centavos: 4000 }] },
  });
  expect(ped.status()).toBe(201);
  const { id: pedidoId, numero } = (await ped.json()) as { id: string; numero: number };
  expect((await api.post(`/compras/${pedidoId}/enviar`)).ok()).toBe(true);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Compras' }).click();
  await page.getByRole('button', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: new RegExp(`Pedido ${numero} · `) }).click();
  await page.getByRole('button', { name: 'Receber pedido' }).click();

  await expect(page.getByText('Gera 1 conta a pagar')).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar parcela' }).click();
  await page.getByRole('button', { name: 'Adicionar parcela' }).click();
  await expect(page.getByText('Gera 3 contas a pagar')).toBeVisible();

  const camposValor = page.getByLabel('Valor da parcela');
  await expect(camposValor).toHaveCount(3);
  // Soma errada de propósito → toast; o pedido continua "enviado".
  await camposValor.nth(0).fill('50,00');
  await camposValor.nth(1).fill('30,00');
  await camposValor.nth(2).fill('10,00');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(toast(page, /soma das parcelas/)).toBeVisible();

  await camposValor.nth(0).fill('40,00');
  await camposValor.nth(1).fill('40,00');
  await camposValor.nth(2).fill('40,00');
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(toast(page, /Financeiro/)).toBeVisible();

  const { contas } = (await (await api.get('/financeiro/contas-a-pagar')).json()) as {
    contas: { origem_tipo: string; origem_id: string | null; valor_centavos: number }[];
  };
  const doPedido = contas.filter((c) => c.origem_tipo === 'compra' && c.origem_id === pedidoId);
  expect(doPedido, '3 contas a pagar do pedido').toHaveLength(3);
  expect(doPedido.reduce((s, c) => s + c.valor_centavos, 0)).toBe(TOTAL);
});
