import { expect, test, type Page } from '@playwright/test';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// S14b / UXM-03: em TODOS os módulos o Voltar do sistema recua exatamente um nível e nunca sai do app (360×640).
// Cada tela interna é uma rota (ADR 011). A evidência vem do navegador real: URL, histórico e o que está visível.

const INICIO = 'O que vamos fazer?';
const passo = (page: Page) => page.locator('[data-progresso]');

interface Etapa {
  /** Botão a tocar. */
  clicar: string | RegExp;
  /** Rota esperada depois do toque (o assistente avança de passo na mesma rota). */
  rota: string;
  /** Título (h1) esperado. */
  h1?: string;
  /** Campo a preencher antes de tocar (assistente). */
  preencher?: [string, string];
  /** Texto "Passo N de M" esperado (assistente). */
  passo?: string;
}

interface Cadeia {
  nome: string;
  etapas: Etapa[];
}

const CADEIAS: Cadeia[] = [
  {
    nome: 'vendas: relatório',
    etapas: [
      { clicar: 'Vendas', rota: '/vendas' },
      { clicar: /Relat/, rota: '/vendas/relatorio' },
    ],
  },
  {
    nome: 'produtos: etiquetas',
    etapas: [
      { clicar: 'Produtos', rota: '/produtos' },
      { clicar: 'Etiquetas', rota: '/produtos/etiquetas', h1: 'Etiquetas' },
    ],
  },
  {
    nome: 'produtos: novo produto (assistente)',
    etapas: [
      { clicar: 'Produtos', rota: '/produtos' },
      { clicar: 'Novo produto', rota: '/produtos/novo', h1: 'Novo produto', passo: 'Passo 1 de' },
    ],
  },
  {
    nome: 'clientes: novo cliente (assistente, 2 passos)',
    etapas: [
      { clicar: 'Clientes', rota: '/clientes' },
      { clicar: 'Novo cliente', rota: '/clientes/novo', h1: 'Novo cliente', passo: 'Passo 1 de' },
      { clicar: 'Continuar', rota: '/clientes/novo', preencher: ['Nome', 'Ana Voltar'], passo: 'Passo 2 de' },
    ],
  },
  {
    nome: 'compras: pedidos > novo pedido (assistente)',
    etapas: [
      { clicar: 'Compras', rota: '/compras' },
      { clicar: /Pedidos/, rota: '/compras/pedidos', h1: 'Pedidos' },
      { clicar: 'Novo pedido', rota: '/compras/pedidos/novo', passo: 'Passo 1 de' },
    ],
  },
  {
    nome: 'compras: fornecedores > novo fornecedor (assistente, 2 passos)',
    etapas: [
      { clicar: 'Compras', rota: '/compras' },
      { clicar: /Fornecedores/, rota: '/compras/fornecedores', h1: 'Fornecedores' },
      { clicar: 'Novo fornecedor', rota: '/compras/fornecedores/novo', passo: 'Passo 1 de' },
      { clicar: 'Continuar', rota: '/compras/fornecedores/novo', preencher: ['Nome', 'Forn Voltar'], passo: 'Passo 2 de' },
    ],
  },
  {
    nome: 'compras: relatório',
    etapas: [
      { clicar: 'Compras', rota: '/compras' },
      { clicar: /Relat/, rota: '/compras/relatorio', h1: 'Relatório' },
    ],
  },
  {
    nome: 'financeiro: nova despesa (assistente)',
    etapas: [
      { clicar: 'Financeiro', rota: '/financeiro' },
      { clicar: 'Nova despesa', rota: '/financeiro/nova-despesa', h1: 'Nova despesa', passo: 'Passo 1 de' },
    ],
  },
  {
    nome: 'financeiro: contas a pagar',
    etapas: [
      { clicar: 'Financeiro', rota: '/financeiro' },
      { clicar: 'Contas a pagar', rota: '/financeiro/contas-a-pagar', h1: 'Contas a pagar' },
    ],
  },
  {
    nome: 'financeiro: relatório',
    etapas: [
      { clicar: 'Financeiro', rota: '/financeiro' },
      { clicar: 'Relatório', rota: '/financeiro/relatorio', h1: 'Relatório' },
    ],
  },
  ...(['usuarios', 'empresa', 'markup', 'categorias'] as const).map<Cadeia>((s) => ({
    nome: `configurações: ${s}`,
    etapas: [
      { clicar: 'Configurações', rota: '/configuracoes' },
      { clicar: new RegExp(`^${{ usuarios: 'Usuários', empresa: 'Empresa', markup: 'Markup', categorias: 'Categorias' }[s]}`), rota: `/configuracoes/${s}` },
    ],
  })),
  {
    nome: 'pessoas: relatório',
    etapas: [
      { clicar: 'Pessoas', rota: '/pessoas' },
      { clicar: 'Relatório de pontos', rota: '/pessoas/relatorio', h1: 'Relatório de pontos' },
    ],
  },
  {
    nome: 'pessoas: gerenciar',
    etapas: [
      { clicar: 'Pessoas', rota: '/pessoas' },
      { clicar: 'Gerenciar pessoas', rota: '/pessoas/gerenciar', h1: 'Gerenciar pessoas' },
    ],
  },
];

