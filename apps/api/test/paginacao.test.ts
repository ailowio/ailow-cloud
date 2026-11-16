import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import {
  type Cliente,
  type EmpresaDeTeste,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// ADR 016 (decisão do Pedro, 2026-11-16: "a melhor recomendação com boas práticas"): paginação no servidor por CURSOR
// (keyset) nas listas que cortam em 200 (produtos, clientes, fornecedores) e busca por pedaço do nome acelerada por
// índice de trigramas (pg_trgm). Cada empresa recebe 205 itens em lote (pelo papel da aplicação, com RLS).
// Só afirma sobre o que é desta empresa (L-0008); a ordem é a da lista (nome, depois desempate estável).

const QTD = 205;
const PAGINA = 200;

interface Pagina<T> {
  itens: T[];
  proximo: string | null;
  truncado: boolean;
}

describe('Paginação por cursor e busca por trigramas (ADR 016)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  let e: EmpresaDeTeste;
  let dono: Cliente;
  let vendedor: Cliente;
  let outra: { empresa: EmpresaDeTeste; dono: Cliente };
  const relogio = new Relogio();

  async function lerTudo<T>(cli: Cliente, url: (depois: string | null) => string, chave: string): Promise<{ paginas: Pagina<T>[]; todos: T[] }> {
    const paginas: Pagina<T>[] = [];
    let depois: string | null = null;
    for (let i = 0; i < 10; i++) {
      const r = await cli.get(url(depois));
      expect(r.statusCode, r.body).toBe(200);
      const corpo = r.json() as Record<string, unknown>;
      const p = { itens: corpo[chave] as T[], proximo: corpo.proximo as string | null, truncado: corpo.truncado as boolean };
      paginas.push(p);
      if (!p.proximo) break;
      depois = p.proximo;
    }
    return { paginas, todos: paginas.flatMap((p) => p.itens) };
  }

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    const p = await prepararEmpresa(app, adminCli, 'Paginacao A');
    e = p.empresa;
    dono = p.dono;
    vendedor = await novoAparelho(app, e);
    await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    const q = await prepararEmpresa(app, adminCli, 'Paginacao B');
    outra = { empresa: q.empresa, dono: q.dono };

    const cat = await dono.post('/categorias', { nome: 'Pag Cat', atributos: [], tipo: 'produto' });
    const categoriaId = (cat.json() as { id: string }).id;
    // Nomes com acento e caixa misturados ("Peça", "PECA", "peça") para provar a ordem e a busca sem acento.
    await withEmpresa(pool, e.empresaId, async (c) => {
      await c.query(
        `INSERT INTO produtos (empresa_id, numero, nome, categoria_id, porte, custo_centavos, preco_centavos, criado_por)
         SELECT $1, i, (ARRAY['Peça','PECA','peça'])[1 + i % 3] || ' Pag ' || lpad(i::text, 3, '0'), $2, 'slim', 100, 1000 + i, $3
           FROM generate_series(1, $4::int) AS i`,
        [e.empresaId, categoriaId, e.donoId, QTD],
      );
      await c.query(
        `INSERT INTO clientes (empresa_id, nome, celular, criado_por)
         SELECT $1, (ARRAY['Ána','ANA','ana'])[1 + i % 3] || ' Pag ' || lpad(i::text, 3, '0'), '119' || lpad(i::text, 8, '0'), $2
           FROM generate_series(1, $3::int) AS i`,
        [e.empresaId, e.donoId, QTD],
      );
      await c.query(
        `INSERT INTO fornecedores (empresa_id, nome, whatsapp)
         SELECT $1, (ARRAY['Fábrica','FABRICA','fabrica'])[1 + i % 3] || ' Pag ' || lpad(i::text, 3, '0'), '219' || lpad(i::text, 8, '0')
           FROM generate_series(1, $2::int) AS i`,
        [e.empresaId, QTD],
      );
    });
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('produtos', () => {
    it('sem busca: 200 + 5 em duas páginas, sem repetir nem pular nenhum, na mesma ordem de uma leitura só', async () => {
      const { paginas, todos } = await lerTudo<{ id: string; nome: string }>(dono, (d) => `/produtos${d ? `?depois=${d}` : ''}`, 'produtos');
      expect(paginas.map((p) => p.itens.length)).toEqual([PAGINA, QTD - PAGINA]);
      expect(paginas[0]?.truncado).toBe(true);
      expect(paginas[1]?.proximo).toBeNull();
      expect(paginas[1]?.truncado).toBe(false);
      expect(new Set(todos.map((p) => p.id)).size).toBe(QTD);
      // Ordem da lista: nome sem diferenciar caixa e o número do produto no empate.
      const nomes = todos.map((p) => p.nome.toLowerCase());
      expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    });

    it('com busca sem acento nem caixa ("PECA pag") também pagina: 205 resultados em 2 páginas', async () => {
      const { todos } = await lerTudo<{ id: string }>(dono, (d) => `/produtos?q=PECA%20pag${d ? `&depois=${d}` : ''}`, 'produtos');
      // "PECA pag" não é um pedaço contínuo de "Peça Pag 001"? É: "peca pag" depois de tirar acento e caixa.
      expect(new Set(todos.map((p) => p.id)).size).toBe(QTD);
    });

    it('o Vendedor pagina do mesmo jeito (e continua sem custo)', async () => {
      const { todos } = await lerTudo<Record<string, unknown>>(vendedor, (d) => `/produtos${d ? `?depois=${d}` : ''}`, 'produtos');
      expect(todos.length).toBe(QTD);
      expect(todos.some((p) => 'custo_centavos' in p)).toBe(false);
    });

    it('o cursor de uma empresa não mostra nada da outra (a RLS manda; o cursor só diz onde continuar)', async () => {
      const primeira = (await dono.get('/produtos')).json() as { proximo: string };
      const r = await outra.dono.get(`/produtos?depois=${primeira.proximo}`);
      expect(r.statusCode).toBe(200);
      const ids = new Set(((await dono.get('/produtos')).json() as { produtos: { id: string }[] }).produtos.map((p) => p.id));
      expect((r.json() as { produtos: { id: string }[] }).produtos.filter((p) => ids.has(p.id))).toEqual([]);
    });
  });

  describe('clientes', () => {
    it('205 clientes em 2 páginas, sem repetir; busca "ana pag" sem acento pagina igual', async () => {
      const sem = await lerTudo<{ id: string }>(dono, (d) => `/clientes${d ? `?depois=${d}` : ''}`, 'clientes');
      expect(sem.paginas.map((p) => p.itens.length)).toEqual([PAGINA, QTD - PAGINA]);
      expect(new Set(sem.todos.map((c) => c.id)).size).toBe(QTD);
      const com = await lerTudo<{ id: string }>(dono, (d) => `/clientes?q=ANA%20PAG${d ? `&depois=${d}` : ''}`, 'clientes');
      expect(new Set(com.todos.map((c) => c.id)).size).toBe(QTD);
    });
  });

  describe('fornecedores', () => {
    it('205 fornecedores em 2 páginas, sem repetir; busca "fabrica pag" sem acento pagina igual', async () => {
      const sem = await lerTudo<{ id: string }>(dono, (d) => `/fornecedores${d ? `?depois=${d}` : ''}`, 'fornecedores');
      expect(sem.paginas.map((p) => p.itens.length)).toEqual([PAGINA, QTD - PAGINA]);
      expect(new Set(sem.todos.map((f) => f.id)).size).toBe(QTD);
      const com = await lerTudo<{ id: string }>(dono, (d) => `/fornecedores?q=f%C3%A1brica%20PAG${d ? `&depois=${d}` : ''}`, 'fornecedores');
      expect(new Set(com.todos.map((f) => f.id)).size).toBe(QTD);
    });
  });

  describe('cursor inválido', () => {
    it.each(['nao-e-base64!', 'eyJ4IjoxfQ', randomUUID(), 'a'.repeat(600)])('recusa %s com 400 (sem 500)', async (cursor) => {
      for (const rota of ['/produtos', '/clientes', '/fornecedores']) {
        const r = await dono.get(`${rota}?depois=${encodeURIComponent(cursor)}`);
        expect(r.statusCode, `${rota} ${cursor.slice(0, 20)}`).toBe(400);
      }
    });
  });

  describe('banco: busca usa o índice de trigramas', () => {
    it('a função de normalização e os índices GIN existem; o plano da busca de clientes usa o índice com a tabela grande', async () => {
      const idx = await owner.query(
        `SELECT indexname FROM pg_indexes WHERE indexname IN
          ('produtos_nome_trgm_idx', 'clientes_nome_trgm_idx', 'fornecedores_nome_trgm_idx', 'skus_codigo_trgm_idx') ORDER BY 1`,
      );
      expect(idx.rows.map((r) => r.indexname)).toEqual([
        'clientes_nome_trgm_idx',
        'fornecedores_nome_trgm_idx',
        'produtos_nome_trgm_idx',
        'skus_codigo_trgm_idx',
      ]);
      const f = await owner.query("SELECT ailow_busca('Ána Çá') AS n");
      expect(f.rows[0].n).toBe('ana ca');
      // A função SQL e a normalização do texto digitado (feita na API) usam a MESMA tabela de acentos.
      const todos = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
      const g = await owner.query('SELECT ailow_busca($1) AS n', [todos]);
      expect(g.rows[0].n).toBe('aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc');
      for (const arquivo of ['produtos/produtos.ts', 'clientes/clientes.ts', 'compras/fornecedores.ts']) {
        const fonte = readFileSync(join(import.meta.dirname, '..', 'src', arquivo), 'utf8');
        expect(fonte, arquivo).toContain(`const COM_ACENTO = '${todos}'`);
      }
      // Sem varredura sequencial: com seqscan desligado o planejador ainda acha caminho pelo índice GIN.
      const plano = await owner.query(`SET LOCAL enable_seqscan = off; EXPLAIN SELECT id FROM clientes WHERE ailow_busca(nome) LIKE '%ana pag 1%'`);
      const texto = (Array.isArray(plano) ? plano[1] : plano).rows.map((r: Record<string, string>) => Object.values(r)[0]).join('\n');
      expect(texto).toMatch(/clientes_nome_trgm_idx/);
    });
  });
});
