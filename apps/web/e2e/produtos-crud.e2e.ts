import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// S09 / UXM-10, no celular da loja (360×640): Produtos com menu de ícones, pop-up de detalhe e CRUD (editar e
// arquivar). A evidência vem do navegador real e da API (persistência), nunca de constantes escritas à mão (L-0017).

interface SkuApi {
  id: string;
  codigo: string;
  tamanho: string;
  cor: string;
  estoque: number;
  estoque_minimo?: number;
}
interface ProdutoApi {
  id: string;
  numero: number;
  nome: string;
  categoria_id: string;
  categoria_nome: string;
  preco_centavos: number;
  custo_centavos?: number;
  skus: SkuApi[];
}

interface Montado {
  id: string;
  nome: string;
  categoriaA: string;
  categoriaB: string;
  nomeCategoriaB: string;
}

/** Duas categorias de produto e um produto com 2 SKUs (M com 5 e G com 3, mínimo 4: "baixo"). */
async function montarProduto(api: APIRequestContext, sufixo: string): Promise<Montado> {
  const criarCategoria = async (nome: string) => {
    const r = await api.post('/categorias', { data: { nome, atributos: [], tipo: 'produto' } });
    expect(r.status(), `categoria ${nome}`).toBe(201);
    return ((await r.json()) as { id: string }).id;
  };
  const nomeCategoriaB = `E2E B ${sufixo}`;
  const categoriaA = await criarCategoria(`E2E A ${sufixo}`);
  const categoriaB = await criarCategoria(nomeCategoriaB);
  const nome = `Peça S09 ${sufixo}`;
  const cor = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const prod = await api.post('/produtos', {
    data: {
      nome,
      categoria_id: categoriaA,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 4000,
      preco_centavos: 9900,
      skus: [
        { tamanho: 'M', cor: `Cor${cor}`, estoque_inicial: 5, estoque_minimo: 0 },
        { tamanho: 'G', cor: `Cor${cor}`, estoque_inicial: 3, estoque_minimo: 4 },
      ],
    },
  });
  expect(prod.status(), 'produto').toBe(201);
  const { id } = (await prod.json()) as { id: string };
  return { id, nome, categoriaA, categoriaB, nomeCategoriaB };
}

async function doApi(api: APIRequestContext, id: string): Promise<ProdutoApi | undefined> {
  const r = await api.get('/produtos');
  expect(r.ok(), 'lista de produtos').toBe(true);
  return ((await r.json()) as { produtos: ProdutoApi[] }).produtos.find((p) => p.id === id);
}

async function abrirProdutos(page: Page, tema: 'dark' | 'light' = 'dark') {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await expect(page.getByLabel('Buscar produto')).toBeVisible();
}

async function abrirDetalhe(page: Page, nome: string): Promise<Locator> {
  await page.getByLabel('Buscar produto').fill(nome);
  await page.locator('.ailow-cartao', { hasText: nome }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Produto', exact: true });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.locator('[data-detalhe-produto]')).toBeVisible();
  return dialogo;
}

const reais = (c: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100).replace(/\s/g, ' ');

async function semSobra(page: Page, seletor: string) {
  return page.evaluate((sel) => {
    const g = document.querySelector(sel) as HTMLElement;
    const botoes = [...g.querySelectorAll('button')] as HTMLElement[];
    const raiz = document.scrollingElement ?? document.documentElement;
    return {
      grade: g.scrollWidth - g.clientWidth,
      documento: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      paginaRola: raiz.scrollHeight > window.innerHeight,
      itens: botoes.filter((b) => b.scrollWidth > b.clientWidth).length,
      fora: botoes.filter((b) => b.getBoundingClientRect().right > window.innerWidth || b.getBoundingClientRect().left < 0).length,
    };
  }, seletor);
}

async function tresColunasAlvos48(grade: Locator, esperados: number) {
  const botoes = grade.getByRole('button');
  expect(await botoes.count()).toBe(esperados);
  const caixas = [];
  for (let i = 0; i < esperados; i++) {
    await botoes.nth(i).scrollIntoViewIfNeeded();
    const c = await botoes.nth(i).boundingBox();
    expect(c).not.toBeNull();
    caixas.push(c as { x: number; y: number; width: number; height: number });
  }
  const naPrimeiraLinha = caixas.filter((c) => Math.abs(c.y - caixas[0]!.y) < 4).length;
  expect(naPrimeiraLinha, 'colunas da grade').toBe(Math.min(3, esperados));
  for (const c of caixas) {
    expect(c.width).toBeGreaterThanOrEqual(48);
    expect(c.height).toBeGreaterThanOrEqual(48);
  }
}

for (const tema of ['dark', 'light'] as const) {
  test(`Produtos (Dono, tema ${tema}): menu em ícones, 3 colunas, alvos ≥ 48 px, sem overflow nem rolagem de página; o pop-up também`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const m = await montarProduto(api, sufixoUnico());
    await abrirProdutos(page, tema);
    const grade = page.locator('[data-grade-acoes]').first();
    await expect(grade).toBeVisible();
    await tresColunasAlvos48(grade, 3);
    expect(await grade.locator('svg').count(), 'um ícone por ação').toBeGreaterThanOrEqual(3);
    for (const nome of ['Novo produto', 'Etiquetas']) await expect(grade.getByRole('button', { name: nome })).toBeVisible();
    expect(await semSobra(page, '[data-grade-acoes]')).toEqual({ grade: 0, documento: 0, paginaRola: false, itens: 0, fora: 0 });

    const dialogo = await abrirDetalhe(page, m.nome);
    await page.waitForTimeout(400);
    const gradeModal = dialogo.locator('[data-grade-acoes]');
    await tresColunasAlvos48(gradeModal, 4);
    const sobra = await page.evaluate(() => {
      const corpo = document.querySelector('.mantine-Modal-body') as HTMLElement;
      const raiz = document.scrollingElement ?? document.documentElement;
      return { corpo: corpo.scrollWidth - corpo.clientWidth, documento: document.documentElement.scrollWidth - document.documentElement.clientWidth, paginaRola: raiz.scrollHeight > window.innerHeight };
    });
    expect(sobra).toEqual({ corpo: 0, documento: 0, paginaRola: false });
  });
}

