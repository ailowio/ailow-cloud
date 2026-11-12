import { expect, type APIRequestContext, type Page } from '@playwright/test';

// Apoio comum aos E2E. Os dados de cada teste nascem pela API (mesma sessão do navegador), com nomes únicos,
// porque os testes dividem o mesmo banco (L-0008): nunca contar nem comparar linhas globais.
// Credenciais: as do `dev:seed` (públicas, só do banco local) ou, no CI/`scripts/e2e.sh`, as da empresa
// descartável (E2E_EMAIL / E2E_SENHA, geradas a cada execução e nunca gravadas).
export const DONO = {
  email: process.env.E2E_EMAIL ?? 'dono@loja.dev',
  senha: process.env.E2E_SENHA ?? 'senha-de-desenvolvimento',
};
export const PIN_DE_TESTE = '4321';

export function sufixoUnico(): string {
  return `${Date.now()}`.slice(-7) + `${Math.floor(Math.random() * 10)}`;
}

export async function entrarComoDono(page: Page): Promise<APIRequestContext> {
  const api = page.context().request;
  const entrou = await api.post('/acesso/entrar', { data: DONO });
  expect(entrou.ok(), 'login do Dono pela API').toBe(true);
  // O Dono da empresa descartável nasce sem PIN; com o PIN definido a sessão fica como a usada pelo app.
  // No banco do `dev:seed` o PIN pode já existir: aí a API recusa e a sessão segue valendo.
  await api.put('/acesso/meu-pin', { data: { senha: DONO.senha, pin: PIN_DE_TESTE } });
  return api;
}

export interface Peca {
  skuId: string;
  codigo: string;
}

/** Cria uma categoria e um produto de 1 peça com o estoque pedido; devolve o SKU. */
export async function criarPeca(api: APIRequestContext, sufixo: string, estoque = 5): Promise<Peca> {
  const cat = await api.post('/categorias', { data: { nome: `E2E ${sufixo}`, atributos: [], tipo: 'produto' } });
  expect(cat.status(), 'categoria de produto').toBe(201);
  const { id: categoria_id } = (await cat.json()) as { id: string };
  const prod = await api.post('/produtos', {
    data: {
      nome: `Peça E2E ${sufixo}`,
      categoria_id,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 4000,
      preco_centavos: 9900,
      skus: [{ tamanho: 'M', cor: `Cor${sufixo.replace(/\d/g, (d) => 'abcdefghij'[Number(d)] as string)}`, estoque_inicial: estoque, estoque_minimo: 0 }],
    },
  });
  expect(prod.status(), 'produto').toBe(201);
  const { skus } = (await prod.json()) as { skus: { id: string; codigo: string }[] };
  return { skuId: skus[0]!.id, codigo: skus[0]!.codigo };
}

export async function saldo(api: APIRequestContext, skuId: string): Promise<number> {
  // Não há GET de saldo por SKU: o saldo vem da lista de produtos (a mesma que a tela usa).
  const r = await api.get('/produtos');
  expect(r.ok(), 'lista de produtos').toBe(true);
  const { produtos } = (await r.json()) as { produtos: { skus: { id: string; estoque: number }[] }[] };
  const sku = produtos.flatMap((p) => p.skus).find((s) => s.id === skuId);
  expect(sku, 'SKU criado pelo teste aparece na lista').toBeTruthy();
  return (sku as { estoque: number }).estoque;
}

export async function abrirInicio(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('O que vamos fazer?')).toBeVisible();
}
