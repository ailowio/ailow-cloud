import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// Rodada 2 de UX (decisão do Pedro, 2026-11-16): o Dono corrige o nome e reativa uma pessoa desativada, em
// Pessoas > Gerenciar pessoas. A prova vem da API (GET /usuarios), nunca só do texto na tela (L-0017).

async function novoVendedor(api: APIRequestContext, nome: string): Promise<string> {
  const r = await api.post('/usuarios', { data: { nome, pin: '1234' } });
  expect(r.status(), 'vendedor de teste').toBe(201);
  return ((await r.json()) as { id: string }).id;
}

async function naApi(api: APIRequestContext, id: string) {
  const r = await api.get('/usuarios');
  const { usuarios } = (await r.json()) as { usuarios: { id: string; nome: string; ativo: boolean }[] };
  return usuarios.find((u) => u.id === id);
}

async function abrirGerenciar(page: Page) {
  await page.goto('/');
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await page.getByRole('button', { name: 'Gerenciar pessoas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Gerenciar pessoas' })).toBeVisible();
}

const aviso = (page: Page, texto: string) => page.locator('.mantine-Notifications-root').getByText(texto);

test('o Dono corrige o nome de um Vendedor e a API guarda o nome novo', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const id = await novoVendedor(api, `Pessoa Nome ${s}`);
  await abrirGerenciar(page);

  await page.getByRole('button', { name: `Opções de Pessoa Nome ${s}` }).click();
  await page.getByRole('button', { name: 'Editar nome' }).click();
  const campo = page.getByRole('textbox', { name: 'Nome' });
  await expect(campo).toHaveValue(`Pessoa Nome ${s}`);
  await campo.fill(`Pessoa Corrigida ${s}`);
  await page.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(aviso(page, 'Nome salvo')).toBeVisible();
  await expect(page.getByText(`Pessoa Corrigida ${s}`, { exact: true })).toBeVisible();
  expect((await naApi(api, id))?.nome).toBe(`Pessoa Corrigida ${s}`);
});

test('nome em branco não salva: o botão fica desabilitado e a API não muda', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const id = await novoVendedor(api, `Pessoa Branco ${s}`);
  await abrirGerenciar(page);
  await page.getByRole('button', { name: `Opções de Pessoa Branco ${s}` }).click();
  await page.getByRole('button', { name: 'Editar nome' }).click();
  await page.getByRole('textbox', { name: 'Nome' }).fill('   ');
  await expect(page.getByRole('button', { name: 'Salvar nome' })).toBeDisabled();
  expect((await naApi(api, id))?.nome).toBe(`Pessoa Branco ${s}`);
});

test('pessoa desativada tem a opção Reativar e volta ativa na API', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const id = await novoVendedor(api, `Pessoa Volta ${s}`);
  expect((await api.post(`/usuarios/${id}/desativar`)).status()).toBe(204);
  await abrirGerenciar(page);

  await page.getByRole('button', { name: `Opções de Pessoa Volta ${s}` }).click();
  // Desativado só oferece Reativar e Editar nome (sem PIN, sessões ou desbloquear).
  await expect(page.getByRole('button', { name: 'Redefinir PIN' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reativar' }).click();
  await page.getByRole('button', { name: `Sim, reativar Pessoa Volta ${s}` }).click();
  await expect(aviso(page, 'Pessoa reativada')).toBeVisible();
  expect((await naApi(api, id))?.ativo).toBe(true);
});