test('(a) tocar no produto abre o pop-up com SKUs, estoque e preço iguais aos da API; Voltar fecha só o pop-up', async ({ page }) => {
  const api = await entrarComoDono(page);
  const m = await montarProduto(api, sufixoUnico());
  await abrirProdutos(page);
  const url = page.url();
  const dialogo = await abrirDetalhe(page, m.nome);

  const esperado = (await doApi(api, m.id)) as ProdutoApi;
  expect(esperado.skus).toHaveLength(2);
  await expect(dialogo).toContainText(m.nome);
  await expect(dialogo).toContainText(`E2E A`);
  await expect(dialogo).toContainText(reais(esperado.preco_centavos));
  await expect(dialogo).toContainText(reais(esperado.custo_centavos as number));
  for (const s of esperado.skus) {
    const linha = dialogo.locator(`[data-sku-codigo="${s.codigo}"]`);
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(s.tamanho);
    await expect(linha).toContainText(s.cor);
    await expect(linha).toContainText(s.estoque < (s.estoque_minimo ?? 0) ? `Baixo · ${s.estoque}` : `${s.estoque} em estoque`);
  }

  await page.goBack();
  await expect(dialogo).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.getByLabel('Buscar produto')).toBeVisible();
});

test('Chegou mercadoria no pop-up: escolhe a variação, lança a entrada e o saldo muda na API', async ({ page }) => {
  const api = await entrarComoDono(page);
  const m = await montarProduto(api, sufixoUnico());
  await abrirProdutos(page);
  const dialogo = await abrirDetalhe(page, m.nome);
  const antes = (await doApi(api, m.id)) as ProdutoApi;
  const alvo = antes.skus.find((s) => s.tamanho === 'G') as SkuApi;

  await dialogo.getByRole('button', { name: 'Chegou mercadoria' }).click();
  await dialogo.locator(`[data-sku-codigo="${alvo.codigo}"]`).click();
  const folha = page.getByRole('dialog', { name: 'Peça', exact: true });
  await expect(folha).toBeVisible();
  await folha.getByLabel('Quantas peças?').fill('2');
  await folha.getByLabel('Motivo').fill('Chegou pedido');
  await folha.getByRole('button', { name: 'Registrar' }).click();
  await expect.poll(async () => ((await doApi(api, m.id)) as ProdutoApi).skus.find((s) => s.id === alvo.id)?.estoque).toBe(alvo.estoque + 2);
});

