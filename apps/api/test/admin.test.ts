import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPool } from '../src/db.js';
import {
  type AdminDeTeste,
  Cliente,
  Relogio,
  adminPool,
  appDeTeste,
  codigoTotp,
  criarEmpresaPelaApi,
  loginAdmin,
  semearAdmin,
} from './helpers.js';

// RF-ACE-01 (Admin cria empresa + Dono), RF-ACE-06 (redefinir senha do Dono), RF-ACE-07 (TOTP do Admin).
describe('Admin da plataforma', () => {
  let pool: pg.Pool;
  let owner: pg.Pool;
  let app: FastifyInstance;
  let relogio: Relogio;
  let adm: AdminDeTeste;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL_TEST as string);
    owner = adminPool();
    relogio = new Relogio();
    app = await appDeTeste(pool, relogio);
    adm = await semearAdmin(pool);
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
    await owner.end();
  });

  describe('login com 2º fator (RF-ACE-07)', () => {
    it('entra com senha + código TOTP e recebe cookie httpOnly/Secure/SameSite=Strict', async () => {
      relogio.avancarMinutos(10);
      const c = new Cliente(app);
      const res = await c.post('/admin/login', {
        email: adm.email,
        senha: adm.senha,
        codigo: codigoTotp(adm.segredo, relogio.agora),
      });
      expect(res.statusCode).toBe(200);
      const cookie = res.cookies.find((x) => x.name === 'admin_sessao');
      expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
      expect(cookie?.value.length).toBeGreaterThanOrEqual(43);
    });

    it('senha certa SEM código válido não entra', async () => {
      const c = new Cliente(app);
      const errado = codigoTotp(adm.segredo, relogio.agora) === '000000' ? '000001' : '000000';
      const res = await c.post('/admin/login', { email: adm.email, senha: adm.senha, codigo: errado });
      expect(res.statusCode).toBe(401);
      expect(c.jar.size).toBe(0);
    });

    it('código certo com senha errada não entra', async () => {
      relogio.avancarMinutos(10);
      const c = new Cliente(app);
      const res = await c.post('/admin/login', {
        email: adm.email,
        senha: 'senha-errada-qualquer',
        codigo: codigoTotp(adm.segredo, relogio.agora),
      });
      expect(res.statusCode).toBe(401);
    });

    it('e-mail inexistente e senha errada dão a MESMA resposta (não revela contas)', async () => {
      const a = await new Cliente(app).post('/admin/login', {
        email: 'nao-existe@ailow.test',
        senha: 'qualquer-coisa',
        codigo: '123456',
      });
      const b = await new Cliente(app).post('/admin/login', {
        email: adm.email,
        senha: 'qualquer-coisa',
        codigo: '123456',
      });
      expect(a.statusCode).toBe(401);
      expect(b.statusCode).toBe(401);
      expect(a.body).toBe(b.body);
    });

    it('o mesmo código TOTP não pode ser usado duas vezes (replay)', async () => {
      relogio.avancarMinutos(10);
      const codigo = codigoTotp(adm.segredo, relogio.agora);
      const corpo = { email: adm.email, senha: adm.senha, codigo };
      expect((await new Cliente(app).post('/admin/login', corpo)).statusCode).toBe(200);
      expect((await new Cliente(app).post('/admin/login', corpo)).statusCode).toBe(401);
    });

    it('dois logins simultâneos com o mesmo código: só um entra (consumo atômico do passo)', async () => {
      relogio.avancarMinutos(10);
      const corpo = { email: adm.email, senha: adm.senha, codigo: codigoTotp(adm.segredo, relogio.agora) };
      // Aquece o pool: com conexões já abertas, todos leem o estado antigo ANTES de qualquer um gravar.
      await Promise.all(Array.from({ length: 8 }, () => pool.query('SELECT pg_sleep(0.05)')));
      const respostas = await Promise.all(Array.from({ length: 6 }, () => new Cliente(app).post('/admin/login', corpo)));
      expect(respostas.filter((r) => r.statusCode === 200)).toHaveLength(1);
      expect(respostas.filter((r) => r.statusCode === 401)).toHaveLength(5);
    });

    it('a sessão do Admin expira por inatividade (15 min)', async () => {
      relogio.avancarMinutos(10);
      const c = await loginAdmin(app, relogio, adm);
      relogio.avancarMinutos(14);
      // viva: o corpo vazio é inválido (400), mas não é 401
      expect((await c.post('/admin/empresas', {})).statusCode).toBe(400);
      relogio.avancarMinutos(16);
      expect((await c.post('/admin/empresas', {})).statusCode).toBe(401);
    });

    it('sair derruba a sessão do Admin', async () => {
      relogio.avancarMinutos(10);
      const c = await loginAdmin(app, relogio, adm);
      expect((await c.post('/admin/sair')).statusCode).toBe(204);
      const res = await c.post('/admin/empresas', {
        nome: 'X',
        dono: { nome: 'Y', email: 'y@x.test', senha: 'senha-longa-123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('rotas de Admin exigem sessão de Admin', () => {
    it('sem cookie: 401', async () => {
      const res = await new Cliente(app).post('/admin/empresas', {
        nome: 'X',
        dono: { nome: 'Y', email: 'y@x.test', senha: 'senha-longa-123' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('sessão de Dono (empresa) não vale como Admin', async () => {
      relogio.avancarMinutos(10);
      const adminCli = await loginAdmin(app, relogio, adm);
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Cookie');
      const dono = new Cliente(app);
      expect((await dono.post('/acesso/entrar', { email: e.email, senha: e.senha })).statusCode).toBe(200);
      const res = await dono.post('/admin/empresas', {
        nome: 'Invasora',
        dono: { nome: 'Y', email: 'inv@x.test', senha: 'senha-longa-123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('criar empresa + Dono (RF-ACE-01)', () => {
    let adminCli: Cliente;
    beforeAll(async () => {
      relogio.avancarMinutos(10);
      adminCli = await loginAdmin(app, relogio, adm);
    });

    it('cria empresa, Dono e registro de login; a senha fica em argon2id, nunca em texto', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Nova');
      const u = await owner.query('SELECT perfil, senha_hash, pin_hash, ativo FROM usuarios WHERE id = $1', [
        e.donoId,
      ]);
      expect(u.rows[0]).toMatchObject({ perfil: 'dono', pin_hash: null, ativo: true });
      expect(u.rows[0].senha_hash.startsWith('$argon2id$')).toBe(true);
      expect(u.rows[0].senha_hash).not.toContain(e.senha);
      const d = await owner.query('SELECT * FROM buscar_login($1)', [e.email]);
      expect(d.rows).toEqual([{ empresa_id: e.empresaId, usuario_id: e.donoId }]);
    });

    it('registra a criação na trilha de auditoria (AUD-10) sem gravar senha', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Auditada');
      const ev = await owner.query(
        'SELECT ator_tipo, tipo, alvo_id FROM eventos_acesso WHERE empresa_id = $1 ORDER BY id',
        [e.empresaId],
      );
      expect(ev.rows).toContainEqual({ ator_tipo: 'admin', tipo: 'empresa_criada', alvo_id: e.donoId });
      expect(JSON.stringify(ev.rows)).not.toContain(e.senha);
    });

    it('e-mail já usado em qualquer empresa: 409 e nada é criado', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Dona do Email');
      const antes = await owner.query('SELECT count(*)::int AS n FROM empresas');
      const res = await adminCli.post('/admin/empresas', {
        nome: 'Loja Repetida',
        dono: { nome: 'Outro', email: e.email.toUpperCase(), senha: 'senha-longa-123' },
      });
      expect(res.statusCode).toBe(409);
      const depois = await owner.query('SELECT count(*)::int AS n FROM empresas');
      expect(depois.rows[0].n).toBe(antes.rows[0].n);
    });

    it.each([
      ['senha curta', { nome: 'L', dono: { nome: 'D', email: 'a@b.test', senha: 'curta' } }],
      ['e-mail inválido', { nome: 'L', dono: { nome: 'D', email: 'xxx', senha: 'senha-longa-123' } }],
      ['nome vazio', { nome: '  ', dono: { nome: 'D', email: 'a@b.test', senha: 'senha-longa-123' } }],
    ])('entrada inválida (%s): 400', async (_n, corpo) => {
      expect((await adminCli.post('/admin/empresas', corpo)).statusCode).toBe(400);
    });
  });

  describe('redefinir a senha do Dono (RF-ACE-06)', () => {
    let adminCli: Cliente;
    beforeAll(async () => {
      relogio.avancarMinutos(10);
      adminCli = await loginAdmin(app, relogio, adm);
    });

    it('a senha nova entra, a antiga não, e as sessões do Dono caem', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Senha');
      const dono = new Cliente(app);
      expect((await dono.post('/acesso/entrar', { email: e.email, senha: e.senha })).statusCode).toBe(200);
      expect((await dono.get('/acesso/eu')).statusCode).toBe(200);

      const res = await adminCli.post(`/admin/empresas/${e.empresaId}/dono/senha`, {
        senha: 'senha-nova-bem-longa',
      });
      expect(res.statusCode).toBe(204);

      expect((await dono.get('/acesso/eu')).statusCode).toBe(401);
      const velha = await new Cliente(app).post('/acesso/entrar', { email: e.email, senha: e.senha });
      expect(velha.statusCode).toBe(401);
      const nova = await new Cliente(app).post('/acesso/entrar', {
        email: e.email,
        senha: 'senha-nova-bem-longa',
      });
      expect(nova.statusCode).toBe(200);
    });

    it('empresa inexistente: 404; senha curta: 400', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Senha 2');
      const inexistente = '00000000-0000-4000-8000-000000000000';
      const r404 = await adminCli.post(`/admin/empresas/${inexistente}/dono/senha`, {
        senha: 'senha-nova-bem-longa',
      });
      expect(r404.statusCode).toBe(404);
      const r400 = await adminCli.post(`/admin/empresas/${e.empresaId}/dono/senha`, { senha: 'curta' });
      expect(r400.statusCode).toBe(400);
    });

    it('registra a redefinição na trilha de auditoria', async () => {
      const e = await criarEmpresaPelaApi(adminCli, 'Loja Senha 3');
      await adminCli.post(`/admin/empresas/${e.empresaId}/dono/senha`, { senha: 'senha-nova-bem-longa' });
      const ev = await owner.query('SELECT tipo, ator_tipo FROM eventos_acesso WHERE empresa_id = $1 ORDER BY id', [
        e.empresaId,
      ]);
      expect(ev.rows).toContainEqual({ tipo: 'senha_redefinida', ator_tipo: 'admin' });
    });
  });
});
