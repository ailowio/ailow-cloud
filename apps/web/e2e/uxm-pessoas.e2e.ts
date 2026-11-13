import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { hojeEmSaoPaulo } from '../src/lib/datas';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// S12: Pessoas como menu de ícones + subrotas, "Adicionar ponto" em assistente, confirmação do resultado,
// histórico (busca + paginação) e relatório. 360×640, nos 2 temas. A prova de que "deu certo" vem da API (GET).
const TEMAS = ['dark', 'light'] as const;
const POR_PAGINA = 10;

async function novoVendedor(api: APIRequestContext, nome: string): Promise<string> {
  const r = await api.post('/usuarios', { data: { nome, pin: '1234' } });
  expect(r.status(), 'vendedor de teste').toBe(201);
  return ((await r.json()) as { id: string }).id;
}

interface MarcaApi {
  id: string;
  tipo: 'entrada' | 'saida';
  registrado_em: string;
}
async function marcasDe(api: APIRequestContext, usuarioId: string, mes: string): Promise<MarcaApi[]> {
  const r = await api.get(`/pontos/espelho?mes=${mes}&usuario_id=${usuarioId}`);
  expect(r.ok(), 'espelho').toBe(true);
  const e = (await r.json()) as { usuarios: { dias: { marcas: MarcaApi[] }[] }[] };
  return e.usuarios.flatMap((u) => u.dias.flatMap((d) => d.marcas)).sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
}

async function medidas(page: Page, onde: string) {
  const m = await page.evaluate(() => {
    const e = document.documentElement;
    return { sh: e.scrollHeight, ih: window.innerHeight, sw: e.scrollWidth, cw: e.clientWidth };
  });
  expect(m.sh, `${onde}: rolagem de página ${m.sh} > ${m.ih}`).toBeLessThanOrEqual(m.ih);
  expect(m.sw, `${onde}: overflow horizontal ${m.sw} > ${m.cw}`).toBeLessThanOrEqual(m.cw);
}

async function usarTema(page: Page, tema: (typeof TEMAS)[number]) {
  await page.evaluate((t) => localStorage.setItem('mantine-color-scheme-value', t), tema);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', tema);
}

const aviso = (page: Page) => page.locator('.mantine-Notifications-notification');
const principal = (page: Page) => page.locator('[data-botao="principal"]');
const secundario = (page: Page) => page.locator('[data-botao="secundario"]');
const linhas = (page: Page) => page.locator('[data-linha-ponto]');

async function abrirPessoas(page: Page) {
  await page.goto('/');
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Pessoas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Pessoas' })).toBeVisible();
}

test('menu de Pessoas: 3 ícones (3 colunas, alvos >= 48 px) abrem a tela certa e o Voltar recua', async ({ page }) => {
  await entrarComoDono(page);
  for (const tema of TEMAS) {
    await page.goto('/');
    await usarTema(page, tema);
    await abrirPessoas(page);
    const nomes = ['Gerenciar pessoas', 'Histórico de pontos', 'Relatório de pontos'];
    const caixas = [];
    for (const n of nomes) {
      const b = page.getByRole('button', { name: n });
      await expect(b, `${tema}: ícone ${n}`).toBeVisible();
      caixas.push((await b.boundingBox())!);
    }
    for (const c of caixas) {
      expect(c.width, `${tema}: largura`).toBeGreaterThanOrEqual(48);
      expect(c.height, `${tema}: altura`).toBeGreaterThanOrEqual(48);
    }
    expect(new Set(caixas.map((c) => Math.round(c.y))).size, `${tema}: mesma linha (3 colunas)`).toBe(1);
    expect(new Set(caixas.map((c) => Math.round(c.x))).size, `${tema}: 3 colunas distintas`).toBe(3);
    await medidas(page, `${tema}/menu`);

    const destinos: [string, string, string][] = [
      ['Gerenciar pessoas', 'Gerenciar pessoas', '/pessoas/gerenciar'],
      ['Histórico de pontos', 'Histórico de pontos', '/pessoas/historico'],
      ['Relatório de pontos', 'Relatório de pontos', '/pessoas/relatorio'],
    ];
    for (const [botao, titulo, rota] of destinos) {
      await page.getByRole('button', { name: botao }).click();
      await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(rota);
      await expect(page.locator('main [aria-busy="true"], [role="status"]')).toHaveCount(0, { timeout: 8000 });
      await medidas(page, `${tema}${rota}`);
      // Voltar do sistema recua para Pessoas
      await page.goBack();
      await expect(page.getByRole('heading', { level: 1, name: 'Pessoas' })).toBeVisible();
      expect(new URL(page.url()).pathname).toBe('/pessoas');
    }
    // seta do topo: tela -> Pessoas -> Início
    await page.getByRole('button', { name: 'Histórico de pontos' }).click();
    await page.getByRole('button', { name: 'Voltar para Pessoas' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Pessoas' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para Início' }).click();
    await expect(page.getByText('O que vamos fazer?')).toBeVisible();
  }
});

