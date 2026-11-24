import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// P02 (plano "Aprimoramentos voz 23/11"), no celular da loja (360×640): Produtos em Lista | Catálogo, com Filtros de
// categoria e cor (exata, D-A7) aplicados NA API (?categoria_id, ?cor, P01). Categoria e cores nascem com nome único,
// então a contagem de cartões vale num banco compartilhado (L-0008, L-0025).
// E2E_CAPTURAS=<pasta> salva screenshots das 2 visões nos 2 temas (só para revisão humana).

const pasta = process.env.E2E_CAPTURAS;
const letras = (s: string) => s.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);

interface Montado {
  catA: string;
  nomeCatA: string;
  corY: string;
  ax: string;
  ay: string;
  by: string;
}

/** Categorias A e B; cores X e Y na grade da empresa; produtos A-X, A-Y e B-Y. */
async function montar(api: APIRequestContext, sufixo: string): Promise<Montado> {
  const categoria = async (nome: string) => {
    const r = await api.post('/categorias', { data: { nome, atributos: [], tipo: 'produto' } });
    expect(r.status(), `categoria ${nome}`).toBe(201);
    return ((await r.json()) as { id: string }).id;
  };
  const nomeCatA = `E2E Filtro A ${sufixo}`;
  const catA = await categoria(nomeCatA);
  const catB = await categoria(`E2E Filtro B ${sufixo}`);
  const corX = `Fx${letras(sufixo)}`;
  const corY = `Fy${letras(sufixo)}`;
  for (const nome of [corX, corY]) {
    const r = await api.post('/opcoes-grade', { data: { tipo: 'cor', nome } });
    expect(r.status(), `cor ${nome}`).toBe(201);
  }
  const produto = async (nome: string, categoria_id: string, cor: string) => {
    const r = await api.post('/produtos', {
      data: {
        nome,
        categoria_id,
        porte: 'slim',
        atributos: [],
        fornecedor: null,
        custo_centavos: 4000,
        preco_centavos: 9900,
        skus: [{ tamanho: 'M', cor, estoque_inicial: 3, estoque_minimo: 0 }],
      },
    });
    expect(r.status(), `produto ${nome}`).toBe(201);
    return nome;
  };
  return {
    catA,
    nomeCatA,
    corY,
    ax: await produto(`Filtro AX ${sufixo}`, catA, corX),
    ay: await produto(`Filtro AY ${sufixo}`, catA, corY),
    by: await produto(`Filtro BY ${sufixo}`, catB, corY),
  };
}

async function abrirProdutos(page: Page, tema: 'dark' | 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('mantine-color-scheme-value', t);
    localStorage.removeItem('ailow-produtos-visao');
  }, tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await expect(page.getByLabel('Buscar produto')).toBeVisible();
}

/** Abre Filtros, escolhe e aplica; devolve a URL do GET /produtos que a lista fez com os filtros. */
async function aplicarFiltros(page: Page, escolha: { categoria?: string; cor?: string }, naUrl: string): Promise<string> {
  await page.getByRole('button', { name: /^Filtros/ }).click();
  const dialogo = page.getByRole('dialog', { name: 'Filtros' });
  await expect(dialogo.locator('[data-filtros-produtos]')).toBeVisible();
  if (escolha.categoria) await dialogo.getByLabel('Categoria').selectOption({ label: escolha.categoria });
  if (escolha.cor) await dialogo.getByLabel('Cor').selectOption({ label: escolha.cor });
  const pedido = page.waitForRequest((r) => r.method() === 'GET' && /\/produtos\?/.test(r.url()) && r.url().includes(naUrl));
  await dialogo.getByRole('button', { name: 'Aplicar' }).click();
  await expect(dialogo).toBeHidden();
  return (await pedido).url();
}

const cartoes = (page: Page) => page.locator('.ailow-cartao');

async function nomesNaTela(page: Page): Promise<string[]> {
  await expect(page.getByLabel('Carregando')).toHaveCount(0);
  return (await cartoes(page).allInnerTexts()).map((t) => t.split('\n')[0]!.trim()).sort();
}

async function semSobraHorizontal(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const fora = [...document.querySelectorAll('main button, main .ailow-cartao')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > window.innerWidth + 0.5 || r.left < -0.5);
    }).length;
    return { documento: doc.scrollWidth - doc.clientWidth, fora };
  });
}

