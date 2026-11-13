import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { abrirInicio, criarPeca, entrarComoDono, sufixoUnico } from './apoio';

// S13, celular da loja (360×640), nos 2 temas: os cadastros com 3+ campos ou decisões viraram assistente em passos
// (novo cliente, fornecedor, novo pedido, dados da empresa). Em cada um: "Passo X de N", botão principal x secundário
// distintos e >= 48 px, erro de validação em toast sem mover o botão, Voltar do sistema recua um passo, "Confira" ao
// final, sem rolagem de página nem lateral. A prova de que gravou vem da API (GET), nunca da tela (L-0017).
test.use({ hasTouch: true });

const TEMAS = ['dark', 'light'] as const;
type Tema = (typeof TEMAS)[number];

const principal = (page: Page) => page.locator('[data-botao="principal"]');
const progresso = (page: Page) => page.locator('[data-assistente] [data-progresso]');
const toast = (page: Page, texto: string) => page.locator('.mantine-Notifications-notification', { hasText: texto });

async function abrirModulo(page: Page, tema: Tema, modulo: string) {
  await page.addInitScript((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await abrirInicio(page);
  await page.getByRole('button', { name: modulo }).first().click();
  await expect(page.getByRole('heading', { name: modulo, level: 1 })).toBeVisible();
}

async function conferirPasso(page: Page, rotulo: string) {
  const m = await page.evaluate(() => {
    const pega = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { bg: cs.backgroundColor, borda: cs.borderTopColor, w: r.width, h: r.height, dentro: r.left >= 0 && r.right <= window.innerWidth };
    };
    const raiz = document.scrollingElement ?? document.documentElement;
    return {
      p: pega('[data-botao="principal"]'),
      s: pega('[data-botao="secundario"]'),
      paginaRola: raiz.scrollHeight > window.innerHeight,
      larguraRola: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  const p = m.p as NonNullable<typeof m.p>;
  const s = m.s as NonNullable<typeof m.s>;
  expect(p, `${rotulo}: principal existe`).not.toBeNull();
  expect(s, `${rotulo}: secundário existe`).not.toBeNull();
  expect(p.bg, `${rotulo}: fundo distinto`).not.toBe(s.bg);
  expect(p.borda, `${rotulo}: borda distinta`).not.toBe(s.borda);
  expect(p.h, `${rotulo}: principal >= 48`).toBeGreaterThanOrEqual(48);
  expect(s.h, `${rotulo}: secundário >= 48`).toBeGreaterThanOrEqual(48);
  expect(p.w, `${rotulo}: principal domina`).toBeGreaterThan(s.w);
  expect(p.dentro && s.dentro, `${rotulo}: dentro da tela`).toBe(true);
  expect(m.paginaRola, `${rotulo}: a página não rola`).toBe(false);
  expect(m.larguraRola, `${rotulo}: sem rolagem lateral`).toBe(false);
}

/** Toque em Continuar com o passo inválido: o toast aparece e nada se move nem muda de passo. */
async function recusa(page: Page, mensagem: string, titulo: string) {
  const caixa = await principal(page).boundingBox();
  const altura = await page.evaluate(() => document.getElementById('conteudo')?.scrollHeight);
  await principal(page).click();
  await expect(toast(page, mensagem)).toBeVisible();
  expect(await principal(page).boundingBox(), `"${mensagem}": botão não se move`).toEqual(caixa);
  expect(await page.evaluate(() => document.getElementById('conteudo')?.scrollHeight), `"${mensagem}": altura igual`).toBe(altura);
  await expect(page.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
}

async function passo(page: Page, titulo: string, n: number, total: number, rotulo: string) {
  await expect(page.getByRole('heading', { name: titulo, level: 2 })).toBeVisible();
  await expect(progresso(page)).toContainText(`Passo ${n} de ${total}`);
  await conferirPasso(page, rotulo);
}

for (const tema of TEMAS) {
  test(`(a)(b)(c)(d)(e) novo cliente em passos (${tema})`, async ({ page }) => {
    test.setTimeout(120_000);
    const api = await entrarComoDono(page);
    const s = sufixoUnico();
    const nome = `Cli Wiz ${s}`;
    const celular = `2198${s.slice(0, 7)}`;
    await abrirModulo(page, tema, 'Clientes');
    await page.getByRole('button', { name: 'Novo cliente' }).first().click();

    await passo(page, 'Qual é o nome do cliente?', 1, 4, 'nome');
    await recusa(page, 'Escreva o nome do cliente.', 'Qual é o nome do cliente?');
    await page.getByLabel('Nome').fill(nome);
    await principal(page).click();

    await passo(page, 'Qual é o celular?', 2, 4, 'celular');
    await recusa(page, 'Escreva o celular do cliente.', 'Qual é o celular?');
    await page.getByLabel('Celular com DDD').fill('21 3888-0001');
    await recusa(page, 'Escreva o celular com DDD e 9 dígitos', 'Qual é o celular?');
    // Voltar do sistema recua um passo e mantém o que foi digitado.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Qual é o nome do cliente?', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveValue(nome);
    await principal(page).click();
    await page.getByLabel('Celular com DDD').fill(celular);
    await principal(page).click();

    await passo(page, 'Avisou para que usa o número?', 3, 4, 'aviso');
    await page.getByRole('switch', { name: /Já avisei/ }).click();
    await principal(page).click();

    await passo(page, 'Confira e salve', 4, 4, 'confirmar');
    await expect(page.locator('[data-assistente]')).toContainText(nome);
    await expect(principal(page)).toHaveText('Cadastrar cliente');
    const salvo = page.waitForResponse((x) => x.url().includes('/clientes') && x.request().method() === 'POST');
    await principal(page).click();
    expect((await salvo).status()).toBe(201);
    // Depois de cadastrar, volta à lista de clientes (com o aviso "Cliente cadastrado").
    await expect(toast(page, 'Cliente cadastrado')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo cliente' })).toBeVisible();

    const r = await api.get(`/clientes?q=${encodeURIComponent(nome)}`);
    const { clientes } = (await r.json()) as { clientes: { nome: string; celular: string; aviso_lgpd_em: string | null }[] };
    const criado = clientes.find((c) => c.nome === nome);
    expect(criado, 'o cliente existe na API').toBeTruthy();
    expect(criado?.celular).toBe(celular);
    expect(criado?.aviso_lgpd_em, 'o aviso foi registrado').not.toBeNull();
  });
}

for (const tema of TEMAS) {
  test(`(a)(b)(c)(d)(e) fornecedor em passos: novo e editar (${tema})`, async ({ page }) => {
    test.setTimeout(150_000);
    const api = await entrarComoDono(page);
    const s = sufixoUnico();
    const nome = `Forn Wiz ${s}`;
    const whats = `1197${s.slice(0, 7)}`;
    await abrirModulo(page, tema, 'Compras');
    await page.getByRole('button', { name: /Fornecedores/ }).first().click();
    await page.getByRole('button', { name: 'Novo fornecedor' }).first().click();

    await passo(page, 'Qual é o nome do fornecedor?', 1, 3, 'nome');
    await recusa(page, 'Escreva o nome do fornecedor.', 'Qual é o nome do fornecedor?');
    await page.getByLabel('Nome').fill(nome);
    await principal(page).click();

    await passo(page, 'Como falar com ele?', 2, 3, 'contato');
    await recusa(page, 'Escreva o WhatsApp do fornecedor.', 'Como falar com ele?');
    await page.getByLabel('WhatsApp com DDD').fill('123');
    await recusa(page, 'Escreva o WhatsApp com DDD', 'Como falar com ele?');
    await page.getByLabel('WhatsApp com DDD').fill(whats);
    await page.getByLabel('CNPJ (opcional)').fill('123');
    await recusa(page, 'CNPJ com 14 dígitos', 'Como falar com ele?');
    await page.getByLabel('CNPJ (opcional)').fill('12.345.678/0001-95');
    await principal(page).click();

    await passo(page, 'Confira e salve', 3, 3, 'confirmar');
    await expect(page.locator('[data-assistente]')).toContainText(nome);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Como falar com ele?', level: 2 })).toBeVisible();
    await expect(page.getByLabel('CNPJ (opcional)')).toHaveValue('12.345.678/0001-95');
    await principal(page).click();
    await principal(page).click();
    await expect(page.getByRole('button', { name: 'Novo fornecedor' })).toBeVisible();

    const lista = await (await api.get(`/fornecedores?q=${encodeURIComponent(nome)}`)).json();
    const criado = (lista as { fornecedores: { id: string; nome: string; whatsapp: string; cnpj: string | null }[] }).fornecedores.find((f) => f.nome === nome);
    expect(criado, 'o fornecedor existe na API').toBeTruthy();
    expect(criado?.whatsapp).toBe(whats);
    expect(criado?.cnpj).toBe('12345678000195');

    // Editar: mesmo assistente, já preenchido; troca o nome e a API confirma.
    // A lista é paginada (S14c): num banco com muitos fornecedores o criado pode estar na página 2; a busca o traz.
    await page.getByLabel('Buscar fornecedor').fill(nome);
    await page.getByRole('button', { name: new RegExp(nome) }).click();
    await passo(page, 'Qual é o nome do fornecedor?', 1, 3, 'editar-nome');
    await expect(page.getByLabel('Nome')).toHaveValue(nome);
    await page.getByLabel('Nome').fill(`${nome} X`);
    await principal(page).click();
    await principal(page).click();
    await principal(page).click();
    await expect(page.getByRole('button', { name: 'Novo fornecedor' })).toBeVisible();
    const f = await api.get(`/fornecedores/${criado?.id}`);
    expect(((await f.json()) as { nome: string }).nome).toBe(`${nome} X`);
  });
}

async function criarFornecedor(api: APIRequestContext, nome: string, whatsapp: string) {
  const r = await api.post('/fornecedores', { data: { nome, whatsapp, cnpj: null } });
  expect(r.status(), 'fornecedor de apoio').toBe(201);
}

for (const tema of TEMAS) {
  test(`(a)(b)(c)(d)(e) novo pedido em passos (${tema})`, async ({ page }) => {
    test.setTimeout(150_000);
    const api = await entrarComoDono(page);
    const s = sufixoUnico();
    const nomeForn = `Forn Ped ${s}`;
    await criarFornecedor(api, nomeForn, `1196${s.slice(0, 7)}`);
    const peca = await criarPeca(api, s);
    await abrirModulo(page, tema, 'Compras');
    await page.getByRole('button', { name: /Pedidos/ }).first().click();
    await page.getByRole('button', { name: 'Novo pedido' }).click();

    await passo(page, 'De quem vai comprar?', 1, 3, 'fornecedor');
    await recusa(page, 'Escolha o fornecedor.', 'De quem vai comprar?');
    // Com a lista cortada em 200 pela API, o recém-criado só aparece buscando (?q= no servidor).
    await page.getByLabel('Buscar fornecedor').fill(nomeForn);
    await page.getByRole('button', { name: nomeForn }).click();
    await principal(page).click();

    await passo(page, 'Quais peças?', 2, 3, 'pecas');
    // As sugestões chegam da API depois de abrir o passo: espera, para medir o botão já no lugar final.
    await expect(page.getByRole('button', { name: /^\+ / }).first()).toBeVisible();
    await recusa(page, 'Adicione pelo menos uma peça ao pedido.', 'Quais peças?');
    await page.getByLabel('Buscar peça').fill(`Peça E2E ${s}`);
    await page.getByRole('button', { name: new RegExp(`^\\+ Peça E2E ${s}`) }).click();
    await page.getByLabel('Custo unitário').fill('');
    await recusa(page, 'Digite o custo de', 'Quais peças?');
    await page.getByLabel('Quantidade').fill('3');
    await page.getByLabel('Custo unitário').fill('25,50');
    // Voltar do sistema recua para o fornecedor e mantém a escolha e as peças.
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'De quem vai comprar?', level: 2 })).toBeVisible();
    await principal(page).click();
    await expect(page.getByLabel('Custo unitário')).toHaveValue('25,50');
    await principal(page).click();

    await passo(page, 'Confira e salve', 3, 3, 'confirmar');
    await expect(page.locator('[data-assistente]')).toContainText(nomeForn);
    await expect(page.locator('[data-assistente]')).toContainText('R$ 76,50');
    await expect(principal(page)).toHaveText('Salvar rascunho');
    const envio = page.waitForRequest((r) => r.url().includes('/compras') && r.method() === 'POST');
    // Espera também a resposta: a conferência pela API abaixo só vale depois de o pedido ser gravado (corrida vista no stack efêmero).
    const resposta = page.waitForResponse((r) => r.url().includes('/compras') && r.request().method() === 'POST');
    await principal(page).click();
    const corpo = (await envio).postDataJSON() as { itens: { custo_centavos: number; quantidade: number }[] };
    expect(corpo.itens[0]).toMatchObject({ custo_centavos: 2550, quantidade: 3 });
    expect((await resposta).ok(), 'POST /compras respondeu ok').toBe(true);

    await expect(page.getByText(nomeForn).first()).toBeVisible();
    const lista = (await (await api.get('/compras')).json()) as { pedidos: { id: string; fornecedor_nome: string; status: string; total_centavos: number }[] };
    const ped = lista.pedidos.find((p) => p.fornecedor_nome === nomeForn);
    expect(ped, 'o pedido existe na API').toBeTruthy();
    expect(ped?.status).toBe('rascunho');
    expect(ped?.total_centavos).toBe(7650);
    const det = (await (await api.get(`/compras/${ped?.id}`)).json()) as { itens: { sku_id: string; quantidade: number; custo_unitario_centavos: number }[] };
    expect(det.itens).toHaveLength(1);
    expect(det.itens[0]).toMatchObject({ sku_id: peca.skuId, quantidade: 3, custo_unitario_centavos: 2550 });
  });
}

for (const tema of TEMAS) {
  test(`(a)(b)(c)(d)(e) dados da empresa em passos (${tema})`, async ({ page }) => {
    test.setTimeout(150_000);
    const api = await entrarComoDono(page);
    const original = (await (await api.get('/empresa')).json()) as Record<string, unknown>;
    const s = sufixoUnico();
    const endereco = `Rua Wizard ${s}`;
    try {
      await abrirModulo(page, tema, 'Configurações');
      await page.getByRole('button', { name: /Empresa/ }).first().click();

      await passo(page, 'Como se chama a empresa?', 1, 4, 'nome');
      await page.getByLabel('Nome da empresa').fill('');
      await recusa(page, 'Escreva o nome da empresa.', 'Como se chama a empresa?');
      await page.getByLabel('Nome da empresa').fill(String(original.nome));
      await principal(page).click();

      await passo(page, 'Como falar com a empresa?', 2, 4, 'contato');
      await page.getByLabel('Telefone').fill('12345');
      await recusa(page, 'Escreva o telefone com DDD', 'Como falar com a empresa?');
      await page.getByLabel('Telefone').fill(String(original.telefone ?? ''));
      await page.getByLabel('Endereço').fill(endereco);
      await principal(page).click();

      await passo(page, 'Quando travar o app?', 3, 4, 'trava');
      // (O campo numérico corrige 0 para 1 ao sair; a regra de 0 e 121 está no teste unitário. Aqui, campo apagado.)
      await page.getByLabel('Travar o app após').fill('');
      await recusa(page, 'Escolha entre 1 e 120 minutos', 'Quando travar o app?');
      await page.getByLabel('Travar o app após').fill(String(original.inatividade_minutos));
      // Voltar do sistema recua um passo e mantém o endereço digitado.
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Como falar com a empresa?', level: 2 })).toBeVisible();
      await expect(page.getByLabel('Endereço')).toHaveValue(endereco);
      await principal(page).click();
      await principal(page).click();

      await passo(page, 'Confira e salve', 4, 4, 'confirmar');
      await expect(page.locator('[data-assistente]')).toContainText(endereco);
      await expect(principal(page)).toHaveText('Salvar dados');
      await principal(page).click();
      await expect(page.getByRole('heading', { name: 'Configurações', level: 1 })).toBeVisible();

      const depois = (await (await api.get('/empresa')).json()) as Record<string, unknown>;
      expect(depois.endereco).toBe(endereco);
      expect(depois.nome).toBe(original.nome);
      expect(depois.inatividade_minutos).toBe(original.inatividade_minutos);
    } finally {
      // Devolve a empresa ao que era (banco compartilhado com outros testes).
      const { tem_logo: _ignorado, ...resto } = original;
      await api.put('/empresa', { data: resto });
    }
  });
}
