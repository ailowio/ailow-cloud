import { expect, test, type Locator, type Page } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// T01 (plano aprimoramentos-voz-2026-11-23): com o teclado aberto o celular de 360×640 fica com ~400 px de altura
// (o index.html pede `interactive-widget=resizes-content`, então o layout encolhe junto). Aqui a janela já nasce
// 360×400: depois de tocar no campo, o campo e o botão principal (Continuar/Finalizar) têm de estar inteiros na área
// visível do <main> que rola, sem nada por cima. A barra do Gboard/Chrome não existe no Playwright: Pedro valida no celular.
test.use({ viewport: { width: 360, height: 400 }, hasTouch: true });

async function conferirComTeclado(page: Page, campo: Locator, botao: Locator, rotulo: string) {
  await campo.click();
  await expect(campo).toBeFocused();
  const m = await page.evaluate(
    ([c, b]) => {
      const area = (document.getElementById('conteudo') as HTMLElement).getBoundingClientRect();
      const medir = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const noMeio = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          dentro: r.top >= area.top && r.bottom <= area.bottom && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth,
          porCima: noMeio !== null && !el.contains(noMeio),
          topo: Math.round(r.top),
          fim: Math.round(r.bottom),
        };
      };
      const raiz = document.scrollingElement ?? document.documentElement;
      return {
        area: { topo: Math.round(area.top), fim: Math.round(area.bottom) },
        campo: medir(c as HTMLElement),
        botao: medir(b as HTMLElement),
        paginaRola: raiz.scrollHeight > window.innerHeight,
        larguraRola: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    },
    [await campo.elementHandle(), await botao.elementHandle()] as const,
  );
  const detalhe = JSON.stringify(m);
  expect(m.botao.dentro, `${rotulo}: botão principal inteiro na área visível ${detalhe}`).toBe(true);
  expect(m.botao.porCima, `${rotulo}: nada por cima do botão principal ${detalhe}`).toBe(false);
  expect(m.campo.dentro, `${rotulo}: campo tocado inteiro na área visível ${detalhe}`).toBe(true);
  expect(m.campo.porCima, `${rotulo}: nada por cima do campo tocado ${detalhe}`).toBe(false);
  expect(m.paginaRola, `${rotulo}: a página não rola (UXM-01)`).toBe(false);
  expect(m.larguraRola, `${rotulo}: sem rolagem lateral (UXM-11)`).toBe(false);
}

const principal = (page: Page) => page.locator('[data-botao="principal"]');

test('Novo produto: com o teclado aberto, "Nome do modelo" e Continuar ficam à vista', async ({ page }) => {
  const api = await entrarComoDono(page);
  const nomeCat = `T01 Prod ${sufixoUnico()}`;
  expect((await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'produto' } })).status()).toBe(201);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  await page.getByRole('button', { name: nomeCat }).click();
  await principal(page).click();
  await expect(page.getByRole('heading', { name: 'Nome e porte' })).toBeVisible();

  await conferirComTeclado(page, page.getByLabel('Nome do modelo'), principal(page), 'Novo produto / nome');
  await expect(principal(page)).toHaveText('Continuar');
});

test('Nova despesa: com o teclado aberto, "O que é?", "Valor" e Continuar ficam à vista', async ({ page }) => {
  const api = await entrarComoDono(page);
  const nomeCat = `T01 Desp ${sufixoUnico()}`;
  expect((await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'financeira' } })).status()).toBe(201);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Financeiro' }).first().click();
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByRole('button', { name: nomeCat }).click();
  await principal(page).click();
  await expect(page.getByRole('heading', { name: 'Quanto é?' })).toBeVisible();

  await conferirComTeclado(page, page.getByLabel('O que é?'), principal(page), 'Nova despesa / descrição');
  await conferirComTeclado(page, page.getByLabel('Valor'), principal(page), 'Nova despesa / valor');
  await expect(principal(page)).toHaveText('Continuar');
});

test('Fechamento da venda: com o teclado aberto, celular, valor e Finalizar ficam à vista', async ({ page }) => {
  const api = await entrarComoDono(page);
  const peca = await criarPeca(api, sufixoUnico(), 5);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).click();
  await page.getByLabel('Buscar').fill(peca.codigo);
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await page.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fechar venda' })).toBeVisible();

  const finalizar = page.getByRole('main').getByRole('button', { name: 'Finalizar', exact: true });
  await conferirComTeclado(page, page.getByLabel('Celular do cliente'), finalizar, 'Fechamento / celular');
  await conferirComTeclado(page, page.getByLabel('Valor desta forma'), finalizar, 'Fechamento / valor');
});
