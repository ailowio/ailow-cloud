import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { adminPool, criarEmpresa } from './helpers.js';

// TEST-12/17, RN-01, RN-06, RN-10: a tabela `lancamentos` isola as empresas (ADR 002) e é imutável
// para o papel de runtime (ADR 005): sem DELETE e sem UPDATE de valor, tipo, origem ou categoria.
// Os testes só afirmam sobre ids criados aqui (L-0008): rodam em paralelo no mesmo Postgres.
describe('lançamentos: isolamento por empresa e imutabilidade (banco)', () => {
  let admin: pg.Pool;
  let app: pg.Pool;
  let empresaA: string;
  let empresaB: string;
  let usuarioA: string;
  let usuarioB: string;
  let lancA: string;
  let lancB: string;

  // Linha válida (venda paga em Pix). Cada teste troca só o campo que quer provar.
  const valida = (usuario: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    tipo: 'entrada',
    origem_tipo: 'venda',
    origem_id: randomUUID(),
    descricao: null,
    categoria: 'Sutiã',
    valor_centavos: 8990,
    forma_pagamento: 'pix',
    vencimento: '2026-11-11',
    pago_em: new Date('2026-11-11T15:00:00Z'),
    status: 'pago',
    estorno_de: null,
    estorno_motivo: null,
    criado_por: usuario,
    ...extra,
  });

  // As chaves vêm do código do teste (nunca de entrada externa); os valores são parâmetros.
  async function inserir(empresaId: string, linha: Record<string, unknown>): Promise<string> {
    const colunas = ['empresa_id', ...Object.keys(linha)];
    const valores = [empresaId, ...Object.values(linha)];
    const marcas = valores.map((_, i) => `$${i + 1}`).join(', ');
    return withEmpresa(app, empresaId, async (c) => {
      const r = await c.query(`INSERT INTO lancamentos (${colunas.join(', ')}) VALUES (${marcas}) RETURNING id`, valores);
      return r.rows[0].id as string;
    });
  }

  async function semearUsuario(empresaId: string, sufixo: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, $3, 'dono', $4, 'x', 'x')`,
      [id, empresaId, `Dono ${sufixo}`, `dono-fin-${sufixo}-${id}@teste.com`],
    );
    return id;
  }

  beforeAll(async () => {
    admin = adminPool();
    app = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Fin A');
    empresaB = await criarEmpresa(admin, 'Fin B');
    usuarioA = await semearUsuario(empresaA, 'a');
    usuarioB = await semearUsuario(empresaB, 'b');
    lancA = await inserir(empresaA, valida(usuarioA));
    lancB = await inserir(empresaB, valida(usuarioB));
  });

  afterAll(async () => {
    await app.end();
    await admin.end();
  });

  describe('isolamento (RN-10, TEST-17)', () => {
    it('a empresa A enxerga só as próprias linhas', async () => {
      const rows = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT id, empresa_id FROM lancamentos')).rows);
      expect(rows.map((r) => r.id)).toContain(lancA);
      expect(rows.map((r) => r.id)).not.toContain(lancB);
      expect(rows.every((r) => r.empresa_id === empresaA)).toBe(true);
    });

    it('sem empresa definida não retorna nada (falha fechada)', async () => {
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE ailow_app');
        expect((await client.query('SELECT 1 FROM lancamentos')).rowCount).toBe(0);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('a empresa A não altera a linha da B (UPDATE permitido, mas a RLS esconde a linha)', async () => {
      const afetadas = await withEmpresa(app, empresaA, async (c) => {
        const r = await c.query("UPDATE lancamentos SET status = 'estornado' WHERE id = $1", [lancB]);
        return r.rowCount;
      });
      expect(afetadas).toBe(0);
      const status = await withEmpresa(app, empresaB, async (c) => (await c.query('SELECT status FROM lancamentos WHERE id = $1', [lancB])).rows[0].status);
      expect(status).toBe('pago');
    });

    it('a empresa A não grava linha com o empresa_id da B (WITH CHECK)', async () => {
      await expect(
        withEmpresa(app, empresaA, async (c) => {
          await c.query(
            `INSERT INTO lancamentos (empresa_id, tipo, origem_tipo, origem_id, valor_centavos, forma_pagamento, vencimento, pago_em, status, criado_por)
             VALUES ($1, 'entrada', 'venda', $2, 100, 'pix', '2026-11-11', now(), 'pago', $3)`,
            [empresaB, randomUUID(), usuarioB],
          );
        }),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('um estorno da A não pode apontar para um lançamento da B (chave estrangeira composta)', async () => {
      await expect(
        inserir(
          empresaA,
          valida(usuarioA, {
            tipo: 'saida',
            origem_tipo: 'estorno',
            origem_id: lancB,
            estorno_de: lancB,
            estorno_motivo: 'teste',
          }),
        ),
      ).rejects.toMatchObject({ code: '23503' });
    });

    it('o autor da A não pode ser um usuário da B (chave estrangeira composta)', async () => {
      await expect(inserir(empresaA, valida(usuarioB))).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('nada é apagado nem reescrito (RN-06, RN-01)', () => {
    it('o papel de runtime não consegue apagar lançamento', async () => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query('DELETE FROM lancamentos WHERE id = $1', [lancA])),
      ).rejects.toMatchObject({ code: '42501' });
      const ainda = await withEmpresa(app, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE id = $1', [lancA])).rowCount);
      expect(ainda).toBe(1);
    });

    it('TRUNCATE também é negado', async () => {
      await expect(withEmpresa(app, empresaA, (c) => c.query('TRUNCATE lancamentos'))).rejects.toMatchObject({ code: '42501' });
    });

    it.each([
      ['valor_centavos', 1],
      ['tipo', 'saida'],
      ['origem_tipo', 'compra'],
      ['origem_id', randomUUID()],
      ['categoria', 'Outra'],
      ['descricao', 'Outra'],
      ['vencimento', '2027-01-01'],
      ['estorno_de', randomUUID()],
      ['empresa_id', randomUUID()],
    ])('o papel de runtime não consegue reescrever %s', async (coluna, valor) => {
      await expect(
        withEmpresa(app, empresaA, (c) => c.query(`UPDATE lancamentos SET ${coluna} = $1 WHERE id = $2`, [valor, lancA])),
      ).rejects.toMatchObject({ code: '42501' });
    });

    it('só status, pago_em, forma_pagamento e pago_por podem mudar (baixa da conta)', async () => {
      const id = await inserir(
        empresaA,
        valida(usuarioA, {
          tipo: 'saida',
          origem_tipo: 'despesa',
          origem_id: null,
          descricao: 'Água',
          forma_pagamento: null,
          pago_em: null,
          status: 'aberto',
        }),
      );
      const r = await withEmpresa(app, empresaA, (c) =>
        c.query(
          "UPDATE lancamentos SET status = 'pago', pago_em = now(), forma_pagamento = 'pix', pago_por = $2 WHERE id = $1",
          [id, usuarioA],
        ),
      );
      expect(r.rowCount).toBe(1);
    });
  });

  describe('restrições de integridade (CHECK / UNIQUE)', () => {
    const casos: [string, (u: string) => Record<string, unknown>, string][] = [
      ['valor zero', (u) => valida(u, { valor_centavos: 0 }), '23514'],
      ['valor negativo', (u) => valida(u, { valor_centavos: -1 }), '23514'],
      ['valor acima do teto de R$ 20 milhões', (u) => valida(u, { valor_centavos: 2_000_000_001 }), '23514'],
      ['venda registrada como saída', (u) => valida(u, { tipo: 'saida' }), '23514'],
      ['compra registrada como entrada', (u) => valida(u, { origem_tipo: 'compra', tipo: 'entrada' }), '23514'],
      ['venda sem id de origem', (u) => valida(u, { origem_id: null }), '23514'],
      ['despesa com id de origem', (u) => valida(u, { tipo: 'saida', origem_tipo: 'despesa', descricao: 'Luz' }), '23514'],
      ['despesa sem descrição', (u) => valida(u, { tipo: 'saida', origem_tipo: 'despesa', origem_id: null }), '23514'],
      ['forma de pagamento inventada', (u) => valida(u, { forma_pagamento: 'cheque' }), '23514'],
      ['status inventado', (u) => valida(u, { status: 'cancelado' }), '23514'],
      ['pago sem pago_em', (u) => valida(u, { pago_em: null }), '23514'],
      ['pago sem forma de pagamento', (u) => valida(u, { forma_pagamento: null }), '23514'],
      ['aberto com pago_em', (u) => valida(u, { status: 'aberto' }), '23514'],
      ['categoria vazia', (u) => valida(u, { categoria: '' }), '23514'],
      ['categoria só com espaços', (u) => valida(u, { categoria: '   ' }), '23514'],
      ['sem vencimento', (u) => valida(u, { vencimento: null }), '23502'],
      ['sem autor', (u) => valida(u, { criado_por: null }), '23502'],
      ['estorno sem lançamento original', (u) => valida(u, { tipo: 'saida', origem_tipo: 'estorno', estorno_motivo: 'x' }), '23514'],
      ['lançamento comum apontando estorno_de', (u) => valida(u, { estorno_de: randomUUID() }), '23514'],
    ];

    it.each(casos)('recusa %s', async (_nome, linha, codigo) => {
      await expect(inserir(empresaA, linha(usuarioA))).rejects.toMatchObject({ code: codigo });
    });

    it('estorno exige motivo e o id de origem igual ao do original', async () => {
      const original = await inserir(empresaA, valida(usuarioA));
      const base = { tipo: 'saida', origem_tipo: 'estorno', origem_id: original, estorno_de: original, estorno_motivo: 'duplicado' };
      await expect(inserir(empresaA, valida(usuarioA, { ...base, estorno_motivo: null }))).rejects.toMatchObject({ code: '23514' });
      await expect(inserir(empresaA, valida(usuarioA, { ...base, origem_id: randomUUID() }))).rejects.toMatchObject({ code: '23514' });
    });

    it('cada lançamento tem no máximo um estorno', async () => {
      const original = await inserir(empresaA, valida(usuarioA));
      const estorno = valida(usuarioA, {
        tipo: 'saida',
        origem_tipo: 'estorno',
        origem_id: original,
        estorno_de: original,
        estorno_motivo: 'cobrado em duplicidade',
      });
      await inserir(empresaA, estorno);
      await expect(inserir(empresaA, estorno)).rejects.toMatchObject({ code: '23505' });
    });
  });
});
