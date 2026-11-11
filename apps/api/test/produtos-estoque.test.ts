import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { ErroEstoque, registrarMovimento } from '../src/produtos/estoque.js';
import { adminPool, criarEmpresa } from './helpers.js';

// RN-03 (estoque nunca negativo), RN-08 (movimento com origem de venda), RF-PRO-04 (movimento com autor e motivo).
// Interface pública de estoque: recebe o cliente da transação do chamador (Vendas, Compras…).
// Só afirmamos sobre SKUs criados aqui (L-0008).
describe('interface pública de estoque (registrarMovimento)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresa: string;
  let outraEmpresa: string;
  let usuario: string;
  let skuOutra: string;
  let produto: string;
  let seq = 0;
  const agora = new Date('2026-11-12T15:00:00.000Z');

  async function semearUsuario(empresaId: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, 'Dono Estoque', 'dono', $3, 'x', 'x')`,
      [id, empresaId, `dono-est-${id}@teste.com`],
    );
    return id;
  }

  async function semearProduto(empresaId: string, usuarioId: string, numero: number): Promise<string> {
    const cat = randomUUID();
    await admin.query("INSERT INTO categorias (id, empresa_id, nome, tipo) VALUES ($1, $2, $3, 'produto')", [cat, empresaId, `Cat ${cat}`]);
    const id = randomUUID();
    await admin.query(
      `INSERT INTO produtos (id, empresa_id, numero, nome, categoria_id, porte, custo_centavos, preco_centavos, criado_por)
       VALUES ($1, $2, $3, 'Sutiã', $4, 'slim', 1000, 2000, $5)`,
      [id, empresaId, numero, cat, usuarioId],
    );
    return id;
  }

  // Cada teste ganha um SKU novo com o saldo que quer provar.
  async function novoSku(saldo: number, empresaId = empresa, produtoId = produto): Promise<string> {
    const id = randomUUID();
    seq += 1;
    await admin.query(
      `INSERT INTO skus (id, empresa_id, produto_id, tamanho, cor, cor_codigo, codigo, estoque, estoque_minimo)
       VALUES ($1, $2, $3, 'M', 'Preto', 'PRE', $4, $5, 0)`,
      [id, empresaId, produtoId, `0001-M-${seq.toString(36).toUpperCase().padStart(3, '0')}`, saldo],
    );
    return id;
  }

  const ctx = () => ({ empresaId: empresa, autorId: usuario, agora });
  const saldo = async (skuId: string) =>
    withEmpresa(app, empresa, async (c) => (await c.query('SELECT estoque FROM skus WHERE id = $1', [skuId])).rows[0].estoque as number);
  const movimentos = async (skuId: string) =>
    withEmpresa(app, empresa, async (c) => (await c.query('SELECT * FROM movimentos_estoque WHERE sku_id = $1 ORDER BY seq', [skuId])).rows);

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string, 12);
    empresa = await criarEmpresa(admin, 'Estoque A');
    outraEmpresa = await criarEmpresa(admin, 'Estoque B');
    usuario = await semearUsuario(empresa);
    const usuarioOutra = await semearUsuario(outraEmpresa);
    produto = await semearProduto(empresa, usuario, 1);
    const produtoOutra = await semearProduto(outraEmpresa, usuarioOutra, 1);
    skuOutra = await novoSku(5, outraEmpresa, produtoOutra);
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  it('entrada soma ao saldo e grava o movimento com autor, motivo e saldo depois', async () => {
    const sku = await novoSku(2);
    const r = await withEmpresa(app, empresa, (c) =>
      registrarMovimento(c, ctx(), { skuId: sku, tipo: 'entrada', quantidade: 3, motivo: 'Chegou o pedido' }),
    );
    expect(r.estoque).toBe(5);
    expect(await saldo(sku)).toBe(5);
    const [m] = await movimentos(sku);
    expect(m).toMatchObject({
      tipo: 'entrada',
      quantidade: 3,
      saldo_apos: 5,
      motivo: 'Chegou o pedido',
      autor_id: usuario,
      origem_id: null,
    });
    expect(m.criado_em.toISOString()).toBe(agora.toISOString());
  });

  it('ajuste negativo desconta do saldo', async () => {
    const sku = await novoSku(4);
    const r = await withEmpresa(app, empresa, (c) =>
      registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -3, motivo: 'Peça com defeito' }),
    );
    expect(r.estoque).toBe(1);
    expect((await movimentos(sku))[0]).toMatchObject({ quantidade: -3, saldo_apos: 1 });
  });

  describe('RN-03: o saldo nunca fica negativo', () => {
    it('saldo 0 não baixa: recusa, o saldo continua 0 e nenhum movimento é gravado', async () => {
      const sku = await novoSku(0);
      await expect(
        withEmpresa(app, empresa, (c) => registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -1, motivo: 'Contagem' })),
      ).rejects.toMatchObject({ name: 'ErroEstoque', codigo: 'estoque_insuficiente' });
      expect(await saldo(sku)).toBe(0);
      expect(await movimentos(sku)).toHaveLength(0);
    });

    it('baixar mais do que o saldo é recusado e nada muda', async () => {
      const sku = await novoSku(3);
      const venda = randomUUID();
      await expect(
        withEmpresa(app, empresa, (c) =>
          registrarMovimento(c, ctx(), { skuId: sku, tipo: 'venda', quantidade: -4, motivo: 'Venda', origemId: venda }),
        ),
      ).rejects.toBeInstanceOf(ErroEstoque);
      expect(await saldo(sku)).toBe(3);
      expect(await movimentos(sku)).toHaveLength(0);
    });

    it('no limite: baixar exatamente o saldo é permitido e zera', async () => {
      const sku = await novoSku(3);
      const r = await withEmpresa(app, empresa, (c) =>
        registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -3, motivo: 'Perda total' }),
      );
      expect(r.estoque).toBe(0);
      expect(await saldo(sku)).toBe(0);
    });

    it('concorrência no limite: com saldo 1, duas baixas ao mesmo tempo, só uma passa', async () => {
      const sku = await novoSku(1);
      let liberar!: () => void;
      const segurar = new Promise<void>((r) => {
        liberar = r;
      });
      let primeiraDentro!: () => void;
      const primeiraPronta = new Promise<void>((r) => {
        primeiraDentro = r;
      });

      // A 1ª transação baixa e fica ABERTA (segurando a linha); a 2ª tenta baixar enquanto isso.
      // Sem o bloqueio da linha ou sem a condição no UPDATE, as duas passariam e o saldo iria a -1.
      const primeira = withEmpresa(app, empresa, async (c) => {
        const r = await registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -1, motivo: 'Primeira' });
        primeiraDentro();
        await segurar;
        return r;
      });
      await primeiraPronta;
      const segunda = withEmpresa(app, empresa, (c) =>
        registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -1, motivo: 'Segunda' }),
      );
      const desfecho = segunda.then(
        () => 'terminou',
        () => 'terminou',
      );
      const aposEspera = await Promise.race([desfecho, new Promise((r) => setTimeout(() => r('bloqueada'), 400))]);
      expect(aposEspera).toBe('bloqueada'); // a corrida de fato aconteceu: a 2ª espera a 1ª
      liberar();
      await expect(primeira).resolves.toMatchObject({ estoque: 0 });
      await expect(segunda).rejects.toMatchObject({ codigo: 'estoque_insuficiente' });
      expect(await saldo(sku)).toBe(0);
      expect(await movimentos(sku)).toHaveLength(1);
    });

    it('cinco baixas simultâneas de 1 com saldo 3: exatamente 3 passam, o saldo termina em 0', async () => {
      const sku = await novoSku(3);
      const resultados = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          withEmpresa(app, empresa, (c) =>
            registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -1, motivo: `Baixa ${i}` }),
          ),
        ),
      );
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(falhas).toHaveLength(2);
      for (const f of falhas) expect(f.reason).toMatchObject({ codigo: 'estoque_insuficiente' });
      expect(await saldo(sku)).toBe(0);
      expect(await movimentos(sku)).toHaveLength(3);
    });
  });

  describe('RN-08: movimentos de venda levam a origem', () => {
    it('a venda baixa o estoque e guarda o id da venda; o estorno devolve', async () => {
      const sku = await novoSku(5);
      const venda = randomUUID();
      await withEmpresa(app, empresa, (c) =>
        registrarMovimento(c, ctx(), { skuId: sku, tipo: 'venda', quantidade: -2, motivo: 'Venda', origemId: venda }),
      );
      await withEmpresa(app, empresa, (c) =>
        registrarMovimento(c, ctx(), { skuId: sku, tipo: 'estorno_venda', quantidade: 2, motivo: 'Estorno da venda', origemId: venda }),
      );
      expect(await saldo(sku)).toBe(5);
      const ms = await movimentos(sku);
      expect(ms.map((m) => [m.tipo, m.origem_id])).toEqual([
        ['venda', venda],
        ['estorno_venda', venda],
      ]);
    });

    it('a mesma venda não baixa o mesmo SKU duas vezes: a 2ª chamada falha e o saldo não se mexe', async () => {
      const sku = await novoSku(5);
      const venda = randomUUID();
      const baixar = () =>
        withEmpresa(app, empresa, (c) =>
          registrarMovimento(c, ctx(), { skuId: sku, tipo: 'venda', quantidade: -1, motivo: 'Venda', origemId: venda }),
        );
      await baixar();
      await expect(baixar()).rejects.toMatchObject({ code: '23505' });
      expect(await saldo(sku)).toBe(4);
    });

    it('venda sem origem, venda positiva e quantidade zero são recusadas antes de tocar o banco', async () => {
      const sku = await novoSku(5);
      const tentar = (m: Parameters<typeof registrarMovimento>[2]) => withEmpresa(app, empresa, (c) => registrarMovimento(c, ctx(), m));
      await expect(tentar({ skuId: sku, tipo: 'venda', quantidade: -1, motivo: 'Venda' })).rejects.toThrow();
      await expect(tentar({ skuId: sku, tipo: 'venda', quantidade: 1, motivo: 'Venda', origemId: randomUUID() })).rejects.toThrow();
      await expect(tentar({ skuId: sku, tipo: 'ajuste', quantidade: 0, motivo: 'Contagem' })).rejects.toThrow();
      expect(await saldo(sku)).toBe(5);
      expect(await movimentos(sku)).toHaveLength(0);
    });
  });

  describe('atomicidade e isolamento', () => {
    it('se o chamador desfaz a transação (ex.: o pagamento da venda falhou), saldo e movimento voltam', async () => {
      const sku = await novoSku(5);
      await expect(
        withEmpresa(app, empresa, async (c) => {
          await registrarMovimento(c, ctx(), { skuId: sku, tipo: 'ajuste', quantidade: -2, motivo: 'Antes da falha' });
          throw new Error('falha depois da baixa');
        }),
      ).rejects.toThrow('falha depois da baixa');
      expect(await saldo(sku)).toBe(5);
      expect(await movimentos(sku)).toHaveLength(0);
    });

    it('SKU inexistente ou de outra empresa é "não encontrado" (a RLS esconde)', async () => {
      const tentar = (skuId: string) =>
        withEmpresa(app, empresa, (c) => registrarMovimento(c, ctx(), { skuId, tipo: 'entrada', quantidade: 1, motivo: 'Teste' }));
      await expect(tentar(randomUUID())).rejects.toMatchObject({ codigo: 'nao_encontrado' });
      await expect(tentar(skuOutra)).rejects.toMatchObject({ codigo: 'nao_encontrado' });
      const intacto = await withEmpresa(app, outraEmpresa, async (c) => (await c.query('SELECT estoque FROM skus WHERE id = $1', [skuOutra])).rows[0].estoque);
      expect(intacto).toBe(5);
    });
  });
});
