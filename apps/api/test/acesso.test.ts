import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  type AdminDeTeste,
  Cliente,
  type EmpresaDeTeste,
  PIN_DONO,
  PIN_VENDEDOR,
  Relogio,
  adminPool,
  appDeTeste,
  criarEmpresaPelaApi,
  loginAdmin,
  novoAparelho,
  prepararEmpresa,
  semearAdmin,
} from './helpers.js';

// RF-ACE-02…05 e RF-ACE-08, RN-09. As rotas de Admin têm seus próprios testes (admin.test.ts).
describe('Acesso de empresa', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let relogio: Relogio;
  let adm: AdminDeTeste;
  let adminCli: Cliente;
  const linhasDeLog: string[] = [];

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    relogio = new Relogio();
    const stream = new Writable({
      write(chunk, _e, cb) {
        linhasDeLog.push(chunk.toString());
        cb();
      },
    });
    app = await appDeTeste(pool, relogio, { logger: { level: 'info', stream } });
    adm = await semearAdmin(pool);
    adminCli = await loginAdmin(app, relogio, adm);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  // Sessão do Admin nova a cada empresa: o relógio avança nos testes e a anterior pode ter expirado.
  async function novaEmpresa(nome: string) {
    adminCli = await loginAdmin(app, relogio, adm);
    return prepararEmpresa(app, adminCli, nome);
  }

  async function eventos(empresaId: string) {
    const r = await owner.query('SELECT tipo, ator_tipo FROM eventos_acesso WHERE empresa_id = $1 ORDER BY id', [
      empresaId,
    ]);
    return r.rows as { tipo: string; ator_tipo: string }[];
  }

  describe('entrar com e-mail + senha (RF-ACE-02)', () => {
    let e: EmpresaDeTeste;
    beforeAll(async () => {
      adminCli = await loginAdmin(app, relogio, adm);
      e = await criarEmpresaPelaApi(adminCli, 'Loja Entrar');
    });

    it('entra, vincula o aparelho e abre a sessão com cookies httpOnly/Secure/SameSite=Strict', async () => {
      const c = new Cliente(app);
      const res = await c.post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        usuario: { id: e.donoId, nome: 'Dono Loja Entrar', perfil: 'dono' },
        precisa_definir_pin: true,
      });
      const ap = res.cookies.find((x) => x.name === 'aparelho');
      const se = res.cookies.find((x) => x.name === 'sessao');
      for (const ck of [ap, se]) {
        expect(ck).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
        expect(ck?.value.startsWith(`${e.empresaId}.`)).toBe(true);
      }
      expect(ap?.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
      // Cookie de sessão: some ao fechar o navegador (sem validade própria).
      expect(se?.maxAge).toBeUndefined();
      expect(se?.expires).toBeUndefined();
    });

    it('nada de hash ou segredo na resposta', async () => {
      const res = await new Cliente(app).post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect(res.body).not.toMatch(/argon2|hash|senha/i);
    });

    it('e-mail com caixa/espaços diferentes entra do mesmo jeito', async () => {
      const res = await new Cliente(app).post('/acesso/entrar', { email: `  ${e.email.toUpperCase()} `, senha: e.senha });
      expect(res.statusCode).toBe(200);
    });

    it('senha errada e e-mail desconhecido dão a MESMA resposta e nenhum cookie', async () => {
      const a = new Cliente(app);
      const b = new Cliente(app);
      const ra = await a.post('/acesso/entrar', { email: e.email, senha: 'senha-errada-qualquer' });
      const rb = await b.post('/acesso/entrar', { email: 'ninguem@loja.test', senha: 'senha-errada-qualquer' });
      expect(ra.statusCode).toBe(401);
      expect(rb.statusCode).toBe(401);
      expect(ra.body).toBe(rb.body);
      expect(a.jar.size + b.jar.size).toBe(0);
    });

    it('entrar de novo no mesmo aparelho reaproveita o aparelho vinculado', async () => {
      const c = new Cliente(app);
      await c.post('/acesso/entrar', { email: e.email, senha: e.senha });
      const antes = c.jar.get('aparelho');
      await c.post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect(c.jar.get('aparelho')).toBe(antes);
    });

    it('registra login e falha de login na trilha, sem senha', async () => {
      await new Cliente(app).post('/acesso/entrar', { email: e.email, senha: 'senha-errada-qualquer' });
      const tipos = (await eventos(e.empresaId)).map((x) => x.tipo);
      expect(tipos).toContain('login');
      expect(tipos).toContain('login_falha');
    });

    it('a senha digitada não aparece nos logs (SEC-16)', async () => {
      linhasDeLog.length = 0;
      await new Cliente(app).post('/acesso/entrar', { email: e.email, senha: 'senha-sigilosa-9999' });
      await new Cliente(app).post('/acesso/entrar', { email: e.email, senha: e.senha });
      const tudo = linhasDeLog.join('');
      expect(tudo).not.toContain('senha-sigilosa-9999');
      expect(tudo).not.toContain(e.senha);
    });

    it('corpo que não é JSON é recusado (415) — reduz CSRF por formulário', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/acesso/entrar',
        payload: `email=${e.email}&senha=${e.senha}`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });
      expect(res.statusCode).toBe(415);
    });

    it('define o PIN do Dono com a senha; senha errada ou PIN inválido não definem', async () => {
      const c = new Cliente(app);
      await c.post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect((await c.put('/acesso/meu-pin', { senha: 'senha-errada-qualquer', pin: '1234' })).statusCode).toBe(401);
      expect((await c.put('/acesso/meu-pin', { senha: e.senha, pin: '12' })).statusCode).toBe(400);
      expect((await c.put('/acesso/meu-pin', { senha: e.senha, pin: '0042' })).statusCode).toBe(204);
      const de = await c.post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect((de.json() as { precisa_definir_pin: boolean }).precisa_definir_pin).toBe(false);
      const row = await owner.query('SELECT pin_hash FROM usuarios WHERE id = $1', [e.donoId]);
      expect(row.rows[0].pin_hash.startsWith('$argon2id$')).toBe(true);
    });

    it('definir PIN sem sessão: 401', async () => {
      expect((await new Cliente(app).put('/acesso/meu-pin', { senha: e.senha, pin: '1234' })).statusCode).toBe(401);
    });
  });

  describe('"Quem está usando?" e PIN (RF-ACE-03)', () => {
    let dono: Cliente;
    let vendedorId: string;
    let empresa: EmpresaDeTeste;
    beforeAll(async () => {
      ({ dono, vendedorId, empresa } = await novaEmpresa('Loja Pin'));
    });

    it('sem aparelho vinculado: não lista usuários nem aceita PIN', async () => {
      const sem = new Cliente(app);
      expect((await sem.get('/acesso/usuarios')).statusCode).toBe(401);
      expect((await sem.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR })).statusCode).toBe(401);
    });

    it('lista só id, nome, perfil e bloqueado dos usuários ativos com PIN', async () => {
      const res = await dono.somenteAparelho().get('/acesso/usuarios');
      expect(res.statusCode).toBe(200);
      const { usuarios } = res.json() as { usuarios: Record<string, unknown>[] };
      expect(usuarios.map((u) => u.perfil).sort()).toEqual(['dono', 'vendedor']);
      for (const u of usuarios) expect(Object.keys(u).sort()).toEqual(['bloqueado', 'id', 'nome', 'perfil']);
    });

    it('PIN certo abre a sessão daquela pessoa (Vendedor)', async () => {
      const c = dono.somenteAparelho();
      const res = await c.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect(res.statusCode).toBe(200);
      expect(res.cookies.find((x) => x.name === 'sessao')).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
      });
      const eu = await c.get('/acesso/eu');
      expect((eu.json() as { usuario: { id: string; perfil: string } }).usuario).toMatchObject({
        id: vendedorId,
        perfil: 'vendedor',
      });
    });

    it('trocar de pessoa no aparelho encerra a sessão da anterior', async () => {
      const a = dono.somenteAparelho();
      await a.post('/acesso/pin', { usuario_id: empresa.donoId, pin: PIN_DONO });
      const sessaoDoDono = a.jar.get('sessao') as string;
      expect((await a.get('/acesso/eu')).statusCode).toBe(200);
      await a.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      const velho = a.somenteAparelho();
      velho.jar.set('sessao', sessaoDoDono);
      expect((await velho.get('/acesso/eu')).statusCode).toBe(401);
    });

    it('PIN inválido (formato) é 400; usuário inexistente é 401 sem revelar nada', async () => {
      const c = dono.somenteAparelho();
      expect((await c.post('/acesso/pin', { usuario_id: vendedorId, pin: 'abcd' })).statusCode).toBe(400);
      const r = await c.post('/acesso/pin', { usuario_id: '00000000-0000-4000-8000-000000000000', pin: '1234' });
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual({ erro: 'pin_invalido' });
    });

    it('o PIN em texto não aparece nos logs (SEC-16)', async () => {
      // L-0011: não use substring solta no log inteiro (time/UUID podem conter "1357" por acaso).
      // Parseia cada linha JSON e garante que nenhum valor de campo string é exatamente o PIN;
      // também rejeita "pin":"<valor>" se o corpo do request vazasse para o log.
      linhasDeLog.length = 0;
      await dono.somenteAparelho().post('/acesso/pin', { usuario_id: vendedorId, pin: '9876' });
      await dono.somenteAparelho().post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      for (const pin of ['9876', PIN_VENDEDOR]) {
        expect(linhasDeLog.join('')).not.toContain(`"pin":"${pin}"`);
        for (const linha of linhasDeLog) {
          let obj: unknown;
          try {
            obj = JSON.parse(linha);
          } catch {
            expect(linha).not.toContain(`"pin":"${pin}"`);
            continue;
          }
          const valores: unknown[] = [];
          const coletar = (v: unknown) => {
            if (v === null || typeof v !== 'object') {
              valores.push(v);
              return;
            }
            for (const x of Object.values(v as Record<string, unknown>)) coletar(x);
          };
          coletar(obj);
          expect(valores.some((v) => v === pin)).toBe(false);
        }
      }
    });
  });

  describe('5 PINs errados bloqueiam o usuário (RF-ACE-05, RN-09)', () => {
    let dono: Cliente;
    let vendedorId: string;
    let empresa: EmpresaDeTeste;
    let aparelho: Cliente;
    beforeAll(async () => {
      ({ dono, vendedorId, empresa } = await novaEmpresa('Loja Bloqueio'));
      aparelho = dono.somenteAparelho();
    });

    const errado = (c: Cliente, id: string) => c.post('/acesso/pin', { usuario_id: id, pin: '0000' });

    it('conta as tentativas, bloqueia na 5ª e mesmo o PIN certo deixa de valer', async () => {
      const restantes: (number | undefined)[] = [];
      for (let i = 0; i < 4; i++) {
        const r = await errado(aparelho, vendedorId);
        expect(r.statusCode).toBe(401);
        restantes.push((r.json() as { tentativas_restantes?: number }).tentativas_restantes);
      }
      expect(restantes).toEqual([4, 3, 2, 1]);

      const quinta = await errado(aparelho, vendedorId);
      expect(quinta.statusCode).toBe(423);
      expect(quinta.json()).toEqual({ erro: 'usuario_bloqueado' });

      const certo = await aparelho.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect(certo.statusCode).toBe(423);
      expect(certo.cookies.find((x) => x.name === 'sessao')).toBeUndefined();

      const lista = (await aparelho.get('/acesso/usuarios')).json() as {
        usuarios: { id: string; bloqueado: boolean }[];
      };
      expect(lista.usuarios.find((u) => u.id === vendedorId)?.bloqueado).toBe(true);
    });

    it('só o Dono desbloqueia; depois disso o PIN certo entra e o contador zera', async () => {
      // O Vendedor bloqueado não tem sessão; quem desbloqueia é o Dono (sessão do `dono`).
      const r = await dono.post(`/usuarios/${vendedorId}/desbloquear`);
      expect(r.statusCode).toBe(204);
      const ok = await aparelho.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect(ok.statusCode).toBe(200);

      // Acertar zera a contagem: 2 erros + acerto + 1 erro => restantes volta a 4.
      await errado(aparelho, vendedorId);
      await errado(aparelho, vendedorId);
      await aparelho.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      const depois = await errado(aparelho, vendedorId);
      expect((depois.json() as { tentativas_restantes: number }).tentativas_restantes).toBe(4);
    });

    it('registra falhas, bloqueio e desbloqueio na trilha (AUD-10)', async () => {
      const tipos = (await eventos(empresa.empresaId)).map((x) => x.tipo);
      expect(tipos.filter((t) => t === 'pin_falha').length).toBeGreaterThanOrEqual(5);
      expect(tipos).toContain('bloqueio');
      expect(tipos).toContain('desbloqueio');
    });

    it('tentativas simultâneas não furam o limite: no máximo 4 respostas 401 antes do bloqueio', async () => {
      const { dono: d2, vendedorId: v2 } = await novaEmpresa('Loja Concorrente');
      const ap = d2.somenteAparelho();
      const respostas = await Promise.all(Array.from({ length: 12 }, () => errado(ap, v2)));
      const codigos = respostas.map((r) => r.statusCode);
      expect(codigos.filter((c) => c === 401).length).toBe(4);
      expect(codigos.filter((c) => c === 423).length).toBe(8);
      const row = await owner.query('SELECT pin_falhas, bloqueado_em FROM usuarios WHERE id = $1', [v2]);
      expect(row.rows[0].pin_falhas).toBe(5);
      expect(row.rows[0].bloqueado_em).not.toBeNull();
    });
  });

  describe('sessão no servidor: inatividade e validade (RF-ACE-04)', () => {
    let dono: Cliente;
    let empresa: EmpresaDeTeste;
    beforeAll(async () => {
      ({ dono, empresa } = await novaEmpresa('Loja Inatividade'));
    });

    it('o uso renova a sessão; ficar parado além do limite (5 min) a derruba', async () => {
      const c = dono.somenteAparelho();
      await c.post('/acesso/pin', { usuario_id: empresa.donoId, pin: PIN_DONO });
      relogio.avancarMinutos(4);
      expect((await c.get('/acesso/eu')).statusCode).toBe(200);
      relogio.avancarMinutos(4);
      expect((await c.get('/acesso/eu')).statusCode).toBe(200);
      relogio.avancarMinutos(6);
      const r = await c.get('/acesso/eu');
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual({ erro: 'nao_autenticado' });
      // O aparelho continua vinculado: volta para "Quem está usando?".
      expect((await c.get('/acesso/usuarios')).statusCode).toBe(200);
    });

    it('o limite vem da empresa (configurável), não de uma constante', async () => {
      await owner.query('UPDATE empresas SET inatividade_minutos = 1 WHERE id = $1', [empresa.empresaId]);
      const c = dono.somenteAparelho();
      await c.post('/acesso/pin', { usuario_id: empresa.donoId, pin: PIN_DONO });
      relogio.avancarMinutos(2);
      expect((await c.get('/acesso/eu')).statusCode).toBe(401);
      await owner.query('UPDATE empresas SET inatividade_minutos = 5 WHERE id = $1', [empresa.empresaId]);
    });

    it('mesmo com uso contínuo a sessão morre em 12 h (validade absoluta)', async () => {
      await owner.query('UPDATE empresas SET inatividade_minutos = 120 WHERE id = $1', [empresa.empresaId]);
      const c = dono.somenteAparelho();
      await c.post('/acesso/pin', { usuario_id: empresa.donoId, pin: PIN_DONO });
      for (let i = 0; i < 6; i++) {
        relogio.avancarMinutos(119);
        expect((await c.get('/acesso/eu')).statusCode).toBe(200);
      }
      relogio.avancarMinutos(119); // ~13 h desde o login
      expect((await c.get('/acesso/eu')).statusCode).toBe(401);
      await owner.query('UPDATE empresas SET inatividade_minutos = 5 WHERE id = $1', [empresa.empresaId]);
    });

    it('cookie adulterado ou com empresa trocada não autentica', async () => {
      const c = dono.somenteAparelho();
      await c.post('/acesso/pin', { usuario_id: empresa.donoId, pin: PIN_DONO });
      const token = c.jar.get('sessao') as string;
      const adulterado = new Cliente(app);
      adulterado.jar.set('sessao', `${token.slice(0, -2)}xx`);
      expect((await adulterado.get('/acesso/eu')).statusCode).toBe(401);
      const outraEmpresa = new Cliente(app);
      outraEmpresa.jar.set('sessao', `00000000-0000-4000-8000-000000000000.${token.split('.')[1]}`);
      expect((await outraEmpresa.get('/acesso/eu')).statusCode).toBe(401);
    });
  });

  describe('sair e derrubar sessões (RF-ACE-08)', () => {
    let dono: Cliente;
    let vendedorId: string;
    let empresa: EmpresaDeTeste;
    beforeAll(async () => {
      ({ dono, vendedorId, empresa } = await novaEmpresa('Loja Sessoes'));
    });

    it('sair encerra a sessão, mas o aparelho segue vinculado', async () => {
      const c = await novoAparelho(app, empresa);
      await c.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect((await c.post('/acesso/sair')).statusCode).toBe(204);
      expect((await c.get('/acesso/eu')).statusCode).toBe(401);
      expect((await c.get('/acesso/usuarios')).statusCode).toBe(200);
    });

    it('o Dono derruba as sessões do Vendedor; ele pode entrar de novo com o PIN', async () => {
      const v = await novoAparelho(app, empresa);
      await v.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      const outroAparelho = await novoAparelho(app, empresa);
      await outroAparelho.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect((await v.get('/acesso/eu')).statusCode).toBe(200);

      expect((await dono.post(`/usuarios/${vendedorId}/derrubar-sessoes`)).statusCode).toBe(204);
      expect((await v.get('/acesso/eu')).statusCode).toBe(401);
      expect((await outroAparelho.get('/acesso/eu')).statusCode).toBe(401);
      expect((await dono.get('/acesso/eu')).statusCode).toBe(200); // a do Dono não caiu
      expect((await v.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR })).statusCode).toBe(200);
      expect((await eventos(empresa.empresaId)).map((x) => x.tipo)).toContain('sessoes_derrubadas');
    });

    it('desativar (funcionário desligado) derruba as sessões e impede novo acesso', async () => {
      const v = await novoAparelho(app, empresa);
      await v.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR });
      expect((await dono.post(`/usuarios/${vendedorId}/desativar`)).statusCode).toBe(204);
      expect((await v.get('/acesso/eu')).statusCode).toBe(401);
      expect((await v.post('/acesso/pin', { usuario_id: vendedorId, pin: PIN_VENDEDOR })).statusCode).toBe(401);
      const lista = (await dono.somenteAparelho().get('/acesso/usuarios')).json() as { usuarios: { id: string }[] };
      expect(lista.usuarios.map((u) => u.id)).not.toContain(vendedorId);
      expect((await eventos(empresa.empresaId)).map((x) => x.tipo)).toContain('usuario_desativado');
      // As sessões ficam REVOGADAS no banco (não só inválidas por o usuário estar inativo).
      const abertas = await owner.query('SELECT count(*)::int AS n FROM sessoes WHERE usuario_id = $1 AND revogada_em IS NULL', [vendedorId]);
      expect(abertas.rows[0].n).toBe(0);
    });
  });

  describe('gestão de usuários pelo Dono', () => {
    let dono: Cliente;
    let empresa: EmpresaDeTeste;
    beforeAll(async () => {
      ({ dono, empresa } = await novaEmpresa('Loja Usuarios'));
    });

    it('cria Vendedor com PIN em argon2id e o lista (sem hashes) em GET /usuarios', async () => {
      const r = await dono.post('/usuarios', { nome: 'Joana', pin: '2468' });
      expect(r.statusCode).toBe(201);
      const id = (r.json() as { id: string }).id;
      const row = await owner.query('SELECT perfil, pin_hash, email, senha_hash FROM usuarios WHERE id = $1', [id]);
      expect(row.rows[0]).toMatchObject({ perfil: 'vendedor', email: null, senha_hash: null });
      expect(row.rows[0].pin_hash.startsWith('$argon2id$')).toBe(true);

      const lista = await dono.get('/usuarios');
      const { usuarios } = lista.json() as { usuarios: Record<string, unknown>[] };
      expect(usuarios.find((u) => u.id === id)).toEqual({
        id,
        nome: 'Joana',
        perfil: 'vendedor',
        ativo: true,
        bloqueado: false,
      });
      expect(lista.body).not.toMatch(/argon2|pin_hash|senha_hash/);
    });

    it('PIN inválido na criação: 400', async () => {
      expect((await dono.post('/usuarios', { nome: 'Sem Pin', pin: '12' })).statusCode).toBe(400);
    });

    it('o Dono redefine o PIN do Vendedor (zera o bloqueio e derruba as sessões)', async () => {
      const id = ((await dono.post('/usuarios', { nome: 'Rita', pin: '1111' })).json() as { id: string }).id;
      const ap = dono.somenteAparelho();
      for (let i = 0; i < 5; i++) await ap.post('/acesso/pin', { usuario_id: id, pin: '0000' });
      expect((await ap.post('/acesso/pin', { usuario_id: id, pin: '1111' })).statusCode).toBe(423);
      expect((await dono.put(`/usuarios/${id}/pin`, { pin: '2222' })).statusCode).toBe(204);
      expect((await ap.post('/acesso/pin', { usuario_id: id, pin: '1111' })).statusCode).toBe(401);
      expect((await ap.post('/acesso/pin', { usuario_id: id, pin: '2222' })).statusCode).toBe(200);
      expect((await eventos(empresa.empresaId)).map((x) => x.tipo)).toContain('pin_alterado');
    });

    it('PIN de Vendedor não pode ser usado para entrar por e-mail (Vendedor não tem senha)', async () => {
      const row = await owner.query("SELECT count(*)::int AS n FROM usuarios WHERE empresa_id = $1 AND perfil = 'vendedor' AND email IS NOT NULL", [
        empresa.empresaId,
      ]);
      expect(row.rows[0].n).toBe(0);
    });
  });
});
