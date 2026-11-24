import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { type Cliente, type EmpresaDeTeste, Relogio, adminPool, appDeTeste, loginAdmin, prepararEmpresa, semearAdmin } from './helpers.js';

// P01 (plano "Aprimoramentos voz 23/11"): GET /produtos aceita categoria_id e cor, combináveis com q e com o cursor
// `depois` (ADR 016). Cada teste só afirma sobre ids/nomes criados aqui (L-0008); sufixos só com letras (L-0014).

const letras = () => [...randomBytes(8)].map((b) => String.fromCharCode(97 + (b % 26))).join('');
const QTD = 205;
const PAGINA = 200;

interface Prod {
  id: string;
  nome: string;
  categoria_id: string;
  skus: { cor: string }[];
}
interface Lista {
  produtos: Prod[];
  proximo: string | null;
  truncado: boolean;
}

describe('GET /produtos com filtros de categoria e cor (P01)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

  let a: { empresa: EmpresaDeTeste; dono: Cliente; cat1: string; cat2: string };
  let b: { empresa: EmpresaDeTeste; dono: Cliente; cat: string };
  const sufixo = letras();
  const ids: Record<string, string> = {};

  async function categoria(cli: Cliente, nome: string): Promise<string> {
    const r = await cli.post('/categorias', { nome, atributos: [], tipo: 'produto' });
    expect(r.statusCode, r.body).toBe(201);
    return (r.json() as { id: string }).id;
  }
  async function produto(cli: Cliente, categoriaId: string, nome: string, cores: string[]): Promise<string> {
    const r = await cli.post('/produtos', {
      nome,
      categoria_id: categoriaId,
      porte: 'slim',
      atributos: [],
      fornecedor: null,
      custo_centavos: 1000,
      preco_centavos: 2000,
      skus: cores.map((cor) => ({ tamanho: 'M', cor, estoque_inicial: 3, estoque_minimo: 0 })),
    });
    expect(r.statusCode, r.body).toBe(201);
    return (r.json() as { id: string }).id;
  }
  const listar = async (cli: Cliente, qs: string): Promise<Lista> => {
    const r = await cli.get(`/produtos${qs}`);
    expect(r.statusCode, r.body).toBe(200);
    return r.json() as Lista;
  };
  const idsDe = (l: Lista) => l.produtos.map((p) => p.id);

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    const pa = await prepararEmpresa(app, adminCli, 'Filtros A');
    const pb = await prepararEmpresa(app, adminCli, 'Filtros B');
    a = { empresa: pa.empresa, dono: pa.dono, cat1: await categoria(pa.dono, 'Sutia'), cat2: await categoria(pa.dono, 'Calcinha') };
    b = { empresa: pb.empresa, dono: pb.dono, cat: await categoria(pb.dono, 'Sutia') };

    ids.sutiaRosa = await produto(a.dono, a.cat1, `Alfa ${sufixo}`, ['Rosa Chá', 'Preto']);
    ids.sutiaAzul = await produto(a.dono, a.cat1, `Beta ${sufixo}`, ['Azul']);
    ids.calcRosa = await produto(a.dono, a.cat2, `Alfa calcinha ${sufixo}`, ['ROSA CHA']);
    // Outra empresa: mesma categoria "Sutia", mesma cor e mesmo nome — nunca pode aparecer para A.
    ids.outraEmpresa = await produto(b.dono, b.cat, `Alfa ${sufixo}`, ['Rosa Chá']);

    // 205 produtos só da categoria 2 (sem SKU, direto no banco com RLS) para provar a paginação com filtro.
    await withEmpresa(pool, a.empresa.empresaId, async (c) => {
      await c.query(
        `INSERT INTO produtos (empresa_id, numero, nome, categoria_id, porte, custo_centavos, preco_centavos, criado_por)
         SELECT $1, 1000 + i, 'Zeta ' || $5 || ' ' || lpad(i::text, 3, '0'), $2, 'slim', 100, 1000 + i, $3
           FROM generate_series(1, $4::int) AS i`,
        [a.empresa.empresaId, a.cat2, a.empresa.donoId, QTD, sufixo],
      );
    });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  it('filtra por categoria: só os produtos daquela categoria', async () => {
    const l = await listar(a.dono, `?categoria_id=${a.cat1}`);
    expect(idsDe(l)).toContain(ids.sutiaRosa);
    expect(idsDe(l)).toContain(ids.sutiaAzul);
    expect(idsDe(l)).not.toContain(ids.calcRosa);
    expect(l.produtos.every((p) => p.categoria_id === a.cat1)).toBe(true);
  });

  it.each(['rosa cha', 'ROSA CHÁ', 'Rosa Chá', '  rosa   cha '])('filtra por cor ignorando acento, caixa e espaços: "%s"', async (cor) => {
    const l = await listar(a.dono, `?cor=${encodeURIComponent(cor)}`);
    expect(idsDe(l)).toContain(ids.sutiaRosa);
    expect(idsDe(l)).toContain(ids.calcRosa);
    expect(idsDe(l)).not.toContain(ids.sutiaAzul);
  });

  it('cor casa o SKU, não o produto: o produto com 2 cores aparece 1 vez e traz os 2 SKUs', async () => {
    const l = await listar(a.dono, '?cor=preto');
    expect(idsDe(l).filter((id) => id === ids.sutiaRosa)).toHaveLength(1);
    expect(l.produtos.find((p) => p.id === ids.sutiaRosa)?.skus.map((s) => s.cor).sort()).toEqual(['Preto', 'Rosa Chá']);
  });

  it('cor + categoria: interseção', async () => {
    const l = await listar(a.dono, `?cor=rosa%20cha&categoria_id=${a.cat1}`);
    expect(idsDe(l)).toContain(ids.sutiaRosa);
    expect(idsDe(l)).not.toContain(ids.calcRosa);
    expect(idsDe(l)).not.toContain(ids.sutiaAzul);
  });

  it('combinado com q: busca por nome dentro do filtro', async () => {
    const l = await listar(a.dono, `?q=alfa&categoria_id=${a.cat1}&cor=rosa`);
    // cor é exata ("rosa" não casa "Rosa Chá"): nada
    expect(idsDe(l)).not.toContain(ids.sutiaRosa);
    const m = await listar(a.dono, `?q=${encodeURIComponent(`alfa ${sufixo}`)}&categoria_id=${a.cat1}&cor=rosa%20cha`);
    expect(idsDe(m)).toEqual([ids.sutiaRosa]);
  });

  it('paginação com filtro: 205 em 2 páginas, sem repetir nem pular, todos da categoria', async () => {
    const todos: Prod[] = [];
    let depois: string | null = null;
    const tamanhos: number[] = [];
    for (let i = 0; i < 5; i++) {
      const l: Lista = await listar(a.dono, `?categoria_id=${a.cat2}${depois ? `&depois=${depois}` : ''}`);
      tamanhos.push(l.produtos.length);
      todos.push(...l.produtos);
      if (!l.proximo) break;
      depois = l.proximo;
    }
    expect(tamanhos).toEqual([PAGINA, QTD + 1 - PAGINA]); // 205 em massa + "Alfa calcinha"
    expect(new Set(todos.map((p) => p.id)).size).toBe(QTD + 1);
    expect(todos.every((p) => p.categoria_id === a.cat2)).toBe(true);
    const unica = await withEmpresa(pool, a.empresa.empresaId, (c) =>
      c.query('SELECT id FROM produtos WHERE ativo AND categoria_id = $1 ORDER BY lower(nome), numero', [a.cat2]),
    );
    expect(todos.map((p) => p.id)).toEqual(unica.rows.map((r) => r.id));
  });

  it('isolamento: o filtro nunca devolve produto de outra empresa (nem usando a categoria dela)', async () => {
    const doA = await listar(a.dono, '?cor=rosa%20cha');
    expect(idsDe(doA)).not.toContain(ids.outraEmpresa);
    const categoriaAlheia = await listar(a.dono, `?categoria_id=${b.cat}`);
    expect(categoriaAlheia.produtos).toEqual([]);
    const doB = await listar(b.dono, '?cor=rosa%20cha');
    expect(idsDe(doB)).toEqual([ids.outraEmpresa]);
  });

  it.each(['abc', '123', '00000000-0000-0000-0000-00000000000g', ''])('categoria_id inválido ("%s") devolve 400', async (v) => {
    const r = await a.dono.get(`/produtos?categoria_id=${v}`);
    expect(r.statusCode).toBe(400);
  });

  it('cor longa demais devolve 400', async () => {
    expect((await a.dono.get(`/produtos?cor=${'x'.repeat(41)}`)).statusCode).toBe(400);
  });

  it('sem filtros o comportamento é o de antes: devolve os produtos da empresa', async () => {
    const l = await listar(a.dono, `?q=${encodeURIComponent(sufixo)}`);
    expect(idsDe(l)).toEqual(expect.arrayContaining([ids.sutiaRosa, ids.sutiaAzul, ids.calcRosa]));
    expect(idsDe(l)).not.toContain(ids.outraEmpresa);
  });
});
