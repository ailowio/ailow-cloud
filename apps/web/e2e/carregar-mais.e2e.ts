import { expect, test, type APIRequestContext } from '@playwright/test';
import { ITENS_POR_PAGINA } from '../src/lib/campos-busca-listas';
import { abrirInicio, entrarComoDono, sufixoUnico } from './apoio';

// ADR 016 (decisão do Pedro, 2026-11-16): a lista que o servidor corta em 200 ganha "Carregar mais" (paginação por
// cursor). Sem buscar, a pessoa alcança o cliente 201 em diante. A prova compara a tela com o total que a API entrega
// página a página (L-0017), então vale no banco limpo do CI e no banco acumulado do dev (L-0025).

const POR_PAGINA_NA_TELA = ITENS_POR_PAGINA;

async function totalPelaApi(api: APIRequestContext): Promise<number> {
  let total = 0;
  let depois: string | null = null;
  for (let i = 0; i < 100; i++) {
    const r = await api.get(`/clientes${depois ? `?depois=${depois}` : ''}`);
    expect(r.ok(), 'GET /clientes').toBe(true);
    const corpo = (await r.json()) as { clientes: unknown[]; proximo: string | null };
    total += corpo.clientes.length;
    if (!corpo.proximo) return total;
    depois = corpo.proximo;
  }
  throw new Error('paginação não terminou');
}

test('Clientes com mais de 200: "Carregar mais" traz o resto, o aviso de corte some e o total bate com a API', async ({ page }) => {
  test.setTimeout(180_000);
  const api = await entrarComoDono(page);
  // Garante mais de 200 clientes: cria o que faltar (no banco limpo do CI, 205).
  const s = sufixoUnico();
  const ja = await totalPelaApi(api);
  for (let i = 0; ja + i <= 205; i++) {
    const celular = `(31) 9${s.slice(0, 4)}-${s.slice(4, 5)}${String(i).padStart(3, '0')}`;
    const r = await api.post('/clientes', { data: { nome: `Pag Mais ${s} ${String(i).padStart(3, '0')}`, celular, aviso_lgpd: true } });
    expect(r.status(), `cliente ${i}`).toBe(201);
  }
  const total = await totalPelaApi(api);
  expect(total, 'mais de 200 clientes para o teste valer').toBeGreaterThan(200);

  await abrirInicio(page);
  await page.getByRole('button', { name: 'Clientes' }).first().click();
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
  await expect(page.locator('[data-aviso-corte]')).toBeVisible();
  // Antes de carregar mais: só a 1ª página do servidor (200) está na tela.
  await expect(page.getByText(`Página 1 de ${Math.ceil(200 / POR_PAGINA_NA_TELA)}`, { exact: true })).toBeVisible();

  const mais = page.getByRole('button', { name: 'Carregar mais' });
  for (let i = 0; i < 20 && (await mais.count()) > 0; i++) await mais.click();
  await expect(mais).toHaveCount(0);
  await expect(page.locator('[data-aviso-corte]')).toHaveCount(0);
  const paginas = Math.ceil(total / POR_PAGINA_NA_TELA);
  await expect(page.getByText(`Página 1 de ${paginas}`, { exact: true })).toBeVisible();
  const larguraRola = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(larguraRola, 'sem rolagem lateral').toBe(false);
});