test('P02: filtrar por categoria e por cor muda o resultado pela API; trocar Lista/Catálogo mantém os filtros', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const m = await montar(api, sufixo);
  await abrirProdutos(page, 'dark');

  // Categoria A: só AX e AY, e a lista pediu ao servidor com categoria_id.
  const urlCategoria = await aplicarFiltros(page, { categoria: m.nomeCatA }, `categoria_id=${m.catA}`);
  expect(urlCategoria).not.toContain('cor=');
  expect(await nomesNaTela(page)).toEqual([m.ax, m.ay].sort());
  await expect(page.getByRole('button', { name: `Tirar filtro Categoria: ${m.nomeCatA}` })).toBeVisible();

  // + cor Y: só AY, com os dois filtros na mesma consulta.
  const urlAmbos = await aplicarFiltros(page, { cor: m.corY }, `cor=${encodeURIComponent(m.corY)}`);
  expect(urlAmbos).toContain(`categoria_id=${m.catA}`);
  expect(await nomesNaTela(page)).toEqual([m.ay]);
  await expect(page.getByRole('button', { name: 'Filtros (2)' })).toBeVisible();

  // Catálogo: mesmos filtros, mesmo resultado, em tiles; tocar abre o detalhe do produto.
  await page.locator('[data-visao-produtos]').getByText('Catálogo', { exact: true }).click();
  await expect(page.locator('[data-catalogo-produtos]')).toBeVisible();
  expect(await nomesNaTela(page)).toEqual([m.ay]);
  await expect(page.locator('[data-chip-filtro]')).toHaveCount(2);
  await page.locator('[data-catalogo-produtos] .ailow-cartao', { hasText: m.ay }).click();
  const detalhe = page.getByRole('dialog', { name: 'Produto', exact: true });
  await expect(detalhe.getByText(m.ay, { exact: true })).toBeVisible();
  // Como em produtos-crud: o Voltar logo no 1º instante chega antes de o router assumir a entrada do pop-up.
  await page.waitForTimeout(400);
  await page.goBack();
  await expect(detalhe).toBeHidden();

  // De volta à Lista: filtros continuam.
  await page.locator('[data-visao-produtos]').getByText('Lista', { exact: true }).click();
  await expect(page.locator('[data-catalogo-produtos]')).toHaveCount(0);
  expect(await nomesNaTela(page)).toEqual([m.ay]);

  // Tirar só a categoria: fica a cor Y (AY e BY), consulta só com cor.
  const pedidoSoCor = page.waitForRequest((r) => /\/produtos\?/.test(r.url()) && r.url().includes('cor='));
  await page.getByRole('button', { name: `Tirar filtro Categoria: ${m.nomeCatA}` }).click();
  expect((await pedidoSoCor).url()).not.toContain('categoria_id=');
  expect(await nomesNaTela(page)).toEqual([m.ay, m.by].sort());

  // Busca combinada com o filtro: o sufixo de BY casa só ele.
  await page.getByLabel('Buscar produto').fill(`BY ${sufixo}`);
  await expect.poll(() => nomesNaTela(page)).toEqual([m.by]);

  // Limpar filtros: os chips somem.
  await page.getByLabel('Buscar produto').fill('');
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('[data-chip-filtro]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Filtros', exact: true })).toBeVisible();
});

for (const tema of ['dark', 'light'] as const) {
  test(`P02 (tema ${tema}): Lista e Catálogo com filtros cabem em 360 px, sem rolagem horizontal`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const m = await montar(api, sufixoUnico());
    await abrirProdutos(page, tema);
    await aplicarFiltros(page, { categoria: m.nomeCatA }, `categoria_id=${m.catA}`);
    expect(await nomesNaTela(page)).toEqual([m.ax, m.ay].sort());

    for (const visao of ['Lista', 'Catálogo'] as const) {
      await page.locator('[data-visao-produtos]').getByText(visao, { exact: true }).click();
      await expect(page.locator('[data-catalogo-produtos]')).toHaveCount(visao === 'Catálogo' ? 1 : 0);
      expect(await semSobraHorizontal(page), `${visao} ${tema}`).toEqual({ documento: 0, fora: 0 });
      if (visao === 'Catálogo') {
        // O nome do produto não pode ser espremido pelo preço no tile de 2 colunas (quebra letra a letra).
        const larguras = await page.locator('[data-catalogo-produtos] .ailow-cartao').evaluateAll((tiles) =>
          tiles.map((t) => (t.querySelector('p') as HTMLElement).getBoundingClientRect().width),
        );
        for (const w of larguras) expect(w).toBeGreaterThanOrEqual(90);
      }
      const filtros = await page.getByRole('button', { name: /^Filtros/ }).boundingBox();
      expect(filtros?.height ?? 0).toBeGreaterThanOrEqual(44);
      if (pasta) {
        await page.locator('[data-visao-produtos]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${pasta}/p02-${visao === 'Lista' ? 'lista' : 'catalogo'}-${tema}.png` });
      }
    }
  });
}