test('Adicionar ponto em assistente: valida por toast sem mover o layout, salva e o histórico mostra na hora', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const nome = `Vend Ponto ${s}`;
  const id = await novoVendedor(api, nome);
  const hoje = hojeEmSaoPaulo();

  await abrirPessoas(page);
  await page.getByRole('button', { name: 'Histórico de pontos' }).click();
  await page.getByRole('button', { name: 'Adicionar ponto' }).click();
  expect(new URL(page.url()).pathname).toBe('/pessoas/historico/adicionar');
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();

  // botões: principal x secundário distintos e >= 48 px
  const bp = (await principal(page).boundingBox())!;
  const bs = (await secundario(page).boundingBox())!;
  expect(bp.height).toBeGreaterThanOrEqual(48);
  expect(bs.height).toBeGreaterThanOrEqual(48);
  expect(bp.width, 'principal é maior que o secundário').toBeGreaterThan(bs.width);
  await expect(secundario(page)).toHaveText('Cancelar');

  // (c) sem pessoa: toast e o botão não se mexe
  await principal(page).click();
  await expect(aviso(page).filter({ hasText: 'Escolha a pessoa' })).toBeVisible();
  const depois = (await principal(page).boundingBox())!;
  expect(depois.y, 'layout não se mexe com o toast').toBe(bp.y);
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();

  await page.getByRole('button', { name: nome }).click();
  await principal(page).click();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();

  // hora vazia -> toast
  await principal(page).click();
  await expect(aviso(page).filter({ hasText: 'hora' })).toBeVisible();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();

  // Saída sem entrada antes: o servidor recusa (sequência) e a pessoa continua no último passo
  await page.getByText('Saída', { exact: true }).click();
  await page.getByLabel('Hora').fill('00:01');
  await principal(page).click();
  await page.getByLabel('Motivo').fill('Esqueceu de bater');
  await principal(page).click();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  await expect(page.getByText('Esqueceu de bater')).toBeVisible();
  await principal(page).click();
  await expect(aviso(page).filter({ hasText: 'primeiro registro' })).toBeVisible();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  expect(await marcasDe(api, id, hoje), 'nada gravado').toHaveLength(0);

  // Voltar do sistema recua um passo por vez; corrige para Entrada 00:00
  await secundario(page).click();
  await secundario(page).click();
  await expect(page.getByText('Passo 2 de 4')).toBeVisible();
  await page.getByText('Entrada', { exact: true }).click();
  await page.getByLabel('Hora').fill('00:00');
  await principal(page).click();
  await principal(page).click();
  await expect(page.getByText('Passo 4 de 4')).toBeVisible();
  await principal(page).click();

  // confirmação explícita do resultado
  const resultado = page.locator('[data-resultado-ponto]');
  await expect(resultado).toBeVisible();
  await expect(resultado).toContainText('Entrada');
  await expect(resultado).toContainText('00:00');
  await expect(aviso(page).filter({ hasText: 'Ponto adicionado' })).toBeVisible();
  const m1 = await marcasDe(api, id, hoje);
  expect(m1.map((m) => m.tipo)).toEqual(['entrada']);
  expect(m1[0]?.registrado_em, 'sem desvio de fuso').toBe(`${hoje}T03:00:00.000Z`);

  // "Adicionar outro" volta ao passo 1 e agora a saída é aceita
  await page.getByRole('button', { name: 'Adicionar outro' }).click();
  await expect(page.getByText('Passo 1 de 4')).toBeVisible();
  await page.getByRole('button', { name: nome }).click();
  await principal(page).click();
  await page.getByText('Saída', { exact: true }).click();
  await page.getByLabel('Hora').fill('00:01');
  await principal(page).click();
  await page.getByLabel('Motivo').fill('Esqueceu de bater a saída');
  await principal(page).click();
  await principal(page).click();
  await expect(resultado).toContainText('Saída');
  const m2 = await marcasDe(api, id, hoje);
  expect(m2.map((m) => [m.tipo, m.registrado_em])).toEqual([
    ['entrada', `${hoje}T03:00:00.000Z`],
    ['saida', `${hoje}T03:01:00.000Z`],
  ]);

  // o histórico já mostra os dois registros, com tipo, data e hora
  await page.getByRole('button', { name: 'Ver no histórico' }).click();
  expect(new URL(page.url()).pathname).toBe('/pessoas/historico');
  await page.getByLabel('Buscar ponto').fill(nome);
  await expect(linhas(page)).toHaveCount(2);
  await expect(linhas(page).first()).toContainText('Saída');
  await expect(linhas(page).first()).toContainText('00:01');
  await expect(linhas(page).nth(1)).toContainText('Entrada');
  await expect(linhas(page).nth(1)).toContainText('00:00');
  await expect(linhas(page).first()).toContainText(hoje.split('-').reverse().join('/'));
  // Voltar do histórico vai para Pessoas (não reabre o assistente)
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Pessoas' })).toBeVisible();
});

