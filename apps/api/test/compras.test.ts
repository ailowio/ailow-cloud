import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  Cliente,
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

// S11 / RF-COM-01…05, RN-11, TEST-17. Só ids e números criados neste arquivo (L-0008).
const DIA = '2026-11-11';
const MES = '2026-11-01';

interface Lado {
  dados: EmpresaDeTeste;
  dono: Cliente;
  vendedor: Cliente;
  categoria: string;
}

interface Peca {
  skuId: string;
  codigo: string;
}

describe('Compras (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();
  let seq = 0;
  const zap = () => `119${String(70_000_000 + ++seq).padStart(8, '0')}`;

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const pin = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (pin.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${pin.statusCode}`);
    const cat = await p.dono.post('/categorias', { nome: 'Sutiã', atributos: ['Bojo'], tipo: 'produto' });
    if (cat.statusCode !== 201) throw new Error(`categoria falhou: ${cat.statusCode} ${cat.body}`);
    return { dados: p.empresa, dono: p.dono, vendedor, categoria: (cat.json() as { id: string }).id };
  }

  async function peca(lado: Lado, estoque = 2): Promise<Peca> {
    const res = await lado.dono.post('/produtos', {
      nome: `Peça ${randomUUID().slice(0, 8)}`,
      categoria_id: lado.categoria,
      porte: 'slim',
      atributos: ['Bojo'],
      fornecedor: 'Texto antigo',
      custo_centavos: 4500,
      preco_centavos: 8990,
      skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: estoque, estoque_minimo: 1 }],
    });
    if (res.statusCode !== 201) throw new Error(`produto falhou: ${res.statusCode} ${res.body}`);
    const sku = (res.json() as { skus: { id: string; codigo: string }[] }).skus[0] as { id: string; codigo: string };
    return { skuId: sku.id, codigo: sku.codigo };
  }

  async function fornecedor(lado: Lado, tel = zap()) {
    const res = await lado.dono.post('/fornecedores', { nome: `Forne ${tel.slice(-4)}`, whatsapp: tel, cnpj: null });
    if (res.statusCode !== 201) throw new Error(`fornecedor falhou: ${res.statusCode} ${res.body}`);
    return { id: (res.json() as { id: string }).id, whatsapp: tel };
  }

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 8);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Compras A');
    b = await montar('Compras B');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  const estoqueDe = async (lado: Lado, codigo: string) => {
    const res = await lado.dono.get(`/skus/por-codigo?codigo=${encodeURIComponent(codigo)}`);
    return (res.json() as { estoque: number }).estoque;
  };

  describe('autorização (TEST-17): 2 empresas × 2 perfis', () => {
    it('sem sessão e Vendedor recebem 401/403; a empresa B não lê o pedido da A', async () => {
      const anon = new Cliente(app);
      expect((await anon.get('/fornecedores')).statusCode).toBe(401);
      expect((await a.vendedor.get('/fornecedores')).statusCode).toBe(403);
      expect((await a.vendedor.post('/compras', {})).statusCode).toBe(403);

      const f = await fornecedor(a);
      const p = await peca(a);
      const ped = await a.dono.post('/compras', {
        fornecedor_id: f.id,
        itens: [{ sku_id: p.skuId, quantidade: 2, custo_centavos: 4500 }],
      });
      expect(ped.statusCode).toBe(201);
      const { id } = ped.json() as { id: string };
      expect((await b.dono.get(`/compras/${id}`)).statusCode).toBe(404);
      expect((await b.dono.get(`/fornecedores/${f.id}`)).statusCode).toBe(404);
    });
  });

  describe('fornecedores (RF-COM-01)', () => {
    it('cadastra, lista por nome e recusa WhatsApp repetido', async () => {
      const loja = await montar('Fornecedores');
      const tel = zap();
      const criado = await loja.dono.post('/fornecedores', {
        nome: 'Atelier Sol',
        whatsapp: tel,
        cnpj: '12.345.678/0001-95',
      });
      expect(criado.statusCode).toBe(201);
      const { id } = criado.json() as { id: string };
      const ficha = await loja.dono.get(`/fornecedores/${id}`);
      expect(ficha.json()).toMatchObject({ nome: 'Atelier Sol', whatsapp: tel, cnpj: '12345678000195' });
      const lista = await loja.dono.get('/fornecedores?q=atelier');
      expect((lista.json() as { fornecedores: { id: string }[] }).fornecedores.map((f) => f.id)).toContain(id);
      expect((await loja.dono.post('/fornecedores', { nome: 'Outro', whatsapp: tel, cnpj: null })).statusCode).toBe(409);
    });
  });

  describe('pedido: rascunho → enviado → recebido (RF-COM-02…04, RN-11)', () => {
    it('envia pelo WhatsApp, recebe com estoque + parcelas e numera a partir de 1', async () => {
      const loja = await montar('Pedidos');
      const f = await fornecedor(loja);
      const p = await peca(loja, 3);
      const antes = await estoqueDe(loja, p.codigo);

      const rascunho = await loja.dono.post('/compras', {
        fornecedor_id: f.id,
        itens: [{ sku_id: p.skuId, quantidade: 2, custo_centavos: 4500 }],
      });
      expect(rascunho.statusCode).toBe(201);
      const ped = rascunho.json() as { id: string; numero: number; status: string; total_centavos: number };
      expect(ped).toMatchObject({ numero: 1, status: 'rascunho', total_centavos: 9000 });

      const enviado = await loja.dono.post(`/compras/${ped.id}/enviar`);
      expect(enviado.statusCode).toBe(200);
      const env = enviado.json() as { pedido: { status: string }; whatsapp_url: string };
      expect(env.pedido.status).toBe('enviado');
      expect(env.whatsapp_url).toContain(`https://wa.me/55${f.whatsapp}?text=`);
      expect(decodeURIComponent(env.whatsapp_url)).toContain(p.codigo);
      expect(decodeURIComponent(env.whatsapp_url)).toContain('Preto');

      const recebido = await loja.dono.post(`/compras/${ped.id}/receber`, {
        parcelas: [
          { valor_centavos: 5000, vencimento: '2026-11-20' },
          { valor_centavos: 4000, vencimento: '2026-12-20' },
        ],
      });
      expect(recebido.statusCode).toBe(200);
      expect((recebido.json() as { status: string }).status).toBe('recebido');
      expect(await estoqueDe(loja, p.codigo)).toBe(antes + 2);

      const contas = await loja.dono.get('/financeiro/contas-a-pagar');
      const abertas = (contas.json() as { contas: { origem_tipo: string; origem_id: string; valor_centavos: number; status: string }[] }).contas.filter(
        (l) => l.origem_id === ped.id,
      );
      expect(abertas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ origem_tipo: 'compra', valor_centavos: 5000, status: 'aberto' }),
          expect.objectContaining({ origem_tipo: 'compra', valor_centavos: 4000, status: 'aberto' }),
        ]),
      );

      expect((await loja.dono.post(`/compras/${ped.id}/receber`, { parcelas: [{ valor_centavos: 9000, vencimento: DIA }] })).statusCode).toBe(409);

      const segundo = await loja.dono.post('/compras', {
        fornecedor_id: f.id,
        itens: [{ sku_id: p.skuId, quantidade: 1, custo_centavos: 4500 }],
      });
      expect((segundo.json() as { numero: number }).numero).toBe(2);
    });

    it('parcelas que não fecham o total e receber rascunho são recusados', async () => {
      const loja = await montar('Parcelas');
      const f = await fornecedor(loja);
      const p = await peca(loja);
      const ped = await loja.dono.post('/compras', {
        fornecedor_id: f.id,
        itens: [{ sku_id: p.skuId, quantidade: 1, custo_centavos: 4500 }],
      });
      const { id } = ped.json() as { id: string };
      expect((await loja.dono.post(`/compras/${id}/receber`, { parcelas: [{ valor_centavos: 4500, vencimento: DIA }] })).statusCode).toBe(409);
      await loja.dono.post(`/compras/${id}/enviar`);
      expect(
        (await loja.dono.post(`/compras/${id}/receber`, { parcelas: [{ valor_centavos: 4501, vencimento: DIA }] })).statusCode,
      ).toBe(400);
    });
  });

  describe('relatório (RF-COM-05)', () => {
    it('soma só os pedidos recebidos do mês, por fornecedor', async () => {
      const loja = await montar('Relatório');
      const f1 = await fornecedor(loja);
      const f2 = await fornecedor(loja);
      const p = await peca(loja, 10);

      async function ciclo(fornecedorId: string, qtd: number, custo: number) {
        const ped = await loja.dono.post('/compras', {
          fornecedor_id: fornecedorId,
          itens: [{ sku_id: p.skuId, quantidade: qtd, custo_centavos: custo }],
        });
        const { id, total_centavos } = ped.json() as { id: string; total_centavos: number };
        await loja.dono.post(`/compras/${id}/enviar`);
        await loja.dono.post(`/compras/${id}/receber`, {
          parcelas: [{ valor_centavos: total_centavos, vencimento: '2026-11-30' }],
        });
        return total_centavos;
      }

      const t1 = await ciclo(f1.id, 2, 4500);
      const t2 = await ciclo(f2.id, 1, 3000);
      // Rascunho não entra no relatório.
      await loja.dono.post('/compras', {
        fornecedor_id: f1.id,
        itens: [{ sku_id: p.skuId, quantidade: 1, custo_centavos: 9999 }],
      });

      const rel = await loja.dono.get(`/compras/relatorio?periodo=mes&data=${MES}`);
      expect(rel.statusCode).toBe(200);
      expect(rel.json()).toMatchObject({
        periodo: 'mes',
        pedidos: 2,
        total_centavos: t1 + t2,
      });
      const por = (rel.json() as { por_fornecedor: { fornecedor_id: string; total_centavos: number }[] }).por_fornecedor;
      expect(por).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fornecedor_id: f1.id, total_centavos: t1 }),
          expect.objectContaining({ fornecedor_id: f2.id, total_centavos: t2 }),
        ]),
      );
    });
  });
});
