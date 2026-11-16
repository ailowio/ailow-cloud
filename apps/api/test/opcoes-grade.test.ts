import { randomUUID } from 'node:crypto';
import { CORES_PADRAO, TAMANHOS_PADRAO } from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool, withEmpresa } from '../src/db.js';
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

// ADR 017: tamanhos e cores configuráveis por empresa. Só o Dono; 2 empresas isoladas (RLS); nada é apagado.
// Só afirma sobre ids/nomes criados aqui (L-0008).

interface Opcao {
  id: string;
  nome: string;
  amostra: string | null;
  ativa: boolean;
}
interface Opcoes {
  tamanhos: Opcao[];
  cores: Opcao[];
}

describe('Opções da grade: tamanhos e cores (ADR 017)', () => {
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
    if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
    return { dados: p.empresa, dono: p.dono, vendedor };
  }
  const ler = async (cli: Cliente) => {
    const r = await cli.get('/opcoes-grade');
    expect(r.statusCode).toBe(200);
    return r.json() as Opcoes;
  };
  async function criar(cli: Cliente, corpo: Record<string, unknown>): Promise<string> {
    const r = await cli.post('/opcoes-grade', corpo);
    if (r.statusCode !== 201) throw new Error(`criar opção falhou: ${r.statusCode} ${r.body}`);
    return (r.json() as { id: string }).id;
  }

  let a: Lado;
  let b: Lado;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    app = await appDeTeste(pool, relogio);
    adminCli = await loginAdmin(app, relogio, await semearAdmin(pool));
    a = await montar('Grade A');
    b = await montar('Grade B');
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('padrão na primeira leitura', () => {
    it('empresa nova recebe os tamanhos e as cores de antes (ordem de grade; cores na ordem de cadastro, com amostra)', async () => {
      const o = await ler(a.dono);
      expect(o.tamanhos.map((t) => t.nome)).toEqual([...TAMANHOS_PADRAO]);
      expect(o.cores.map((c) => ({ nome: c.nome, amostra: c.amostra }))).toEqual(CORES_PADRAO);
      expect([...o.tamanhos, ...o.cores].every((x) => x.ativa)).toBe(true);
    });

    it('ler de novo (e em paralelo, noutra empresa nova) não duplica nada', async () => {
      const c = await montar('Grade Paralela');
      const [x, y] = await Promise.all([ler(c.dono), ler(c.dono)]);
      expect(x.tamanhos.length).toBe(TAMANHOS_PADRAO.length);
      expect(y.cores.length).toBe(CORES_PADRAO.length);
      const n = await owner.query('SELECT count(*)::int AS n FROM opcoes_grade WHERE empresa_id = $1', [c.dados.empresaId]);
      expect(n.rows[0].n).toBe(TAMANHOS_PADRAO.length + CORES_PADRAO.length);
      expect((await ler(c.dono)).tamanhos.length).toBe(TAMANHOS_PADRAO.length);
    });

    it('desativar todas as cores não faz a semente voltar (a empresa já tem opções)', async () => {
      const c = await montar('Grade Sem Cor');
      for (const cor of (await ler(c.dono)).cores) {
        expect((await c.dono.put(`/opcoes-grade/${cor.id}`, { nome: cor.nome, amostra: cor.amostra, ativa: false })).statusCode).toBe(204);
      }
      const depois = await ler(c.dono);
      expect(depois.cores.length).toBe(CORES_PADRAO.length);
      expect(depois.cores.every((x) => !x.ativa)).toBe(true);
    });
  });

  describe('criar', () => {
    it('tamanho digitado em minúsculas é gravado em maiúsculas e entra na ordem de grade', async () => {
      const id = await criar(a.dono, { tipo: 'tamanho', nome: 'g1' });
      const o = await ler(a.dono);
      const nomes = o.tamanhos.map((t) => t.nome);
      expect(o.tamanhos.find((t) => t.id === id)?.nome).toBe('G1');
      expect(nomes.indexOf('G1')).toBeGreaterThan(nomes.indexOf('GG'));
    });

    it('tamanho fora da regra do SKU (4+ caracteres, símbolo, vazio) ou com amostra: 400', async () => {
      for (const nome of ['PPPP', 'P-1', '', '  ']) {
        expect((await a.dono.post('/opcoes-grade', { tipo: 'tamanho', nome })).statusCode, nome).toBe(400);
      }
      expect((await a.dono.post('/opcoes-grade', { tipo: 'tamanho', nome: 'XG', amostra: '#000000' })).statusCode).toBe(400);
    });

    it('cor nova com amostra (gravada em minúsculas) vai para o fim da lista', async () => {
      const nome = `Lilás ${randomUUID().slice(0, 6)}`;
      const id = await criar(a.dono, { tipo: 'cor', nome, amostra: '#ABCDEF' });
      const cores = (await ler(a.dono)).cores;
      expect(cores.at(-1)).toEqual({ id, nome, amostra: '#abcdef', ativa: true });
    });

    it('cor sem amostra é aceita; amostra fora do formato é 400', async () => {
      await criar(a.dono, { tipo: 'cor', nome: `Sem Amostra ${randomUUID().slice(0, 6)}` });
      expect((await a.dono.post('/opcoes-grade', { tipo: 'cor', nome: 'Ocre', amostra: 'red' })).statusCode).toBe(400);
    });

    it('repetida é 409 opcao_ja_existe: sem diferenciar maiúsculas nem acento ("Rosa Chá" = "rosa cha")', async () => {
      expect((await a.dono.post('/opcoes-grade', { tipo: 'tamanho', nome: 'p' })).statusCode).toBe(409);
      const s = randomUUID().slice(0, 6);
      await criar(a.dono, { tipo: 'cor', nome: `Rosa Chá ${s}` });
      const r = await a.dono.post('/opcoes-grade', { tipo: 'cor', nome: `rosa  cha ${s}` });
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ erro: 'opcao_ja_existe' });
    });

    it('o mesmo nome pode existir como tamanho e como cor? Não se aplica: tamanho e cor têm regras diferentes; e cada empresa tem as suas', async () => {
      const nome = `Exclusiva ${randomUUID().slice(0, 6)}`;
      await criar(a.dono, { tipo: 'cor', nome });
      expect((await ler(b.dono)).cores.map((c) => c.nome)).not.toContain(nome);
      await criar(b.dono, { tipo: 'cor', nome }); // a outra empresa pode ter o mesmo nome
    });

    it('registra a criação na trilha (AUD-10)', async () => {
      const id = await criar(a.dono, { tipo: 'cor', nome: `Trilha ${randomUUID().slice(0, 6)}` });
      const r = await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1', [id]);
      expect(r.rows.map((x) => x.tipo)).toContain('opcao_grade_criada');
    });
  });

  describe('alterar', () => {
    it('renomeia, troca a amostra e desativa uma cor; ela continua listada como inativa', async () => {
      const s = randomUUID().slice(0, 6);
      const id = await criar(a.dono, { tipo: 'cor', nome: `Marsala ${s}`, amostra: '#800000' });
      const r = await a.dono.put(`/opcoes-grade/${id}`, { nome: `Marsala Escuro ${s}`, amostra: '#5a0000', ativa: false });
      expect(r.statusCode).toBe(204);
      expect((await ler(a.dono)).cores.find((c) => c.id === id)).toEqual({
        id,
        nome: `Marsala Escuro ${s}`,
        amostra: '#5a0000',
        ativa: false,
      });
      const ev = await owner.query('SELECT tipo FROM eventos_acesso WHERE alvo_id = $1', [id]);
      expect(ev.rows.map((x) => x.tipo)).toContain('opcao_grade_alterada');
    });

    it('tamanho segue a regra do SKU ao renomear (e é gravado em maiúsculas); tamanho com amostra é 400', async () => {
      const id = await criar(a.dono, { tipo: 'tamanho', nome: 'XGG' });
      expect((await a.dono.put(`/opcoes-grade/${id}`, { nome: 'Preto', amostra: null, ativa: true })).statusCode).toBe(400);
      expect((await a.dono.put(`/opcoes-grade/${id}`, { nome: 'xg', amostra: '#000000', ativa: true })).statusCode).toBe(400);
      expect((await a.dono.put(`/opcoes-grade/${id}`, { nome: 'eg', amostra: null, ativa: true })).statusCode).toBe(204);
      expect((await ler(a.dono)).tamanhos.find((t) => t.id === id)?.nome).toBe('EG');
    });

    it('renomear para um nome que já existe é 409 e nada muda', async () => {
      const s = randomUUID().slice(0, 6);
      await criar(a.dono, { tipo: 'cor', nome: `Areia ${s}` });
      const id = await criar(a.dono, { tipo: 'cor', nome: `Duna ${s}` });
      expect((await a.dono.put(`/opcoes-grade/${id}`, { nome: `areia ${s}`, amostra: null, ativa: true })).statusCode).toBe(409);
      expect((await ler(a.dono)).cores.find((c) => c.id === id)?.nome).toBe(`Duna ${s}`);
    });

    it('opção inexistente ou de outra empresa: 404 e a outra empresa não muda', async () => {
      const idB = await criar(b.dono, { tipo: 'cor', nome: `So B ${randomUUID().slice(0, 6)}` });
      expect((await a.dono.put(`/opcoes-grade/${idB}`, { nome: 'Invasor', amostra: null, ativa: false })).statusCode).toBe(404);
      expect((await a.dono.put(`/opcoes-grade/${randomUUID()}`, { nome: 'X', amostra: null, ativa: true })).statusCode).toBe(404);
      expect((await ler(b.dono)).cores.find((c) => c.id === idB)?.ativa).toBe(true);
    });
  });

  describe('autorização (2 empresas × 2 perfis)', () => {
    it('sem sessão: 401 em ler, criar e alterar', async () => {
      const anon = new Cliente(app);
      expect((await anon.get('/opcoes-grade')).statusCode).toBe(401);
      expect((await anon.post('/opcoes-grade', { tipo: 'cor', nome: 'X' })).statusCode).toBe(401);
      expect((await anon.put(`/opcoes-grade/${randomUUID()}`, { nome: 'X', amostra: null, ativa: true })).statusCode).toBe(401);
    });

    it('o Vendedor não lê, não cria e não altera (403), e nada é criado', async () => {
      const nome = `Do Vendedor ${randomUUID().slice(0, 6)}`;
      expect((await a.vendedor.get('/opcoes-grade')).statusCode).toBe(403);
      expect((await a.vendedor.post('/opcoes-grade', { tipo: 'cor', nome })).statusCode).toBe(403);
      const cor = (await ler(a.dono)).cores[0] as Opcao;
      expect((await a.vendedor.put(`/opcoes-grade/${cor.id}`, { nome: 'X', amostra: null, ativa: false })).statusCode).toBe(403);
      expect((await ler(a.dono)).cores.map((c) => c.nome)).not.toContain(nome);
    });

    it('empresa_id no corpo é recusado (corpo estrito): 400', async () => {
      const r = await a.dono.post('/opcoes-grade', { tipo: 'cor', nome: 'Com Empresa', empresa_id: b.dados.empresaId });
      expect(r.statusCode).toBe(400);
    });
  });

  describe('banco (ADR 002): RLS forçada e sem DELETE para o papel da aplicação', () => {
    it('o papel da aplicação não apaga opção (nada é apagado)', async () => {
      const id = (await ler(a.dono)).cores[0]?.id as string;
      await expect(
        withEmpresa(pool, a.dados.empresaId, (c) => c.query('DELETE FROM opcoes_grade WHERE id = $1', [id])),
      ).rejects.toThrow(/permission denied/);
    });

    it('no contexto da empresa B, as opções da A não aparecem', async () => {
      const idsA = new Set([...(await ler(a.dono)).cores, ...(await ler(a.dono)).tamanhos].map((x) => x.id));
      const r = await withEmpresa(pool, b.dados.empresaId, (c) => c.query('SELECT id FROM opcoes_grade'));
      expect(r.rows.filter((x) => idsA.has(x.id as string))).toEqual([]);
    });

    it('tamanho fora da regra é recusado pelo próprio banco', async () => {
      await expect(
        withEmpresa(pool, a.dados.empresaId, (c) =>
          c.query("INSERT INTO opcoes_grade (empresa_id, tipo, nome) VALUES ($1, 'tamanho', 'pppp')", [a.dados.empresaId]),
        ),
      ).rejects.toThrow(/check/);
    });
  });
});
