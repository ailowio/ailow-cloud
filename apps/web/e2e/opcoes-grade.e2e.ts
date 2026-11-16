import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// ADR 017 (decisão do Pedro, 2026-11-16): tamanhos e cores configuráveis na engrenagem do "Novo produto". Criar e
// desativar pela engrenagem dos passos "Quais tamanhos?" e "Quais cores?" muda os chips na hora, sem perder o que já
// foi marcado no assistente. A prova vem da API (GET /opcoes-grade), não só da tela (L-0017). 360×640.

interface Opcao {
  id: string;
  nome: string;
  amostra: string | null;
  ativa: boolean;
}
async function opcoes(api: APIRequestContext): Promise<{ tamanhos: Opcao[]; cores: Opcao[] }> {
  const r = await api.get('/opcoes-grade');
  expect(r.ok(), 'GET /opcoes-grade').toBe(true);
  return r.json();
}

// Código de tamanho único por execução: 3 letras (regra do SKU), começando por Z para não cair num tamanho conhecido.
function tamanhoUnico(): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXY';
  const sorteia = () => letras[Math.floor(Math.random() * letras.length)];
  return `Z${sorteia()}${sorteia()}`;
}

const toast = (page: Page, texto: string) => page.locator('.mantine-Notifications-root').getByText(texto);
const continuar = (page: Page) => page.locator('[data-botao="principal"]').click();

async function irAteTamanhos(page: Page, api: APIRequestContext, s: string) {
  const nomeCat = `E2E Grade ${s}`;
  expect((await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'produto' } })).status()).toBe(201);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  await page.getByRole('button', { name: nomeCat }).click();
  await continuar(page);
  await page.getByLabel('Nome do modelo').fill(`Peça Grade ${s}`);
  await page.getByRole('button', { name: 'Slim' }).click();
  await continuar(page);
  await expect(page.getByRole('heading', { name: 'Quais tamanhos?' })).toBeVisible();
}

test('engrenagem em "Quais tamanhos?": cria um tamanho, ele vira chip na hora e o que já estava marcado continua', async ({ page }) => {
  test.setTimeout(90_000);
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const novo = tamanhoUnico();
  await irAteTamanhos(page, api, s);
  await page.getByRole('button', { name: 'P', exact: true }).click();

  await page.getByRole('button', { name: 'Configurar tamanhos' }).click();
  const pop = page.getByRole('dialog', { name: 'Tamanhos' });
  await expect(pop).toBeVisible();
  await pop.getByRole('button', { name: 'Novo tamanho' }).click();
  const form = page.getByRole('dialog', { name: 'Novo tamanho' });
  await form.getByLabel('Tamanho').fill(novo.toLowerCase());
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast(page, 'Tamanho criado')).toBeVisible();
  await expect(pop.locator(`[data-opcao-grade="${novo}"]`)).toBeVisible();

  // Voltar do sistema fecha só o pop-up: o assistente continua no mesmo passo, com "P" marcado.
  await page.goBack();
  await expect(pop).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Quais tamanhos?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'P', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const chip = page.getByRole('group', { name: 'Outros tamanhos' }).getByRole('button', { name: novo, exact: true });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');

  expect((await opcoes(api)).tamanhos.find((t) => t.nome === novo)).toMatchObject({ ativa: true, amostra: null });
  const larguraRola = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(larguraRola, 'sem rolagem lateral').toBe(false);
});

test('engrenagem em "Quais cores?": cria uma cor com amostra e desativa outra; os chips mudam e a API confirma', async ({ page }) => {
  test.setTimeout(90_000);
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const nova = `Lilas ${s}`;
  const some = `Some ${s}`;
  const criada = await api.post('/opcoes-grade', { data: { tipo: 'cor', nome: some, amostra: '#123456' } });
  expect(criada.status(), 'cor que vai ser desativada').toBe(201);

  await irAteTamanhos(page, api, s);
  await page.getByRole('button', { name: 'P', exact: true }).click();
  await continuar(page);
  await expect(page.getByRole('heading', { name: 'Quais cores?' })).toBeVisible();
  await expect(page.getByRole('button', { name: some, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Configurar cores' }).click();
  const pop = page.getByRole('dialog', { name: 'Cores' });
  await pop.getByRole('button', { name: 'Nova cor' }).click();
  const form = page.getByRole('dialog', { name: 'Nova cor' });
  await form.getByRole('textbox', { name: /^Cor/ }).fill(nova);
  await form.getByRole('textbox', { name: /^Amostra/ }).fill('#c8a2c8');
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast(page, 'Cor criada')).toBeVisible();

  await pop.getByRole('button', { name: `Editar ${some}` }).click();
  const editar = page.getByRole('dialog', { name: 'Editar cor' });
  await editar.getByRole('switch', { name: 'Cor ativa' }).click();
  await editar.getByRole('button', { name: 'Salvar' }).click();
  await expect(toast(page, 'Salvo')).toBeVisible();
  await expect(pop.locator(`[data-opcao-grade="${some}"]`)).toContainText('Desativada');

  await page.goBack();
  await expect(pop).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Quais cores?' })).toBeVisible();
  await expect(page.getByRole('button', { name: nova, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: some, exact: true })).toHaveCount(0);

  const o = await opcoes(api);
  expect(o.cores.find((c) => c.nome === nova)).toMatchObject({ ativa: true, amostra: '#c8a2c8' });
  expect(o.cores.find((c) => c.nome === some)).toMatchObject({ ativa: false });
});
