import { randomUUID } from 'node:crypto';
import {
  adminLoginBodySchema,
  criarEmpresaBodySchema,
  criarEmpresaResponseSchema,
  empresaIdParamsSchema,
  erroSchema,
  redefinirSenhaBodySchema,
} from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ADMIN_VALIDADE_HORAS,
  type Deps,
  credenciaisInvalidas,
  naoEncontrado,
  opcoesCookie,
  registrarEvento,
  semConteudo,
  somarHoras,
} from '../acesso/comum.js';
import { type Guardas, adminDe } from '../acesso/guardas.js';
import { novoToken } from '../acesso/tokens.js';
import { validarTotp } from '../acesso/totp.js';
import { semearCategoriasFinanceiras } from '../configuracoes/categorias.js';
import { withEmpresa } from '../db.js';

const adminCookie = [{ admin_sessao: [] }];
const UNIQUE_VIOLATION = '23505';

export async function registrarRotasAdmin(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, hasher, agora, cookieSecure } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const hashFalso = await hasher.hash('senha-descartavel-para-igualar-tempo');

  // ------------------------------------------------------------ login com senha + TOTP (RF-ACE-07)
  rotas.post(
    '/admin/login',
    {
      schema: {
        tags: ['admin'],
        summary: 'Admin da plataforma entra com e-mail, senha e código TOTP',
        body: adminLoginBodySchema,
        response: { 200: z.object({ ok: z.literal(true) }), 401: erroSchema, 429: erroSchema },
      },
      config: { rateLimit: deps.limiteSenha },
    },
    async (request, reply) => {
      const { email, senha, codigo } = request.body;
      const r = await pool.query(
        'SELECT id, senha_hash, totp_segredo, totp_ultimo_passo FROM admins WHERE email = $1 AND ativo',
        [email],
      );
      const adm = r.rows[0] as
        | { id: string; senha_hash: string; totp_segredo: string; totp_ultimo_passo: string }
        | undefined;

      // Sempre gasta o hash (mesmo sem a conta) e responde igual em qualquer falha.
      const senhaOk = await hasher.verificar(adm?.senha_hash ?? hashFalso, senha);
      const now = agora();
      const passo =
        adm && senhaOk
          ? validarTotp(deps.cifraTotp.decifrar(adm.totp_segredo), codigo, now.getTime(), Number(adm.totp_ultimo_passo))
          : null;
      if (!adm || !senhaOk || passo === null) return credenciaisInvalidas(reply);

      // Anti-replay atômico: só um login pode "consumir" cada passo TOTP.
      const consumiu = await pool.query(
        'UPDATE admins SET totp_ultimo_passo = $2 WHERE id = $1 AND totp_ultimo_passo < $2 RETURNING id',
        [adm.id, passo],
      );
      if (consumiu.rowCount === 0) return credenciaisInvalidas(reply);

      const t = novoToken();
      await pool.query(
        `INSERT INTO admin_sessoes (admin_id, token_hash, criada_em, ultimo_uso_em, expira_em)
         VALUES ($1, $2, $3, $3, $4)`,
        [adm.id, t.hash, now, somarHoras(now, ADMIN_VALIDADE_HORAS)],
      );
      reply.setCookie('admin_sessao', t.token, opcoesCookie(cookieSecure));
      return { ok: true as const };
    },
  );

  rotas.post(
    '/admin/sair',
    {
      preValidation: g.exigirAdmin,
      schema: {
        tags: ['admin'],
        summary: 'Encerra a sessão do Admin',
        security: adminCookie,
        response: { 204: semConteudo, 401: erroSchema },
      },
    },
    async (request, reply) => {
      await pool.query('UPDATE admin_sessoes SET revogada_em = $2 WHERE id = $1', [adminDe(request).sessaoId, agora()]);
      reply.clearCookie('admin_sessao', opcoesCookie(cookieSecure));
      return reply.code(204).send(null);
    },
  );

  // ------------------------------------------------------------ empresa + Dono (RF-ACE-01)
  rotas.post(
    '/admin/empresas',
    {
      preValidation: g.exigirAdmin,
      schema: {
        tags: ['admin'],
        summary: 'Cria a empresa e o primeiro usuário Dono (e-mail, senha inicial)',
        security: adminCookie,
        body: criarEmpresaBodySchema,
        response: { 201: criarEmpresaResponseSchema, 401: erroSchema, 409: erroSchema },
      },
    },
    async (request, reply) => {
      const { nome, dono } = request.body;
      const empresaId = randomUUID();
      const donoId = randomUUID();
      const senhaHash = await hasher.hash(dono.senha);
      const now = agora();
      try {
        // Tudo na transação da própria empresa: ou cria empresa, Dono e login, ou nada.
        await withEmpresa(pool, empresaId, async (c) => {
          await c.query('INSERT INTO empresas (id, nome, criado_em) VALUES ($1, $2, $3)', [empresaId, nome, now]);
          await c.query(
            `INSERT INTO usuarios (id, empresa_id, nome, perfil, email, senha_hash, criado_em)
             VALUES ($1, $2, $3, 'dono', $4, $5, $6)`,
            [donoId, empresaId, dono.nome, dono.email, senhaHash, now],
          );
          await c.query('SELECT registrar_login($1, $2, $3)', [dono.email, empresaId, donoId]);
          await semearCategoriasFinanceiras(c, empresaId, now);
          await registrarEvento(c, {
            empresaId,
            atorTipo: 'admin',
            atorId: adminDe(request).adminId,
            alvoId: donoId,
            tipo: 'empresa_criada',
            em: now,
          });
        });
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'email_em_uso' });
        }
        throw err;
      }
      return reply.code(201).send({ empresa_id: empresaId, dono_id: donoId });
    },
  );

  // ------------------------------------------------------------ redefinir senha do Dono (RF-ACE-06)
  rotas.post(
    '/admin/empresas/:empresaId/dono/senha',
    {
      preValidation: g.exigirAdmin,
      schema: {
        tags: ['admin'],
        summary: 'Redefine a senha do Dono e derruba as sessões dele (não há "esqueci a senha" no MVP)',
        security: adminCookie,
        params: empresaIdParamsSchema,
        body: redefinirSenhaBodySchema,
        response: { 204: semConteudo, 401: erroSchema, 404: erroSchema },
      },
    },
    async (request, reply) => {
      const { empresaId } = request.params;
      const novoHash = await hasher.hash(request.body.senha);
      const now = agora();
      const achou = await withEmpresa(pool, empresaId, async (c) => {
        const q = await c.query("SELECT id FROM usuarios WHERE perfil = 'dono' ORDER BY criado_em, id LIMIT 1 FOR UPDATE");
        const donoId = q.rows[0]?.id as string | undefined;
        if (!donoId) return false;
        await c.query('UPDATE usuarios SET senha_hash = $2, pin_falhas = 0, bloqueado_em = NULL WHERE id = $1', [donoId, novoHash]);
        await c.query('UPDATE sessoes SET revogada_em = $2 WHERE usuario_id = $1 AND revogada_em IS NULL', [donoId, now]);
        await registrarEvento(c, {
          empresaId,
          atorTipo: 'admin',
          atorId: adminDe(request).adminId,
          alvoId: donoId,
          tipo: 'senha_redefinida',
          em: now,
        });
        return true;
      });
      if (!achou) return naoEncontrado(reply);
      return reply.code(204).send(null);
    },
  );
}