test('histórico: busca e paginação (DOM <= página) e relatório de horas por dia', async ({ page }) => {
  const api = await entrarComoDono(page);
  const s = sufixoUnico();
  const nome = `Vend Hist ${s}`;
  const id = await novoVendedor(api, nome);
  // 12 dias do mês anterior, 4 h por dia (08:00-12:00) = 24 marcas
  const [ano, mes] = hojeEmSaoPaulo().split('-').map(Number) as [number, number];
  const ant = mes === 1 ? { a: ano - 1, m: 12 } : { a: ano, m: mes - 1 };
  const mesAnt = `${ant.a}-${String(ant.m).padStart(2, '0')}-01`;
  for (let d = 1; d <= 12; d++) {
    const data = `${ant.a}-${String(ant.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    for (const [tipo, hora] of [['entrada', '08:00'], ['saida', '12:00']] as const) {
      const r = await api.post('/pontos/manual', { data: { usuario_id: id, tipo, data, hora, motivo: 'carga E2E' } });
      expect(r.status(), `${tipo} ${data}`).toBe(201);
    }
  }
  for (const tema of TEMAS) {
    await page.goto('/pessoas/historico');
    await usarTema(page, tema);
    await expect(page.getByRole('heading', { level: 1, name: 'Histórico de pontos' })).toBeVisible();
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    const busca = page.getByLabel('Buscar ponto');
    await busca.fill(nome);
    await expect(linhas(page)).toHaveCount(POR_PAGINA);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 3');
    expect(await linhas(page).count(), 'DOM <= tamanho da página').toBeLessThanOrEqual(POR_PAGINA);
    await medidas(page, `${tema}/histórico`);
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 2 de 3');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(linhas(page)).toHaveCount(4);
    // busca refina: só as saídas
    await busca.fill(`${nome} saída`);
    await expect(linhas(page)).toHaveCount(POR_PAGINA);
    await expect(page.locator('[data-paginacao-texto]')).toHaveText('Página 1 de 2');
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(linhas(page)).toHaveCount(2); // 12 saídas = 10 + 2
    await expect(linhas(page).filter({ hasText: 'Entrada' })).toHaveCount(0);
    await busca.fill('zzzz nenhum');
    await expect(linhas(page)).toHaveCount(0);
    await expect(page.getByText('Nenhum ponto encontrado')).toBeVisible();
    await medidas(page, `${tema}/histórico vazio`);

    // relatório: 12 dias x 4h = 48h00
    await page.goto('/pessoas/relatorio');
    await expect(page.getByRole('heading', { level: 1, name: 'Relatório de pontos' })).toBeVisible();
    await page.getByRole('button', { name: 'Mês anterior' }).click();
    const cartao = page.locator('[data-relatorio-pessoa]').filter({ hasText: nome });
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('48h00');
    await expect(cartao).toContainText('12 dias');
    await expect(cartao.locator('[data-relatorio-dia]')).toHaveCount(12);
    await expect(cartao.locator('[data-relatorio-dia]').first()).toContainText('4h00');
    await medidas(page, `${tema}/relatório`);
  }
  expect(mesAnt).toMatch(/^\d{4}-\d{2}-01$/);
});

test('bater ponto: confirmação explícita do resultado e o registro aparece no histórico', async ({ page }) => {
  const api = await entrarComoDono(page);
  // O ponto exige 30 s entre batidas da mesma pessoa (outro teste do Dono pode ter batido há pouco).
  const est = (await (await api.get('/pontos/estado')).json()) as { proximo: 'entrada' | 'saida'; ultima: { registrado_em: string } | null };
  if (est.ultima) {
    const idade = Date.now() - Date.parse(est.ultima.registrado_em);
    if (idade < 32000) await page.waitForTimeout(32000 - idade);
  }
  await abrirPessoas(page);
  const rotulo = est.proximo === 'entrada' ? 'Bater entrada' : 'Bater saída';
  const tipo = est.proximo === 'entrada' ? 'Entrada' : 'Saída';
  await page.getByRole('button', { name: rotulo }).click();
  const conf = page.locator('[data-resultado-ponto]');
  await expect(conf).toBeVisible();
  await expect(conf).toContainText(tipo);
  await expect(conf).toContainText(/\d{2}:\d{2}/);
  await medidas(page, 'bater/confirmação');
  const eu = (await (await api.get('/acesso/eu')).json()) as { usuario: { id: string; nome: string } };
  const marcas = await marcasDe(api, eu.usuario.id, hojeEmSaoPaulo());
  const ultima = marcas[marcas.length - 1]!;
  expect(ultima.tipo).toBe(est.proximo);
  await page.getByRole('button', { name: 'Ver no histórico' }).click();
  await page.getByLabel('Buscar ponto').fill(eu.usuario.nome);
  await expect(linhas(page).first()).toContainText(tipo);
  expect(new Date(ultima.registrado_em).getTime()).toBeGreaterThan(Date.now() - 120000);
});

test('Adicionar ponto: botões e passos nos 2 temas sem overflow nem rolagem de página', async ({ page }) => {
  const api = await entrarComoDono(page);
  const nome = `Vend Tema ${sufixoUnico()}`;
  await novoVendedor(api, nome);
  for (const tema of TEMAS) {
    await page.goto('/');
    await usarTema(page, tema);
    await page.goto('/pessoas/historico/adicionar');
    for (let passo = 1; passo <= 4; passo++) {
      await expect(page.getByText(`Passo ${passo} de 4`)).toBeVisible();
      const bp = (await principal(page).boundingBox())!;
      const bs = (await secundario(page).boundingBox())!;
      expect(bp.height, `${tema} p${passo}`).toBeGreaterThanOrEqual(48);
      expect(bs.height, `${tema} p${passo}`).toBeGreaterThanOrEqual(48);
      const fundoP = await principal(page).evaluate((e) => getComputedStyle(e).backgroundColor);
      const fundoS = await secundario(page).evaluate((e) => getComputedStyle(e).backgroundColor);
      expect(fundoP, `${tema} p${passo}: principal x secundário`).not.toBe(fundoS);
      await medidas(page, `${tema}/passo ${passo}`);
      if (passo === 4) break;
      if (passo === 1) await page.getByRole('button', { name: nome }).click();
      if (passo === 2) await page.getByLabel('Hora').fill('00:00');
      if (passo === 3) await page.getByLabel('Motivo').fill('Teste de tema');
      await principal(page).click();
    }
  }
});