const caminho = (page: Page) => new URL(page.url()).pathname;

for (const cadeia of CADEIAS) {
  test(`(a) Voltar recua um nível por vez e nunca sai do app: ${cadeia.nome}`, async ({ page }) => {
    await entrarComoDono(page);
    await abrirInicio(page);
    const origem = new URL(page.url()).origin;
    // Trilha do que estava na tela depois de cada toque: rota e "Passo N de" (se houver).
    const trilha: { rota: string; passo?: string }[] = [{ rota: '/' }];

    for (const e of cadeia.etapas) {
      if (e.preencher) await page.getByLabel(new RegExp(`^${e.preencher[0]}`)).fill(e.preencher[1]);
      await page.getByRole('button', { name: e.clicar }).first().click();
      await expect.poll(() => caminho(page), { message: `rota depois de tocar em ${String(e.clicar)}` }).toBe(e.rota);
      if (e.h1) await expect(page.getByRole('heading', { level: 1, name: e.h1 })).toBeVisible();
      if (e.passo) await expect(passo(page)).toContainText(e.passo);
      trilha.push({ rota: e.rota, passo: e.passo });
    }

    for (let i = trilha.length - 1; i >= 1; i--) {
      await page.goBack();
      const alvo = trilha[i - 1] as { rota: string; passo?: string };
      await expect.poll(() => caminho(page), { message: `Voltar nº ${trilha.length - i}: deve ir para ${alvo.rota}` }).toBe(alvo.rota);
      if (alvo.passo) await expect(passo(page)).toContainText(alvo.passo);
      else await expect(passo(page)).toHaveCount(0);
    }
    await expect(page.getByText(INICIO)).toBeVisible();

    // Um Voltar a mais na raiz também fica no app.
    await page.goBack();
    await page.waitForTimeout(300);
    expect(new URL(page.url()).origin).toBe(origem);
    await expect(page.getByText(INICIO)).toBeVisible();
  });
}

test('(a) assistente concluído: o Voltar não reabre o assistente (cliente cadastrado)', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  const s = sufixoUnico();
  const nome = `Cli Voltar ${s}`;
  // Celular único por execução: o banco de dev é compartilhado e a API recusa celular repetido.
  const celular = `(21) 9${s.slice(0, 4)}-${s.slice(4, 8)}`;
  await page.getByRole('button', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: 'Novo cliente' }).first().click();
  await page.getByLabel(/^Nome/).fill(nome);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Celular com DDD').fill(celular);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(passo(page)).toContainText('Passo 4 de 4');
  await page.getByRole('button', { name: 'Cadastrar cliente' }).click();
  await expect.poll(() => caminho(page)).toBe('/clientes');
  await expect(passo(page)).toHaveCount(0);

  await page.goBack();
  await expect.poll(() => caminho(page)).toBe('/');
  await expect(page.getByText(INICIO)).toBeVisible();
});

test('(a) Cancelar no 1º passo volta à lista e o Voltar seguinte vai ao Início', async ({ page }) => {
  await entrarComoDono(page);
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Clientes' }).click();
  await page.getByRole('button', { name: 'Novo cliente' }).first().click();
  await expect.poll(() => caminho(page)).toBe('/clientes/novo');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect.poll(() => caminho(page)).toBe('/clientes');
  await page.goBack();
  await expect.poll(() => caminho(page)).toBe('/');
  await expect(page.getByText(INICIO)).toBeVisible();
});

