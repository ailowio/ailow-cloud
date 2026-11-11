import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  Cliente,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// S08 / RF-PRO-06 (etiquetas só do Dono), RF-PRO-07 (custo nunca na etiqueta), TEST-17 (2 empresas × 2 perfis).
// Só afirmamos sobre ids/códigos criados aqui (L-0008). O PDF é lido pelo pdfjs-dist, não pelo pdfkit que o gerou.
interface Criado {
  id: string;
  skus: { id: string; codigo: string }[];
}
interface Lado {
  dono: Cliente;
  vendedor: Cliente;
  categoria: string;
}

const CUSTO = 4321; // "43,21" não pode aparecer na etiqueta
const FORNECEDOR = 'Fornecedor Secreto';

async function paginasDoPdf(pdf: Buffer): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const textos: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const c = await (await doc.getPage(i)).getTextContent();
    textos.push(c.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return textos;
}

describe('Etiquetas (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool; // papel dono do banco: só para desativar produto (ainda não há rota para isso)
  let app: FastifyInstance;
  let adminCli: Cliente;
  // 22h30 de 11/11 em São Paulo = 01h30 de 12/11 em UTC: pega quem usar o dia de UTC no nome do arquivo.
  const relogio = new Relogio(new Date('2026-11-12T01:30:00.000Z'));
  let a: Lado;
  let b: Lado;

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    const cat = await p.dono.post('/categorias', { nome: 'Calcinha', atributos: [], tipo: 'produto' });
    if (cat.statusCode !== 201) throw new Error(`criar categoria falhou: ${cat.statusCode} ${cat.body}`);
    return { dono: p.dono, vendedor, categoria: (cat.json() as { id: string }).id };
  }

  async function criar(lado: Lado, nome: string): Promise<Criado> {
    const res = await lado.dono.post('/produtos', {
      nome,
      categoria_id: lado.categoria,
      porte: 'slim',
      atributos: [],
      fornecedor: FORNECEDOR,
      custo_centavos: CUSTO,
      preco_centavos: 8990,
      skus: [
        { tamanho: 'P', cor: 'Preto', estoque_inicial: 2, estoque_minimo: 0 },
        { tamanho: 'M', cor: 'Nude', estoque_inicial: 0, estoque_minimo: 0 },
      ],
    });
    if (res.statusCode !== 201) throw new Error(`criar produto falhou: ${res.statusCode} ${res.body}`);
    return res.json() as Criado;
  }

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 8);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Etiquetas A');
    b = await montar('Etiquetas B');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  const pedido = (itens: { sku_id: string; quantidade: number }[]) => ({ itens });

  it('o Dono recebe o PDF: uma página por fileira de 3, na ordem pedida, com código, nome, tamanho, cor e preço', async () => {
    const p = await criar(a, `Calcinha Açaí ${randomUUID().slice(0, 6)}`);
    const [preto, nude] = p.skus as [Criado['skus'][0], Criado['skus'][0]];
    const res = await a.dono.post('/etiquetas', pedido([
      { sku_id: nude.id, quantidade: 1 },
      { sku_id: preto.id, quantidade: 3 },
    ]));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="etiquetas-.*\.pdf"$/);

    const paginas = await paginasDoPdf(res.rawPayload);
    expect(paginas).toHaveLength(2); // 4 etiquetas = 2 fileiras (a 2ª com 2 em branco)
    const [p1, p2] = paginas as [string, string];
    expect(p1.indexOf(nude.codigo)).toBeGreaterThanOrEqual(0);
    expect(p1.indexOf(nude.codigo)).toBeLessThan(p1.indexOf(preto.codigo));
    expect(p1.split(preto.codigo)).toHaveLength(3); // 2 do preto na 1ª fileira
    expect(p2.split(preto.codigo)).toHaveLength(2); // e 1 na 2ª
    for (const t of ['Calcinha', 'Açaí', 'Nude', 'Preto', 'R$ 89,90']) expect(p1).toContain(t);
  });

  it('o nome do arquivo leva o dia de São Paulo, não o de UTC (22h30 do dia 11 ainda é dia 11)', async () => {
    expect(relogio.agora.toISOString().slice(0, 10)).toBe('2026-11-12'); // em UTC já é dia 12
    const p = await criar(a, `Noite ${randomUUID().slice(0, 6)}`);
    const res = await a.dono.post('/etiquetas', pedido([{ sku_id: (p.skus[0] as { id: string }).id, quantidade: 1 }]));
    expect(res.headers['content-disposition']).toBe('attachment; filename="etiquetas-2026-11-11.pdf"');
  });

  it('RF-PRO-07: a etiqueta não traz custo nem fornecedor', async () => {
    const p = await criar(a, `Sem custo ${randomUUID().slice(0, 6)}`);
    const res = await a.dono.post('/etiquetas', pedido([{ sku_id: (p.skus[0] as { id: string }).id, quantidade: 1 }]));
    const texto = (await paginasDoPdf(res.rawPayload)).join(' ');
    expect(texto).not.toContain('43,21');
    expect(texto).not.toContain(FORNECEDOR);
  });

  it('sem sessão devolve 401', async () => {
    const res = await new Cliente(app).post('/etiquetas', pedido([{ sku_id: randomUUID(), quantidade: 1 }]));
    expect(res.statusCode).toBe(401);
  });

  it('o Vendedor não gera etiquetas (403)', async () => {
    const p = await criar(a, `Vendedor ${randomUUID().slice(0, 6)}`);
    const res = await a.vendedor.post('/etiquetas', pedido([{ sku_id: (p.skus[0] as { id: string }).id, quantidade: 1 }]));
    expect(res.statusCode).toBe(403);
  });

  it('uma empresa não gera etiqueta de SKU da outra (404, sem PDF)', async () => {
    const pb = await criar(b, `Só da B ${randomUUID().slice(0, 6)}`);
    const skuB = (pb.skus[0] as { id: string }).id;
    const res = await a.dono.post('/etiquetas', pedido([{ sku_id: skuB, quantidade: 1 }]));
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).not.toBe('application/pdf');
    // e a própria B consegue
    expect((await b.dono.post('/etiquetas', pedido([{ sku_id: skuB, quantidade: 1 }]))).statusCode).toBe(200);
  });

  it('SKU inexistente no meio do pedido derruba o pedido inteiro (404)', async () => {
    const p = await criar(a, `Misturado ${randomUUID().slice(0, 6)}`);
    const res = await a.dono.post('/etiquetas', pedido([
      { sku_id: (p.skus[0] as { id: string }).id, quantidade: 1 },
      { sku_id: randomUUID(), quantidade: 1 },
    ]));
    expect(res.statusCode).toBe(404);
  });

  it('produto desativado não gera etiqueta (404)', async () => {
    const p = await criar(a, `Desativado ${randomUUID().slice(0, 6)}`);
    await owner.query('UPDATE produtos SET ativo = false WHERE id = $1', [p.id]);
    const res = await a.dono.post('/etiquetas', pedido([{ sku_id: (p.skus[0] as { id: string }).id, quantidade: 1 }]));
    expect(res.statusCode).toBe(404);
  });

  it.each([
    ['quantidade zero', [{ sku_id: randomUUID(), quantidade: 0 }]],
    ['lista vazia', []],
    ['mais de 999 etiquetas', [{ sku_id: randomUUID(), quantidade: 1000 }]],
  ])('pedido inválido (%s) devolve 400', async (_n, itens) => {
    expect((await a.dono.post('/etiquetas', { itens })).statusCode).toBe(400);
  });
});
