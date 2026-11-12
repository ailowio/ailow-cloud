import { expect, test } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, saldo, sufixoUnico } from './apoio';

// Fluxo crítico: receber compra (RF-COM-04). O pedido enviado ao fornecedor é recebido pela tela com 1 parcela:
// o estoque sobe a quantidade pedida e a conta a pagar nasce. Evidência: saldo e lançamento lidos pela API.
test('receber pedido de compra sobe o estoque e gera a conta a pagar', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const peca = await criarPeca(api, sufixo, 2);

  const forn = await api.post('/fornecedores', { data: { nome: `Forn E2E ${sufixo}`, whatsapp: `11988${sufixo.slice(0, 6)}`, cnpj: null } });
  expect(forn.status(), 'fornecedor').toBe(201);
  const { id: fornecedor_id } = (await forn.json()) as { id: string };

  const QTD = 3;
  const CUSTO = 4000;
  const ped = await api.post('/compras', { data: { fornecedor_id, itens: [{ sku_id: peca.skuId, quantidade: QTD, custo_centavos: CUSTO }] } });
  expect(ped.status(), 'pedido (rascunho)').toBe(201);
  const { id: pedidoId, numero } = (await ped.json()) as { id: string; numero: number };
  // O envio pelo WhatsApp abre outra aba; aqui só o estado "enviado" interessa.
  expect((await api.post(`/compras/${pedidoId}/enviar`)).ok(), 'pedido enviado').toBe(true);
  expect(await saldo(api, peca.skuId), 'antes de receber o saldo não muda').toBe(2);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Compras' }).click();
  await page.getByRole('button', { name: /Pedidos/ }).click();
  await page.getByRole('button', { name: new RegExp(`Pedido ${numero} · `) }).click();
  await page.getByRole('button', { name: 'Receber pedido' }).click();
  await page.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(page.getByText(/Pedido recebido/)).toBeVisible();

  expect(await saldo(api, peca.skuId), 'o recebimento somou a quantidade pedida').toBe(2 + QTD);

  const { contas } = (await (await api.get('/financeiro/contas-a-pagar')).json()) as {
    contas: { origem_tipo: string; origem_id: string | null; valor_centavos: number; status: string }[];
  };
  const conta = contas.find((c) => c.origem_tipo === 'compra' && c.origem_id === pedidoId);
  expect(conta, 'a conta a pagar do pedido existe').toBeTruthy();
  expect(conta?.valor_centavos, 'no valor total do pedido').toBe(QTD * CUSTO);
});
