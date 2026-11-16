import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// S08 / UXM-01, UXM-09, UXM-10, UXM-11: relatório de vendas como lista de cartões separados, com busca, paginação,
// modal de detalhe e cancelamento, a 360×640. Evidência vem do navegador e da API (L-0017). Dados do próprio teste.
const TEMAS = ['dark', 'light'] as const;
const POR_PAGINA = 10;
const VENDAS = 11;

interface Cenario {
  nome: string;
  letras: string;
  numeros: number[];
  ids: string[];
  codigo: string;
}

async function criarVendas(api: APIRequestContext): Promise<Cenario> {
  const sufixo = sufixoUnico();
  const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
  const peca = await criarPeca(api, sufixo, VENDAS + 1);
  const celular = `119${sufixo}`;
  const nome = `Zelda ${letras}`;
  const numeros: number[] = [];
  const ids: string[] = [];
  for (let i = 0; i < VENDAS; i++) {
    const r = await api.post('/vendas', {
      data: {
        itens: [{ sku_id: peca.skuId, quantidade: 1 }],
        cliente: { celular, nome },
        desconto: { tipo: 'nenhum' },
        pagamentos: [{ forma: 'pix', valor_centavos: 9900 }],
      },
    });
    expect(r.status(), `venda ${i}`).toBe(201);
    const v = (await r.json()) as { id: string; numero: number };
    numeros.push(v.numero);
    ids.push(v.id);
  }
  return { nome, letras, numeros, ids, codigo: peca.codigo };
}

async function abrirRelatorio(page: Page, tema: (typeof TEMAS)[number]) {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Vendas' }).first().click();
  await page.getByRole('button', { name: /Gerenciar vendas/ }).click();
  await expect(page.locator('[data-venda]').first()).toBeVisible();
}

const linhas = (page: Page) => page.locator('[data-venda]');

for (const tema of TEMAS) {
  test(`relatório (tema ${tema}): nº e nome em cada venda, linhas separadas, só a lista rola e sem overflow`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const c = await criarVendas(api);
    await abrirRelatorio(page, tema);
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);

    const n = await linhas(page).count();
    expect(n, 'DOM respeita o tamanho da página').toBeLessThanOrEqual(POR_PAGINA);
    expect(n).toBeGreaterThan(1);
    // Cada venda mostra "Venda N" e o nome da cliente (as vendas do próprio teste têm nome conhecido).
    await page.getByLabel('Buscar venda').fill(c.letras);
    await expect(linhas(page).first()).toContainText(`Venda ${c.numeros.at(-1)}`);
    await expect(linhas(page).first()).toContainText(c.nome);
    await page.getByLabel('Buscar venda').fill('');

    const m = await page.evaluate(() => {
      const raiz = document.documentElement;
      const el = document.querySelector('[data-lista-vendas]') as HTMLElement;
      const caixas = [...document.querySelectorAll('[data-venda]')].map((x) => x.getBoundingClientRect());
      const sobrepostas = caixas.filter((b, i) => i > 0 && b.top < (caixas[i - 1] as DOMRect).bottom - 0.5).length;
      const estilo = getComputedStyle(document.querySelector('[data-venda]') as HTMLElement);
      const rolagem = document.scrollingElement as Element;
      return {
        sobrepostas,
        divisor: Number.parseFloat(estilo.borderBottomWidth),
        divisorCor: estilo.borderBottomColor,
        listaRola: el.scrollHeight > el.clientHeight,
        paginaRola: rolagem.scrollHeight > window.innerHeight,
        largura: raiz.scrollWidth - raiz.clientWidth,
        listaLargura: el.scrollWidth - el.clientWidth,
      };
    });
    expect(m.sobrepostas, 'linhas sem sobreposição').toBe(0);
    expect(m.divisor, 'divisor visível entre linhas').toBeGreaterThan(0);
    expect(m.divisorCor).not.toBe('rgba(0, 0, 0, 0)');
    expect(m.listaRola, 'a lista rola por dentro').toBe(true);
    expect(m.paginaRola, 'a página não rola').toBe(false);
    expect(m.largura, 'overflow horizontal').toBeLessThanOrEqual(0);
    expect(m.listaLargura, 'overflow horizontal da lista').toBeLessThanOrEqual(0);
  });
}

