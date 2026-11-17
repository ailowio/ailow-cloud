import { expect, test, type Page } from '@playwright/test';
import { DONO, entrarComoDono, PIN_DE_TESTE, sufixoUnico } from './apoio';

// UXM-04/05/06 em navegador real (360×640). Evidência medida no DOM, nunca constante escrita à mão (L-0017).
// Um único login do Dono (limite de 10/min por IP): ele só serve para vincular o aparelho; cada teste abre a
// própria sessão pelo PIN com o cookie `aparelho` guardado aqui.
let aparelho: { name: string; value: string; domain: string; path: string }[] = [];
let nomeDono = '';

test.beforeAll(async ({ browser, baseURL }) => {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  const api = await entrarComoDono(page);
  nomeDono = ((await (await api.get('/acesso/eu')).json()) as { usuario: { nome: string } }).usuario.nome;
  await api.post('/acesso/sair');
  aparelho = (await ctx.cookies()).filter((c) => c.name === 'aparelho');
  expect(aparelho.length, 'cookie do aparelho vinculado').toBe(1);
  await ctx.close();
});

async function abrirPin(page: Page) {
  await page.context().addCookies(aparelho);
  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nomeDono) }).click();
  await expect(page.getByRole('button', { name: '5', exact: true })).toBeVisible();
}

// "Sair" desvincula o aparelho no servidor (decisão do Pedro, 2026-11-16): quem testa o Sair usa um aparelho só dele,
// senão o cookie compartilhado acima morreria para os testes seguintes.
async function abrirPinComAparelhoProprio(page: Page) {
  const api = await entrarComoDono(page);
  await api.post('/acesso/sair');
  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nomeDono) }).click();
  await expect(page.getByRole('button', { name: '5', exact: true })).toBeVisible();
}

const tocar = async (page: Page, digitos: string) => {
  for (const d of digitos) await page.getByRole('button', { name: d, exact: true }).click();
};

const caixas = (page: Page) =>
  Promise.all([
    page.locator('[aria-label$="de 4 dígitos"]').boundingBox(),
    page.getByRole('button', { name: '1', exact: true }).boundingBox(),
    page.getByRole('button', { name: '5', exact: true }).boundingBox(),
    page.getByRole('button', { name: '0', exact: true }).boundingBox(),
    page.getByRole('button', { name: 'Apagar' }).boundingBox(),
    page.getByRole('heading', { level: 1 }).boundingBox(),
  ]);

async function semOverflow(page: Page, tela: string) {
  const m = await page.evaluate(() => {
    const e = document.documentElement;
    return { sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ih: window.innerHeight };
  });
  expect(m.sw, `${tela}: overflow horizontal`).toBeLessThanOrEqual(m.cw);
  expect(m.sh, `${tela}: scroll de página`).toBeLessThanOrEqual(m.ih);
}

test('UXM-04: PIN errado vira toast; teclado, pontos e título não se mexem; sem erro inline', async ({ page }) => {
  await abrirPin(page);
  const antes = await caixas(page);
  expect(antes.every(Boolean)).toBe(true);

  await tocar(page, '0000');
  const toast = page.locator('.mantine-Notification-root');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(/PIN errado/);

  const depois = await caixas(page);
  expect(depois).toEqual(antes);
  // O toast fica no topo: não cobre o teclado numérico.
  const t = await toast.boundingBox();
  const teclado = antes[2] as { y: number };
  expect(t && t.y + t.height).toBeLessThan(teclado.y);
  // Nada de bloco de erro dentro da tela (o toast fica fora do <main>).
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  await semOverflow(page, 'PIN');
});

test('UXM-04: senha errada em Entrar vira toast e o formulário não se mexe', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(DONO.email);
  await page.getByLabel('Senha').fill('senha-errada-s03');
  const botao = page.getByRole('button', { name: 'Entrar' });
  const antes = await Promise.all([page.getByLabel('E-mail').boundingBox(), page.getByLabel('Senha').boundingBox(), botao.boundingBox()]);

  await botao.click();
  const toast = page.locator('.mantine-Notification-root');
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('E-mail ou senha incorretos.');
  const depois = await Promise.all([page.getByLabel('E-mail').boundingBox(), page.getByLabel('Senha').boundingBox(), botao.boundingBox()]);
  expect(depois).toEqual(antes);
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
});

