import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

// S14c / UXM-09: busca ampla (caracteres soltos, número/valor) e lista paginada em Clientes, Fornecedores, Pedidos de
// compra, Contas a pagar e na busca da Venda, a 360×640. Cada teste cria 16 itens próprios pela API (nomes únicos:
// o banco é compartilhado, L-0008), então a lista filtrada tem 2 páginas. A evidência vem do DOM do navegador (L-0017).
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

const TEMAS = ['dark', 'light'] as const;
const NOMES = ['Alfa', 'Beta', 'Gama', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Teta', 'Iota', 'Capa', 'Lambda', 'Mi', 'Ni', 'Csi', 'Omicron', 'Pi'];
const N = NOMES.length;

const letrasDe = (sufixo: string) => sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);

async function abrirModulo(page: Page, modulo: string, tema: (typeof TEMAS)[number] = 'dark') {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: modulo }).first().click();
}

/** Mede no navegador: sem rolagem de página nem overflow, paginação fixa à vista, alvos >= 48 px. */
async function medirTela(page: Page, onde: string) {
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
  expect(m.largura, `${onde}: overflow horizontal`).toBeLessThanOrEqual(0);
  expect(m.altura, `${onde}: rolagem da página (só o conteúdo rola)`).toBeLessThanOrEqual(0);
  expect(m.nav, `${onde}: paginação presente`).toBe(true);
  expect(m.navDentro, `${onde}: paginação fixa embaixo, à vista`).toBe(true);
  expect(m.navLargura, `${onde}: overflow da paginação`).toBeLessThanOrEqual(0);
  expect(m.menores, `${onde}: botões da paginação < 48 px`).toBe(0);
}

/** Próxima/Anterior trocam os itens; o DOM respeita a página; mudar a busca volta à página 1. */
async function conferirPaginacao(page: Page, itens: Locator, buscaLabel: string, filtro: string, porPagina: number) {
  const texto = page.locator('[data-paginacao-texto]');
  await page.getByLabel(buscaLabel, { exact: true }).fill(filtro);
  await expect(texto).toHaveText('Página 1 de 2');
  expect(await itens.count(), 'itens no DOM da página 1').toBe(porPagina);
  const antes = await itens.first().innerText();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(texto).toHaveText('Página 2 de 2');
  expect(await itens.count(), 'itens no DOM da página 2').toBe(N - porPagina);
  expect(await itens.first().innerText()).not.toBe(antes);
  await page.getByRole('button', { name: 'Anterior' }).click();
  await expect(texto).toHaveText('Página 1 de 2');
  expect(await itens.first().innerText()).toBe(antes);
  // Vai à página 2 e muda a busca: volta à 1.
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(texto).toHaveText('Página 2 de 2');
  await page.getByLabel(buscaLabel, { exact: true }).fill(filtro.slice(0, -1));
  await expect(texto).toHaveText('Página 1 de 2');
  await page.getByLabel(buscaLabel, { exact: true }).fill(filtro);
}

// ----------------------------------------------------------------------------------------------- Clientes

async function criarClientes(api: APIRequestContext, letras: string, sufixo: string) {
  for (let i = 0; i < N; i++) {
    const celular = `219${sufixo.slice(-6)}${String(i).padStart(2, '0')}`;
    const r = await api.post('/clientes', { data: { nome: `Cli ${letras} ${NOMES[i]}`, celular } });
    expect(r.status(), `cliente ${i}`).toBe(201);
  }
}

test('Clientes: busca por caracteres soltos e por pedaço do celular; Próxima/Anterior; mudar a busca volta à pág. 1', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = letrasDe(sufixo);
  await criarClientes(api, letras, sufixo);
  await abrirModulo(page, 'Clientes');
  const cartoes = page.locator('.ailow-bloco');
  await expect(cartoes.first()).toBeVisible();
  const busca = page.getByLabel('Buscar cliente', { exact: true });

  await busca.fill(`epsln ${letras}`); // caracteres soltos de "Epsilon"
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText(`Cli ${letras} Epsilon`);
  await busca.fill(`${letras} lmbd`); // fora de ordem
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Lambda');
  await busca.fill(`${sufixo.slice(-6)}07`); // pedaço do celular (o 8º cliente, "Teta")
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Teta');
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nenhum cliente encontrado')).toBeVisible();

  await conferirPaginacao(page, cartoes, 'Buscar cliente', `cli ${letras}`, 15);
});