test('relatório: busca por nome e por número filtra; Próxima/Anterior trocam as vendas', async ({ page }) => {
  const api = await entrarComoDono(page);
  const c = await criarVendas(api);
  await abrirRelatorio(page, 'dark');
  const busca = page.getByLabel('Buscar venda');
  const texto = page.locator('[data-paginacao-texto]');

  const alvo = c.numeros[3] as number;
  await busca.fill(String(alvo));
  await expect(linhas(page).first()).toContainText(`Venda ${alvo}`);
  await busca.fill(`zld ${c.letras}`);
  await expect(linhas(page)).toHaveCount(POR_PAGINA);
  for (const t of await linhas(page).allInnerTexts()) expect(t).toContain(c.nome);
  await busca.fill('qqqzzzxxx');
  await expect(page.getByText('Nada encontrado')).toBeVisible();

  await busca.fill('');
  await expect(texto).toContainText(/Página 1 de \d+/);
  const antes = await linhas(page).first().innerText();
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(texto).toContainText(/Página 2 de/);
  expect(await linhas(page).first().innerText()).not.toBe(antes);
  expect(await linhas(page).count()).toBeLessThanOrEqual(POR_PAGINA);
  await page.getByRole('navigation', { name: 'Paginação' }).getByRole('button', { name: 'Anterior' }).click();
  expect(await linhas(page).first().innerText()).toBe(antes);
});

test('relatório: tocar numa venda abre o detalhe com itens e total da API; Voltar fecha só o modal; cancelar reflete na lista', async ({ page }) => {
  const api = await entrarComoDono(page);
  const c = await criarVendas(api);
  const id = c.ids.at(-1) as string;
  const numero = c.numeros.at(-1) as number;
  const venda = (await (await api.get(`/vendas/${id}`)).json()) as {
    itens: { codigo: string; nome: string; quantidade: number; preco_unitario_centavos: number }[];
    total_centavos: number;
  };
  await abrirRelatorio(page, 'dark');
  await page.getByLabel('Buscar venda').fill(`${c.letras}`);
  await linhas(page).first().click();

  const modal = page.getByRole('dialog', { name: 'Detalhe da venda' });
  await expect(modal.getByText(`Venda ${numero}`, { exact: true })).toBeVisible();
  await expect(modal.getByText(c.nome)).toBeVisible();
  const itens = modal.locator('[data-item-venda]');
  await expect(itens).toHaveCount(venda.itens.length);
  for (const i of venda.itens) {
    const linha = modal.locator(`[data-item-venda="${i.codigo}"]`);
    await expect(linha).toContainText(i.nome);
    await expect(linha).toContainText(`${i.quantidade} ×`);
  }
  const reais = (venda.total_centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  await expect(modal.locator('[data-total-venda]')).toContainText(reais);
  expect(await page.evaluate(() => (document.scrollingElement as Element).scrollHeight <= window.innerHeight)).toBe(true);

  // Voltar do sistema fecha só o modal: a tela do relatório continua.
  await page.goBack();
  await expect(modal).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Relatório' })).toBeVisible();
  await expect(linhas(page).first()).toBeVisible();

  // Cancelar pela UI: confirmação clara, status muda na lista e na API; nada é apagado.
  await linhas(page).first().click();
  await modal.getByRole('button', { name: 'Cancelar venda' }).click();
  await expect(page.getByText(/nada é apagado/)).toBeVisible();
  await page.getByLabel('Motivo').fill('Cliente desistiu (E2E S08)');
  await page.getByRole('button', { name: 'Confirmar cancelamento' }).click();
  await expect(modal.getByText('Cancelada').first()).toBeVisible();
  const depois = (await (await api.get(`/vendas/${id}`)).json()) as { status: string };
  expect(depois.status).toBe('cancelada');
  await page.goBack();
  await expect(modal).toBeHidden();
  await expect(linhas(page).first()).toContainText('Cancelada');
});
