import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { hojeEmSaoPaulo } from '../src/lib/datas';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// S14a / UXM-11: a paginação (componentes/Paginacao.tsx) cabe a 360 px nas 3 telas que a usam, nos 2 temas:
// nenhum botão nem rótulo é cortado (scrollWidth <= clientWidth), "Página X de Y" fica em UMA linha, os alvos
// continuam >= 48 px e a barra não gera rolagem lateral. A medida vem do navegador, nunca de constantes (L-0017).
const TEMAS = ['dark', 'light'] as const;
type Tema = (typeof TEMAS)[number];

async function mediPaginacao(page: Page, onde: string) {
  const nav = page.locator('nav[aria-label="Paginação"]');
  await expect(nav, `${onde}: paginação presente`).toBeVisible();
  await page.getByRole('button', { name: 'Próxima' }).scrollIntoViewIfNeeded();
  const m = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Paginação"]') as HTMLElement;
    const texto = nav.querySelector('[data-paginacao-texto]') as HTMLElement;
    const cortado = (el: Element) => (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth;
    const botoes = [...nav.querySelectorAll('button')] as HTMLElement[];
    // O rótulo do Mantine fica num <span> interno com overflow oculto: é nele que o corte aparece.
    const internos = botoes.flatMap((b) => [...b.querySelectorAll('span')]);
    const lh = parseFloat(getComputedStyle(texto).lineHeight);
    const raiz = document.documentElement;
    return {
      botoesCortados: botoes.filter(cortado).length,
      internosCortados: internos.filter(cortado).length,
      textoCortado: cortado(texto),
      linhasDoTexto: Math.round(texto.getBoundingClientRect().height / lh),
      menores: botoes.filter((b) => b.getBoundingClientRect().height < 48 || b.getBoundingClientRect().width < 48).length,
      fora: [...botoes, texto].filter((e) => e.getBoundingClientRect().left < 0 || e.getBoundingClientRect().right > window.innerWidth).length,
      sobraDaBarra: nav.scrollWidth - nav.clientWidth,
      sobraDaPagina: raiz.scrollWidth - raiz.clientWidth,
      rotulos: botoes.map((b) => b.textContent?.trim()),
    };
  });
  expect(m.botoesCortados, `${onde}: botões com conteúdo cortado`).toBe(0);
  expect(m.internosCortados, `${onde}: rótulos/ícones cortados`).toBe(0);
  expect(m.textoCortado, `${onde}: "Página X de Y" cortado`).toBe(false);
  expect(m.linhasDoTexto, `${onde}: "Página X de Y" em 1 linha`).toBe(1);
  expect(m.menores, `${onde}: alvos < 48 px`).toBe(0);
  expect(m.fora, `${onde}: elementos fora da tela`).toBe(0);
  expect(m.sobraDaBarra, `${onde}: rolagem lateral da barra`).toBeLessThanOrEqual(0);
  expect(m.sobraDaPagina, `${onde}: rolagem lateral da página`).toBeLessThanOrEqual(0);
  expect(m.rotulos.join('|'), `${onde}: rótulos`).toMatch(/Anterior.*Próxima/);
}

/** Mede na página 1 (Anterior desligado) e na seguinte (os dois ligados). */
async function medirAsDuasPaginas(page: Page, onde: string) {
  await mediPaginacao(page, `${onde}/pág. 1`);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.locator('[data-paginacao-texto]')).toContainText(/Página 2 de/);
  await mediPaginacao(page, `${onde}/pág. 2`);
}

async function usarTema(page: Page, tema: Tema) {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
}

async function produtosEmMuitasPaginas(api: APIRequestContext, letras: string, sufixo: string) {
  const cat = await api.post('/categorias', { data: { nome: `E2E pag ${sufixo}`, atributos: [], tipo: 'produto' } });
  const { id: categoria_id } = (await cat.json()) as { id: string };
  for (let i = 0; i < 21; i++) {
    const r = await api.post('/produtos', {
      data: {
        // "Zz": a lista vem em ordem alfabética e a tela olha só os 200 primeiros; estes produtos não podem empurrar os dos outros testes para fora.
        nome: `Zz pag ${letras} ${i}`,
        categoria_id,
        porte: 'slim',
        atributos: [],
        fornecedor: null,
        custo_centavos: 1000,
        preco_centavos: 5000,
        skus: [{ tamanho: 'M', cor: 'Azul', estoque_inicial: 1, estoque_minimo: 0 }],
      },
    });
    expect(r.status(), `produto ${i}`).toBe(201);
  }
}

for (const tema of TEMAS) {
  test(`paginação a 360 px (tema ${tema}): Produtos não corta botões nem quebra "Página X de Y"`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
    await produtosEmMuitasPaginas(api, letras, sufixo);
    await usarTema(page, tema);
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Produtos' }).first().click();
    await page.getByLabel('Buscar produto').fill(`Zz pag ${letras}`);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirAsDuasPaginas(page, `${tema}/Produtos`);
  });

  test(`paginação a 360 px (tema ${tema}): Histórico de pontos não corta botões nem quebra "Página X de Y"`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const nome = `Vend Pag ${sufixoUnico()}`;
    const criado = await api.post('/usuarios', { data: { nome, pin: '1234' } });
    expect(criado.status(), 'vendedor').toBe(201);
    const { id } = (await criado.json()) as { id: string };
    const [ano, mes] = hojeEmSaoPaulo().split('-').map(Number) as [number, number];
    const ant = mes === 1 ? { a: ano - 1, m: 12 } : { a: ano, m: mes - 1 };
    for (let d = 1; d <= 6; d++) {
      const data = `${ant.a}-${String(ant.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      for (const [tipo, hora] of [['entrada', '08:00'], ['saida', '12:00']] as const) {
        const r = await api.post('/pontos/manual', { data: { usuario_id: id, tipo, data, hora, motivo: 'carga E2E' } });
        expect(r.status(), `${tipo} ${data}`).toBe(201);
      }
    }
    await usarTema(page, tema);
    await page.goto('/pessoas/historico');
    await expect(page.getByRole('heading', { level: 1, name: 'Histórico de pontos' })).toBeVisible();
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    await page.getByLabel('Buscar ponto').fill(nome);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirAsDuasPaginas(page, `${tema}/Histórico`);
  });

  test(`paginação a 360 px (tema ${tema}): Relatório de vendas não corta botões nem quebra "Página X de Y"`, async ({ page }) => {
    const api = await entrarComoDono(page);
    const sufixo = sufixoUnico();
    const letras = sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
    const peca = await criarPeca(api, sufixo, 12);
    const nome = `Zelda ${letras}`;
    for (let i = 0; i < 11; i++) {
      const r = await api.post('/vendas', {
        data: {
          itens: [{ sku_id: peca.skuId, quantidade: 1 }],
          cliente: { celular: `119${sufixo}`, nome },
          desconto: { tipo: 'nenhum' },
          pagamentos: [{ forma: 'pix', valor_centavos: 9900 }],
        },
      });
      expect(r.status(), `venda ${i}`).toBe(201);
    }
    await usarTema(page, tema);
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Vendas' }).first().click();
    await page.getByRole('button', { name: /Gerenciar vendas/ }).click();
    await expect(page.locator('[data-venda]').first()).toBeVisible();
    await page.getByLabel('Buscar venda').fill(letras);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
    await medirAsDuasPaginas(page, `${tema}/Relatório de vendas`);
  });
}
