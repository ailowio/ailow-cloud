import { randomUUID } from 'node:crypto';
import type { LancamentoNovo } from '@ailow/shared';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import {
  ErroFinanceiro,
  estornarLancamento,
  estornarOrigem,
  pagarLancamento,
  registrarLancamento,
} from '../src/financeiro/lancamentos.js';
import { adminPool, criarEmpresa } from './helpers.js';

// RF-FIN-01/04/06, RN-01, RN-06: a interface pública que Vendas e Compras vão chamar, DENTRO da
// transação delas. Só afirma sobre ids criados aqui (L-0008).
describe('interface pública do Financeiro (lançamentos)', () => {
  let admin: pg.Pool;
  let pool: pg.Pool;
  let empresaA: string;
  let empresaB: string;
  let autorA: string;
  let autorB: string;
  const agora = new Date('2026-11-11T15:00:00.000Z'); // 12:00 em São Paulo

  const venda = (extra: Partial<LancamentoNovo> = {}): LancamentoNovo => ({
    tipo: 'entrada',
    origem_tipo: 'venda',
    origem_id: randomUUID(),
    descricao: null,
    categoria: 'Sutiã',
    valor_centavos: 8990,
    forma_pagamento: 'pix',
    vencimento: '2026-11-11',
    paga: true,
    ...extra,
  });
  const contaAPagar = (extra: Partial<LancamentoNovo> = {}): LancamentoNovo =>
    venda({
      tipo: 'saida',
      origem_tipo: 'despesa',
      origem_id: null,
      descricao: 'Condomínio',
      categoria: 'Aluguel',
      forma_pagamento: null,
      vencimento: '2026-11-20',
      paga: false,
      ...extra,
    });

  const registrar = (empresaId: string, autorId: string, l: LancamentoNovo) =>
    withEmpresa(pool, empresaId, (c) => registrarLancamento(c, { empresaId, autorId, agora }, l));
  const ler = (empresaId: string, id: string) =>
    withEmpresa(pool, empresaId, async (c) => (await c.query('SELECT * FROM lancamentos WHERE id = $1', [id])).rows[0]);

  async function semearAutor(empresaId: string): Promise<string> {
    const id = randomUUID();
    await admin.query(
      `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, pin_hash)
       VALUES ($1, $2, 'Dono', 'dono', $3, 'x', 'x')`,
      [id, empresaId, `dono-lanc-${id}@teste.com`],
    );
    return id;
  }

  beforeAll(async () => {
    admin = adminPool();
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    empresaA = await criarEmpresa(admin, 'Lanc A');
    empresaB = await criarEmpresa(admin, 'Lanc B');
    autorA = await semearAutor(empresaA);
    autorB = await semearAutor(empresaB);
  });
  afterAll(async () => {
    await pool.end();
    await admin.end();
  });

  describe('registrar (RF-FIN-01)', () => {
    it('venda paga: entra com pago_em = agora, autor, forma e valor em centavos inteiros', async () => {
      const { id } = await registrar(empresaA, autorA, venda());
      expect(await ler(empresaA, id)).toMatchObject({
        empresa_id: empresaA,
        tipo: 'entrada',
        origem_tipo: 'venda',
        valor_centavos: 8990,
        forma_pagamento: 'pix',
        status: 'pago',
        pago_em: agora,
        criado_por: autorA,
        pago_por: autorA,
        estorno_de: null,
      });
    });

    it('conta a pagar: nasce em aberto, sem pago_em nem forma', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      expect(await ler(empresaA, id)).toMatchObject({
        status: 'aberto',
        pago_em: null,
        pago_por: null,
        forma_pagamento: null,
        origem_tipo: 'despesa',
        origem_id: null,
      });
    });

    it('é atômico com a transação do chamador: se a venda falha depois, o lançamento some junto', async () => {
      const origem = randomUUID();
      let criado = '';
      await expect(
        withEmpresa(pool, empresaA, async (c) => {
          criado = (await registrarLancamento(c, { empresaId: empresaA, autorId: autorA, agora }, venda({ origem_id: origem }))).id;
          throw new Error('estoque insuficiente');
        }),
      ).rejects.toThrow('estoque insuficiente');
      expect(criado).not.toBe('');
      expect(await ler(empresaA, criado)).toBeUndefined();
    });

    it.each([
      ['valor zero', { valor_centavos: 0 }],
      ['valor com centavos quebrados (float)', { valor_centavos: 10.5 }],
      ['venda como saída', { tipo: 'saida' as const }],
      ['pago sem forma de pagamento', { forma_pagamento: null }],
    ])('recusa %s e não grava nada', async (_nome, parte) => {
      const origem = randomUUID();
      await expect(registrar(empresaA, autorA, venda({ origem_id: origem, ...parte }))).rejects.toThrow();
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE origem_id = $1', [origem])).rowCount);
      expect(n).toBe(0);
    });

    it('uma empresa não registra lançamento com autor de outra', async () => {
      await expect(registrar(empresaA, autorB, venda())).rejects.toMatchObject({ code: '23503' });
    });
  });

  describe('estornar (RF-FIN-04, RN-06)', () => {
    it('gera o lançamento inverso ligado ao original e marca o original como estornado, sem apagar nada', async () => {
      const { id } = await registrar(empresaA, autorA, venda({ valor_centavos: 12345, categoria: 'Calcinha' }));
      const antes = await ler(empresaA, id);
      const estorno = await withEmpresa(pool, empresaA, (c) =>
        estornarLancamento(c, { empresaId: empresaA, autorId: autorA, agora: new Date('2026-11-12T13:00:00.000Z') }, id, 'Cobrado em duplicidade'),
      );

      const original = await ler(empresaA, id);
      expect(original).toMatchObject({ status: 'estornado', valor_centavos: 12345, pago_em: antes.pago_em, tipo: 'entrada' });

      expect(await ler(empresaA, estorno.id)).toMatchObject({
        tipo: 'saida',
        origem_tipo: 'estorno',
        origem_id: id,
        estorno_de: id,
        estorno_motivo: 'Cobrado em duplicidade',
        valor_centavos: 12345,
        forma_pagamento: 'pix',
        categoria: 'Calcinha',
        status: 'pago',
        pago_em: new Date('2026-11-12T13:00:00.000Z'),
        criado_por: autorA,
      });
    });

    it('estornar conta ainda em aberto a cancela: os dois ficam estornados e nada entra no caixa', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      const estorno = await withEmpresa(pool, empresaA, (c) =>
        estornarLancamento(c, { empresaId: empresaA, autorId: autorA, agora }, id, 'Lançada por engano'),
      );
      expect(await ler(empresaA, id)).toMatchObject({ status: 'estornado', pago_em: null });
      expect(await ler(empresaA, estorno.id)).toMatchObject({ status: 'estornado', pago_em: null, tipo: 'entrada', origem_tipo: 'estorno' });
    });

    it('um lançamento só pode ser estornado uma vez', async () => {
      const { id } = await registrar(empresaA, autorA, venda());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      await withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, id, 'primeiro'));
      await expect(withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, id, 'segundo'))).rejects.toMatchObject({
        codigo: 'ja_estornado',
      });
    });

    it('duas tentativas simultâneas: a 2ª espera a 1ª terminar e recebe ja_estornado (nunca dois estornos)', async () => {
      const { id } = await registrar(empresaA, autorA, venda());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      // Corrida determinística: a 1ª transação fica ABERTA, segurando o lock do original, enquanto a 2ª tenta.
      let liberar!: () => void;
      const portao = new Promise<void>((r) => {
        liberar = r;
      });
      let travou!: () => void;
      const aviso = new Promise<void>((r) => {
        travou = r;
      });
      const primeira = withEmpresa(pool, empresaA, async (c) => {
        const e = await estornarLancamento(c, ctx, id, 'tentativa 1');
        travou();
        await portao;
        return e;
      });
      await aviso;
      const segunda = withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, id, 'tentativa 2'));
      const situacao = await Promise.race([
        segunda.then(
          () => 'terminou',
          () => 'terminou',
        ),
        new Promise((r) => setTimeout(() => r('esperando'), 300)),
      ]);
      expect(situacao).toBe('esperando');
      liberar();
      await primeira;
      await expect(segunda).rejects.toMatchObject({ codigo: 'ja_estornado' });
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE estorno_de = $1', [id])).rowCount);
      expect(n).toBe(1);
    });

    it('um estorno não pode ser estornado', async () => {
      const { id } = await registrar(empresaA, autorA, venda());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      const estorno = await withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, id, 'motivo'));
      await expect(withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, estorno.id, 'desfazer'))).rejects.toMatchObject({
        codigo: 'e_estorno',
      });
    });

    it('lançamento de outra empresa (ou inexistente) é "não encontrado" e continua intacto', async () => {
      const { id: daB } = await registrar(empresaB, autorB, venda());
      const ctxA = { empresaId: empresaA, autorId: autorA, agora };
      await expect(withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctxA, daB, 'invasão'))).rejects.toMatchObject({
        codigo: 'nao_encontrado',
      });
      await expect(withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctxA, randomUUID(), 'x'))).rejects.toBeInstanceOf(ErroFinanceiro);
      expect(await ler(empresaB, daB)).toMatchObject({ status: 'pago' });
    });
  });

  // RN-08: cancelar uma venda estorna EXATAMENTE os lançamentos que ela gerou (um por forma de pagamento).
  describe('estornar uma venda inteira (RN-08)', () => {
    const ctx = () => ({ empresaId: empresaA, autorId: autorA, agora: new Date('2026-11-12T13:00:00.000Z') });
    const estornarVenda = (origemId: string, motivo = 'Cliente desistiu', empresaId = empresaA, autorId = autorA) =>
      withEmpresa(pool, empresaId, (c) =>
        estornarOrigem(c, { empresaId, autorId, agora: new Date('2026-11-12T13:00:00.000Z') }, 'venda', origemId, motivo),
      );
    // Venda paga em duas formas: gera 2 lançamentos com a mesma origem.
    async function vendaEmDuasFormas(): Promise<{ origem: string; pix: string; dinheiro: string }> {
      const origem = randomUUID();
      const { id: pix } = await registrar(empresaA, autorA, venda({ origem_id: origem, valor_centavos: 6000, forma_pagamento: 'pix' }));
      const { id: dinheiro } = await registrar(empresaA, autorA, venda({ origem_id: origem, valor_centavos: 2990, forma_pagamento: 'dinheiro' }));
      return { origem, pix, dinheiro };
    }

    it('estorna todos os pagamentos da venda e devolve um estorno para cada um', async () => {
      const v = await vendaEmDuasFormas();
      const r = await estornarVenda(v.origem);
      expect(r.ids).toHaveLength(2);

      for (const [id, valor, forma] of [
        [v.pix, 6000, 'pix'],
        [v.dinheiro, 2990, 'dinheiro'],
      ] as const) {
        expect(await ler(empresaA, id)).toMatchObject({ status: 'estornado', valor_centavos: valor });
        const estorno = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT * FROM lancamentos WHERE estorno_de = $1', [id])).rows[0]);
        expect(r.ids).toContain(estorno.id);
        expect(estorno).toMatchObject({
          tipo: 'saida',
          origem_tipo: 'estorno',
          valor_centavos: valor,
          forma_pagamento: forma,
          estorno_motivo: 'Cliente desistiu',
          status: 'pago',
          criado_por: autorA,
        });
      }
    });

    it('o total estornado é exatamente o total vendido (soma dos estornos = soma dos pagamentos)', async () => {
      const v = await vendaEmDuasFormas();
      const r = await estornarVenda(v.origem);
      const soma = await withEmpresa(pool, empresaA, async (c) =>
        Number((await c.query('SELECT sum(valor_centavos) AS s FROM lancamentos WHERE id = ANY($1::uuid[])', [r.ids])).rows[0].s),
      );
      expect(soma).toBe(6000 + 2990);
    });

    it('não mexe em outra venda nem na despesa de mesma empresa', async () => {
      const v = await vendaEmDuasFormas();
      const outra = await registrar(empresaA, autorA, venda());
      const despesa = await registrar(empresaA, autorA, contaAPagar());
      await estornarVenda(v.origem);
      expect(await ler(empresaA, outra.id)).toMatchObject({ status: 'pago' });
      expect(await ler(empresaA, despesa.id)).toMatchObject({ status: 'aberto' });
    });

    it('se um pagamento já tinha sido estornado sozinho, estorna só o que falta (sem duplicar)', async () => {
      const v = await vendaEmDuasFormas();
      await withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx(), v.pix, 'Pix lançado errado'));
      const r = await estornarVenda(v.origem);
      expect(r.ids).toHaveLength(1);
      expect(await ler(empresaA, v.dinheiro)).toMatchObject({ status: 'estornado' });
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE estorno_de = $1', [v.pix])).rowCount);
      expect(n).toBe(1);
    });

    it('venda com pagamento ainda em aberto: o aberto é cancelado e nada dele entra no caixa', async () => {
      const origem = randomUUID();
      const { id: pago } = await registrar(empresaA, autorA, venda({ origem_id: origem, valor_centavos: 5000 }));
      const { id: aberto } = await registrar(empresaA, autorA, venda({ origem_id: origem, valor_centavos: 3000, forma_pagamento: null, paga: false }));
      const r = await estornarVenda(origem);
      expect(r.ids).toHaveLength(2);
      expect(await ler(empresaA, pago)).toMatchObject({ status: 'estornado' });
      expect(await ler(empresaA, aberto)).toMatchObject({ status: 'estornado', pago_em: null });
    });

    it('estornar de novo a mesma venda: ja_estornado, e nenhum estorno extra é criado', async () => {
      const v = await vendaEmDuasFormas();
      await estornarVenda(v.origem);
      await expect(estornarVenda(v.origem, 'de novo')).rejects.toMatchObject({ codigo: 'ja_estornado' });
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE estorno_de = ANY($1::uuid[])', [[v.pix, v.dinheiro]])).rowCount);
      expect(n).toBe(2);
    });

    it('venda que não existe, ou que é de outra empresa, é "não encontrada" e a outra fica intacta', async () => {
      const origemB = randomUUID();
      const { id: daB } = await registrar(empresaB, autorB, venda({ origem_id: origemB }));
      await expect(estornarVenda(origemB)).rejects.toMatchObject({ codigo: 'nao_encontrado' });
      await expect(estornarVenda(randomUUID())).rejects.toBeInstanceOf(ErroFinanceiro);
      expect(await ler(empresaB, daB)).toMatchObject({ status: 'pago' });
    });

    it('o tipo de origem conta: o id de uma venda não é achado como "compra"', async () => {
      const v = await vendaEmDuasFormas();
      await expect(
        withEmpresa(pool, empresaA, (c) => estornarOrigem(c, ctx(), 'compra', v.origem, 'engano')),
      ).rejects.toMatchObject({ codigo: 'nao_encontrado' });
      expect(await ler(empresaA, v.pix)).toMatchObject({ status: 'pago' });
    });

    it('é atômico com a transação do chamador: se algo falha depois, nenhum estorno fica', async () => {
      const v = await vendaEmDuasFormas();
      await expect(
        withEmpresa(pool, empresaA, async (c) => {
          await estornarOrigem(c, ctx(), 'venda', v.origem, 'cancelando');
          throw new Error('falhou ao devolver o estoque');
        }),
      ).rejects.toThrow('falhou ao devolver o estoque');
      expect(await ler(empresaA, v.pix)).toMatchObject({ status: 'pago' });
      expect(await ler(empresaA, v.dinheiro)).toMatchObject({ status: 'pago' });
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE estorno_de = ANY($1::uuid[])', [[v.pix, v.dinheiro]])).rowCount);
      expect(n).toBe(0);
    });

    it('duas tentativas simultâneas: a 2ª espera a 1ª e recebe ja_estornado (nunca estorno em dobro)', async () => {
      const v = await vendaEmDuasFormas();
      let liberar!: () => void;
      const portao = new Promise<void>((r) => {
        liberar = r;
      });
      let travou!: () => void;
      const aviso = new Promise<void>((r) => {
        travou = r;
      });
      // A 1ª transação fica ABERTA segurando os locks da venda; a 2ª tem de esperar.
      const primeira = withEmpresa(pool, empresaA, async (c) => {
        const e = await estornarOrigem(c, ctx(), 'venda', v.origem, 'tentativa 1');
        travou();
        await portao;
        return e;
      });
      await aviso;
      const segunda = estornarVenda(v.origem, 'tentativa 2');
      const situacao = await Promise.race([
        segunda.then(
          () => 'terminou',
          () => 'terminou',
        ),
        new Promise((r) => setTimeout(() => r('esperando'), 300)),
      ]);
      expect(situacao).toBe('esperando');
      liberar();
      await primeira;
      await expect(segunda).rejects.toMatchObject({ codigo: 'ja_estornado' });
      const n = await withEmpresa(pool, empresaA, async (c) => (await c.query('SELECT 1 FROM lancamentos WHERE estorno_de = ANY($1::uuid[])', [[v.pix, v.dinheiro]])).rowCount);
      expect(n).toBe(2);
    });
  });

  describe('marcar como pago (RF-FIN-03)', () => {
    it('baixa a conta: status pago, pago_em, forma e quem pagou', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      const quando = new Date('2026-11-19T18:00:00.000Z');
      await withEmpresa(pool, empresaA, (c) => pagarLancamento(c, { empresaId: empresaA, autorId: autorA, agora: quando }, id, 'debito'));
      expect(await ler(empresaA, id)).toMatchObject({ status: 'pago', pago_em: quando, forma_pagamento: 'debito', pago_por: autorA, valor_centavos: 8990 });
    });

    it('pagar duas vezes: a segunda recebe ja_pago e a data do primeiro pagamento não muda', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      await withEmpresa(pool, empresaA, (c) => pagarLancamento(c, ctx, id, 'pix'));
      await expect(
        withEmpresa(pool, empresaA, (c) => pagarLancamento(c, { ...ctx, agora: new Date('2026-12-01T00:00:00Z') }, id, 'dinheiro')),
      ).rejects.toMatchObject({ codigo: 'ja_pago' });
      expect(await ler(empresaA, id)).toMatchObject({ pago_em: agora, forma_pagamento: 'pix' });
    });

    it('duas baixas simultâneas: só uma vale', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      const r = await Promise.allSettled([
        withEmpresa(pool, empresaA, (c) => pagarLancamento(c, ctx, id, 'pix')),
        withEmpresa(pool, empresaA, (c) => pagarLancamento(c, ctx, id, 'dinheiro')),
      ]);
      expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    });

    it('conta estornada não se paga; de outra empresa é "não encontrada"', async () => {
      const { id } = await registrar(empresaA, autorA, contaAPagar());
      const ctx = { empresaId: empresaA, autorId: autorA, agora };
      await withEmpresa(pool, empresaA, (c) => estornarLancamento(c, ctx, id, 'engano'));
      await expect(withEmpresa(pool, empresaA, (c) => pagarLancamento(c, ctx, id, 'pix'))).rejects.toMatchObject({ codigo: 'lancamento_estornado' });

      const { id: daB } = await registrar(empresaB, autorB, contaAPagar());
      await expect(withEmpresa(pool, empresaA, (c) => pagarLancamento(c, ctx, daB, 'pix'))).rejects.toMatchObject({ codigo: 'nao_encontrado' });
      expect(await ler(empresaB, daB)).toMatchObject({ status: 'aberto' });
    });
  });
});
