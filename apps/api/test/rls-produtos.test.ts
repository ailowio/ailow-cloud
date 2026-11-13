import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// TEST-12/17, RN-01, RN-03: produtos, SKUs e movimentos de estoque isolam as empresas (ADR 002) e o papel de
// runtime não apaga nem reescreve o que não deve (ADR 006). Só afirmamos sobre ids criados aqui (L-0008).
describe('produtos, SKUs e movimentos: isolamento e restrições (banco)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresaA: string;
  let empresaB: string;
  let usuarioA: string;
  let usuarioB: string;
  let catA: string;
  let catB: string;
  let catFinanceiraA: string;
  let prodA: string;
  let prodB: string;
  let skuA: string;
  let skuB: string;
  let numeroA = 0;

  // As chaves vêm do código do teste (nunca de entrada externa); os valores são parâmetros.
  async function inserir(empresaId: string, tabela: string, linha: Record<string, unknown>): Promise<string> {
    const colunas = ['empresa_id', ...Object.keys(linha)];
    const valores = [empresaId, ...Object.values(linha)];
    const marcas = valores.map((_, i) => `$${i + 1}`).join(', ');
    return withEmpresa(app, empresaId, async (c) => {
      const r = await c.query(`INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES (${marcas}) RETURNING id`, valores);
      return r.rows[0].id as string;
    });
  }

  const produto = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    numero: ++numeroA,
    nome: 'Tomara que caia',
    categoria_id: catA,
    porte: 'slim',
    atributos: ['bojo'],
    fornecedor: 'Fina Paixão',
    custo_centavos: 4500,
    preco_centavos: 8990,
    criado_por: usuarioA,
    ...extra,
  });

  const sku = (produtoId: string, extra: Record<string, unknown> = {}): Record<string, unknown> => {
    const n = ++numeroA;
    return {
      produto_id: produtoId,
      tamanho: 'M',
      cor: 'Preto',
      cor_codigo: 'PRE',
      codigo: `${String(n).padStart(4, '0')}-M-PRE`,
      estoque: 5,
      estoque_minimo: 2,
      ...extra,
    };
  };

  const movimento = (skuId: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    sku_id: skuId,
    tipo: 'entrada',
    quantidade: 3,
    saldo_apos: 8,
    motivo: 'Chegou pedido',
    origem_id: null,
    autor_id: usuarioA,
    ...extra,
  });

  async function semearUsuario(empresaId: string, sufixo: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, $3, 'dono', $4, 'x', 'x')`,
      [id, empresaId, `Dono ${sufixo}`, `dono-prod-${sufixo}-${id}@teste.com`],
    );
    return id;
  }

  async function semearCategoria(empresaId: string, nome: string, tipo: 'produto' | 'financeira'): Promise<string> {
    const id = randomUUID();
    await admin.query('INSERT INTO categorias (id, empresa_id, nome, tipo) VALUES ($1, $2, $3, $4)', [id, empresaId, nome, tipo]);
    return id;
  }

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Prod A');
    empresaB = await criarEmpresa(admin, 'Prod B');
    usuarioA = await semearUsuario(empresaA, 'a');
    usuarioB = await semearUsuario(empresaB, 'b');
    catA = await semearCategoria(empresaA, 'Sutiã', 'produto');
    catB = await semearCategoria(empresaB, 'Sutiã', 'produto');
    catFinanceiraA = await semearCategoria(empresaA, 'Aluguel', 'financeira');
    prodA = await inserir(empresaA, 'produtos', produto());
    skuA = await inserir(empresaA, 'skus', sku(prodA));
    prodB = await inserir(empresaB, 'produtos', {
      ...produto({ categoria_id: catB, criado_por: usuarioB }),
      numero: 1,
    });
    skuB = await inserir(empresaB, 'skus', { ...sku(prodB), codigo: '0001-M-PRE' });
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  describe('isolamento (ADR 002, TEST-17)', () => {
    it.each(['produtos', 'skus'])('a empresa A enxerga só as próprias linhas de %s', async (tabela) => {
      const rows = await withEmpresa(app, empresaA, async (c) => (await c.query(`SELECT id, empresa_id FROM ${tabela}`)).rows);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.empresa_id === empresaA)).toBe(true);
      expect(rows.map((r) => r.id)).not.toContain(tabela === 'produtos' ? prodB : skuB);
    });

    it('a empresa A não enxerga os movimentos da B', async () => {
      const idB = await inserir(empresaB, 'movimentos_estoque', movimento(skuB, { autor_id: usuarioB }));
      const rows = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT id FROM movimentos_estoque')).rows);
      expect(rows.map((r) => r.id)).not.toContain(idB);
    });

    it.each(['produtos', 'skus', 'movimentos_estoque'])('sem empresa definida %s não retorna nada (falha fechada)', async (tabela) => {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE ailow_app');
        expect((await client.query(`SELECT 1 FROM ${tabela}`)).rowCount).toBe(0);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('a empresa A não altera o estoque da B (a RLS esconde a linha)', async () => {
      const afetadas = await withEmpresa(app, empresaA, async (c) => (await c.query('UPDATE skus SET estoque = 99 WHERE id = $1', [skuB])).rowCount);
      expect(afetadas).toBe(0);
      const estoque = await withEmpresa(app, empresaB, async (c) => (await c.query('SELECT estoque FROM skus WHERE id = $1', [skuB])).rows[0].estoque);
      expect(estoque).toBe(5);
    });

    it('a empresa A não grava produto com o empresa_id da B (WITH CHECK)', async () => {
      await expect(
        withEmpresa(app, empresaA, (c) =>
          c.query(
            `INSERT INTO produtos (empresa_id, numero, nome, categoria_id, porte, custo_centavos, preco_centavos, criado_por)
             VALUES ($1, 77, 'x', $2, 'slim', 1, 2, $3)`,
            [empresaB, catB, usuarioB],
          ),
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('produto da A não aponta para categoria da B (chave estrangeira composta)', async () => {
      await expect(inserir(empresaA, 'produtos', produto({ categoria_id: catB }))).rejects.toMatchObject({ code: '23503' });
    });

    it('produto da A não aponta para usuário da B', async () => {
      await expect(inserir(empresaA, 'produtos', produto({ criado_por: usuarioB }))).rejects.toMatchObject({ code: '23503' });
    });

    it('SKU da A não aponta para produto da B', async () => {
      await expect(inserir(empresaA, 'skus', sku(prodB))).rejects.toMatchObject({ code: '23503' });
    });

    it('movimento da A não aponta para SKU nem autor da B', async () => {
      await expect(inserir(empresaA, 'movimentos_estoque', movimento(skuB))).rejects.toMatchObject({ code: '23503' });
      await expect(inserir(empresaA, 'movimentos_estoque', movimento(skuA, { autor_id: usuarioB }))).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('categoria do produto', () => {
    it('só categoria de PRODUTO serve (a financeira é recusada pelo banco)', async () => {
      await expect(inserir(empresaA, 'produtos', produto({ categoria_id: catFinanceiraA }))).rejects.toMatchObject({ code: '23503' });
    });

    it('categoria em uso por um produto não pode ser apagada (só desativada)', async () => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query('DELETE FROM categorias WHERE id = $1', [catA])),
      ).rejects.toMatchObject({ code: '23001' }); // restrict_violation: ON DELETE RESTRICT
    });

    it('desativar a categoria em uso é permitido e não mexe nos produtos', async () => {
      const catUso = await semearCategoria(empresaA, 'Calcinha (desativar)', 'produto');
      const p = await inserir(empresaA, 'produtos', produto({ categoria_id: catUso }));
      const r = await withEmpresa(app, empresaA, (c) => c.query('UPDATE categorias SET ativa = false WHERE id = $1', [catUso]));
      expect(r.rowCount).toBe(1);
      const ainda = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT 1 FROM produtos WHERE id = $1', [p])).rowCount);
      expect(ainda).toBe(1);
    });
  });

  describe('nada é apagado; só o estoque e o mínimo mudam (RN-03, RN-08)', () => {
    it.each(['produtos', 'skus', 'movimentos_estoque'])('o papel de runtime não apaga %s', async (tabela) => {
      await expect(withEmpresa(app, empresaA, (c) => c.query(`DELETE FROM ${tabela}`))).rejects.toMatchObject({ code: '42501' });
      await expect(withEmpresa(app, empresaA, (c) => c.query(`TRUNCATE ${tabela}`))).rejects.toMatchObject({ code: '42501' });
    });

    // S09 (migração 20261118120000): nome, categoria, porte, atributos, fornecedor, custo, preço e `ativo` passam a
    // poder mudar (editar/arquivar produto); a identidade do produto continua imutável.
    it.each([
      ['numero', 9000],
      ['empresa_id', randomUUID()],
      ['criado_por', randomUUID()],
    ])('o papel de runtime não reescreve produtos.%s', async (coluna, valor) => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query(`UPDATE produtos SET ${coluna} = $1 WHERE id = $2`, [valor, prodA])),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('nome, preço, custo e situação do produto podem mudar (S09)', async () => {
      const r = await withEmpresa(app, empresaA, (c) =>
        c.query('UPDATE produtos SET nome = $2, preco_centavos = 7777, custo_centavos = 3333, ativo = true WHERE id = $1', [prodA, 'Renomeado']),
      );
      expect(r.rowCount).toBe(1);
    });

    it.each([
      ['codigo', '9999-X-XXX'],
      ['tamanho', 'G'],
      ['cor', 'Azul'],
      ['produto_id', randomUUID()],
      ['empresa_id', randomUUID()],
    ])('o papel de runtime não reescreve skus.%s', async (coluna, valor) => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query(`UPDATE skus SET ${coluna} = $1 WHERE id = $2`, [valor, skuA])),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('estoque e estoque mínimo podem mudar', async () => {
      const r = await withEmpresa(app, empresaA, (c) => c.query('UPDATE skus SET estoque = 6, estoque_minimo = 3 WHERE id = $1', [skuA]));
      expect(r.rowCount).toBe(1);
    });

    it.each(['quantidade', 'motivo', 'saldo_apos', 'autor_id', 'tipo'])('movimento é imutável: %s não muda', async (coluna) => {
      const id = await inserir(empresaA, 'movimentos_estoque', movimento(skuA));
      const valor = coluna === 'autor_id' ? usuarioA : coluna === 'tipo' ? 'ajuste' : coluna === 'motivo' ? 'Outro motivo' : 1;
      await expect(
        withEmpresa(app, empresaA, (c) => c.query(`UPDATE movimentos_estoque SET ${coluna} = $1 WHERE id = $2`, [valor, id])),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });

  describe('estoque nunca negativo (RN-03)', () => {
    it('UPDATE para saldo negativo é recusado pelo banco', async () => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query('UPDATE skus SET estoque = -1 WHERE id = $1', [skuA])),
      ).rejects.toMatchObject({ code: '23514' });
    });

    it('SKU nasce com saldo negativo? Não', async () => {
      await expect(inserir(empresaA, 'skus', sku(prodA, { estoque: -1 }))).rejects.toMatchObject({ code: '23514' });
    });

    it('movimento com saldo posterior negativo também é recusado', async () => {
      await expect(inserir(empresaA, 'movimentos_estoque', movimento(skuA, { saldo_apos: -1 }))).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('restrições de integridade (CHECK / UNIQUE)', () => {
    const produtos: [string, Record<string, unknown>, string][] = [
      ['porte inventado', { porte: 'medio' }, '23514'],
      ['nome vazio', { nome: '  ' }, '23514'],
      ['nome com 81 caracteres', { nome: 'x'.repeat(81) }, '23514'],
      ['custo negativo', { custo_centavos: -1 }, '23514'],
      ['preço zero', { preco_centavos: 0 }, '23514'],
      ['preço acima do teto', { preco_centavos: 2_000_000_001 }, '23514'],
      ['número zero', { numero: 0 }, '23514'],
      ['número com 5 dígitos', { numero: 10000 }, '23514'],
      ['fornecedor vazio', { fornecedor: '  ' }, '23514'],
      ['sem categoria', { categoria_id: null }, '23502'],
      ['sem autor', { criado_por: null }, '23502'],
    ];
    it.each(produtos)('produto recusa %s', async (_nome, extra, codigo) => {
      await expect(inserir(empresaA, 'produtos', produto(extra))).rejects.toMatchObject({ code: codigo });
    });

    it('o número do produto é único por empresa; a outra empresa pode ter o mesmo', async () => {
      await expect(inserir(empresaA, 'produtos', produto({ numero: 1 }))).rejects.toMatchObject({ code: '23505' });
      await expect(
        inserir(empresaB, 'produtos', produto({ categoria_id: catB, criado_por: usuarioB, numero: 2, nome: 'Outro' })),
      ).resolves.toBeTruthy();
    });

    const skus: [string, Record<string, unknown>][] = [
      ['tamanho em minúsculas', { tamanho: 'gg' }],
      ['tamanho com 4 caracteres', { tamanho: 'ABCD' }],
      ['código da cor com 2 caracteres', { cor_codigo: 'PR' }],
      ['código da cor em minúsculas', { cor_codigo: 'pre' }],
      ['código do SKU fora do formato', { codigo: '42-M-PRE' }],
      ['cor vazia', { cor: ' ' }],
      ['estoque mínimo negativo', { estoque_minimo: -1 }],
    ];
    it.each(skus)('SKU recusa %s', async (_nome, extra) => {
      await expect(inserir(empresaA, 'skus', sku(prodA, extra))).rejects.toMatchObject({ code: '23514' });
    });

    it('o código do SKU é único por empresa', async () => {
      const dup = sku(prodA);
      await inserir(empresaA, 'skus', dup);
      await expect(inserir(empresaA, 'skus', { ...dup })).rejects.toMatchObject({ code: '23505' });
    });

    const movs: [string, Record<string, unknown>][] = [
      ['quantidade zero', { quantidade: 0 }],
      ['tipo inventado', { tipo: 'sumiu' }],
      ['motivo curto demais', { motivo: 'ok' }],
      ['motivo com 201 caracteres', { motivo: 'x'.repeat(201) }],
      ['entrada negativa', { tipo: 'entrada', quantidade: -1 }],
      ['estoque inicial negativo', { tipo: 'inicial', quantidade: -1 }],
      ['venda positiva (venda sempre tira)', { tipo: 'venda', quantidade: 1, origem_id: randomUUID() }],
      ['estorno de venda negativo (estorno sempre devolve)', { tipo: 'estorno_venda', quantidade: -1, origem_id: randomUUID() }],
      ['venda sem origem', { tipo: 'venda', quantidade: -1, origem_id: null }],
      ['entrada com origem de venda', { tipo: 'entrada', origem_id: randomUUID() }],
    ];
    it.each(movs)('movimento recusa %s', async (_nome, extra) => {
      await expect(inserir(empresaA, 'movimentos_estoque', movimento(skuA, extra))).rejects.toMatchObject({ code: '23514' });
    });

    it('ajuste pode ser negativo e a venda guarda a origem', async () => {
      await inserir(empresaA, 'movimentos_estoque', movimento(skuA, { tipo: 'ajuste', quantidade: -2, saldo_apos: 3 }));
      await inserir(empresaA, 'movimentos_estoque', movimento(skuA, { tipo: 'venda', quantidade: -1, saldo_apos: 2, origem_id: randomUUID() }));
    });

    it('a mesma venda não baixa o mesmo SKU duas vezes (nem estorna duas vezes)', async () => {
      const venda = randomUUID();
      const baixa = movimento(skuA, { tipo: 'venda', quantidade: -1, saldo_apos: 1, origem_id: venda });
      await inserir(empresaA, 'movimentos_estoque', baixa);
      await expect(inserir(empresaA, 'movimentos_estoque', baixa)).rejects.toMatchObject({ code: '23505' });
      const estorno = movimento(skuA, { tipo: 'estorno_venda', quantidade: 1, saldo_apos: 2, origem_id: venda });
      await inserir(empresaA, 'movimentos_estoque', estorno);
      await expect(inserir(empresaA, 'movimentos_estoque', estorno)).rejects.toMatchObject({ code: '23505' });
    });
  });
});