// (b) Link direto e recarregar: a mesma tela volta e a seta leva ao PAI (não ao Início fixo).
const PAIS: [string, string, string][] = [
  ['/vendas/relatorio', '/vendas', 'Venda'],
  ['/produtos/etiquetas', '/produtos', 'Produtos'],
  ['/produtos/novo', '/produtos', 'Produtos'],
  ['/clientes/novo', '/clientes', 'Clientes'],
  ['/compras/pedidos', '/compras', 'Compras'],
  ['/compras/pedidos/novo', '/compras/pedidos', 'Pedidos'],
  ['/compras/fornecedores/novo', '/compras/fornecedores', 'Fornecedores'],
  ['/compras/relatorio', '/compras', 'Compras'],
  ['/financeiro/nova-despesa', '/financeiro', 'Financeiro'],
  ['/financeiro/contas-a-pagar', '/financeiro', 'Financeiro'],
  ['/financeiro/relatorio', '/financeiro', 'Financeiro'],
  ['/configuracoes/usuarios', '/configuracoes', 'Configurações'],
  ['/configuracoes/empresa', '/configuracoes', 'Configurações'],
  ['/pessoas/relatorio', '/pessoas', 'Pessoas'],
];

for (const tocou of [false, true]) {
  test(`(b) link direto + recarregar numa subrota: mesma tela e a seta vai ao pai (${tocou ? 'depois de tocar' : 'sem tocar'})`, async ({ page }) => {
    await entrarComoDono(page);
    for (const [rota, pai, rotuloPai] of PAIS) {
      await page.goto(rota);
      await expect.poll(() => caminho(page), { message: `link direto ${rota}` }).toBe(rota);
      const h1 = page.getByRole('heading', { level: 1 });
      // Enquanto a sessão carrega, o título é o do app ("Ailow ERP").
      await expect(h1).not.toHaveText('Ailow ERP');
      const titulo = await h1.innerText();
      // O toque arma a reserva do Voltar (TravaVoltar); recarregar tem de manter a tela e o pai certo mesmo assim.
      if (tocou) await page.mouse.click(180, 330);
      await page.reload();
      await expect.poll(() => caminho(page), { message: `recarregar ${rota}` }).toBe(rota);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo, { timeout: 15000 });
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Ailow ERP');

      await page.getByRole('button', { name: `Voltar para ${rotuloPai}` }).click();
      await expect.poll(() => caminho(page), { message: `seta em ${rota} deve ir a ${pai}` }).toBe(pai);
    }
    // E do módulo a seta leva ao Início.
    await page.goto('/financeiro');
    await page.getByRole('button', { name: 'Voltar para Início' }).click();
    await expect(page.getByText(INICIO)).toBeVisible();
    expect(caminho(page)).toBe('/');
  });
}

// (c) Vendedor por URL direta: rota sem permissão cai no Início, sem loop.
test('(c) Vendedor abrindo por URL direta uma rota sem permissão cai no Início sem loop', async ({ page }) => {
  const api = await entrarComoDono(page);
  const pin = '2468';
  const criado = await api.post('/usuarios', { data: { nome: `Vend Voltar ${sufixoUnico()}`, pin } });
  expect(criado.status(), 'vendedor criado').toBe(201);
  const { id: usuario_id } = (await criado.json()) as { id: string };
  expect((await api.post('/acesso/pin', { data: { usuario_id, pin } })).status(), 'sessão do vendedor').toBe(200);

  for (const rota of ['/financeiro/contas-a-pagar', '/compras/pedidos/novo', '/configuracoes/usuarios', '/rota-que-nao-existe/x']) {
    const antes = await page.evaluate(() => window.history.length);
    await page.goto(rota);
    await expect(page.getByText(INICIO)).toBeVisible();
    await page.waitForTimeout(400);
    expect(caminho(page), `${rota}: fica no Início`).toBe('/');
    // A página nova ocupa 1 entrada; o redirecionamento troca a entrada (replace), não empilha: sem loop.
    const entradas = (await page.evaluate(() => window.history.length)) - antes;
    expect(entradas, `${rota}: entradas novas no histórico (${entradas})`).toBeLessThanOrEqual(1);
  }
  // Subrota proibida dentro de um módulo permitido: volta à raiz do módulo.
  await page.goto('/produtos/novo');
  await expect.poll(() => caminho(page)).toBe('/produtos');
  await page.goto('/pessoas/gerenciar');
  await expect.poll(() => caminho(page)).toBe('/pessoas');
  const origem = new URL(page.url()).origin;
  await page.goBack();
  await page.waitForTimeout(300);
  expect(new URL(page.url()).origin).toBe(origem);
});
