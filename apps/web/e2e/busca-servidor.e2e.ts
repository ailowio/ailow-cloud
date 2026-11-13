import { expect, test, type APIRequestContext } from '@playwright/test';

// S14c: com mais de 200 produtos a lista vem cortada (`truncado`). A busca passa a perguntar ao servidor (?q=) e une com
// o que já está na tela; o corte é avisado; se a rede falhar, a lista local continua e há um toast. O cenário é o banco
// saturado: se ele ainda não tem mais de 200 produtos, o teste completa até passar de 200 (dados sintéticos, sem apagar).
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

async function garantirListaCortada(api: APIRequestContext) {
  const lista = async () => (await (await api.get('/produtos')).json()) as { produtos: { nome: string }[]; truncado: boolean };
  let atual = await lista();
  if (atual.truncado) return atual;
  const cat = await api.post('/categorias', { data: { nome: `E2E enche ${sufixoUnico()}`, atributos: [], tipo: 'produto' } });
  const { id: categoria_id } = (await cat.json()) as { id: string };
  for (let i = 0; i < 210 && !atual.truncado; i++) {
    const r = await api.post('/produtos', {
      data: { nome: `Aa enche ${sufixoUnico()} ${i}`, categoria_id, porte: 'slim', atributos: [], fornecedor: null, custo_centavos: 100, preco_centavos: 200, skus: [{ tamanho: 'M', cor: 'Azul', estoque_inicial: 1, estoque_minimo: 0 }] },
    });
    expect(r.status(), `produto de enchimento ${i}`).toBe(201);
    if (i % 25 === 24) atual = await lista();
  }
  atual = await lista();
  expect(atual.truncado, 'a lista sem filtro precisa estar cortada neste cenário').toBe(true);
  return atual;
}

async function criarUltimoDaFila(api: APIRequestContext, letras: string) {
  const cat = await api.post('/categorias', { data: { nome: `E2E srv ${letras}`, atributos: [], tipo: 'produto' } });
  const { id: categoria_id } = (await cat.json()) as { id: string };
  // "Zz": a lista vem em ordem alfabética; este produto fica depois dos 200 primeiros.
  const nome = `Zz servidor ${letras}`;
  const r = await api.post('/produtos', {
    data: { nome, categoria_id, porte: 'slim', atributos: [], fornecedor: null, custo_centavos: 100, preco_centavos: 4321, skus: [{ tamanho: 'M', cor: 'Azul', estoque_inicial: 1, estoque_minimo: 0 }] },
  });
  expect(r.status(), 'produto').toBe(201);
  return nome;
}

for (const tela of ['Produtos', 'Etiquetas'] as const) {
  test(`${tela}: com mais de 200 produtos a busca acha no servidor o que a lista cortada não tem, e o corte é avisado`, async ({ page }) => {
    const api = await entrarComoDono(page);
    await garantirListaCortada(api);
    const letras = sufixoUnico().replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string);
    const nome = await criarUltimoDaFila(api, letras);
    await abrirInicio(page);
    await page.getByRole('button', { name: 'Produtos' }).first().click();
    if (tela === 'Etiquetas') await page.getByRole('button', { name: 'Etiquetas' }).click();
    const cartoes = page.locator('.ailow-cartao');
    await expect(cartoes.first()).toBeVisible();

    // Sem busca: aviso claro de que só os primeiros 200 estão na lista.
    await expect(page.locator('[data-aviso-corte]')).toHaveText('Mostrando os primeiros 200; refine a busca.');
    await expect(cartoes.filter({ hasText: nome })).toHaveCount(0);

    // A busca (debounce de 300 ms) consulta o servidor com ?q= e o produto aparece.
    const consulta = page.waitForRequest((r) => r.url().includes('/produtos?q=') && r.method() === 'GET');
    await page.getByLabel('Buscar produto').fill(nome);
    await consulta;
    await expect(cartoes.filter({ hasText: nome })).toHaveCount(1);
    // Busca que o servidor respondeu inteira: o aviso de corte some.
    await expect(page.locator('[data-aviso-corte]')).toHaveCount(0);

    // Caracteres soltos + um pedaço contínuo: o servidor recebe o pedaço, o cliente aplica o resto.
    await page.getByLabel('Buscar produto').fill(`zz srvdr ${letras}`);
    await expect(cartoes.filter({ hasText: nome })).toHaveCount(1);

    // Pelo preço (faixa do servidor): "43,21" junto do sufixo.
    await page.getByLabel('Buscar produto').fill(`43,21 ${letras}`);
    await expect(cartoes.filter({ hasText: nome })).toHaveCount(1);
  });
}

test('Produtos: se a consulta ao servidor falhar, a lista já carregada continua na tela e aparece um toast', async ({ page }) => {
  const api = await entrarComoDono(page);
  const { produtos } = await garantirListaCortada(api);
  const conhecido = produtos[0]?.nome as string;
  await page.route('**/produtos?q=*', (rota) => rota.abort('failed'));
  await abrirInicio(page);
  await page.getByRole('button', { name: 'Produtos' }).first().click();
  await expect(page.locator('.ailow-cartao').first()).toBeVisible();
  await page.getByLabel('Buscar produto').fill(conhecido);
  await expect(page.getByText('Não consegui buscar no servidor')).toBeVisible();
  await expect(page.locator('.ailow-cartao', { hasText: conhecido }).first()).toBeVisible();
});