for (const tema of TEMAS) {
  test(`Clientes (tema ${tema}): sem rolagem de página nem overflow a 360 px, paginação fixa`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = letrasDe(sufixo);
    await criarClientes(api, letras, sufixo);
    await abrirModulo(page, 'Clientes', tema);
    await page.getByLabel('Buscar cliente', { exact: true }).fill(`cli ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirTela(page, `${tema}/Clientes`);
  });
}

// ------------------------------------------------------------------------------------------- Fornecedores

async function criarFornecedores(api: APIRequestContext, letras: string, sufixo: string) {
  for (let i = 0; i < N; i++) {
    const whatsapp = `219${sufixo.slice(-6)}${String(i).padStart(2, '0')}`;
    const r = await api.post('/fornecedores', { data: { nome: `Forn ${letras} ${NOMES[i]}`, whatsapp, cnpj: null } });
    expect(r.status(), `fornecedor ${i}`).toBe(201);
  }
}

test('Fornecedores: busca por caracteres soltos e pelo WhatsApp; Próxima/Anterior; mudar a busca volta à pág. 1', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = letrasDe(sufixo);
  await criarFornecedores(api, letras, sufixo);
  await abrirModulo(page, 'Compras');
  await page.getByRole('button', { name: /Fornecedores/ }).first().click();
  const cartoes = page.locator('.ailow-bloco');
  await expect(cartoes.first()).toBeVisible();
  const busca = page.getByLabel('Buscar fornecedor', { exact: true });

  await busca.fill(`mcrn ${letras}`); // "Omicron"
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Omicron');
  await busca.fill(`${sufixo.slice(-6)}03`); // WhatsApp do 4º ("Delta")
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Delta');
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nenhum fornecedor encontrado')).toBeVisible();

  await conferirPaginacao(page, cartoes, 'Buscar fornecedor', `forn ${letras}`, 15);
});

for (const tema of TEMAS) {
  test(`Fornecedores (tema ${tema}): sem rolagem de página nem overflow a 360 px, paginação fixa`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = letrasDe(sufixo);
    await criarFornecedores(api, letras, sufixo);
    await abrirModulo(page, 'Compras', tema);
    await page.getByRole('button', { name: /Fornecedores/ }).first().click();
    await page.getByLabel('Buscar fornecedor', { exact: true }).fill(`forn ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirTela(page, `${tema}/Fornecedores`);
  });
}

// ------------------------------------------------------------------------------------------------ Pedidos

async function criarPedidos(api: APIRequestContext, letras: string, sufixo: string) {
  const peca = await criarPeca(api, sufixo, 5);
  const forn = await api.post('/fornecedores', { data: { nome: `Pedforn ${letras}`, whatsapp: `219${sufixo.slice(-6)}99`, cnpj: null } });
  expect(forn.status(), 'fornecedor').toBe(201);
  const { id: fornecedor_id } = (await forn.json()) as { id: string };
  const numeros: number[] = [];
  for (let i = 0; i < N; i++) {
    // Total = custo (1 peça): 10,00 + i centavos → "10,07" identifica o pedido i = 7.
    const r = await api.post('/compras', { data: { fornecedor_id, itens: [{ sku_id: peca.skuId, quantidade: 1, custo_centavos: 1000 + i }] } });
    expect(r.status(), `pedido ${i}`).toBe(201);
    numeros.push(((await r.json()) as { numero: number }).numero);
  }
  return numeros;
}

test('Pedidos de compra: busca por fornecedor solto, número, status e valor; Próxima/Anterior; mudar a busca volta à pág. 1', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = letrasDe(sufixo);
  const numeros = await criarPedidos(api, letras, sufixo);
  await abrirModulo(page, 'Compras');
  await page.getByRole('button', { name: /Pedidos/ }).first().click();
  const cartoes = page.locator('[data-pedido]');
  await expect(cartoes.first()).toBeVisible();
  const busca = page.getByLabel('Buscar pedido', { exact: true });

  await busca.fill(`pdfrn ${letras}`); // caracteres soltos de "Pedforn"
  await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
  await busca.fill(`10,07 ${letras}`); // valor
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText(`Pedido ${numeros[7]}`);
  await busca.fill(`#${numeros[3]}`); // número com #
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText(`Pedido ${numeros[3]}`);
  await busca.fill(`rascunho ${letras}`); // status
  await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nenhum pedido encontrado')).toBeVisible();

  await conferirPaginacao(page, cartoes, 'Buscar pedido', `pedforn ${letras}`, 15);
});

