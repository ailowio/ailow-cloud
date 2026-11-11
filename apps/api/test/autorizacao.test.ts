import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  Cliente,
  type EmpresaDeTeste,
  PIN_DONO,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// TEST-17 / RN-10 / RNF-06: 2 empresas × 2 perfis. Ninguém lê nem altera dados da outra empresa,
// e o Vendedor nunca passa pelas rotas de gestão (que são as mesmas que Financeiro, Compras,
// Configurações e custo vão usar: `exigirPerfil('dono')`).
describe('autorização entre empresas e perfis', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;

  interface Ator {
    nome: string;
    perfil: 'dono' | 'vendedor';
    empresa: 'A' | 'B';
    cli: Cliente;
    usuarioId: string;
  }
  const atores: Ator[] = [];
  const emp: Record<'A' | 'B', { dados: EmpresaDeTeste; vendedorId: string; donoCli: Cliente }> = {} as never;

  const outra = (e: 'A' | 'B') => (e === 'A' ? 'B' : 'A');

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    const relogio = new Relogio();
    app = await appDeTeste(pool, relogio);
    const adm = await semearAdmin(pool);
    const adminCli = await loginAdmin(app, relogio, adm);

    for (const e of ['A', 'B'] as const) {
      const p = await prepararEmpresa(app, adminCli, `Empresa ${e}`);
      emp[e] = { dados: p.empresa, vendedorId: p.vendedorId, donoCli: p.dono };
      // O Dono já está com sessão aberta (entrou por e-mail + senha).
      atores.push({ nome: `Dono ${e}`, perfil: 'dono', empresa: e, cli: p.dono, usuarioId: p.empresa.donoId });
      // O Vendedor entra com PIN, no PRÓPRIO aparelho (senão encerraria a sessão do Dono).
      const v = await novoAparelho(app, p.empresa);
      const r = await v.post('/acesso/pin', { usuario_id: p.vendedorId, pin: PIN_VENDEDOR });
      if (r.statusCode !== 200) throw new Error(`PIN do vendedor falhou: ${r.statusCode}`);
      atores.push({ nome: `Vendedor ${e}`, perfil: 'vendedor', empresa: e, cli: v, usuarioId: p.vendedorId });
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  const ator = (empresa: 'A' | 'B', perfil: 'dono' | 'vendedor') => {
    const a = atores.find((x) => x.empresa === empresa && x.perfil === perfil);
    if (!a) throw new Error('ator não encontrado');
    return a;
  };
  const todos = [
    ['Dono A', 'A', 'dono'],
    ['Vendedor A', 'A', 'vendedor'],
    ['Dono B', 'B', 'dono'],
    ['Vendedor B', 'B', 'vendedor'],
  ] as const;

  describe.each(todos)('%s', (_nome, empresa, perfil) => {
    it('GET /acesso/eu devolve a si mesmo (nunca outro usuário)', async () => {
      const a = ator(empresa, perfil);
      const res = await a.cli.get('/acesso/eu');
      expect(res.statusCode).toBe(200);
      expect((res.json() as { usuario: { id: string } }).usuario.id).toBe(a.usuarioId);
    });

    if (perfil === 'dono') {
      it('GET /usuarios lista só os usuários da própria empresa', async () => {
        const res = await ator(empresa, perfil).cli.get('/usuarios');
        expect(res.statusCode).toBe(200);
        const ids = (res.json() as { usuarios: { id: string }[] }).usuarios.map((u) => u.id).sort();
        expect(ids).toEqual([emp[empresa].dados.donoId, emp[empresa].vendedorId].sort());
      });

      it('ações sobre usuário de OUTRA empresa dão 404 e não surtem efeito', async () => {
        const a = ator(empresa, perfil);
        const alvo = emp[outra(empresa)].vendedorId;
        const antes = await owner.query('SELECT ativo, pin_hash, pin_falhas, bloqueado_em FROM usuarios WHERE id = $1', [alvo]);
        for (const [metodo, rota, corpo] of [
          ['POST', `/usuarios/${alvo}/derrubar-sessoes`, {}],
          ['POST', `/usuarios/${alvo}/desbloquear`, {}],
          ['POST', `/usuarios/${alvo}/desativar`, {}],
          ['PUT', `/usuarios/${alvo}/pin`, { pin: '9999' }],
        ] as const) {
          const res = await a.cli.req(metodo, rota, corpo);
          expect(res.statusCode, `${metodo} ${rota}`).toBe(404);
        }
        const vend = ator(outra(empresa), 'vendedor');
        expect((await vend.cli.get('/acesso/eu')).statusCode).toBe(200); // sessão dele não caiu
        const depois = await owner.query('SELECT ativo, pin_hash, pin_falhas, bloqueado_em FROM usuarios WHERE id = $1', [alvo]);
        expect(depois.rows[0]).toEqual({ ...antes.rows[0] });
        expect(depois.rows[0].ativo).toBe(true);
      });

      it('empresa_id enviado no corpo, na query ou em cabeçalho é ignorado: vale a da sessão', async () => {
        const a = ator(empresa, perfil);
        const outraId = emp[outra(empresa)].dados.empresaId;
        const r = await a.cli.req(
          'POST',
          `/usuarios?empresa_id=${outraId}`,
          { nome: 'Plantada', pin: '5678', empresa_id: outraId },
          { 'x-empresa-id': outraId },
        );
        expect(r.statusCode).toBe(201);
        const id = (r.json() as { id: string }).id;
        const row = await owner.query('SELECT empresa_id FROM usuarios WHERE id = $1', [id]);
        expect(row.rows[0].empresa_id).toBe(emp[empresa].dados.empresaId);

        const lista = await a.cli.req('GET', `/usuarios?empresa_id=${outraId}`, undefined, {
          'x-empresa-id': outraId,
        });
        const ids = (lista.json() as { usuarios: { id: string }[] }).usuarios.map((u) => u.id);
        expect(ids).toContain(id);
        expect(ids).not.toContain(emp[outra(empresa)].dados.donoId);
      });
    } else {
      it('é barrado (403) em TODAS as rotas de gestão, sem vazar dados', async () => {
        const a = ator(empresa, perfil);
        const alvo = emp[empresa].dados.donoId;
        const chamadas = [
          ['GET', '/usuarios', undefined],
          ['POST', '/usuarios', { nome: 'X', pin: '1212' }],
          ['POST', `/usuarios/${alvo}/derrubar-sessoes`, {}],
          ['POST', `/usuarios/${alvo}/desbloquear`, {}],
          ['POST', `/usuarios/${alvo}/desativar`, {}],
          ['PUT', `/usuarios/${alvo}/pin`, { pin: '9999' }],
        ] as const;
        for (const [metodo, rota, corpo] of chamadas) {
          const res = await a.cli.req(metodo, rota, corpo);
          expect(res.statusCode, `${metodo} ${rota}`).toBe(403);
          expect(res.json()).toEqual({ erro: 'sem_permissao' });
        }
        // O Dono continua intacto.
        const row = await owner.query('SELECT ativo FROM usuarios WHERE id = $1', [alvo]);
        expect(row.rows[0].ativo).toBe(true);
      });
    }

    it('PIN de usuário da OUTRA empresa, no aparelho desta, não abre sessão', async () => {
      const a = ator(empresa, perfil);
      const ap = a.cli.somenteAparelho();
      const alvo = emp[outra(empresa)].vendedorId;
      const res = await ap.post('/acesso/pin', { usuario_id: alvo, pin: PIN_VENDEDOR });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ erro: 'pin_invalido' });
    });

    it('trocar o prefixo de empresa do cookie por outra empresa não autentica', async () => {
      const a = ator(empresa, perfil);
      const segredo = (a.cli.jar.get('sessao') as string).split('.')[1];
      const forjado = new Cliente(app);
      forjado.jar.set('sessao', `${emp[outra(empresa)].dados.empresaId}.${segredo}`);
      expect((await forjado.get('/acesso/eu')).statusCode).toBe(401);
    });
  });

  it('rotas protegidas sem sessão: 401', async () => {
    const semSessao = new Cliente(app);
    const id = emp.A.vendedorId;
    for (const [metodo, rota] of [
      ['GET', '/acesso/eu'],
      ['POST', '/acesso/sair'],
      ['PUT', '/acesso/meu-pin'],
      ['GET', '/usuarios'],
      ['POST', '/usuarios'],
      ['POST', `/usuarios/${id}/derrubar-sessoes`],
      ['POST', `/usuarios/${id}/desbloquear`],
      ['POST', `/usuarios/${id}/desativar`],
      ['PUT', `/usuarios/${id}/pin`],
    ] as const) {
      const res = await semSessao.req(metodo, rota, metodo === 'GET' ? undefined : {});
      expect(res.statusCode, `${metodo} ${rota}`).toBe(401);
    }
  });

  it('o Dono de uma empresa não enxerga a trilha nem as sessões da outra (via banco, papel de runtime)', async () => {
    // Prova de ponta a ponta no banco: depois de toda a atividade acima, a empresa A só vê o que é dela.
    const { withEmpresa } = await import('../src/db.js');
    const idsA = emp.A.dados.empresaId;
    const resultado = await withEmpresa(pool, idsA, async (c) => {
      const s = await c.query('SELECT DISTINCT empresa_id FROM sessoes');
      const ev = await c.query('SELECT DISTINCT empresa_id FROM eventos_acesso');
      const u = await c.query('SELECT DISTINCT empresa_id FROM usuarios');
      return [s.rows, ev.rows, u.rows];
    });
    for (const linhas of resultado) expect(linhas).toEqual([{ empresa_id: idsA }]);
  });

  it('PIN_DONO e PIN_VENDEDOR são diferentes (guarda do próprio teste)', () => {
    expect(PIN_DONO).not.toBe(PIN_VENDEDOR);
  });
});
