import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// ADR 015 (decisão do Pedro, 2026-11-16): Nova receita (assistente de 4 passos, como a despesa) e Contas a receber
// (baixa = "Marcar como recebido"). 360×640. A prova vem da API (contas a receber, extrato), não só da tela (L-0017).
test.use({ hasTouch: true });

const continuar = (page: Page) => page.locator('[data-botao="principal"]').click();
const toast = (page: Page, texto: string) => page.locator('.mantine-Notifications-root').getByText(texto);

async function abrirFinanceiro(page: Page) {
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Financeiro' }).first().click();
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
}

interface Conta {
  id: string;
  descricao: string | null;
  valor_centavos: number;
  status: string;
  tipo: string;
  origem_tipo: string;
}
async function aReceber(api: APIRequestContext): Promise<Conta[]> {
  const r = await api.get('/financeiro/contas-a-receber');
  expect(r.ok(), 'GET contas a receber').toBe(true);
  return ((await r.json()) as { contas: Conta[] }).contas;
}

// Categoria financeira própria (nome único): não depende das categorias acumuladas no banco de dev (L-0025).
async function categoriaPropria(api: APIRequestContext, s: string): Promise<string> {
  const nome = `Receita ${s}`;
  const r = await api.post('/categorias', { data: { nome, atributos: [], tipo: 'financeira' } });
  expect(r.status(), 'categoria financeira de teste').toBe(201);
  return nome;
}

async function semRolagemLateral(page: Page, onde: string) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `${onde}: rolagem lateral`).toBeLessThanOrEqual(m.cw);
}

test('Nova receita a receber: 4 passos, aparece em Contas a receber e "Marcar como recebido" dá baixa', async ({ page }) => {
  test.setTimeout(120_000);
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const descricao = `Sinal encomenda ${s}`;
  const categoria = await categoriaPropria(api, s);
  await abrirFinanceiro(page);

  await page.getByRole('button', { name: 'Nova receita' }).click();
  await expect(page).toHaveURL(/\/financeiro\/nova-receita$/);
  await expect(page.getByRole('heading', { name: 'Que tipo de receita é?' })).toBeVisible();
  await expect(page.locator('[data-assistente] [data-progresso]')).toContainText('Passo 1 de 4');
  await continuar(page);
  await expect(toast(page, 'Escolha o tipo da receita.')).toBeVisible();
  await page.getByRole('button', { name: categoria, exact: true }).click();
  await continuar(page);

  await expect(page.getByRole('heading', { name: 'Quanto é?' })).toBeVisible();
  await page.getByLabel('Valor').pressSequentially('25075');
  await page.getByLabel('O que é?').fill(descricao);
  await continuar(page);

  await expect(page.getByRole('heading', { name: 'Quando recebe?' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Já foi recebida/ })).toBeVisible();
  await semRolagemLateral(page, 'passo quando');
  await continuar(page);

  await expect(page.getByRole('heading', { name: 'Confira e salve' })).toBeVisible();
  await expect(page.locator('[data-assistente]')).toContainText('Fica em contas a receber');
  const salvo = page.waitForResponse((r) => r.url().endsWith('/financeiro/receitas') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Salvar receita' }).click();
  expect((await salvo).status()).toBe(201);
  await expect(toast(page, 'Receita salva em contas a receber')).toBeVisible();

  // Vai para Contas a receber, onde a receita aparece; a API confirma: entrada, origem receita, em aberto, R$ 250,75.
  await expect(page).toHaveURL(/\/financeiro\/contas-a-receber$/);
  await expect(page.getByRole('heading', { name: 'Contas a receber', level: 1 })).toBeVisible();
  await expect(page.getByText(descricao)).toBeVisible();
  const criada = (await aReceber(api)).find((c) => c.descricao === descricao);
  expect(criada).toMatchObject({ tipo: 'entrada', origem_tipo: 'receita', status: 'aberto', valor_centavos: 25_075 });
  await semRolagemLateral(page, 'contas a receber');

  // Baixa: escolhe a forma e confirma; some da lista e da API.
  const cartao = page.locator('.ailow-cartao', { hasText: descricao });
  await cartao.getByRole('button', { name: 'Marcar como recebido' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Marcar como recebido?' });
  await dialogo.getByRole('button', { name: 'Pix' }).click();
  await dialogo.getByRole('button', { name: 'Confirmar recebimento' }).click();
  await expect(toast(page, 'Conta recebida')).toBeVisible();
  await expect(page.getByText(descricao)).toHaveCount(0);
  expect((await aReceber(api)).map((c) => c.id)).not.toContain(criada?.id);
});

test('Nova receita já recebida: vai direto para o caixa (extrato de hoje), não para Contas a receber', async ({ page }) => {
  test.setTimeout(120_000);
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const descricao = `Aporte ${s}`;
  const categoria = await categoriaPropria(api, s);
  await abrirFinanceiro(page);
  await page.getByRole('button', { name: 'Nova receita' }).click();
  await page.getByRole('button', { name: categoria, exact: true }).click();
  await continuar(page);
  await page.getByLabel('Valor').pressSequentially('5000');
  await page.getByLabel('O que é?').fill(descricao);
  await continuar(page);
  await page.getByRole('switch', { name: /Já foi recebida/ }).click();
  await continuar(page);
  await expect(toast(page, 'Escolha como foi recebido.')).toBeVisible();
  await page.getByRole('button', { name: 'Dinheiro' }).click();
  await continuar(page);
  await expect(page.locator('[data-assistente]')).toContainText('Já recebida (Dinheiro)');
  await page.getByRole('button', { name: 'Salvar receita' }).click();
  await expect(toast(page, 'Receita salva e recebida')).toBeVisible();

  expect((await aReceber(api)).map((c) => c.descricao)).not.toContain(descricao);
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const ex = (await (await api.get(`/financeiro/extrato?data=${hoje}`)).json()) as { lancamentos: Conta[] };
  expect(ex.lancamentos.find((l) => l.descricao === descricao)).toMatchObject({ tipo: 'entrada', status: 'pago', valor_centavos: 5_000 });
});

test('Contas a receber vazia mostra o caminho para lançar uma receita', async ({ page }) => {
  await entrarComoDono(page);
  // Sem garantia de lista vazia no banco compartilhado: confere só que a tela abre sem erro e tem o atalho.
  await abrirFinanceiro(page);
  await page.getByRole('button', { name: 'Contas a receber' }).click();
  await expect(page.getByRole('heading', { name: 'Contas a receber', level: 1 })).toBeVisible();
  await expect(page.locator('main [aria-busy="true"], [role="status"]')).toHaveCount(0, { timeout: 8000 });
  await semRolagemLateral(page, 'contas a receber');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Financeiro', level: 1 })).toBeVisible();
});
