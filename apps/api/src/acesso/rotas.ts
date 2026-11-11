import {
  definirMeuPinBodySchema,
  definirPinBodySchema,
  criarVendedorBodySchema,
  entrarBodySchema,
  entrarResponseSchema,
  erroSchema,
  euResponseSchema,
  pinBodySchema,
  quemUsaResponseSchema,
  sessaoResponseSchema,
  usuarioIdParamsSchema,
  usuariosResponseSchema,
  type Perfil,
} from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { withEmpresa } from '../db.js';
import {
  APARELHO_VALIDADE_DIAS,
  type Deps,
  PIN_MAX_FALHAS,
  SESSAO_VALIDADE_HORAS,
  credenciaisInvalidas,
  naoEncontrado,
  opcoesCookie,
  registrarEvento,
  semConteudo,
  somarHoras,
} from './comum.js';
import { type Guardas, aparelhoDe, sessaoDe } from './guardas.js';
import { lerToken, novoToken } from './tokens.js';

const sessaoCookie = [{ sessao: [] }];
const aparelhoCookie = [{ aparelho: [] }];

interface UsuarioLinha {
  id: string;
  nome: string;
  perfil: Perfil;
}

export async function registrarRotasAcesso(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, hasher, agora, cookieSecure } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  // Hash descartável: login de e-mail inexistente gasta o mesmo tempo que um existente.
  const hashFalso = await hasher.hash('senha-descartavel-para-igualar-tempo');

  // ---------------------------------------------------------------- entrar (RF-ACE-02)
  rotas.post(
    '/acesso/entrar',
    {
      schema: {
        tags: ['acesso'],
        summary: 'Dono entra com e-mail + senha e vincula o aparelho',
        body: entrarBodySchema,
        response: { 200: entrarResponseSchema, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const { email, senha } = request.body;
      const achado = await pool.query('SELECT empresa_id, usuario_id FROM buscar_login($1)', [email]);
      const login = achado.rows[0] as { empresa_id: string; usuario_id: string } | undefined;

      const usuario = login
        ? await withEmpresa(pool, login.empresa_id, async (c) => {
            const r = await c.query(
              `SELECT id, nome, perfil, senha_hash, (pin_hash IS NOT NULL) AS tem_pin
                 FROM usuarios WHERE id = $1 AND ativo AND senha_hash IS NOT NULL`,
              [login.usuario_id],
            );
            return r.rows[0] as (UsuarioLinha & { senha_hash: string; tem_pin: boolean }) | undefined;
          })
        : undefined;

      const confere = await hasher.verificar(usuario?.senha_hash ?? hashFalso, senha);
      if (!login || !usuario || !confere) {
        if (login) {
          await withEmpresa(pool, login.empresa_id, (c) =>
            registrarEvento(c, {
              empresaId: login.empresa_id,
              atorTipo: 'sistema',
              alvoId: login.usuario_id,
              tipo: 'login_falha',
              em: agora(),
            }),
          );
        }
        return credenciaisInvalidas(reply);
      }

      const now = agora();
      const cookieAparelho = lerToken(request.cookies.aparelho);
      const resultado = await withEmpresa(pool, login.empresa_id, async (c) => {
        // Reaproveita o aparelho vinculado deste navegador, se for desta empresa; senão vincula um novo.
        let aparelhoId: string | undefined;
        let tokenAparelho: string | undefined;
        if (cookieAparelho?.empresaId === login.empresa_id) {
          const r = await c.query('SELECT id FROM aparelhos WHERE token_hash = $1', [cookieAparelho.hash]);
          aparelhoId = r.rows[0]?.id;
        }
        if (!aparelhoId) {
          const novo = novoToken(login.empresa_id);
          const r = await c.query(
            `INSERT INTO aparelhos (empresa_id, token_hash, criado_por, criado_em, ultimo_uso_em)
             VALUES ($1, $2, $3, $4, $4) RETURNING id`,
            [login.empresa_id, novo.hash, usuario.id, now],
          );
          aparelhoId = r.rows[0].id as string;
          tokenAparelho = novo.token;
          await registrarEvento(c, {
            empresaId: login.empresa_id,
            atorTipo: 'usuario',
            atorId: usuario.id,
            alvoId: aparelhoId,
            tipo: 'aparelho_vinculado',
            em: now,
          });
        }
        const sessao = await abrirSessao(c, login.empresa_id, usuario.id, aparelhoId, now);
        // A senha é um fator mais forte que o PIN: entrar com ela libera um Dono bloqueado por PIN.
        await c.query('UPDATE usuarios SET pin_falhas = 0, bloqueado_em = NULL WHERE id = $1', [usuario.id]);
        await registrarEvento(c, {
          empresaId: login.empresa_id,
          atorTipo: 'usuario',
          atorId: usuario.id,
          tipo: 'login',
          em: now,
        });
        return { tokenAparelho, tokenSessao: sessao };
      });

      if (resultado.tokenAparelho) {
        reply.setCookie(
          'aparelho',
          resultado.tokenAparelho,
          opcoesCookie(cookieSecure, APARELHO_VALIDADE_DIAS * 86_400),
        );
      }
      reply.setCookie('sessao', resultado.tokenSessao, opcoesCookie(cookieSecure));
      return { usuario: { id: usuario.id, nome: usuario.nome, perfil: usuario.perfil }, precisa_definir_pin: !usuario.tem_pin };
    },
  );

  // Cria a sessão e encerra as anteriores do mesmo aparelho (trocar de pessoa encerra a anterior).
  async function abrirSessao(
    c: import('pg').PoolClient,
    empresaId: string,
    usuarioId: string,
    aparelhoId: string,
    now: Date,
  ): Promise<string> {
    await c.query(
      'UPDATE sessoes SET revogada_em = $2 WHERE aparelho_id = $1 AND revogada_em IS NULL',
      [aparelhoId, now],
    );
    const t = novoToken(empresaId);
    await c.query(
      `INSERT INTO sessoes (empresa_id, usuario_id, aparelho_id, token_hash, criada_em, ultimo_uso_em, expira_em)
       VALUES ($1, $2, $3, $4, $5, $5, $6)`,
      [empresaId, usuarioId, aparelhoId, t.hash, now, somarHoras(now, SESSAO_VALIDADE_HORAS)],
    );
    return t.token;
  }

  // ---------------------------------------------------------------- quem está usando (RF-ACE-03)
  rotas.get(
    '/acesso/usuarios',
    {
      preValidation: g.exigirAparelho,
      schema: {
        tags: ['acesso'],
        summary: 'Quem está usando? Usuários ativos da empresa do aparelho vinculado',
        security: aparelhoCookie,
        response: { 200: quemUsaResponseSchema, 401: erroSchema },
      },
    },
    async (request) => {
      const ap = aparelhoDe(request);
      const usuarios = await withEmpresa(pool, ap.empresaId, async (c) => {
        const r = await c.query(
          `SELECT id, nome, perfil, (bloqueado_em IS NOT NULL) AS bloqueado
             FROM usuarios WHERE ativo AND pin_hash IS NOT NULL ORDER BY nome, id`,
        );
        return r.rows as (UsuarioLinha & { bloqueado: boolean })[];
      });
      return { usuarios };
    },
  );

  // ---------------------------------------------------------------- PIN (RF-ACE-03, 05 / RN-09)
  rotas.post(
    '/acesso/pin',
    {
      preValidation: g.exigirAparelho,
      schema: {
        tags: ['acesso'],
        summary: 'PIN de 4 dígitos abre a sessão da pessoa; 5 erros seguidos bloqueiam o usuário',
        security: aparelhoCookie,
        body: pinBodySchema,
        response: { 200: sessaoResponseSchema, 401: erroSchema, 423: erroSchema },
      },
    },
    async (request, reply) => {
      const ap = aparelhoDe(request);
      const { usuario_id, pin } = request.body;
      const now = agora();

      // A linha do usuário fica travada (FOR UPDATE) durante a conferência: tentativas simultâneas
      // são serializadas e não conseguem passar do limite. O resultado é RETORNADO (não lançado)
      // para que a contagem de falhas seja gravada (COMMIT) mesmo quando o PIN está errado.
      const r = await withEmpresa(pool, ap.empresaId, async (c) => {
        const q = await c.query(
          `SELECT id, nome, perfil, pin_hash, pin_falhas, bloqueado_em
             FROM usuarios WHERE id = $1 AND ativo AND pin_hash IS NOT NULL FOR UPDATE`,
          [usuario_id],
        );
        const u = q.rows[0] as (UsuarioLinha & { pin_hash: string; pin_falhas: number; bloqueado_em: Date | null }) | undefined;
        if (!u) return { tipo: 'invalido' as const };
        if (u.bloqueado_em) return { tipo: 'bloqueado' as const };

        if (!(await hasher.verificar(u.pin_hash, pin))) {
          const falhas = u.pin_falhas + 1;
          const bloqueia = falhas >= PIN_MAX_FALHAS;
          await c.query('UPDATE usuarios SET pin_falhas = $2, bloqueado_em = $3 WHERE id = $1', [
            u.id,
            falhas,
            bloqueia ? now : null,
          ]);
          await registrarEvento(c, { empresaId: ap.empresaId, atorTipo: 'aparelho', atorId: ap.id, alvoId: u.id, tipo: 'pin_falha', em: now });
          if (bloqueia) {
            await registrarEvento(c, { empresaId: ap.empresaId, atorTipo: 'sistema', alvoId: u.id, tipo: 'bloqueio', em: now });
            return { tipo: 'bloqueado' as const };
          }
          return { tipo: 'errado' as const, restantes: PIN_MAX_FALHAS - falhas };
        }

        await c.query('UPDATE usuarios SET pin_falhas = 0 WHERE id = $1', [u.id]);
        const token = await abrirSessao(c, ap.empresaId, u.id, ap.id, now);
        await registrarEvento(c, { empresaId: ap.empresaId, atorTipo: 'usuario', atorId: u.id, tipo: 'pin_ok', em: now });
        return { tipo: 'ok' as const, token, usuario: { id: u.id, nome: u.nome, perfil: u.perfil } };
      });

      if (r.tipo === 'invalido') return reply.code(401).send({ erro: 'pin_invalido' });
      if (r.tipo === 'bloqueado') return reply.code(423).send({ erro: 'usuario_bloqueado' });
      if (r.tipo === 'errado') return reply.code(401).send({ erro: 'pin_invalido', tentativas_restantes: r.restantes });
      reply.setCookie('sessao', r.token, opcoesCookie(cookieSecure));
      return { usuario: r.usuario };
    },
  );

  // ---------------------------------------------------------------- sessão atual / sair (RF-ACE-08)
  rotas.get(
    '/acesso/eu',
    {
      preValidation: g.exigirSessao,
      schema: {
        tags: ['acesso'],
        summary: 'Quem sou eu (usuário da sessão atual)',
        security: sessaoCookie,
        response: { 200: euResponseSchema, 401: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return {
        usuario: { id: s.usuarioId, nome: s.nome, perfil: s.perfil },
        inatividade_minutos: s.inatividadeMinutos,
      };
    },
  );

  rotas.post(
    '/acesso/sair',
    {
      preValidation: g.exigirSessao,
      schema: {
        tags: ['acesso'],
        summary: 'Encerra a sessão atual (o aparelho continua vinculado)',
        security: sessaoCookie,
        response: { 204: semConteudo, 401: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      await withEmpresa(pool, s.empresaId, async (c) => {
        await c.query('UPDATE sessoes SET revogada_em = $2 WHERE id = $1', [s.id, agora()]);
        await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, tipo: 'sair', em: agora() });
      });
      reply.clearCookie('sessao', opcoesCookie(cookieSecure));
      return reply.code(204).send(null);
    },
  );

  // ---------------------------------------------------------------- Dono define o próprio PIN
  rotas.put(
    '/acesso/meu-pin',
    {
      preValidation: g.exigirSessao,
      schema: {
        tags: ['acesso'],
        summary: 'Dono define o próprio PIN (exige a senha)',
        security: sessaoCookie,
        body: definirMeuPinBodySchema,
        response: { 204: semConteudo, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { senha, pin } = request.body;
      const hashSenha = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query('SELECT senha_hash FROM usuarios WHERE id = $1', [s.usuarioId]);
        return r.rows[0]?.senha_hash as string | null | undefined;
      });
      // Só quem tem senha (Dono) define o PIN assim; o PIN do Vendedor é definido pelo Dono.
      if (!hashSenha) return reply.code(403).send({ erro: 'sem_permissao' });
      if (!(await hasher.verificar(hashSenha, senha))) return credenciaisInvalidas(reply);
      const novoHash = await hasher.hash(pin);
      await withEmpresa(pool, s.empresaId, async (c) => {
        await c.query('UPDATE usuarios SET pin_hash = $2, pin_falhas = 0, bloqueado_em = NULL WHERE id = $1', [
          s.usuarioId,
          novoHash,
        ]);
        await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: s.usuarioId, tipo: 'pin_alterado', em: agora() });
      });
      return reply.code(204).send(null);
    },
  );

  // ---------------------------------------------------------------- gestão de usuários (só Dono)
  const gestao = [g.exigirSessao, g.exigirPerfil('dono')];

  rotas.get(
    '/usuarios',
    {
      preValidation: gestao,
      schema: {
        tags: ['usuarios'],
        summary: 'Lista os usuários da empresa da sessão (Dono)',
        security: sessaoCookie,
        response: { 200: usuariosResponseSchema, 401: erroSchema, 403: erroSchema },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      const usuarios = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `SELECT id, nome, perfil, ativo, (bloqueado_em IS NOT NULL) AS bloqueado
             FROM usuarios ORDER BY criado_em, id`,
        );
        return r.rows as (UsuarioLinha & { ativo: boolean; bloqueado: boolean })[];
      });
      return { usuarios };
    },
  );

  rotas.post(
    '/usuarios',
    {
      preValidation: gestao,
      schema: {
        tags: ['usuarios'],
        summary: 'Cria um Vendedor com PIN (Dono). A empresa vem da sessão, nunca do corpo',
        security: sessaoCookie,
        body: criarVendedorBodySchema,
        response: { 201: z.object({ id: z.uuid() }), 401: erroSchema, 403: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const pinHash = await hasher.hash(request.body.pin);
      const id = await withEmpresa(pool, s.empresaId, async (c) => {
        const r = await c.query(
          `INSERT INTO usuarios (empresa_id, nome, perfil, pin_hash, criado_em)
           VALUES ($1, $2, 'vendedor', $3, $4) RETURNING id`,
          [s.empresaId, request.body.nome, pinHash, agora()],
        );
        const novo = r.rows[0].id as string;
        await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: novo, tipo: 'usuario_criado', em: agora() });
        return novo;
      });
      return reply.code(201).send({ id });
    },
  );

  // Ações sobre um usuário existente: o 404 vale tanto para "não existe" quanto para "é de outra empresa".
  type Acao = (
    c: import('pg').PoolClient,
    alvo: { id: string; perfil: Perfil },
    now: Date,
  ) => Promise<'ok' | 'proibido'>;

  function acaoSobreUsuario(rota: string, resumo: string, tipoEvento: string, acao: Acao) {
    rotas.post(
      rota,
      {
        preValidation: gestao,
        schema: {
          tags: ['usuarios'],
          summary: resumo,
          security: sessaoCookie,
          params: usuarioIdParamsSchema,
          response: { 204: semConteudo, 401: erroSchema, 403: erroSchema, 404: erroSchema, 409: erroSchema },
        },
      },
      async (request, reply) => {
        const s = sessaoDe(request);
        const now = agora();
        const alvoId = request.params.id;
        const r = await withEmpresa(pool, s.empresaId, async (c) => {
          const q = await c.query('SELECT id, perfil FROM usuarios WHERE id = $1 FOR UPDATE', [alvoId]);
          const alvo = q.rows[0] as { id: string; perfil: Perfil } | undefined;
          if (!alvo) return 'inexistente' as const;
          const res = await acao(c, alvo, now);
          if (res === 'ok') {
            await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId, tipo: tipoEvento, em: now });
          }
          return res;
        });
        if (r === 'inexistente') return naoEncontrado(reply);
        if (r === 'proibido') return reply.code(409).send({ erro: 'nao_permitido' });
        return reply.code(204).send(null);
      },
    );
  }

  const derrubar = (c: import('pg').PoolClient, usuarioId: string, now: Date) =>
    c.query('UPDATE sessoes SET revogada_em = $2 WHERE usuario_id = $1 AND revogada_em IS NULL', [usuarioId, now]);

  acaoSobreUsuario('/usuarios/:id/derrubar-sessoes', 'Derruba todas as sessões de um usuário (Dono)', 'sessoes_derrubadas', async (c, alvo, now) => {
    await derrubar(c, alvo.id, now);
    return 'ok';
  });

  acaoSobreUsuario('/usuarios/:id/desbloquear', 'Desbloqueia um usuário bloqueado por PINs errados (Dono)', 'desbloqueio', async (c, alvo) => {
    await c.query('UPDATE usuarios SET pin_falhas = 0, bloqueado_em = NULL WHERE id = $1', [alvo.id]);
    return 'ok';
  });

  acaoSobreUsuario('/usuarios/:id/desativar', 'Desativa um Vendedor (funcionário desligado) e derruba as sessões (Dono)', 'usuario_desativado', async (c, alvo, now) => {
    if (alvo.perfil === 'dono') return 'proibido'; // o Dono não se desativa; quem resolve é o Admin
    await c.query('UPDATE usuarios SET ativo = false WHERE id = $1', [alvo.id]);
    await derrubar(c, alvo.id, now);
    return 'ok';
  });

  // PIN do Vendedor: o hash é calculado ANTES de abrir a transação (argon2 é lento e não deve segurar linha travada).
  rotas.put(
    '/usuarios/:id/pin',
    {
      preValidation: gestao,
      schema: {
        tags: ['usuarios'],
        summary: 'Redefine o PIN de um Vendedor, zera o bloqueio e derruba as sessões (Dono)',
        security: sessaoCookie,
        params: usuarioIdParamsSchema,
        body: definirPinBodySchema,
        response: { 204: semConteudo, 401: erroSchema, 403: erroSchema, 404: erroSchema, 409: erroSchema },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const now = agora();
      const novoHash = await hasher.hash(request.body.pin);
      const r = await withEmpresa(pool, s.empresaId, async (c) => {
        const q = await c.query('SELECT id, perfil FROM usuarios WHERE id = $1 FOR UPDATE', [request.params.id]);
        const alvo = q.rows[0] as { id: string; perfil: Perfil } | undefined;
        if (!alvo) return 'inexistente' as const;
        if (alvo.perfil === 'dono') return 'proibido' as const; // o Dono usa PUT /acesso/meu-pin (exige a senha)
        await c.query('UPDATE usuarios SET pin_hash = $2, pin_falhas = 0, bloqueado_em = NULL WHERE id = $1', [alvo.id, novoHash]);
        await derrubar(c, alvo.id, now);
        await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: alvo.id, tipo: 'pin_alterado', em: now });
        return 'ok' as const;
      });
      if (r === 'inexistente') return naoEncontrado(reply);
      if (r === 'proibido') return reply.code(409).send({ erro: 'nao_permitido' });
      return reply.code(204).send(null);
    },
  );
}
