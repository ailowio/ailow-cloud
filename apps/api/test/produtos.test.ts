import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
import { registrarMovimento } from '../src/produtos/estoque.js';
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

// S07 / RF-PRO-01…05/07, RN-01, RN-03, RN-05, RN-10. Cada empresa vê só o que é seu; o Vendedor nunca vê o custo.
// Só afirmamos sobre ids/nomes criados aqui (L-0008): os arquivos de teste rodam em paralelo no mesmo Postgres.
interface SkuResp {
  id: string;
  codigo: string;
  tamanho: string;
  cor: string;
  estoque: number;
  estoque_minimo?: number;
}
interface ProdutoResp {
  id: string;
  numero: number;
  nome: string;
  categoria_id: string;
  categoria_nome: string;
  porte: string;
  atributos: string[];
  preco_centavos: number;
  custo_centavos?: number;
  fornecedor?: string | null;
  ativo: boolean;
  skus: SkuResp[];
}
interface Criado {
  id: string;
  numero: number;
  skus: { id: string; codigo: string }[];
}

describe('Produtos (API)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

  interface Lado {
    dados: EmpresaDeTeste;
    dono: Cliente;
    vendedor: Cliente;
    vendedorId: string;
    categoria: string; // categoria de produto "Sutiã" (atributos: Bojo, Aro, Renda)
  }
  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    const cat = await p.dono.post('/categorias', { nome: 'Sutiã', atributos: ['Bojo', 'Aro', 'Renda'], tipo: 'produto' });
    if (cat.statusCode !== 201) throw new Error(`criar categoria falhou: ${cat.statusCode} ${cat.body}`);
    return { dados: p.empresa, dono: p.dono, vendedor, vendedorId: p.vendedorId, categoria: (cat.json() as { id: string }).id };
  }

  const sku = (extra: Record<string, unknown> = {}) => ({ tamanho: 'M', cor: 'Preto', estoque_inicial: 5, estoque_minimo: 2, ...extra });
  const corpo = (lado: Lado, extra: Record<string, unknown> = {}) => ({
    nome: `Tomara que caia ${randomUUID().slice(0, 8)}`,
    categoria_id: lado.categoria,
    porte: 'slim',
    atributos: ['Bojo'],
    fornecedor: 'Fina Paixão',
    custo_centavos: 4500,
    preco_centavos: 8990,
    skus: [sku()],
    ...extra,
  });
  async function criar(lado: Lado, extra: Record<string, unknown> = {}): Promise<Criado> {
    const res = await lado.dono.post('/produtos', corpo(lado, extra));
    if (res.statusCode !== 201) throw new Error(`criar produto falhou: ${res.statusCode} ${res.body}`);
    return res.json() as Criado;
  }
  const listar = async (cli: Cliente, q?: string) => {
    const res = await cli.get(`/produtos${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`);
    return { status: res.statusCode, corpo: res.body, json: res.json() as { produtos: ProdutoResp[]; truncado: boolean } };
  };
  const eventos = async (alvo: string) =>
    (await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1 ORDER BY id', [alvo])).rows.map((r) => r.tipo as string);

  let a: Lado;
  let b: Lado;
  let c: Lado; // numeração: começa do zero

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string, 12);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Prod API A');
    b = await montar('Prod API B');
    c = await montar('Prod API C');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('autorização (RN-10, TEST-17): 2 empresas × 2 perfis', () => {
    const rotas: [string, 'GET' | 'POST', string, unknown][] = [
      ['listar', 'GET', '/produtos', undefined],
      ['criar', 'POST', '/produtos', {}],
      ['entrada de estoque', 'POST', `/skus/${randomUUID()}/estoque`, { tipo: 'entrada', quantidade: 1, motivo: 'Teste' }],
      ['movimentos', 'GET', `/skus/${randomUUID()}/movimentos`, undefined],
      ['alertas', 'GET', '/estoque/alertas', undefined],
    ];

    it.each(rotas)('sem sessão: %s devolve 401', async (_n, metodo, url, corpoReq) => {
      expect((await new Cliente(app).req(metodo, url, corpoReq)).statusCode).toBe(401);
    });

    it.each(rotas.filter((r) => r[0] !== 'listar'))('Vendedor não acessa: %s devolve 403', async (_n, metodo, url, corpoReq) => {
      expect((await a.vendedor.req(metodo, url, corpoReq)).statusCode).toBe(403);
    });

    it('o 403 do Vendedor não tem efeito colateral: não cria produto nem mexe no estoque', async () => {
      const marca = `Vendedor tentou ${randomUUID()}`;
      expect((await a.vendedor.post('/produtos', corpo(a, { nome: marca }))).statusCode).toBe(403);
      expect((await listar(a.dono, marca)).json.produtos).toHaveLength(0);

      const p = await criar(a);
      const s = p.skus[0] as { id: string };
      expect((await a.vendedor.post(`/skus/${s.id}/estoque`, { tipo: 'ajuste', quantidade: -5, motivo: 'Sumiu' })).statusCode).toBe(403);
      const depois = (await listar(a.dono, p.skus[0]?.codigo)).json.produtos[0]?.skus[0];
      expect(depois?.estoque).toBe(5);
    });

    it('uma empresa não vê, não ajusta nem lê movimentos de SKU da outra', async () => {
      const nomeB = `Só da B ${randomUUID()}`;
      const pb = await criar(b, { nome: nomeB });
      const skuB = pb.skus[0] as { id: string; codigo: string };

      // O código é único por empresa: a A pode ter um SKU com o mesmo código. Conferimos pelo id do produto da B.
      for (const cli of [a.dono, a.vendedor]) {
        expect((await listar(cli, nomeB)).json.produtos).toHaveLength(0);
        expect((await listar(cli, skuB.codigo)).json.produtos.map((p) => p.id)).not.toContain(pb.id);
        expect((await listar(cli)).json.produtos.map((p) => p.id)).not.toContain(pb.id);
      }
      expect((await a.dono.post(`/skus/${skuB.id}/estoque`, { tipo: 'entrada', quantidade: 9, motivo: 'Invasão' })).statusCode).toBe(404);
      expect((await a.dono.get(`/skus/${skuB.id}/movimentos`)).statusCode).toBe(404);
      const intacto = (await listar(b.dono, skuB.codigo)).json.produtos[0]?.skus[0];
      expect(intacto?.estoque).toBe(5);
    });

    it('o empresa_id enviado no corpo é ignorado: o produto nasce na empresa da sessão', async () => {
      const nome = `Com empresa forjada ${randomUUID()}`;
      const res = await a.dono.post('/produtos', { ...corpo(a, { nome }), empresa_id: b.dados.empresaId });
      expect(res.statusCode).toBe(201);
      expect((await listar(a.dono, nome)).json.produtos).toHaveLength(1);
      expect((await listar(b.dono, nome)).json.produtos).toHaveLength(0);
    });
  });

  describe('RF-PRO-07: o Vendedor vê produto, preço e estoque, nunca o custo', () => {
    it('o Dono vê custo, fornecedor e estoque mínimo', async () => {
      const nome = `Visível ao Dono ${randomUUID()}`;
      await criar(a, { nome, custo_centavos: 4321, fornecedor: 'Pretty Paty' });
      const p = (await listar(a.dono, nome)).json.produtos[0];
      expect(p).toMatchObject({ nome, custo_centavos: 4321, fornecedor: 'Pretty Paty', preco_centavos: 8990 });
      expect(p?.skus[0]).toMatchObject({ estoque: 5, estoque_minimo: 2 });
    });

    it('o Vendedor vê produto, preço e estoque; custo, fornecedor e mínimo NÃO existem na resposta', async () => {
      const nome = `Visível ao Vendedor ${randomUUID()}`;
      await criar(a, { nome, custo_centavos: 4321, fornecedor: 'Pretty Paty' });
      const r = await listar(a.vendedor, nome);
      expect(r.status).toBe(200);
      const p = r.json.produtos[0];
      expect(p).toMatchObject({ nome, preco_centavos: 8990 });
      expect(p?.skus[0]).toMatchObject({ estoque: 5 });
      // Nem como null: a chave inteira some. Confere o texto cru da resposta, não só o objeto.
      expect(r.corpo).not.toMatch(/custo|fornecedor|estoque_minimo|Pretty Paty|4321/);
      expect(Object.keys(p as object)).not.toContain('custo_centavos');
    });
  });

  describe('RF-PRO-01/02: cadastro com SKUs, código curto e estoque inicial', () => {
    it('cria um produto por grade tamanho × cor e devolve o código de cada SKU (PPPP-TT-CCC)', async () => {
      const res = await c.dono.post(
        '/produtos',
        corpo(c, {
          skus: [
            sku({ tamanho: 'P', cor: 'Preto', estoque_inicial: 4, estoque_minimo: 1 }),
            sku({ tamanho: 'P', cor: 'Nude', estoque_inicial: 0, estoque_minimo: 1 }),
            sku({ tamanho: 'M', cor: 'Preto', estoque_inicial: 2, estoque_minimo: 1 }),
          ],
        }),
      );
      expect(res.statusCode).toBe(201);
      const criado = res.json() as Criado;
      expect(criado.numero).toBe(1);
      expect(criado.skus.map((s) => s.codigo).sort()).toEqual(['0001-M-PRE', '0001-P-NUD', '0001-P-PRE']);
    });

    it('estoque inicial vira movimento "inicial" com autor; saldo 0 não gera movimento', async () => {
      const lado = await montar('Prod API estoque inicial');
      const criado = await criar(lado, {
        skus: [sku({ tamanho: 'P', estoque_inicial: 4 }), sku({ tamanho: 'M', estoque_inicial: 0 })],
      });
      const comEstoque = criado.skus.find((s) => s.codigo.includes('-P-')) as { id: string };
      const zerado = criado.skus.find((s) => s.codigo.includes('-M-')) as { id: string };
      const ms = (await lado.dono.get(`/skus/${comEstoque.id}/movimentos`)).json() as {
        movimentos: { tipo: string; quantidade: number; saldo_apos: number; motivo: string; autor_nome: string }[];
      };
      expect(ms.movimentos).toHaveLength(1);
      expect(ms.movimentos[0]).toMatchObject({ tipo: 'inicial', quantidade: 4, saldo_apos: 4, motivo: 'Estoque inicial' });
      expect(ms.movimentos[0]?.autor_nome).toContain('Dono');
      expect(((await lado.dono.get(`/skus/${zerado.id}/movimentos`)).json() as { movimentos: unknown[] }).movimentos).toHaveLength(0);
    });

    it('o número do produto é sequencial por empresa (a outra empresa começa em 1)', async () => {
      const lado = await montar('Prod API numeração');
      expect((await criar(lado)).numero).toBe(1);
      expect((await criar(lado)).numero).toBe(2);
      expect((await criar(lado)).numero).toBe(3);
    });

    it('criações simultâneas recebem números diferentes, sem buraco nem erro', async () => {
      const lado = await montar('Prod API simultâneo');
      const rs = await Promise.all(Array.from({ length: 6 }, () => lado.dono.post('/produtos', corpo(lado))));
      expect(rs.map((r) => r.statusCode)).toEqual([201, 201, 201, 201, 201, 201]);
      const numeros = rs.map((r) => (r.json() as Criado).numero).sort((x, y) => x - y);
      expect(numeros).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('cores que começam igual recebem códigos diferentes, e a mesma cor repete o código em todos os tamanhos', async () => {
      const lado = await montar('Prod API cores');
      const criado = await criar(lado, {
        skus: [
          sku({ tamanho: 'P', cor: 'Rosa Chá' }),
          sku({ tamanho: 'M', cor: 'Rosa Chá' }),
          sku({ tamanho: 'P', cor: 'Rosa Bebê' }),
        ],
      });
      expect(criado.skus.map((s) => s.codigo).sort()).toEqual(['0001-M-ROS', '0001-P-RO2', '0001-P-ROS']);
    });

    it('guarda os atributos com a grafia da categoria e aceita só os que a categoria tem', async () => {
      const lado = await montar('Prod API atributos');
      const nome = `Com atributos ${randomUUID()}`;
      await criar(lado, { nome, atributos: ['bojo', 'ARO'] });
      expect((await listar(lado.dono, nome)).json.produtos[0]?.atributos.sort()).toEqual(['Aro', 'Bojo']);
      const res = await lado.dono.post('/produtos', corpo(lado, { atributos: ['Bojo', 'Alça removível'] }));
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ erro: 'atributos_invalidos' });
    });

    it('só categoria de produto, ativa e da própria empresa serve', async () => {
      const financeira = (await a.dono.get('/categorias?tipo=financeira')).json() as { categorias: { id: string }[] };
      const casos: [string, string][] = [
        ['financeira', financeira.categorias[0]?.id as string],
        ['inexistente', randomUUID()],
        ['de outra empresa', b.categoria],
      ];
      for (const [_nome, categoria_id] of casos) {
        const res = await a.dono.post('/produtos', corpo(a, { categoria_id }));
        expect(res.statusCode).toBe(400);
        expect(res.json()).toMatchObject({ erro: 'categoria_invalida' });
      }
      const inativa = (await a.dono.post('/categorias', { nome: `Inativa ${randomUUID()}`, atributos: [], tipo: 'produto' })).json() as { id: string };
      await a.dono.put(`/categorias/${inativa.id}`, { nome: `Inativa ${randomUUID()}`, atributos: [], ativa: false });
      const res = await a.dono.post('/produtos', corpo(a, { categoria_id: inativa.id }));
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ erro: 'categoria_invalida' });
    });

    it('categoria em uso por produto não é apagada: o banco recusa e a API só desativa', async () => {
      const lado = await montar('Prod API categoria em uso');
      await criar(lado);
      await expect(
        withEmpresa(pool, lado.dados.empresaId, (cl) => cl.query('DELETE FROM categorias WHERE id = $1', [lado.categoria])),
      ).rejects.toMatchObject({ code: '23001' });
      const r = await lado.dono.put(`/categorias/${lado.categoria}`, { nome: 'Sutiã', atributos: ['Bojo'], ativa: false });
      expect(r.statusCode).toBe(204);
    });

    it.each([
      ['sem SKU', { skus: [] }],
      ['custo fracionado (RN-01)', { custo_centavos: 45.5 }],
      ['preço zero', { preco_centavos: 0 }],
      ['porte inventado', { porte: 'medio' }],
      ['mínimo ausente', { skus: [{ tamanho: 'M', cor: 'Preto', estoque_inicial: 1 }] }],
      ['SKU repetido', { skus: [sku(), sku({ cor: 'PRETO' })] }],
    ])('corpo inválido (%s) devolve 400 e não grava nada', async (_nome, extra) => {
      const nome = `Inválido ${randomUUID()}`;
      const res = await a.dono.post('/produtos', corpo(a, { nome, ...extra }));
      expect(res.statusCode).toBe(400);
      expect((await listar(a.dono, nome)).json.produtos).toHaveLength(0);
    });

    it('depois do número 9999 não cabe mais produto na empresa (409), e nada é gravado', async () => {
      const lado = await montar('Prod API limite');
      const usuario = lado.dados.donoId;
      await owner.query(
        `INSERT INTO produtos (empresa_id, numero, nome, categoria_id, porte, custo_centavos, preco_centavos, criado_por)
         VALUES ($1, 9999, 'Último', $2, 'slim', 1, 2, $3)`,
        [lado.dados.empresaId, lado.categoria, usuario],
      );
      const nome = `Excedente ${randomUUID()}`;
      const res = await lado.dono.post('/produtos', corpo(lado, { nome }));
      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ erro: 'limite_de_produtos' });
      expect((await listar(lado.dono, nome)).json.produtos).toHaveLength(0);
    });

    it('registra o evento de auditoria "produto_criado" com o autor', async () => {
      const criado = await criar(a);
      expect(await eventos(criado.id)).toEqual(['produto_criado']);
    });
  });

  describe('RN-05: preço sugerido é só uma sugestão', () => {
    it('a API guarda o preço digitado, mesmo diferente de custo × markup (sempre editável)', async () => {
      const nome = `Preço livre ${randomUUID()}`;
      // Markup padrão da empresa é 0; custo 4500 e preço 12345: nada força custo × (1 + markup).
      await criar(a, { nome, custo_centavos: 4500, preco_centavos: 12_345 });
      expect((await listar(a.dono, nome)).json.produtos[0]?.preco_centavos).toBe(12_345);
    });
  });

  describe('RF-PRO-03: lista e busca por nome, código e preço', () => {
    let lado: Lado;
    // Só letras: a busca por preço ("89", "90") não pode casar por acaso com dígitos do nome.
    const tag = [...randomUUID().replace(/[^a-f]/g, '')].join('').padEnd(6, 'x').slice(0, 8);
    let calcinha: Criado;
    beforeAll(async () => {
      lado = await montar('Prod API busca');
      await criar(lado, { nome: `Sutiã Essência ${tag}`, preco_centavos: 8990, skus: [sku({ tamanho: '46', cor: 'Chocolate' })] });
      calcinha = await criar(lado, { nome: `Calcinha Conforto ${tag}`, preco_centavos: 2500, skus: [sku({ tamanho: 'GG', cor: 'Nude' })] });
      await criar(lado, { nome: `Camisola ${tag}`, preco_centavos: 15_000, skus: [sku({ tamanho: 'M', cor: 'Vinho' })] });
    });
    const nomes = async (q?: string, cli = lado.dono) => (await listar(cli, q)).json.produtos.map((p) => p.nome);

    it('sem busca, lista todos os produtos da empresa pelo nome', async () => {
      expect(await nomes()).toEqual([`Calcinha Conforto ${tag}`, `Camisola ${tag}`, `Sutiã Essência ${tag}`]);
    });

    it('por nome, sem diferenciar maiúsculas nem acentos', async () => {
      expect(await nomes(`sutia ESSENCIA ${tag}`)).toEqual([`Sutiã Essência ${tag}`]);
      expect(await nomes('calcinha')).toEqual([`Calcinha Conforto ${tag}`]);
    });

    it('por código do SKU, inteiro ou em pedaço', async () => {
      const codigo = calcinha.skus[0]?.codigo as string;
      expect(await nomes(codigo)).toEqual([`Calcinha Conforto ${tag}`]);
      expect(await nomes(codigo.toLowerCase())).toEqual([`Calcinha Conforto ${tag}`]);
      expect(await nomes('-GG-NUD')).toEqual([`Calcinha Conforto ${tag}`]);
    });

    it('por preço: com centavos é exato; só os reais pega a faixa daquele real', async () => {
      expect(await nomes('89,90')).toEqual([`Sutiã Essência ${tag}`]);
      expect(await nomes('R$ 25,00')).toEqual([`Calcinha Conforto ${tag}`]);
      expect(await nomes('89')).toEqual([`Sutiã Essência ${tag}`]); // R$ 89,00 a R$ 89,99
      expect(await nomes('90')).toEqual([]);
      expect(await nomes('89,91')).toEqual([]);
    });

    it('busca sem resultado devolve lista vazia (não erro)', async () => {
      const r = await listar(lado.dono, `nada-parecido-${randomUUID()}`);
      expect(r.status).toBe(200);
      expect(r.json).toEqual({ produtos: [], truncado: false });
    });

    it('o Vendedor busca do mesmo jeito', async () => {
      expect(await nomes('camisola', lado.vendedor)).toEqual([`Camisola ${tag}`]);
    });

    it('caracteres especiais da busca são texto, não curinga nem SQL', async () => {
      expect(await nomes('%')).toEqual([]);
      expect(await nomes('_')).toEqual([]);
      expect(await nomes("'; DROP TABLE produtos; --")).toEqual([]);
      expect((await listar(lado.dono)).status).toBe(200);
    });

    it('busca com mais de 80 caracteres é recusada (400)', async () => {
      expect((await lado.dono.get(`/produtos?q=${'x'.repeat(81)}`)).statusCode).toBe(400);
    });
  });

  describe('RF-PRO-04: entrada e ajuste de estoque (só Dono, com motivo e autor)', () => {
    it('a entrada soma ao saldo e fica no histórico com o motivo e o nome de quem fez', async () => {
      const p = await criar(a);
      const s = p.skus[0] as { id: string };
      const r = await a.dono.post(`/skus/${s.id}/estoque`, { tipo: 'entrada', quantidade: 7, motivo: 'Chegou pedido da Fina Paixão' });
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ estoque: 12 });
      const ms = (await a.dono.get(`/skus/${s.id}/movimentos`)).json() as {
        movimentos: { tipo: string; quantidade: number; saldo_apos: number; motivo: string; autor_nome: string }[];
      };
      // O mais recente primeiro.
      expect(ms.movimentos.map((m) => [m.tipo, m.quantidade, m.saldo_apos])).toEqual([
        ['entrada', 7, 12],
        ['inicial', 5, 5],
      ]);
      expect(ms.movimentos[0]).toMatchObject({ motivo: 'Chegou pedido da Fina Paixão' });
      expect(ms.movimentos[0]?.autor_nome).toContain('Dono');
    });

    it('o ajuste negativo tira do saldo; saldo 0 não baixa (409 estoque_insuficiente)', async () => {
      const p = await criar(a, { skus: [sku({ estoque_inicial: 2 })] });
      const s = p.skus[0] as { id: string };
      expect((await a.dono.post(`/skus/${s.id}/estoque`, { tipo: 'ajuste', quantidade: -2, motivo: 'Peça com defeito' })).json()).toEqual({ estoque: 0 });
      const r = await a.dono.post(`/skus/${s.id}/estoque`, { tipo: 'ajuste', quantidade: -1, motivo: 'Mais uma com defeito' });
      expect(r.statusCode).toBe(409);
      expect(r.json()).toMatchObject({ erro: 'estoque_insuficiente' });
      const ms = (await a.dono.get(`/skus/${s.id}/movimentos`)).json() as { movimentos: unknown[] };
      expect(ms.movimentos).toHaveLength(2); // inicial + o ajuste que passou; o recusado não deixa rastro
    });

    it('concorrência no limite pela API: saldo 1, duas baixas ao mesmo tempo, uma passa e uma é 409', async () => {
      const p = await criar(a, { skus: [sku({ estoque_inicial: 1 })] });
      const s = p.skus[0] as { id: string };
      const rs = await Promise.all(
        [1, 2].map((i) => a.dono.post(`/skus/${s.id}/estoque`, { tipo: 'ajuste', quantidade: -1, motivo: `Baixa ${i}` })),
      );
      expect(rs.map((r) => r.statusCode).sort()).toEqual([200, 409]);
      const depois = (await listar(a.dono, p.skus[0]?.codigo)).json.produtos[0]?.skus[0];
      expect(depois?.estoque).toBe(0);
    });

    it.each([
      ['sem motivo', { tipo: 'entrada', quantidade: 1, motivo: '' }],
      ['quantidade zero', { tipo: 'ajuste', quantidade: 0, motivo: 'Contagem' }],
      ['entrada negativa', { tipo: 'entrada', quantidade: -1, motivo: 'Contagem' }],
      ['quantidade fracionada', { tipo: 'ajuste', quantidade: 1.5, motivo: 'Contagem' }],
      ['tipo "venda" (só a Vendas grava)', { tipo: 'venda', quantidade: -1, motivo: 'Contagem' }],
    ])('corpo inválido (%s) devolve 400 e não mexe no saldo', async (_nome, corpoReq) => {
      const p = await criar(a);
      const s = p.skus[0] as { id: string };
      expect((await a.dono.post(`/skus/${s.id}/estoque`, corpoReq)).statusCode).toBe(400);
      expect((await listar(a.dono, p.skus[0]?.codigo)).json.produtos[0]?.skus[0]?.estoque).toBe(5);
    });

    it('SKU inexistente devolve 404; id que não é UUID devolve 400', async () => {
      expect((await a.dono.post(`/skus/${randomUUID()}/estoque`, { tipo: 'entrada', quantidade: 1, motivo: 'Teste' })).statusCode).toBe(404);
      expect((await a.dono.post('/skus/abc/estoque', { tipo: 'entrada', quantidade: 1, motivo: 'Teste' })).statusCode).toBe(400);
    });

    it('registra o evento de auditoria "estoque_ajustado"', async () => {
      const p = await criar(a);
      const s = p.skus[0] as { id: string };
      await a.dono.post(`/skus/${s.id}/estoque`, { tipo: 'entrada', quantidade: 1, motivo: 'Teste' });
      expect(await eventos(s.id)).toEqual(['estoque_ajustado']);
    });

    it('a baixa de uma venda (interface pública) aparece no histórico com a origem', async () => {
      const p = await criar(a);
      const s = p.skus[0] as { id: string };
      const venda = randomUUID();
      await withEmpresa(pool, a.dados.empresaId, (cl) =>
        registrarMovimento(
          cl,
          { empresaId: a.dados.empresaId, autorId: a.dados.donoId, agora: relogio.agora },
          { skuId: s.id, tipo: 'venda', quantidade: -2, motivo: 'Venda', origemId: venda },
        ),
      );
      const ms = (await a.dono.get(`/skus/${s.id}/movimentos`)).json() as { movimentos: { tipo: string; origem_id: string | null }[] };
      expect(ms.movimentos[0]).toMatchObject({ tipo: 'venda', origem_id: venda });
      expect((await listar(a.vendedor, p.skus[0]?.codigo)).json.produtos[0]?.skus[0]?.estoque).toBe(3);
    });
  });

  describe('RF-PRO-05: alertas de estoque abaixo do mínimo (tela inicial do Dono)', () => {
    let lado: Lado;
    beforeAll(async () => {
      lado = await montar('Prod API alertas');
    });
    const alertas = async (cli = lado.dono) =>
      (await cli.get('/estoque/alertas')).json() as {
        total: number;
        itens: { sku_id: string; codigo: string; produto: string; tamanho: string; cor: string; estoque: number; estoque_minimo: number }[];
      };

    it('sem produtos, o aviso é vazio', async () => {
      const novo = await montar('Prod API alertas vazio');
      expect(await alertas(novo.dono)).toEqual({ total: 0, itens: [] });
    });

    it('lista só os SKUs estritamente abaixo do mínimo; igual ao mínimo e mínimo 0 não avisam', async () => {
      const nome = `Alerta ${randomUUID().slice(0, 8)}`;
      const p = await criar(lado, {
        nome,
        skus: [
          sku({ tamanho: 'P', estoque_inicial: 1, estoque_minimo: 3 }), // abaixo: avisa
          sku({ tamanho: 'M', estoque_inicial: 3, estoque_minimo: 3 }), // igual: não avisa
          sku({ tamanho: 'G', estoque_inicial: 0, estoque_minimo: 0 }), // sem mínimo: não avisa
          sku({ tamanho: 'GG', estoque_inicial: 0, estoque_minimo: 2 }), // zerado e abaixo: avisa
        ],
      });
      const r = await alertas();
      const meus = r.itens.filter((i) => i.produto === nome).sort((x, y) => x.tamanho.localeCompare(y.tamanho));
      expect(meus.map((i) => [i.tamanho, i.estoque, i.estoque_minimo])).toEqual([
        ['GG', 0, 2],
        ['P', 1, 3],
      ]);
      expect(meus[0]).toMatchObject({ cor: 'Preto', codigo: p.skus.find((s) => s.codigo.includes('-GG-'))?.codigo });
      expect(r.total).toBe(2);
    });

    it('a entrada de mercadoria tira o SKU do aviso; uma baixa o coloca de volta', async () => {
      const lado2 = await montar('Prod API alertas ciclo');
      const p = await criar(lado2, { skus: [sku({ estoque_inicial: 1, estoque_minimo: 3 })] });
      const s = p.skus[0] as { id: string };
      expect((await lado2.dono.get('/estoque/alertas')).json()).toMatchObject({ total: 1 });
      await lado2.dono.post(`/skus/${s.id}/estoque`, { tipo: 'entrada', quantidade: 2, motivo: 'Reposição' });
      expect((await lado2.dono.get('/estoque/alertas')).json()).toMatchObject({ total: 0 });
      await lado2.dono.post(`/skus/${s.id}/estoque`, { tipo: 'ajuste', quantidade: -1, motivo: 'Perda' });
      expect((await lado2.dono.get('/estoque/alertas')).json()).toMatchObject({ total: 1 });
    });

    it('não mostra SKU de outra empresa', async () => {
      const so = await criar(b, { skus: [sku({ estoque_inicial: 0, estoque_minimo: 5 })] });
      const ids = (await alertas(a.dono)).itens.map((i) => i.sku_id);
      expect(ids).not.toContain(so.skus[0]?.id);
      expect((await alertas(b.dono)).itens.map((i) => i.sku_id)).toContain(so.skus[0]?.id);
    });

    it('com muitos SKUs, o total é o exato e a lista é limitada a 50', async () => {
      const lado3 = await montar('Prod API alertas muitos');
      const tamanhos = Array.from({ length: 12 }, (_, i) => `T${i}`);
      const cores = ['Preto', 'Nude', 'Vinho', 'Azul', 'Rosa', 'Verde'];
      const skus = tamanhos.flatMap((t) => cores.map((cor) => sku({ tamanho: t, cor, estoque_inicial: 0, estoque_minimo: 1 })));
      await criar(lado3, { skus: skus.slice(0, 60) });
      const r = (await lado3.dono.get('/estoque/alertas')).json() as { total: number; itens: unknown[] };
      expect(r.total).toBe(60);
      expect(r.itens).toHaveLength(50);
    });
  });
});
