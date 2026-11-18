import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CORES_PADRAO, MAX_EIXOS_POR_CATEGORIA, TAMANHOS_PADRAO } from '@ailow/shared';
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

describe('Eixos de grade (biblioteca + categoria)', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let adminCli: Cliente;
  const relogio = new Relogio();

  interface Lado {
    dados: EmpresaDeTeste;
    dono: Cliente;
    vendedor: Cliente;
  }

  async function montar(nome: string): Promise<Lado> {
    const p = await prepararEmpresa(app, adminCli, nome);
    const vendedor = await novoAparelho(app, p.empresa);
    const r = await vendedor.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
    if (r.statusCode !== 200) throw new Error(`PIN falhou: ${r.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor };
  }

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Eixos A');
    b = await montar('Eixos B');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  it('1ª leitura semeia Tamanho e Cor com valores padrão', async () => {
    const r = await a.dono.get('/eixos-grade');
    if (r.statusCode !== 200) throw new Error(`GET eixos: ${r.statusCode} ${r.body}`);
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      eixos: { slug: string; sistema: boolean; valores: { nome: string }[] }[];
    };
    const tam = body.eixos.find((e) => e.slug === 'tamanho');
    const cor = body.eixos.find((e) => e.slug === 'cor');
    expect(tam?.sistema).toBe(true);
    expect(cor?.sistema).toBe(true);
    expect(tam?.valores.map((v) => v.nome)).toEqual([...TAMANHOS_PADRAO]);
    expect(cor?.valores.map((v) => v.nome)).toEqual(CORES_PADRAO.map((c) => c.nome));
  });

  it('vendedor não muta; duas empresas não vazam', async () => {
    expect((await a.vendedor.get('/eixos-grade')).statusCode).toBe(403);
    const criado = await a.dono.post('/eixos-grade', { nome: 'Taça', tipo_valor: 'texto' });
    if (criado.statusCode !== 201) throw new Error(`criar eixo: ${criado.statusCode} ${criado.body}`);
    expect(criado.statusCode).toBe(201);
    const id = (criado.json() as { id: string }).id;
    const naB = await b.dono.get('/eixos-grade');
    expect(naB.statusCode).toBe(200);
    const eixosB = (naB.json() as { eixos: { id: string }[] }).eixos.map((e) => e.id);
    expect(eixosB).not.toContain(id);
  });

  it('cria valores no eixo custom e liga na categoria (máx 4)', async () => {
    const eixos = (await a.dono.get('/eixos-grade')).json() as {
      eixos: { id: string; slug: string }[];
    };
    const taca = eixos.eixos.find((e) => e.slug === 'taca');
    expect(taca).toBeTruthy();
    expect((await a.dono.post(`/eixos-grade/${taca!.id}/valores`, { nome: 'A' })).statusCode).toBe(201);
    expect((await a.dono.post(`/eixos-grade/${taca!.id}/valores`, { nome: 'B' })).statusCode).toBe(201);

    const cat = await a.dono.post('/categorias', {
      nome: `Sutiã Eixos ${relogio.agora.getTime()}`,
      tipo: 'produto',
      atributos: ['bojo'],
    });
    expect(cat.statusCode).toBe(201);
    const catId = (cat.json() as { id: string }).id;

    // força semente de vínculos padrão
    await a.dono.get('/eixos-grade');
    const tam = eixos.eixos.find((e) => e.slug === 'tamanho')!;
    const cor = eixos.eixos.find((e) => e.slug === 'cor')!;
    const put = await a.dono.put(`/categorias/${catId}/eixos`, {
      eixos: [
        { eixo_id: tam.id, seq: 0 },
        { eixo_id: cor.id, seq: 1 },
        { eixo_id: taca!.id, seq: 2 },
      ],
    });
    expect(put.statusCode).toBe(204);

    const lidos = await a.dono.get(`/categorias/${catId}/eixos`);
    expect(lidos.statusCode).toBe(200);
    expect((lidos.json() as { eixos: unknown[] }).eixos).toHaveLength(3);

    const extras = Array.from({ length: MAX_EIXOS_POR_CATEGORIA + 1 }, (_, i) => ({
      nome: `EixoX${i}`,
      tipo_valor: 'texto' as const,
    }));
    const ids: string[] = [];
    for (const e of extras) {
      const r = await a.dono.post('/eixos-grade', e);
      if (r.statusCode === 201) ids.push((r.json() as { id: string }).id);
    }
    const demais = await a.dono.put(`/categorias/${catId}/eixos`, {
      eixos: ids.slice(0, MAX_EIXOS_POR_CATEGORIA + 1).map((eixo_id, seq) => ({ eixo_id, seq })),
    });
    expect(demais.statusCode).toBe(400);
  });

  it('desativa valor (sem DELETE) e recusa amostra em eixo texto', async () => {
    const eixos = (await a.dono.get('/eixos-grade')).json() as {
      eixos: { id: string; slug: string; valores: { id: string; nome: string }[] }[];
    };
    const taca = eixos.eixos.find((e) => e.slug === 'taca')!;
    const valorA = taca.valores.find((v) => v.nome === 'A')!;
    expect(
      (await a.dono.put(`/eixos-grade/valores/${valorA.id}`, { nome: 'A', amostra: null, ativa: false })).statusCode,
    ).toBe(204);
    expect((await a.dono.post(`/eixos-grade/${taca.id}/valores`, { nome: 'C', amostra: '#111111' })).statusCode).toBe(
      400,
    );
  });
});
