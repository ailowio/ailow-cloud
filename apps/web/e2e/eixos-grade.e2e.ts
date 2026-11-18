import { expect, test } from '@playwright/test';
import { entrarComoDono } from './apoio';

// Eixos extras (Taça): criar na biblioteca, ligar em Sutiã, cadastrar produto 1×1×2 → 2 códigos com sufixo.
test('eixo Taça multiplica SKU e código', async ({ page }) => {
  const api = await entrarComoDono(page);

  const eixosResp = await api.get('/eixos-grade');
  expect(eixosResp.ok(), 'GET /eixos-grade').toBe(true);
  const lista = (await eixosResp.json()) as { eixos: { id: string; slug: string }[] };

  let taca = lista.eixos.find((e) => e.slug === 'taca');
  if (!taca) {
    const criado = await api.post('/eixos-grade', { data: { nome: 'Taça', tipo_valor: 'texto' } });
    expect(criado.ok()).toBe(true);
    taca = { id: ((await criado.json()) as { id: string }).id, slug: 'taca' };
  }
  for (const nome of ['A', 'B']) {
    await api.post(`/eixos-grade/${taca.id}/valores`, { data: { nome } });
  }

  const cats = await api.get('/categorias?tipo=produto');
  expect(cats.ok()).toBe(true);
  let sutia = ((await cats.json()) as { categorias: { id: string; nome: string }[] }).categorias.find((c) =>
    /^suti[aã]$/i.test(c.nome),
  );
  if (!sutia) {
    const c = await api.post('/categorias', {
      data: { nome: 'Sutiã', tipo: 'produto', atributos: ['bojo'] },
    });
    expect(c.ok()).toBe(true);
    sutia = { id: ((await c.json()) as { id: string }).id, nome: 'Sutiã' };
  }

  const lib = (await (await api.get('/eixos-grade')).json()) as {
    eixos: { id: string; slug: string }[];
  };
  const tam = lib.eixos.find((e) => e.slug === 'tamanho')!;
  const cor = lib.eixos.find((e) => e.slug === 'cor')!;
  const put = await api.put(`/categorias/${sutia.id}/eixos`, {
    data: {
      eixos: [
        { eixo_id: tam.id, seq: 0 },
        { eixo_id: cor.id, seq: 1 },
        { eixo_id: taca.id, seq: 2 },
      ],
    },
  });
  expect(put.status()).toBe(204);

  const produto = await api.post('/produtos', {
    data: {
      nome: `TQC E2E ${Date.now()}`,
      categoria_id: sutia.id,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 1000,
      preco_centavos: 2900,
      skus: [
        { tamanho: 'M', cor: 'Preto', estoque_inicial: 1, estoque_minimo: 0, extras: [{ slug: 'taca', valor: 'A' }] },
        { tamanho: 'M', cor: 'Preto', estoque_inicial: 1, estoque_minimo: 0, extras: [{ slug: 'taca', valor: 'B' }] },
      ],
    },
  });
  expect(produto.ok(), await produto.text()).toBe(true);
  const corpo = (await produto.json()) as { skus: { codigo: string }[] };
  expect(corpo.skus).toHaveLength(2);
  expect(corpo.skus.every((s) => /-A$|-B$/.test(s.codigo))).toBe(true);
});
