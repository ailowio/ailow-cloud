import { expect, test } from '@playwright/test';

// RNF-04: de "Vendas" até finalizar 1 peça, cliente já cadastrado, Pix, em no máximo 8 toques.
// Toque = clique real (isTrusted) num controle, contado pelo navegador a partir do clique em "Vendas".
// Digitar o código da peça e o celular não é toque: os dois campos já abrem com foco.
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// O limite do RNF-04 é 8. E2E_LIMITE_TOQUES só pode APERTAR (canário do CI, L-0006: com limite 1 este teste tem de
// reprovar); nunca afrouxa o critério (L-0017).
const LIMITE_DE_TOQUES = Math.min(8, Number(process.env.E2E_LIMITE_TOQUES ?? 8));

test('RNF-04: venda de 1 peça, cliente cadastrado, Pix, em até 8 toques', async ({ page }) => {
  // Dados do próprio teste pela API (mesma sessão do navegador): um cliente novo e uma peça com saldo.
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const celular = `119${sufixo}`;
  const cliente = await api.post('/clientes', { data: { nome: `E2E ${sufixo}`, celular, aviso_lgpd: false } });
  expect(cliente.status()).toBe(201);
  const peca = await criarPeca(api, sufixo, 5);

  await page.addInitScript(() => {
    (window as unknown as { __toques: string[] }).__toques = [];
    document.addEventListener(
      'click',
      (e) => {
        if (!e.isTrusted) return;
        const alvo = (e.target as Element | null)?.closest('button, a, [role="button"], input, label');
        if (alvo) (window as unknown as { __toques: string[] }).__toques.push((alvo.textContent ?? '').trim().slice(0, 30));
      },
      true,
    );
  });

  // A sessão do login pela API já vale no navegador: a tela inicial abre direto.
  await page.goto('/');
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();

  // Daqui em diante tudo conta: zera o contador e vai de "Vendas" até "Finalizar".
  await page.evaluate(() => {
    (window as unknown as { __toques: string[] }).__toques.length = 0;
  });

  await page.getByRole('button', { name: 'Vendas' }).click();
  await page.getByLabel('Buscar').fill(peca.codigo);
  // A busca lista todas as variações do produto: o toque vai na que tem o código (e o saldo) escolhido.
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByLabel('Celular do cliente').fill(celular);
  await expect(page.getByText(`E2E ${sufixo}`)).toBeVisible();
  await page.getByRole('button', { name: 'Pix' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.getByText(/^Venda \d+/).first()).toBeVisible();

  const toques = await page.evaluate(() => (window as unknown as { __toques: string[] }).__toques);
  console.log(`toques (${toques.length}): ${toques.join(' > ')}`);
  expect(toques.length).toBeLessThanOrEqual(LIMITE_DE_TOQUES);
});