test('(b) editar: valida sem mover o layout e persiste nome, preço, custo e categoria; a lista reflete', async ({ page }) => {
  test.setTimeout(90_000); // cada aviso de erro dura 5 s e o teste espera cada um sumir

  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const m = await montarProduto(api, sufixo);
  await abrirProdutos(page);
  const dialogo = await abrirDetalhe(page, m.nome);
  await dialogo.getByRole('button', { name: 'Editar' }).click();
  const form = page.getByRole('dialog', { name: 'Editar produto' });
  await expect(form).toBeVisible();
  await page.waitForTimeout(400);

  const nome = form.getByLabel('Nome');
  const preco = form.getByLabel('Preço de venda');
  const custo = form.getByLabel('Custo');
  const salvar = form.getByRole('button', { name: 'Salvar' });
  await expect(nome).toHaveValue(m.nome);
  await expect(preco).toHaveValue('99,00');
  await expect(custo).toHaveValue('40,00');
  expect(await nome.getAttribute('maxlength'), 'nome limitado a 80').toBe('80');

  const medir = async () => ({
    janela: await page.evaluate(() => ({ h: window.innerHeight, rola: (document.scrollingElement ?? document.documentElement).scrollHeight > window.innerHeight })),
    salvar: await salvar.boundingBox(),
    form: await form.boundingBox(),
  });
  // O corpo do pop-up rola por dentro: leva o Salvar à vista antes de medir (senão o clique é que o moveria).
  await salvar.scrollIntoViewIfNeeded();
  const antes = await medir();

  const tentativas: [string, () => Promise<void>, RegExp][] = [
    ['nome vazio', async () => { await nome.fill(''); }, /nome/i],
    ['preço zero', async () => { await nome.fill(m.nome); await preco.fill('0'); }, /Preço/],
    ['preço negativo', async () => { await preco.fill('-5'); }, /Preço/],
    ['preço vazio', async () => { await preco.fill(''); }, /Preço/],
    ['custo negativo', async () => { await preco.fill('99,00'); await custo.fill('-3'); }, /Custo/],
  ];
  for (const [rotulo, preparar, aviso] of tentativas) {
    await preparar();
    await salvar.click();
    await expect(page.locator('.mantine-Notification-root', { hasText: aviso }).first(), rotulo).toBeVisible();
    const depois = await medir();
    expect(depois, `${rotulo}: layout e viewport iguais`).toEqual(antes);
    await page.locator('.mantine-Notification-root').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => undefined);
  }
  // Nada foi salvo pelas tentativas inválidas.
  const intacto = (await doApi(api, m.id)) as ProdutoApi;
  expect(intacto).toMatchObject({ nome: m.nome, preco_centavos: 9900, custo_centavos: 4000 });

  // Edição válida.
  const novoNome = `Peça S09 editada ${sufixo}`;
  await nome.fill(novoNome);
  await preco.fill('123,45');
  await custo.fill('50,00');
  await form.getByRole('button', { name: m.nomeCategoriaB }).click();
  await salvar.click();
  await expect(form).toBeHidden();

  const salvo = (await doApi(api, m.id)) as ProdutoApi;
  expect(salvo).toMatchObject({ nome: novoNome, preco_centavos: 12_345, custo_centavos: 5000, categoria_id: m.categoriaB });
  // O pop-up de detalhe mostra os dados novos e, fechado, a lista também.
  await expect(dialogo).toContainText(novoNome);
  await expect(dialogo).toContainText(reais(12_345));
  await page.goBack();
  await expect(dialogo).toBeHidden();
  await page.getByLabel('Buscar produto').fill(novoNome);
  await expect(page.locator('.ailow-cartao', { hasText: novoNome }).first()).toContainText(reais(12_345));
});

test('(c) arquivar pede confirmação: cancelar não altera; confirmar tira da lista, mas o estoque fica', async ({ page }) => {
  const api = await entrarComoDono(page);
  const m = await montarProduto(api, sufixoUnico());
  await abrirProdutos(page);
  const dialogo = await abrirDetalhe(page, m.nome);

  await dialogo.getByRole('button', { name: 'Arquivar' }).click();
  const confirma = page.getByRole('dialog', { name: 'Arquivar produto' });
  await expect(confirma).toBeVisible();
  await expect(confirma).toContainText(m.nome);
  await confirma.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirma).toBeHidden();
  await expect(dialogo).toBeVisible();
  expect(await doApi(api, m.id), 'cancelar não altera').toBeTruthy();

  await dialogo.getByRole('button', { name: 'Arquivar' }).click();
  await expect(confirma).toBeVisible();
  await confirma.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(confirma).toBeHidden();
  expect(await doApi(api, m.id), 'sumiu da lista ativa').toBeUndefined();
  await page.getByLabel('Buscar produto').fill(m.nome);
  await expect(page.getByText('Nada encontrado')).toBeVisible();
});

test('(d) Vendedor vê o pop-up com SKUs e preço, mas sem custo, sem editar, sem arquivar e sem mexer no estoque', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const m = await montarProduto(api, sufixo);
  const pin = '2468';
  const criado = await api.post('/usuarios', { data: { nome: `Vend S09 ${sufixo}`, pin } });
  expect(criado.status(), 'vendedor criado').toBe(201);
  const { id: usuario_id } = (await criado.json()) as { id: string };
  const trocou = await api.post('/acesso/pin', { data: { usuario_id, pin } });
  expect(trocou.status(), 'sessão do vendedor').toBe(200);

  await abrirProdutos(page);
  await expect(page.locator('[data-grade-acoes]')).toHaveCount(0);
  const dialogo = await abrirDetalhe(page, m.nome);
  const esperado = (await doApi(api, m.id)) as ProdutoApi;
  expect(esperado.custo_centavos, 'a API não manda o custo ao Vendedor').toBeUndefined();
  await expect(dialogo).toContainText(reais(esperado.preco_centavos));
  for (const s of esperado.skus) await expect(dialogo.locator(`[data-sku-codigo="${s.codigo}"]`)).toContainText(s.tamanho);
  await expect(dialogo).not.toContainText(/custo/i);
  await expect(dialogo).not.toContainText(reais(4000));
  for (const nome of ['Editar', 'Arquivar', 'Chegou mercadoria', 'Ajustar estoque']) {
    await expect(dialogo.getByRole('button', { name: nome })).toHaveCount(0);
  }
});
