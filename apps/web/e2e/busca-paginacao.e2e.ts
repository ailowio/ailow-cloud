import { expect, test, type Page } from '@playwright/test';

// S07 / UXM-09: busca ampla (caracteres soltos, código, preço) e lista paginada em Produtos e Etiquetas, a 360×640.
// A evidência vem do navegador (nós do DOM, rolagem, caixas), não de constantes (L-0017). Dados do próprio teste.
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

const TEMAS = ['dark', 'light'] as const;
const POR_PAGINA = { Produtos: 20, Etiquetas: 6 } as const;

async function criarCamiseta(page: Page) {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const cat = await api.post('/categorias', { data: { nome: `E2E busca ${sufixo}`, atributos: [], tipo: 'produto' } });
  const { id: categoria_id } = (await cat.json()) as { id: string };
  const nome = `Camiseta branca ${letras}`;
  const prod = await api.post('/produtos', {
    data: {
      nome,
      categoria_id,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 1000,
      preco_centavos: 7777,
      skus: [{ tamanho: 'G', cor: 'Branca', estoque_inicial: 2, estoque_minimo: 0 }],
    },
  });
  expect(prod.status(), 'produto').toBe(201);
  const { skus } = (await prod.json()) as { skus: { codigo: string }[] };
  return { nome, letras, codigo: skus[0]!.codigo };
}

/**
 * Lote próprio para a paginação: 21 produtos (> 20 de Produtos e > 6 de Etiquetas) com uma marca única de 16 letras
 * (a busca aceita caracteres soltos; uma marca curta casaria com dados de outros testes). O banco pode estar limpo
 * (e2e.sh) ou cheio (dev): o teste filtra pela marca e não depende de quanto já existe.
 */
async function criarLote(page: Page) {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const marca = `${letras}${letras}`;
  const cat = await api.post('/categorias', { data: { nome: `E2E lote ${sufixo}`, atributos: [], tipo: 'produto' } });
  expect(cat.status(), 'categoria').toBe(201);
  const { id: categoria_id } = (await cat.json()) as { id: string };
  for (let i = 0; i < 21; i++) {
    const prod = await api.post('/produtos', {
      data: {
        nome: `Lote ${marca} ${String(i).padStart(2, '0')}`,
        categoria_id,
        porte: 'slim',
        atributos: [],
        fornecedor: null,
        custo_centavos: 1000,
        preco_centavos: 3000 + i,
        skus: [{ tamanho: 'M', cor: 'Azul', estoque_inicial: 1, estoque_minimo: 0 }],
      },
    });
    expect(prod.status(), `produto ${i} do lote`).toBe(201);
  }
  return marca;
}

async function abrir(page: Page, tela: 'Produtos' | 'Etiquetas', tema: (typeof TEMAS)[number]) {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  if (tela === 'Etiquetas') await page.getByRole('button', { name: 'Etiquetas' }).click();
  await expect(page.locator('.ailow-cartao').first()).toBeVisible();
}

const cartoes = (page: Page) => page.locator('.ailow-cartao');
const primeiro = (page: Page) => cartoes(page).first().innerText();

for (const tela of ['Produtos', 'Etiquetas'] as const) {
  test(`${tela}: busca por caracteres soltos, código e preço acha a peça`, async ({ page }) => {
    const c = await criarCamiseta(page);
    await abrir(page, tela, 'dark');
    const busca = page.getByLabel('Buscar produto');

    // "cmst bra <letras>": caracteres soltos de "Camiseta" + "branca" + o sufixo único.
    await busca.fill(`cmst bra ${c.letras}`);
    await expect(cartoes(page)).toHaveCount(1);
    await expect(cartoes(page).first()).toContainText(c.nome);

    // Tokens fora de ordem.
    await busca.fill(`${c.letras} bra cmst`);
    await expect(cartoes(page)).toHaveCount(1);

    // Por código do SKU.
    await busca.fill(c.codigo);
    await expect(cartoes(page).first()).toContainText(c.nome);

    // Por preço: "77,77" e "7777" (centavos), junto do sufixo para isolar a peça.
    await busca.fill(`77,77 ${c.letras}`);
    await expect(cartoes(page)).toHaveCount(1);
    await busca.fill(`7777 ${c.letras}`);
    await expect(cartoes(page)).toHaveCount(1);

    // Sem resultado.
    await busca.fill('qqqzzzxxx');
    await expect(page.getByText('Nada encontrado')).toBeVisible();
  });

  test(`${tela}: Próxima/Anterior trocam os itens, o DOM respeita o tamanho da página e a busca volta à página 1`, async ({ page }) => {
    const marca = await criarLote(page);
    await abrir(page, tela, 'dark');
    const max = POR_PAGINA[tela];
    await page.getByLabel('Buscar produto').fill(marca);
    const texto = page.locator('[data-paginacao-texto]');
    await expect(texto).toContainText(/Página 1 de \d+/);
    expect(await cartoes(page).count()).toBeLessThanOrEqual(max);

    const antes = await primeiro(page);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(texto).toContainText(/Página 2 de/);
    expect(await primeiro(page)).not.toBe(antes);
    expect(await cartoes(page).count()).toBeLessThanOrEqual(max);
    await page.getByRole('button', { name: 'Anterior' }).click();
    await expect(texto).toContainText(/Página 1 de/);
    expect(await primeiro(page)).toBe(antes);

    // Vai à página 2 e muda a busca: volta à 1.
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(texto).toContainText(/Página 2 de/);
    await page.getByLabel('Buscar produto').fill('e');
    await expect(texto).toContainText(/Página 1 de/);
  });

  for (const tema of TEMAS) {
    test(`${tela} (tema ${tema}): sem rolagem de página nem overflow a 360 px; paginação com alvos ≥ 48 px`, async ({ page }) => {
      const marca = await criarLote(page);
      await abrir(page, tela, tema);
      await page.getByLabel('Buscar produto').fill(marca);
      await expect(page.locator('[data-paginacao-texto]')).toContainText(/Página 1 de [2-9]/);
      await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
      const m = await page.evaluate(() => {
        const raiz = document.documentElement;
        const nav = document.querySelector('nav[aria-label="Paginação"]') as HTMLElement | null;
        const botoes = nav ? [...nav.querySelectorAll('button')].map((b) => b.getBoundingClientRect()) : [];
        return {
          largura: raiz.scrollWidth - raiz.clientWidth,
          altura: raiz.scrollHeight - raiz.clientHeight,
          nav: nav !== null,
          navDentro: nav ? nav.getBoundingClientRect().bottom <= window.innerHeight + 1 : false,
          navLargura: nav ? nav.scrollWidth - nav.clientWidth : 0,
          menores: botoes.filter((b) => b.height < 48 || b.width < 48).length,
        };
      });
      expect(m.largura, 'overflow horizontal').toBeLessThanOrEqual(0);
      expect(m.altura, 'rolagem da página (só o conteúdo rola)').toBeLessThanOrEqual(0);
      expect(m.nav, 'paginação presente').toBe(true);
      expect(m.navDentro, 'paginação fixa embaixo, à vista').toBe(true);
      expect(m.navLargura, 'overflow da paginação').toBeLessThanOrEqual(0);
      expect(m.menores, 'botões da paginação < 48 px').toBe(0);
    });
  }
}