test('UXM-05: cada tecla numérica vibra uma vez (10 ms); apagar não', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __vib: unknown[] };
    w.__vib = [];
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: (p: unknown) => {
        w.__vib.push(p);
        return true;
      },
    });
  });
  await abrirPin(page);
  await tocar(page, '123');
  const chamadas = await page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib);
  expect(chamadas).toEqual([10, 10, 10]);
  await page.getByRole('button', { name: 'Apagar' }).click();
  expect(await page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib.length)).toBe(3);
});

test('UXM-05: sem navigator.vibrate o teclado funciona e nada quebra', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined });
  });
  await abrirPin(page);
  expect(await page.evaluate(() => typeof navigator.vibrate)).toBe('undefined');
  await tocar(page, '123');
  await expect(page.locator('[aria-label="3 de 4 dígitos"]')).toBeVisible();
  expect(erros).toEqual([]);
});

test('UXM-06: toolbar tem inicial, Trocar e Tema; menu da inicial tem Sair; Sair desvincula; sem overflow nos 2 temas', async ({ page }) => {
  await abrirPinComAparelhoProprio(page);
  await tocar(page, PIN_DE_TESTE);
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();

  for (const tema of ['light', 'dark'] as const) {
    await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    const gatilho = page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) });
    const trocar = page.getByRole('button', { name: 'Trocar de usuário' });
    await expect(gatilho).toBeVisible();
    await expect(trocar).toBeVisible();
    expect((await gatilho.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    expect((await trocar.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await semOverflow(page, `Início/${tema}`);
    await gatilho.click();
    const sair = page.getByRole('menuitem', { name: 'Sair' });
    await expect(sair).toBeVisible();
    expect((await sair.boundingBox())?.height).toBeGreaterThanOrEqual(48);
    await expect(page.getByRole('menuitem', { name: 'Trocar de usuário' })).toHaveCount(0);
    await semOverflow(page, `Menu aberto/${tema}`);
    await page.keyboard.press('Escape');
    await expect(sair).toBeHidden();
  }

  // Sair: volta ao login do Dono, a sessão fica encerrada e o aparelho DESVINCULADO no servidor (decisão de 2026-11-16;
  // antes o aparelho seguia vinculado e a rota protegida caía em /quem-usa).
  await page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  expect((await page.context().request.get('/acesso/eu')).status(), 'sessão encerrada no servidor').toBe(401);
  expect((await page.context().request.get('/acesso/usuarios')).status(), 'aparelho desvinculado no servidor').toBe(401);

  // Rota protegida não abre mais e nem "Quem está usando?" aparece: só o login do Dono.
  await page.goto('/configuracoes');
  await expect(page.getByText('O que vamos fazer?')).toHaveCount(0);
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('button', { name: 'Trocar de usuário' })).toHaveCount(0);
});

test('UXM-06: Trocar de usuário (toolbar) leva a Quem está usando?', async ({ page }) => {
  await abrirPin(page);
  await tocar(page, PIN_DE_TESTE);
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  await page.getByRole('button', { name: 'Trocar de usuário' }).click();
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  expect((await page.context().request.get('/acesso/eu')).status()).toBe(401);
});

test('Usuário bloqueado: o aviso vem em toast (não inline) e o teclado fica desabilitado', async ({ page }) => {
  // Vendedor próprio, bloqueado pela API com 5 PINs errados (RN-09); nada de dado acumulado do dev (L-0025).
  const api = await entrarComoDono(page);
  const nome = `Bloqueado ${sufixoUnico()}`;
  const criado = await api.post('/usuarios', { data: { nome, pin: '1357' } });
  expect(criado.status(), 'Vendedor criado').toBe(201);
  const { id } = (await criado.json()) as { id: string };
  for (let i = 0; i < 5; i++) await api.post('/acesso/pin', { data: { usuario_id: id, pin: '0000' } });
  expect((await api.post('/acesso/pin', { data: { usuario_id: id, pin: '1357' } })).status(), 'bloqueado no servidor').toBe(423);
  await api.post('/acesso/sair'); // sem sessão: o app abre em "Quem está usando?"

  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nome) }).click();
  const aviso = 'Usuário bloqueado por PIN errado. Peça ao Dono para desbloquear.';
  await expect(page.locator('.mantine-Notifications-root').getByText(aviso)).toBeVisible();
  await expect(page.getByText(aviso)).toHaveCount(1); // só o toast: nada inline empurrando o teclado
  await expect(page.getByRole('button', { name: '5', exact: true })).toBeDisabled();
});
