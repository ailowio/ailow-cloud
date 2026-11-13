import { expect, test, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// S10, no celular da loja (360×640): assistente "Novo produto" em passos curtos (tamanhos e cores separados),
// botões principal x secundário inequívocos, valores com teclado numérico e markup editável, engrenagem de
// categorias e Voltar do sistema recuando um passo por vez. Evidência do navegador real e da API (L-0017).

interface SkuApi {
  tamanho: string;
  cor: string;
  estoque: number;
  estoque_minimo?: number;
}
interface ProdutoApi {
  id: string;
  nome: string;
  preco_centavos: number;
  custo_centavos?: number;
  skus: SkuApi[];
}

async function abrirAssistente(page: Page, tema: 'dark' | 'light') {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  await expect(page.getByRole('heading', { name: 'Que tipo de peça é?' })).toBeVisible();
}

/** (b) e (e): estilos computados do principal x secundário, alvos, e nada de rolagem de página nem estouro. */
async function conferirPasso(page: Page, rotulo: string) {
  const m = await page.evaluate(() => {
    const pega = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, borda: cs.borderTopColor, w: r.width, h: r.height, dentro: r.left >= 0 && r.right <= window.innerWidth, estouro: el.scrollWidth > el.clientWidth };
    };
    const raiz = document.scrollingElement ?? document.documentElement;
    return {
      p: pega('[data-botao="principal"]'),
      s: pega('[data-botao="secundario"]'),
      paginaRola: raiz.scrollHeight > window.innerHeight,
      larguraRola: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(m.p, `${rotulo}: botão principal`).not.toBeNull();
  expect(m.s, `${rotulo}: botão secundário`).not.toBeNull();
  const p = m.p as NonNullable<typeof m.p>;
  const s = m.s as NonNullable<typeof m.s>;
  expect(p.bg, `${rotulo}: fundo distinto`).not.toBe(s.bg);
  expect(p.borda, `${rotulo}: borda distinta`).not.toBe(s.borda);
  expect(p.h, `${rotulo}: principal ≥ 48`).toBeGreaterThanOrEqual(48);
  expect(s.h, `${rotulo}: secundário ≥ 48`).toBeGreaterThanOrEqual(48);
  expect(p.w, `${rotulo}: principal domina a largura`).toBeGreaterThan(s.w);
  expect(p.dentro && s.dentro, `${rotulo}: botões dentro da tela`).toBe(true);
  expect(p.estouro || s.estouro, `${rotulo}: rótulo inteiro`).toBe(false);
  expect(m.paginaRola, `${rotulo}: a página não rola`).toBe(false);
  expect(m.larguraRola, `${rotulo}: sem rolagem lateral`).toBe(false);
}

const continuar = (page: Page) => page.locator('[data-botao="principal"]').click();
const progresso = (page: Page) => page.locator('[data-assistente] [data-progresso]');

for (const tema of ['dark', 'light'] as const) {
  test(`(a)(b)(c)(d)(e) cria produto completo com tamanhos e cores; botões distintos; markup; Voltar do sistema (${tema})`, async ({ page }) => {
    test.setTimeout(120_000);
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const nomeCat = `E2E S10 ${sufixo}`;
    const r = await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'produto' } });
    expect(r.status(), 'categoria').toBe(201);
    const nome = `Peça S10 ${sufixo}`;

    await abrirAssistente(page, tema);
    await conferirPasso(page, 'categoria');
    await expect(progresso(page)).toContainText(/Passo 1 de \d+/);
    await page.getByRole('button', { name: nomeCat }).click();
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Nome e porte' })).toBeVisible();
    await page.getByLabel('Nome do modelo').fill(nome);
    await page.getByRole('button', { name: 'Slim' }).click();
    await conferirPasso(page, 'modelo');
    await continuar(page);

    // Etapa 3 destrinchada: tamanhos e cores em passos próprios, com chips selecionáveis.
    await expect(page.getByRole('heading', { name: 'Quais tamanhos?' })).toBeVisible();
    await expect(continuar_desabilitado(page)).resolves.toBe(true);
    for (const t of ['P', 'M', 'G']) await page.getByRole('button', { name: t, exact: true }).click();
    await page.getByRole('button', { name: 'G', exact: true }).click(); // desmarca
    await expect(page.getByRole('button', { name: 'G', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByRole('button', { name: 'P', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await conferirPasso(page, 'tamanhos');
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Quais cores?' })).toBeVisible();
    for (const c of ['Preto', 'Nude']) await page.getByRole('button', { name: c, exact: true }).click();
    expect(await page.locator('[data-amostra-cor]').count(), 'chips de cor com amostra').toBeGreaterThanOrEqual(8);
    await conferirPasso(page, 'cores');

    // (d) Voltar do sistema recua um passo por vez, sem perder o que foi escolhido.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Quais tamanhos?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'P', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await continuar(page);
    await expect(page.getByRole('button', { name: 'Preto', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await continuar(page);

    await expect(page.getByRole('heading', { name: 'Confira as variações' })).toBeVisible();
    await expect(page.locator('[data-assistente]')).toContainText('4 variações');
    await conferirPasso(page, 'grade');
    await continuar(page);

    // Custo: campo por dígitos, teclado numérico, valor em destaque.
    await expect(page.getByRole('heading', { name: 'Quanto custou?' })).toBeVisible();
    const custo = page.getByLabel('Custo de cada peça');
    expect(await custo.getAttribute('inputmode')).toBe('numeric');
    // Valor máximo: trava em R$ 20 milhões e cabe no campo (sem o texto estourar).
    await custo.pressSequentially('99999999999');
    await expect(custo).toHaveValue('20.000.000,00');
    expect(await custo.evaluate((el) => (el as HTMLInputElement).scrollWidth <= (el as HTMLInputElement).clientWidth), 'valor máximo cabe').toBe(true);
    await custo.fill('');
    await custo.pressSequentially('4500');
    await expect(custo).toHaveValue('45,00');
    await conferirPasso(page, 'custo');
    await continuar(page);

    // (c) Preço e markup: o markup da loja já vem aplicado; editar um recalcula o outro.
    await expect(page.getByRole('heading', { name: 'Por quanto vende?' })).toBeVisible();
    const preco = page.getByLabel('Preço de venda');
    const markup = page.getByLabel('Markup (%)');
    expect(await preco.getAttribute('inputmode')).toBe('numeric');
    const markupInicial = (await markup.inputValue()).replace(',', '.');
    const esperadoInicial = Math.round(4500 * (1 + Number(markupInicial) / 100));
    await expect(preco).toHaveValue(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(esperadoInicial / 100));
    await markup.fill('50');
    await expect(preco).toHaveValue('67,50');
    await preco.fill('');
    await preco.pressSequentially('9000');
    await expect(markup).toHaveValue('100');
    await page.getByRole('button', { name: 'Mais 5 pontos de markup' }).click();
    await expect(markup).toHaveValue('105');
    await expect(preco).toHaveValue('92,25');
    await preco.fill('');
    await preco.pressSequentially('9000');
    await expect(markup).toHaveValue('100');
    await conferirPasso(page, 'preco');
    await continuar(page);

    // Estoque e salvar.
    await expect(page.getByRole('heading', { name: 'Quantas peças?' })).toBeVisible();
    await page.getByLabel('Tenho').first().fill('5');
    await page.getByLabel('Mínimo').first().fill('1');
    await page.getByRole('button', { name: 'Aplicar a todos' }).click();
    await conferirPasso(page, 'estoque');
    await expect(progresso(page)).toContainText(/Passo (\d+) de \1/);
    await page.locator('[data-botao="principal"]').click();
    await expect(page.getByText(/cadastrado/).first()).toBeVisible();

    const lista = await api.get('/produtos');
    const criado = ((await lista.json()) as { produtos: ProdutoApi[] }).produtos.find((p) => p.nome === nome) as ProdutoApi;
    expect(criado, 'produto na API').toBeTruthy();
    expect(criado.preco_centavos).toBe(9000);
    expect(criado.custo_centavos).toBe(4500);
    expect(criado.skus.map((s) => `${s.tamanho}|${s.cor}`).sort()).toEqual(['M|Nude', 'M|Preto', 'P|Nude', 'P|Preto']);
    for (const s of criado.skus) {
      expect(s.estoque).toBe(5);
      expect(s.estoque_minimo).toBe(1);
    }
  });
}

async function continuar_desabilitado(page: Page): Promise<boolean> {
  return page.locator('[data-botao="principal"]').isDisabled();
}

test('(d) Voltar do sistema: recua cada passo, e só do primeiro passo sai do assistente; Cancelar também sai', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  const nomeCat = `E2E S10v ${sufixo}`;
  expect((await api.post('/categorias', { data: { nome: nomeCat, atributos: [], tipo: 'produto' } })).status()).toBe(201);

  await abrirAssistente(page, 'dark');
  await page.getByRole('button', { name: nomeCat }).click();
  await continuar(page);
  await page.getByLabel('Nome do modelo').fill(`Volta ${sufixo}`);
  await page.getByRole('button', { name: 'Slim' }).click();
  await continuar(page);
  await expect(page.getByRole('heading', { name: 'Quais tamanhos?' })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Nome e porte' })).toBeVisible();
  await expect(page.getByLabel('Nome do modelo')).toHaveValue(`Volta ${sufixo}`);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Que tipo de peça é?' })).toBeVisible();
  // Primeiro passo: o Voltar do sistema sai do assistente (volta para a tela anterior do app).
  await page.goBack();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();

  // Cancelar (secundário do 1º passo) volta para a lista de Produtos.
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  await page.locator('[data-botao="secundario"]').click();
  await expect(page.getByLabel('Buscar produto')).toBeVisible();

  // Sair pela seta da tela com passos já dados não deixa passos "fantasma": um Voltar do sistema vai ao Início.
  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  await page.getByRole('button', { name: nomeCat }).click();
  await continuar(page);
  await expect(page.getByRole('heading', { name: 'Nome e porte' })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar para Produtos' }).click();
  await expect(page.getByLabel('Buscar produto')).toBeVisible();
  await page.goBack();
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
});

test('engrenagem: abre as categorias em pop-up, cria uma e ela aparece no assistente; Voltar fecha só o pop-up', async ({ page }) => {
  const api = await entrarComoDono(page);
  const sufixo = sufixoUnico();
  expect((await api.post('/categorias', { data: { nome: `E2E S10g ${sufixo}`, atributos: [], tipo: 'produto' } })).status()).toBe(201);
  await abrirAssistente(page, 'light');

  await page.getByRole('button', { name: 'Configurar categorias' }).click();
  const pop = page.getByRole('dialog', { name: 'Categorias' });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(`E2E S10g ${sufixo}`);
  await pop.getByRole('button', { name: 'Nova categoria de produto' }).click();
  const form = page.getByRole('dialog', { name: 'Nova categoria de produto' });
  const novaCat = `E2E S10n ${sufixo}`;
  await form.getByLabel('Nome').fill(novaCat);
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect(form).toBeHidden();
  await expect(pop).toContainText(novaCat);

  await page.goBack();
  await expect(pop).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Que tipo de peça é?' })).toBeVisible();
  await expect(page.getByRole('button', { name: novaCat })).toBeVisible();
});
