import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// S05 / UXM-10, no celular da loja (360×640): grade de ações (3 colunas, estilo home do iPhone) e modal em formato de
// pop-up. A evidência vem do navegador real (caixas, rolagem, histórico), nunca de constantes escritas à mão (L-0017).
// S16: as telas de verdade (o catálogo `/?catalogo` só existe no build de dev, não no de produção do e2e.sh): o pop-up
// de detalhe do produto (Produtos) traz a GradeAcoes com 4 ações e, com 12 variações, tem conteúdo longo para rolar.
import { criarPeca, entrarComoDono, sufixoUnico } from './apoio';

const TEMAS = ['dark', 'light'] as const;
const TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', '36', '38', '40', '42', '44', '46'];

/** Produto com 12 variações (dados do próprio teste, nome único): o pop-up de detalhe fica mais alto que a tela. */
async function criarProdutoLongo(api: APIRequestContext): Promise<string> {
  const sufixo = sufixoUnico();
  const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const cat = await api.post('/categorias', { data: { nome: `E2E pop ${sufixo}`, atributos: [], tipo: 'produto' } });
  expect(cat.status(), 'categoria').toBe(201);
  const { id: categoria_id } = (await cat.json()) as { id: string };
  const nome = `Pop ${letras}${letras}`;
  const prod = await api.post('/produtos', {
    data: {
      nome,
      categoria_id,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 1000,
      preco_centavos: 6000,
      skus: TAMANHOS.map((tamanho) => ({ tamanho, cor: 'Azul', estoque_inicial: 2, estoque_minimo: 0 })),
    },
  });
  expect(prod.status(), 'produto com 12 variações').toBe(201);
  return nome;
}

/** Login, produto longo pela API, tela Produtos, busca pelo nome e toque no cartão: abre o pop-up de detalhe. */
async function abrirDetalhe(page: Page, tema: (typeof TEMAS)[number]) {
  const api = await entrarComoDono(page);
  const nome = await criarProdutoLongo(api);
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.goto('/');
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByLabel('Buscar produto').fill(nome);
  await page.locator('.ailow-cartao', { hasText: nome }).first().click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await page.waitForTimeout(400); // fim da animação de entrada
  return dialogo;
}

async function caixa(l: Locator) {
  const c = await l.boundingBox();
  expect(c, 'elemento visível com caixa').not.toBeNull();
  return c as { x: number; y: number; width: number; height: number };
}

for (const tema of TEMAS) {
  test(`GradeAcoes (detalhe do produto, tema ${tema}): 3 colunas, alvos ≥ 48 px e sem overflow horizontal`, async ({ page }) => {
    const dialogo = await abrirDetalhe(page, tema);
    const grade = dialogo.locator('[data-grade-acoes]');
    await grade.scrollIntoViewIfNeeded();
    await expect(grade).toBeVisible();
    // Todas as caixas no mesmo instante (um só evaluate), para a rolagem do corpo não deslocar as linhas.
    const m = await grade.evaluate((g) => {
      const botoes = [...g.querySelectorAll('button')] as HTMLElement[];
      const caixas = botoes.map((b) => b.getBoundingClientRect());
      return {
        n: caixas.length,
        colunas: caixas.filter((c) => Math.abs(c.y - caixas[0]!.y) < 4).length,
        menores: caixas.filter((c) => c.width < 48 || c.height < 48).length,
        grade: g.scrollWidth - g.clientWidth,
        documento: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        itens: botoes.filter((b) => b.scrollWidth > b.clientWidth).length,
        fora: botoes.filter((b) => b.getBoundingClientRect().right > window.innerWidth).length,
      };
    });
    expect(m.n, 'ações na grade').toBeGreaterThanOrEqual(4);
    expect(m.colunas, 'itens na mesma linha que o primeiro').toBe(3);
    expect(m.menores, 'alvos menores que 48 px').toBe(0);
    expect({ grade: m.grade, documento: m.documento, itens: m.itens, fora: m.fora }).toEqual({ grade: 0, documento: 0, itens: 0, fora: 0 });
  });

  test(`Pop-up (detalhe do produto, tema ${tema}): centralizado, margem ≥ 16 px, ≤ 85dvh, corpo rola e a página não`, async ({ page }) => {
    const dialogo = await abrirDetalhe(page, tema);
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
  const api = await entrarComoDono(page);
  const nome = await criarProdutoLongo(api);
  await page.goto('/');
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByLabel('Buscar produto').fill(nome);
  const cartao = page.locator('.ailow-cartao', { hasText: nome }).first();
  await expect(cartao).toBeVisible();
  const url = page.url();
  await cartao.click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await page.goBack();
  await expect(dialogo).toBeHidden();
  expect(page.url()).toBe(url);

  await cartao.click();
  await expect(dialogo).toBeVisible();
  await page.locator('.mantine-Modal-close').click();
  await expect(dialogo).toBeHidden();
});

test('Pop-up respeita prefers-reduced-motion (sem transição) e usa ~180 ms no normal', async ({ page }) => {
  const api = await entrarComoDono(page);
  const nome = await criarProdutoLongo(api);
  await page.goto('/');
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByLabel('Buscar produto').fill(nome);
  const cartao = page.locator('.ailow-cartao', { hasText: nome }).first();
  await expect(cartao).toBeVisible();
  const duracao = async () => {
    await cartao.click();
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
