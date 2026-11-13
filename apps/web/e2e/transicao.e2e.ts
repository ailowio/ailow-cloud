import { expect, test, type Page } from '@playwright/test';
import { DONO, entrarComoDono, PIN_DE_TESTE } from './apoio';

// UXM-07 (S04): transição de entrada/saída/troca de usuário e caminho de volta a "Quem está usando?".
// Evidência medida no navegador (L-0017): o tempo de vida do overlay vem de um MutationObserver, não de sleeps.
// Um único login do Dono no beforeAll (limite de 10/min por IP) e um segundo, no teste do formulário.
const ID = 'transicao-usuario';
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

interface Vida {
  ini: number;
  fim: number | null;
  semScroll: boolean;
}

/** Observa o DOM: cada aparição do overlay vira uma entrada com início, fim e se a página rolou/estourou. */
async function observar(page: Page) {
  await page.addInitScript((id) => {
    const w = window as unknown as { __vidas: Vida[] };
    w.__vidas = [];
    const medir = () => {
      const e = document.documentElement;
      return e.scrollHeight <= window.innerHeight && e.scrollWidth <= e.clientWidth && window.scrollY === 0;
    };
    const ob = new MutationObserver(() => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      const aberta = w.__vidas.find((v) => v.fim === null);
      if (el && !aberta) w.__vidas.push({ ini: performance.now(), fim: null, semScroll: medir() });
      else if (el && aberta && !medir()) aberta.semScroll = false;
      else if (!el && aberta) aberta.fim = performance.now();
    });
    document.addEventListener('DOMContentLoaded', () => ob.observe(document.body, { childList: true, subtree: true }));
    // Amostra a cada quadro enquanto o overlay existe (a medição acima só roda em mutações).
    const quadro = () => {
      const aberta = w.__vidas.find((v) => v.fim === null);
      if (aberta && !medir()) aberta.semScroll = false;
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }, ID);
}

const vidas = (page: Page) => page.evaluate(() => (window as unknown as { __vidas: Vida[] }).__vidas);

async function abrirPin(page: Page) {
  await page.context().addCookies(aparelho);
  await page.goto('/');
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(nomeDono) }).click();
  await expect(page.getByRole('button', { name: '5', exact: true })).toBeVisible();
}

async function digitarPin(page: Page) {
  for (const d of PIN_DE_TESTE) await page.getByRole('button', { name: d, exact: true }).click();
}

/** Espera o overlay surgir e sumir sozinho e devolve a última vida medida. */
async function esperarCiclo(page: Page, esperadas: number): Promise<Vida> {
  const overlay = page.getByTestId(ID);
  await expect.poll(async () => (await vidas(page)).length, { message: 'overlay apareceu' }).toBe(esperadas);
  await expect(overlay).toHaveCount(0, { timeout: 2000 });
  const todas = await vidas(page);
  const v = todas[todas.length - 1] as Vida;
  expect(v.fim, 'overlay terminou').not.toBeNull();
  return v;
}

const duracao = (v: Vida) => (v.fim as number) - v.ini;

test('Entrar com PIN: overlay aparece, some sozinho em até 1,2 s e o Início fica interativo', async ({ page }) => {
  await observar(page);
  await abrirPin(page);
  await digitarPin(page);
  const v = await esperarCiclo(page, 1);
  expect(duracao(v), 'vida do overlay (ms)').toBeLessThanOrEqual(1200);
  expect(duracao(v), 'não pisca: dura o bastante para ser vista').toBeGreaterThanOrEqual(400);
  expect(v.semScroll, 'sem scroll de página nem overflow durante a transição').toBe(true);
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) }).click();
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible();
});

test('Sair e Trocar de usuário mostram a transição; em Entrar há caminho de volta a Quem está usando?', async ({ page }) => {
  await observar(page);
  await abrirPin(page);
  await digitarPin(page);
  await esperarCiclo(page, 1);

  // Trocar de usuário.
  await page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) }).click();
  await page.getByRole('menuitem', { name: 'Trocar de usuário' }).click();
  const troca = await esperarCiclo(page, 2);
  expect(duracao(troca)).toBeLessThanOrEqual(1200);
  expect(troca.semScroll).toBe(true);
  await expect(page.getByText('Quem está usando?')).toBeVisible();

  // Entrar de novo e Sair.
  await page.getByRole('button', { name: new RegExp(nomeDono) }).click();
  await digitarPin(page);
  await esperarCiclo(page, 3);
  await page.getByRole('button', { name: new RegExp(`Menu de ${nomeDono}`) }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  const saida = await esperarCiclo(page, 4);
  expect(duracao(saida)).toBeLessThanOrEqual(1200);
  expect(saida.semScroll).toBe(true);
  await expect(page).toHaveURL(/\/entrar$/);

  // (d) O beco sem saída da S03: Entrar tem o caminho para /quem-usa, e ele funciona.
  const voltar = page.getByRole('button', { name: 'Trocar de usuário' });
  await expect(voltar).toBeVisible();
  expect((await voltar.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  await voltar.click();
  await expect(page).toHaveURL(/\/quem-usa$/);
  await expect(page.getByText('Quem está usando?')).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(nomeDono) })).toBeVisible();
});

test('Login do Dono (e-mail e senha) também mostra a transição', async ({ page }) => {
  await observar(page);
  await page.context().addCookies(aparelho);
  await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com e-mail e senha' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel('E-mail').fill(DONO.email);
  await page.getByLabel('Senha').fill(DONO.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const v = await esperarCiclo(page, 1);
  expect(duracao(v)).toBeLessThanOrEqual(1200);
  expect(v.semScroll).toBe(true);
  await expect(page.getByText('Quem está usando?')).toBeVisible();
});

for (const tema of ['light', 'dark'] as const) {
  test(`Sem scroll nem overflow durante a transição (tema ${tema})`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
    await observar(page);
    await abrirPin(page);
    await digitarPin(page);
    const v = await esperarCiclo(page, 1);
    expect(v.semScroll).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
  });
}

test('prefers-reduced-motion: a animação não usa movimento (duração ≤ 200 ms ou nenhuma)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observar(page);
  await abrirPin(page);
  // O fade reduzido dura ~180 ms: as medidas são tiradas no instante em que o overlay entra no DOM.
  await page.evaluate((id) => {
    const w = window as unknown as { __medidas: { nome: string; dur: string }[] };
    w.__medidas = [];
    new MutationObserver((_m, ob) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) return;
      w.__medidas = [el, ...Array.from(el.querySelectorAll('*'))].map((n) => {
        const c = getComputedStyle(n);
        return { nome: c.animationName, dur: c.animationDuration };
      });
      ob.disconnect();
    }).observe(document.body, { childList: true, subtree: true });
  }, ID);
  await digitarPin(page);
  const ler = () => page.evaluate(() => (window as unknown as { __medidas: { nome: string; dur: string }[] }).__medidas);
  await expect.poll(async () => (await ler()).length, { message: 'overlay medido' }).toBeGreaterThan(0);
  const medidas = await ler();
  for (const m of medidas) {
    const tempos = m.dur.split(',').map((t) => (t.trim().endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000));
    const sem = m.nome === 'none';
    expect(sem || tempos.every((t) => t <= 200), `animação ${m.nome} ${m.dur}`).toBe(true);
  }
  const v = await esperarCiclo(page, 1);
  expect(duracao(v)).toBeLessThanOrEqual(1200);
});
