import { expect, test, type Locator, type Page } from '@playwright/test';

// S05 / UXM-10, no celular da loja (360×640): grade de ações (3 colunas, estilo home do iPhone) e modal em formato de
// pop-up. A evidência vem do navegador real (caixas, rolagem, histórico), nunca de constantes escritas à mão (L-0017).
import { criarPeca, entrarComoDono, sufixoUnico } from './apoio';

const TEMAS = ['dark', 'light'] as const;

async function abrirCatalogo(page: Page, tema: (typeof TEMAS)[number]) {
  await page.goto('/?catalogo');
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.goto('/?catalogo');
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

async function caixa(l: Locator) {
  const c = await l.boundingBox();
  expect(c, 'elemento visível com caixa').not.toBeNull();
  return c as { x: number; y: number; width: number; height: number };
}

async function tresPorLinha(grade: Locator) {
  const botoes = grade.getByRole('button');
  expect(await botoes.count()).toBeGreaterThanOrEqual(4);
  const caixas = [];
  for (let i = 0; i < (await botoes.count()); i++) {
    await botoes.nth(i).scrollIntoViewIfNeeded();
    caixas.push(await caixa(botoes.nth(i)));
  }
  const linhas = new Set(caixas.map((c) => Math.round(c.y + (c.height / 2))));
  // A página não rola, então o teste mede a posição relativa dentro da grade (y muda só por linha).
  return { caixas, colunas: caixas.filter((c) => Math.abs(c.y - caixas[0]!.y) < 4).length, linhas: linhas.size };
}

for (const tema of TEMAS) {
  test(`GradeAcoes (catálogo, tema ${tema}): 3 colunas, alvos ≥ 48 px e sem overflow horizontal`, async ({ page }) => {
    await abrirCatalogo(page, tema);
    const grade = page.locator('[data-grade-acoes]').first();
    await expect(grade).toBeVisible();
    const { caixas, colunas } = await tresPorLinha(grade);
    expect(colunas, 'itens na mesma linha que o primeiro').toBe(3);
    for (const c of caixas) {
      expect(c.width).toBeGreaterThanOrEqual(48);
      expect(c.height).toBeGreaterThanOrEqual(48);
    }
    const sobra = await page.evaluate(() => {
      const g = document.querySelector('[data-grade-acoes]') as HTMLElement;
      const filhos = [...g.querySelectorAll('button')] as HTMLElement[];
      return {
        grade: g.scrollWidth - g.clientWidth,
        documento: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        itens: filhos.filter((b) => b.scrollWidth > b.clientWidth).length,
        fora: filhos.filter((b) => b.getBoundingClientRect().right > window.innerWidth).length,
      };
    });
    expect(sobra).toEqual({ grade: 0, documento: 0, itens: 0, fora: 0 });
  });

  test(`Pop-up (catálogo, tema ${tema}): centralizado, margem ≥ 16 px, ≤ 85dvh, corpo rola e a página não`, async ({ page }) => {
    await abrirCatalogo(page, tema);
    await page.getByRole('button', { name: 'Abrir pop-up longo' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await page.waitForTimeout(400); // fim da animação de entrada
    const c = await caixa(dialogo);
    const janela = page.viewportSize()!;
    expect(c.x, 'margem esquerda').toBeGreaterThanOrEqual(16);
    expect(janela.width - (c.x + c.width), 'margem direita').toBeGreaterThanOrEqual(16);
    expect(Math.abs(c.x - (janela.width - (c.x + c.width))), 'centrado na horizontal').toBeLessThanOrEqual(2);
    expect(Math.abs(c.y - (janela.height - (c.y + c.height))), 'centrado na vertical').toBeLessThanOrEqual(2);
    expect(c.height, 'altura ≤ 85dvh').toBeLessThanOrEqual(janela.height * 0.85 + 1);

    const medidas = await page.evaluate(() => {
      const corpo = document.querySelector('.mantine-Modal-body') as HTMLElement;
      const raiz = document.scrollingElement ?? document.documentElement;
      const antes = corpo.scrollTop;
      corpo.scrollTop = 200;
      return {
        corpoRola: corpo.scrollHeight > corpo.clientHeight && corpo.scrollTop > antes,
        pagina: raiz.scrollHeight,
        janela: window.innerHeight,
        raio: parseFloat(getComputedStyle(document.querySelector('.mantine-Modal-content') as Element).borderTopLeftRadius),
      };
    });
    expect(medidas.corpoRola, 'o corpo do pop-up rola por dentro').toBe(true);
    expect(medidas.pagina, 'a página não rola').toBeLessThanOrEqual(medidas.janela);
    expect(medidas.raio, 'cantos bem arredondados').toBeGreaterThanOrEqual(20);

    const fechar = await caixa(page.locator('.mantine-Modal-close'));
    expect(fechar.width).toBeGreaterThanOrEqual(48);
    expect(fechar.height).toBeGreaterThanOrEqual(48);
  });
}

test('Pop-up: o botão Voltar fecha o pop-up sem sair da tela e o X também fecha', async ({ page }) => {
  await abrirCatalogo(page, 'dark');
  const url = page.url();
  await page.getByRole('button', { name: 'Abrir pop-up', exact: true }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await page.goBack();
  await expect(dialogo).toBeHidden();
  expect(page.url()).toBe(url);

  await page.getByRole('button', { name: 'Abrir pop-up', exact: true }).click();
  await expect(dialogo).toBeVisible();
  await page.locator('.mantine-Modal-close').click();
  await expect(dialogo).toBeHidden();
});

test('Pop-up respeita prefers-reduced-motion (sem transição) e usa ~180 ms no normal', async ({ page }) => {
  await abrirCatalogo(page, 'dark');
  const duracao = async () => {
    await page.getByRole('button', { name: 'Abrir pop-up', exact: true }).click();
    const d = page.getByRole('dialog');
    await expect(d).toBeVisible();
    const t = await d.evaluate((el) => getComputedStyle(el).transitionDuration);
    await page.locator('.mantine-Modal-close').click();
    await expect(d).toBeHidden();
    return t;
  };
  expect(await duracao()).toBe('0.18s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await duracao()).toBe('0s');
});

test('Vendas: grade de ações com ícones; cada toque leva à tela certa', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const peca = await criarPeca(api, sufixo);
  await page.goto('/');
  await page.getByRole('button', { name: 'Vendas' }).click();
  const grade = page.locator('[data-grade-acoes]');
  await expect(grade).toBeVisible();
  const botoes = grade.getByRole('button');
  expect(await botoes.count()).toBe(3);
  const caixas = [await caixa(botoes.nth(0)), await caixa(botoes.nth(1)), await caixa(botoes.nth(2))];
  expect(caixas.every((c) => Math.abs(c.y - caixas[0]!.y) < 4), '3 ações na mesma linha').toBe(true);
  expect(caixas.every((c) => c.width >= 48 && c.height >= 48)).toBe(true);
  expect(await grade.locator('svg').count(), 'um ícone por ação').toBeGreaterThanOrEqual(3);

  // Fechar começa desligado (carrinho vazio) e liga com uma peça.
  await expect(grade.getByRole('button', { name: 'Fechar', exact: true })).toBeDisabled();

  // Toque real em Escanear: a tela de leitura substitui a de montar.
  await grade.getByRole('button', { name: 'Escanear' }).click();
  await expect(page.getByLabel('Buscar')).toBeHidden();
  await page.goto('/');
  await page.getByRole('button', { name: 'Vendas' }).click();
  await expect(page.getByLabel('Buscar')).toBeVisible();

  await page.getByLabel('Buscar').fill(peca.codigo);
  await page.locator('[data-toque="peca"]', { hasText: peca.codigo }).click();
  await page.locator('[data-grade-acoes]').getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page).toHaveURL(/\/vendas\/fechar$/);
  await page.goBack();

  await page.locator('[data-grade-acoes]').getByRole('button', { name: /Gerenciar vendas/ }).click();
  await expect(page).toHaveURL(/\/vendas\/relatorio$/);
});