for (const tema of TEMAS) {
  test(`Pedidos de compra (tema ${tema}): sem rolagem de página nem overflow a 360 px, paginação fixa`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = letrasDe(sufixo);
    await criarPedidos(api, letras, sufixo);
    await abrirModulo(page, 'Compras', tema);
    await page.getByRole('button', { name: /Pedidos/ }).first().click();
    await page.getByLabel('Buscar pedido', { exact: true }).fill(`pedforn ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirTela(page, `${tema}/Pedidos`);
  });
}

// ------------------------------------------------------------------------------------------ Contas a pagar

async function criarContas(api: APIRequestContext, letras: string) {
  const cat = await api.post('/categorias', { data: { nome: `Cb ${letras}`, atributos: [], tipo: 'financeira' } });
  expect(cat.status(), 'categoria financeira').toBe(201);
  for (let i = 0; i < N; i++) {
    const r = await api.post('/financeiro/despesas', {
      data: {
        descricao: `Conta ${letras} ${NOMES[i]}`,
        categoria: `Cb ${letras}`,
        valor_centavos: 123400 + i, // R$ 1.234,00 + i centavos
        vencimento: '2031-03-15',
        forma_pagamento: null,
        paga: false,
      },
    });
    expect(r.status(), `despesa ${i}`).toBe(201);
  }
}

test('Contas a pagar: busca por descrição solta, valor e vencimento; Próxima/Anterior; mudar a busca volta à pág. 1', async ({ page }) => {
  const api = await entrarComoDono(page);
  const letras = letrasDe(sufixoUnico());
  await criarContas(api, letras);
  await abrirModulo(page, 'Financeiro');
  await page.getByRole('button', { name: 'Contas a pagar' }).click();
  await expect(page.getByRole('heading', { name: 'Contas a pagar', level: 1 })).toBeVisible();
  const cartoes = page.locator('section[aria-label] .ailow-cartao');
  const busca = page.getByLabel('Buscar conta', { exact: true });
  await expect(busca).toBeVisible();

  await busca.fill(`${letras} psln`); // "Epsilon" solto
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Epsilon');
  await busca.fill(`1234,05 ${letras}`); // valor exato do 6º ("Zeta")
  await expect(cartoes).toHaveCount(1);
  await expect(cartoes.first()).toContainText('Zeta');
  await busca.fill(`15/03/2031 ${letras}`); // vencimento: todas as 16
  await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nenhuma conta encontrada')).toBeVisible();

  await conferirPaginacao(page, cartoes, 'Buscar conta', `conta ${letras}`, 15);
});

for (const tema of TEMAS) {
  test(`Contas a pagar (tema ${tema}): sem rolagem de página nem overflow a 360 px, paginação fixa`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const letras = letrasDe(sufixoUnico());
    await criarContas(api, letras);
    await abrirModulo(page, 'Financeiro', tema);
    await page.getByRole('button', { name: 'Contas a pagar' }).click();
    await page.getByLabel('Buscar conta', { exact: true }).fill(`conta ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirTela(page, `${tema}/Contas a pagar`);
  });
}

// ----------------------------------------------------------------------------------------- Busca da Venda

async function criarProdutosParaVenda(api: APIRequestContext, letras: string, sufixo: string) {
  const cat = await api.post('/categorias', { data: { nome: `E2E venda ${sufixo}`, atributos: [], tipo: 'produto' } });
  const { id: categoria_id } = (await cat.json()) as { id: string };
  for (let i = 0; i < N; i++) {
    const r = await api.post('/produtos', {
      data: {
        nome: `Zv ${letras} ${NOMES[i]}`,
        categoria_id,
        porte: 'slim',
        atributos: [],
        fornecedor: null,
        custo_centavos: 1000,
        preco_centavos: 5500 + i, // R$ 55,00 + i centavos
        skus: [{ tamanho: 'M', cor: 'Azul', estoque_inicial: 3, estoque_minimo: 0 }],
      },
    });
    expect(r.status(), `produto ${i}`).toBe(201);
  }
}

test('Venda, busca da peça: caracteres soltos, valor e código; Próxima/Anterior; mudar a busca volta à pág. 1', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const letras = letrasDe(sufixo);
  await criarProdutosParaVenda(api, letras, sufixo);
  await abrirModulo(page, 'Vendas');
  const pecas = page.locator('[data-toque="peca"]');
  const busca = page.getByLabel('Buscar', { exact: true });
  await expect(busca).toBeVisible();

  await busca.fill(`zv ${letras} dlt`); // "Delta" solto
  await expect(pecas).toHaveCount(1);
  await expect(pecas.first()).toContainText(`Zv ${letras} Delta`);
  await busca.fill(`55,09 ${letras}`); // valor do 10º ("Capa")
  await expect(pecas).toHaveCount(1);
  await expect(pecas.first()).toContainText('Capa');
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nenhuma peça com esse texto')).toBeVisible();

  await conferirPaginacao(page, pecas, 'Buscar', `zv ${letras}`, 10);
});

for (const tema of TEMAS) {
  test(`Venda, busca da peça (tema ${tema}): sem rolagem de página nem overflow a 360 px, paginação fixa`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = letrasDe(sufixo);
    await criarProdutosParaVenda(api, letras, sufixo);
    await abrirModulo(page, 'Vendas', tema);
    await page.getByLabel('Buscar', { exact: true }).fill(`zv ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirTela(page, `${tema}/Venda`);
  });
}
