import { randomUUID } from 'node:crypto';
import { CATEGORIAS_FINANCEIRAS_PADRAO } from '@ailow/shared';
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

// S05 / RF-CFG-02, 03, 04 e RF-ACE-04: configurações da empresa (só Dono), isoladas por empresa.
// Os testes só afirmam sobre ids/nomes criados aqui (L-0008): rodam em paralelo no mesmo Postgres.
describe('configurações da empresa (Dono)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  let a: { dados: EmpresaDeTeste; dono: Cliente; vendedor: Cliente; vendedorId: string };
  let b: { dados: EmpresaDeTeste; dono: Cliente; vendedor: Cliente; vendedorId: string };

  async function montar(adminCli: Cliente, nome: string) {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor, vendedorId: p.vendedorId };
  }

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    const relogio = new Relogio();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar(adminCli, 'Config A');
    b = await montar(adminCli, 'Config B');
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('dados da empresa e markup (RF-CFG-02/03)', () => {
    it('devolve o padrão de uma empresa nova: nome, sem telefone/endereço, markup 0 e trava em 5 min', async () => {
      const res = await a.dono.get('/empresa');
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        nome: 'Config A',
        telefone: null,
        endereco: null,
        markup_bps: 0,
        inatividade_minutos: 5,
        tem_logo: false,
      });
    });

    it('Dono altera os dados e o telefone é guardado só com dígitos', async () => {
      const res = await a.dono.put('/empresa', {
        nome: 'Marcant A',
        telefone: '(11) 98765-4321',
        endereco: 'Rua das Flores, 10',
        markup_bps: 10000,
        inatividade_minutos: 10,
      });
      expect(res.statusCode).toBe(200);
      const esperado = {
        nome: 'Marcant A',
        telefone: '11987654321',
        endereco: 'Rua das Flores, 10',
        markup_bps: 10000,
        inatividade_minutos: 10,
        tem_logo: false,
      };
      expect(res.json()).toEqual(esperado);
      expect((await a.dono.get('/empresa')).json()).toEqual(esperado);
    });

    it('telefone e endereço podem ser removidos (null)', async () => {
      const res = await a.dono.put('/empresa', {
        nome: 'Marcant A',
        telefone: null,
        endereco: null,
        markup_bps: 10000,
        inatividade_minutos: 10,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ telefone: null, endereco: null });
    });

    it.each([
      ['nome vazio', { nome: '   ' }],
      ['nome gigante', { nome: 'x'.repeat(121) }],
      ['markup negativo', { markup_bps: -1 }],
      ['markup acima do limite (1000%)', { markup_bps: 100001 }],
      ['markup fracionário', { markup_bps: 10.5 }],
      ['trava de 0 minutos', { inatividade_minutos: 0 }],
      ['trava de 121 minutos', { inatividade_minutos: 121 }],
      ['telefone curto demais', { telefone: '12345' }],
      ['telefone com letras', { telefone: 'abcdefghijk' }],
      ['endereço gigante', { endereco: 'x'.repeat(201) }],
    ])('rejeita com 400: %s', async (_nome, parte) => {
      const base = { nome: 'Marcant A', telefone: null, endereco: null, markup_bps: 0, inatividade_minutos: 5 };
      const res = await a.dono.put('/empresa', { ...base, ...parte });
      expect(res.statusCode).toBe(400);
      // Nada foi gravado: o nome continua sendo o último válido.
      expect((await a.dono.get('/empresa')).json()).toMatchObject({ nome: 'Marcant A' });
    });

    it('Vendedor não lê nem altera (403) e sem sessão é 401', async () => {
      expect((await a.vendedor.get('/empresa')).statusCode).toBe(403);
      const corpo = { nome: 'Invasor', telefone: null, endereco: null, markup_bps: 0, inatividade_minutos: 5 };
      expect((await a.vendedor.put('/empresa', corpo)).statusCode).toBe(403);
      const anonimo = new Cliente(app);
      expect((await anonimo.get('/empresa')).statusCode).toBe(401);
      expect((await anonimo.put('/empresa', corpo)).statusCode).toBe(401);
    });

    it('alterar a empresa A não toca a B, e empresa_id no corpo é ignorado', async () => {
      const antesB = (await b.dono.get('/empresa')).json();
      const res = await a.dono.put('/empresa', {
        nome: 'Marcant A 2',
        telefone: null,
        endereco: null,
        markup_bps: 5000,
        inatividade_minutos: 5,
        empresa_id: b.dados.empresaId,
      });
      expect(res.statusCode).toBe(200);
      expect((await b.dono.get('/empresa')).json()).toEqual(antesB);
      expect((await a.dono.get('/empresa')).json()).toMatchObject({ nome: 'Marcant A 2', markup_bps: 5000 });
    });

    it('deixa rastro da alteração na trilha de eventos (AUD)', async () => {
      const r = await owner.query(
        `SELECT ator_id FROM eventos_acesso WHERE empresa_id = $1 AND tipo = 'empresa_alterada'`,
        [a.dados.empresaId],
      );
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((x) => x.ator_id === a.dados.donoId)).toBe(true);
    });

    it('GET /acesso/eu informa a trava por inatividade da empresa (RF-ACE-04)', async () => {
      const dono = (await a.dono.get('/acesso/eu')).json();
      const vendedor = (await a.vendedor.get('/acesso/eu')).json();
      expect(dono.inatividade_minutos).toBe(5);
      expect(vendedor.inatividade_minutos).toBe(5);
    });
  });

  describe('logo da empresa (RF-CFG-02)', () => {
    // PNG 1×1 transparente (válido e pequeno).
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    it('Dono envia PNG, GET devolve a imagem, Vendedor também lê; DELETE remove', async () => {
      expect((await a.dono.get('/empresa/logo')).statusCode).toBe(404);
      const up = await a.dono.putArquivo('/empresa/logo', PNG, 'marca.png', 'image/png');
      expect(up.statusCode).toBe(200);
      expect(up.json()).toMatchObject({ tem_logo: true });
      const img = await a.dono.get('/empresa/logo');
      expect(img.statusCode).toBe(200);
      expect(img.headers['content-type']).toMatch(/image\/png/);
      expect(Buffer.from(img.rawPayload)).toEqual(PNG);
      expect((await a.vendedor.get('/empresa/logo')).statusCode).toBe(200);
      // Empresa B não vê a logo de A.
      expect((await b.dono.get('/empresa/logo')).statusCode).toBe(404);
      const del = await a.dono.delete('/empresa/logo');
      expect(del.statusCode).toBe(200);
      expect(del.json()).toMatchObject({ tem_logo: false });
      expect((await a.dono.get('/empresa/logo')).statusCode).toBe(404);
    });

    it('corpo que não é multipart válido dá 400 (nunca 500 nem 406): sem boundary, JSON e texto', async () => {
      const esperado = { erro: 'requisicao_invalida', mensagem: 'envie o arquivo em multipart/form-data' };
      const semBoundary = await a.dono.req('PUT', '/empresa/logo', Buffer.from('x'), { 'content-type': 'multipart/form-data' });
      expect(semBoundary.statusCode).toBe(400);
      expect(semBoundary.json()).toEqual(esperado);
      const json = await a.dono.req('PUT', '/empresa/logo', Buffer.from('{}'), { 'content-type': 'application/json' });
      expect(json.statusCode).toBe(400);
      expect(json.json()).toEqual(esperado);
      const texto = await a.dono.req('PUT', '/empresa/logo', Buffer.from('oi'), { 'content-type': 'text/plain' });
      expect(texto.statusCode).toBe(400);
    });

    it('rejeita tipo inválido, arquivo vazio e Vendedor no upload', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');
      expect((await a.dono.putArquivo('/empresa/logo', svg, 'x.svg', 'image/svg+xml')).statusCode).toBe(400);
      expect((await a.dono.putArquivo('/empresa/logo', Buffer.alloc(0), 'x.png', 'image/png')).statusCode).toBe(400);
      expect((await a.vendedor.putArquivo('/empresa/logo', PNG, 'x.png', 'image/png')).statusCode).toBe(403);
      expect((await a.vendedor.delete('/empresa/logo')).statusCode).toBe(403);
    });
  });

  describe('categorias e atributos (RF-CFG-04)', () => {
    it('Dono cria categorias e a lista vem ordenada por nome, já com atributos e ativa', async () => {
      const c1 = await a.dono.post('/categorias', { nome: 'Sutiã', atributos: ['bojo', 'aro', 'renda'] });
      expect(c1.statusCode).toBe(201);
      const c2 = await a.dono.post('/categorias', { nome: 'Calcinha', atributos: [] });
      expect(c2.statusCode).toBe(201);
      const lista = (await a.dono.get('/categorias')).json().categorias as {
        id: string;
        nome: string;
        atributos: string[];
        ativa: boolean;
      }[];
      const nossas = lista.filter((c) => [c1.json().id, c2.json().id].includes(c.id));
      expect(nossas.map((c) => c.nome)).toEqual(['Calcinha', 'Sutiã']);
      expect(nossas.find((c) => c.nome === 'Sutiã')).toMatchObject({ atributos: ['bojo', 'aro', 'renda'], ativa: true });
    });

    it('nome repetido na mesma empresa é 409, mesmo mudando maiúsculas e espaços', async () => {
      expect((await a.dono.post('/categorias', { nome: 'Pijama', atributos: [] })).statusCode).toBe(201);
      for (const nome of ['Pijama', 'pijama', '  PIJAMA  ']) {
        const r = await a.dono.post('/categorias', { nome, atributos: [] });
        expect(r.statusCode, nome).toBe(409);
        expect(r.json().erro).toBe('categoria_ja_existe');
      }
    });

    it('o mesmo nome em outra empresa é permitido e cada uma só vê as suas', async () => {
      const rb = await b.dono.post('/categorias', { nome: 'Pijama', atributos: ['manga'] });
      expect(rb.statusCode).toBe(201);
      const listaB = (await b.dono.get('/categorias')).json().categorias as { id: string; nome: string }[];
      expect(listaB.map((c) => c.id)).toContain(rb.json().id);
      const listaA = (await a.dono.get('/categorias')).json().categorias as { id: string }[];
      expect(listaA.map((c) => c.id)).not.toContain(rb.json().id);
    });

    it('Dono renomeia, troca atributos e desativa; a lista reflete', async () => {
      const id = (await a.dono.post('/categorias', { nome: 'Meia', atributos: ['cano'] })).json().id as string;
      const r = await a.dono.put(`/categorias/${id}`, { nome: 'Meias', atributos: ['cano', 'compressão'], ativa: false });
      expect(r.statusCode).toBe(204);
      const lista = (await a.dono.get('/categorias')).json().categorias as { id: string }[];
      expect(lista.find((c) => c.id === id)).toEqual({
        id,
        nome: 'Meias',
        atributos: ['cano', 'compressão'],
        ativa: false,
        tipo: 'produto',
      });
    });

    describe('dois tipos: produto e financeira', () => {
      type Linha = { id: string; nome: string; tipo: string; ativa: boolean; atributos: string[] };
      const listar = async (cli: Cliente, tipo?: string) =>
        (await cli.get(tipo ? `/categorias?tipo=${tipo}` : '/categorias')).json().categorias as Linha[];

      it('empresa nova já vem com as categorias financeiras padrão e nenhuma de produto', async () => {
        const e = await prepararEmpresa(app, adminCli, 'Padrões');
        const todas = await listar(e.dono);
        expect(todas.filter((c) => c.tipo === 'produto')).toEqual([]);
        expect(todas.filter((c) => c.tipo === 'financeira').map((c) => c.nome).sort()).toEqual(
          [...CATEGORIAS_FINANCEIRAS_PADRAO].sort(),
        );
        expect(todas.every((c) => c.ativa && c.atributos.length === 0)).toBe(true);
      });

      it('Dono cria categoria financeira e a lista filtra por tipo', async () => {
        const nome = `Taxa do cartão ${randomUUID().slice(0, 8)}`;
        const r = await a.dono.post('/categorias', { nome, atributos: [], tipo: 'financeira' });
        expect(r.statusCode).toBe(201);
        const id = r.json().id as string;
        const prod = (await a.dono.post('/categorias', { nome: `Produto ${nome}`, atributos: ['x'] })).json().id as string;

        const financeiras = await listar(a.dono, 'financeira');
        expect(financeiras.map((c) => c.id)).toContain(id);
        expect(financeiras.map((c) => c.id)).not.toContain(prod);
        const produtos = await listar(a.dono, 'produto');
        expect(produtos.map((c) => c.id)).toContain(prod);
        expect(produtos.map((c) => c.id)).not.toContain(id);
        expect((await listar(a.dono)).map((c) => c.id)).toEqual(expect.arrayContaining([id, prod]));
      });

      it('o mesmo nome pode existir como categoria de produto e como financeira', async () => {
        const nome = `Embalagem ${randomUUID().slice(0, 8)}`;
        expect((await a.dono.post('/categorias', { nome, atributos: [] })).statusCode).toBe(201);
        expect((await a.dono.post('/categorias', { nome, atributos: [], tipo: 'financeira' })).statusCode).toBe(201);
        const repetida = await a.dono.post('/categorias', { nome: nome.toUpperCase(), atributos: [], tipo: 'financeira' });
        expect(repetida.statusCode).toBe(409);
      });

      it('categoria financeira com atributos é 400; tipo inventado é 400; filtro inventado é 400', async () => {
        expect((await a.dono.post('/categorias', { nome: 'F1', atributos: ['bojo'], tipo: 'financeira' })).statusCode).toBe(400);
        expect((await a.dono.post('/categorias', { nome: 'F2', atributos: [], tipo: 'servico' })).statusCode).toBe(400);
        expect((await a.dono.get('/categorias?tipo=servico')).statusCode).toBe(400);
      });

      it('editar mantém o tipo; financeira não ganha atributos ao ser editada (400, e nada muda)', async () => {
        const nome = `Editável ${randomUUID().slice(0, 8)}`;
        const id = (await a.dono.post('/categorias', { nome, atributos: [], tipo: 'financeira' })).json().id as string;
        const r = await a.dono.put(`/categorias/${id}`, { nome: `${nome} 2`, atributos: ['bojo'], ativa: true });
        expect(r.statusCode).toBe(400);
        expect(r.json().erro).toBe('categoria_financeira_sem_atributos');
        const ok = await a.dono.put(`/categorias/${id}`, { nome: `${nome} 2`, atributos: [], ativa: false });
        expect(ok.statusCode).toBe(204);
        expect((await listar(a.dono, 'financeira')).find((c) => c.id === id)).toMatchObject({ nome: `${nome} 2`, tipo: 'financeira', ativa: false });
      });

      it('Vendedor não acessa nenhum dos dois tipos', async () => {
        expect((await a.vendedor.get('/categorias?tipo=financeira')).statusCode).toBe(403);
        expect((await a.vendedor.post('/categorias', { nome: 'X', atributos: [], tipo: 'financeira' })).statusCode).toBe(403);
      });
    });

    it('renomear para um nome que já existe é 409', async () => {
      await a.dono.post('/categorias', { nome: 'Body', atributos: [] });
      const id = (await a.dono.post('/categorias', { nome: 'Corset', atributos: [] })).json().id as string;
      const r = await a.dono.put(`/categorias/${id}`, { nome: 'body', atributos: [], ativa: true });
      expect(r.statusCode).toBe(409);
    });

    it('categoria de outra empresa responde 404 (não vaza que existe) e não é alterada', async () => {
      const idB = (await b.dono.post('/categorias', { nome: 'Só da B', atributos: [] })).json().id as string;
      const r = await a.dono.put(`/categorias/${idB}`, { nome: 'Invadida', atributos: [], ativa: false });
      expect(r.statusCode).toBe(404);
      const listaB = (await b.dono.get('/categorias')).json().categorias as { id: string; nome: string; ativa: boolean }[];
      expect(listaB.find((c) => c.id === idB)).toMatchObject({ nome: 'Só da B', ativa: true });
    });

    it.each([
      ['nome vazio', { nome: ' ', atributos: [] }],
      ['nome gigante', { nome: 'x'.repeat(61), atributos: [] }],
      ['atributo vazio', { nome: 'Teste', atributos: [' '] }],
      ['atributo gigante', { nome: 'Teste', atributos: ['x'.repeat(41)] }],
      ['atributos repetidos', { nome: 'Teste', atributos: ['Aro', 'aro'] }],
      ['atributos demais', { nome: 'Teste', atributos: Array.from({ length: 21 }, (_, i) => `a${i}`) }],
    ])('rejeita com 400: %s', async (_nome, corpo) => {
      const r = await a.dono.post('/categorias', corpo);
      expect(r.statusCode).toBe(400);
    });

    it('Vendedor não acessa categorias (403) e sem sessão é 401', async () => {
      expect((await a.vendedor.get('/categorias')).statusCode).toBe(403);
      expect((await a.vendedor.post('/categorias', { nome: 'X', atributos: [] })).statusCode).toBe(403);
      const anonimo = new Cliente(app);
      expect((await anonimo.get('/categorias')).statusCode).toBe(401);
    });

    it('criar e alterar deixam rastro na trilha de eventos', async () => {
      const r = await owner.query(
        `SELECT tipo FROM eventos_acesso WHERE empresa_id = $1 AND tipo IN ('categoria_criada', 'categoria_alterada')`,
        [a.dados.empresaId],
      );
      const tipos = new Set(r.rows.map((x) => x.tipo));
      expect(tipos).toEqual(new Set(['categoria_criada', 'categoria_alterada']));
    });
  });
});

// RF-ACE-04: o limite configurado pelo Dono vale no servidor (a sessão expira de verdade).
describe('trava por inatividade configurável (RF-ACE-04)', () => {
  it('com 1 minuto configurado, a sessão expira após 2 minutos parados e o PIN volta a ser pedido', async () => {
    const pool = createPool(process.env.DATABASE_URL_TEST as string);
    const relogio = new Relogio();
    const app = await appDeTeste(pool, relogio);
    try {
      const adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
      const p = await prepararEmpresa(app, adminCli, 'Trava 1min');
      const put = await p.dono.put('/empresa', {
        nome: 'Trava 1min',
        telefone: null,
        endereco: null,
        markup_bps: 0,
        inatividade_minutos: 1,
      });
      expect(put.statusCode).toBe(200);
      relogio.avancarSegundos(30);
      expect((await p.dono.get('/acesso/eu')).statusCode).toBe(200); // ainda dentro do limite (e renova)
      relogio.avancarMinutos(2);
      expect((await p.dono.get('/acesso/eu')).statusCode).toBe(401);
    } finally {
      await app.close();
      await pool.end();
    }
  });
});
