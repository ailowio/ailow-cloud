import type { Perfil } from '@ailow/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { withEmpresa } from '../db.js';
import { ADMIN_INATIVIDADE_MINUTOS, type Deps, naoAutenticado, semPermissao } from './comum.js';
import { lerToken } from './tokens.js';

export interface SessaoAtiva {
  id: string;
  empresaId: string;
  usuarioId: string;
  aparelhoId: string;
  perfil: Perfil;
  nome: string;
  inatividadeMinutos: number;
}
export interface AparelhoAtivo {
  id: string;
  empresaId: string;
}
export interface AdminAtivo {
  sessaoId: string;
  adminId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    sessao: SessaoAtiva | null;
    aparelho: AparelhoAtivo | null;
    admin: AdminAtivo | null;
  }
}

// Os dados abaixo SEMPRE vêm do banco, a partir do segredo do cookie. O prefixo de empresa do cookie
// só diz onde procurar; se estiver errado, a RLS não devolve nada e o resultado é "não autenticado".
export function criarGuardas({ pool, agora }: Deps) {
  // Valida a sessão e renova o "último uso" na mesma instrução (inatividade configurada na empresa).
  async function exigirSessao(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const lido = lerToken(request.cookies.sessao);
    if (!lido?.empresaId) return naoAutenticado(reply);
    const now = agora();
    const sessao = await withEmpresa(pool, lido.empresaId, async (c) => {
      const r = await c.query(
        `UPDATE sessoes s SET ultimo_uso_em = $2::timestamptz
           FROM usuarios u, empresas e
          WHERE s.token_hash = $1
            AND s.revogada_em IS NULL
            AND s.expira_em > $2::timestamptz
            AND u.empresa_id = s.empresa_id AND u.id = s.usuario_id AND u.ativo
            AND e.id = s.empresa_id
            AND s.ultimo_uso_em + make_interval(mins => e.inatividade_minutos) > $2::timestamptz
        RETURNING s.id, s.empresa_id, s.usuario_id, s.aparelho_id, u.perfil, u.nome, e.inatividade_minutos`,
        [lido.hash, now],
      );
      return r.rows[0] as
        | {
            id: string;
            empresa_id: string;
            usuario_id: string;
            aparelho_id: string;
            perfil: Perfil;
            nome: string;
            inatividade_minutos: number;
          }
        | undefined;
    });
    if (!sessao) return naoAutenticado(reply);
    request.sessao = {
      id: sessao.id,
      empresaId: sessao.empresa_id,
      usuarioId: sessao.usuario_id,
      aparelhoId: sessao.aparelho_id,
      perfil: sessao.perfil,
      nome: sessao.nome,
      inatividadeMinutos: sessao.inatividade_minutos,
    };
  }

  // Vale depois de exigirSessao. É o ponto único onde "Vendedor não acessa gestão/custo" é imposto.
  function exigirPerfil(perfil: Perfil) {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (request.sessao?.perfil !== perfil) return semPermissao(reply);
    };
  }

  // Aparelho vinculado (cookie de longa duração): autoriza listar "Quem está usando?" e digitar PIN.
  async function exigirAparelho(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const lido = lerToken(request.cookies.aparelho);
    if (!lido?.empresaId) return naoAutenticado(reply);
    const ap = await withEmpresa(pool, lido.empresaId, async (c) => {
      const r = await c.query(
        'UPDATE aparelhos SET ultimo_uso_em = $2::timestamptz WHERE token_hash = $1 RETURNING id, empresa_id',
        [lido.hash, agora()],
      );
      return r.rows[0] as { id: string; empresa_id: string } | undefined;
    });
    if (!ap) return naoAutenticado(reply);
    request.aparelho = { id: ap.id, empresaId: ap.empresa_id };
  }

  // Admin da plataforma: tabelas sem RLS e sem GRANT para o papel de runtime; acesso pelo pool.
  async function exigirAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const lido = lerToken(request.cookies.admin_sessao, false);
    if (!lido) return naoAutenticado(reply);
    const r = await pool.query(
      `UPDATE admin_sessoes s SET ultimo_uso_em = $2::timestamptz
         FROM admins a
        WHERE s.token_hash = $1
          AND s.revogada_em IS NULL
          AND s.expira_em > $2::timestamptz
          AND s.ultimo_uso_em + make_interval(mins => $3::int) > $2::timestamptz
          AND a.id = s.admin_id AND a.ativo
      RETURNING s.id, s.admin_id`,
      [lido.hash, agora(), ADMIN_INATIVIDADE_MINUTOS],
    );
    const linha = r.rows[0] as { id: string; admin_id: string } | undefined;
    if (!linha) return naoAutenticado(reply);
    request.admin = { sessaoId: linha.id, adminId: linha.admin_id };
  }

  return { exigirSessao, exigirPerfil, exigirAparelho, exigirAdmin };
}

export type Guardas = ReturnType<typeof criarGuardas>;

export function sessaoDe(request: FastifyRequest): SessaoAtiva {
  if (!request.sessao) throw new Error('rota sem exigirSessao');
  return request.sessao;
}
export function aparelhoDe(request: FastifyRequest): AparelhoAtivo {
  if (!request.aparelho) throw new Error('rota sem exigirAparelho');
  return request.aparelho;
}
export function adminDe(request: FastifyRequest): AdminAtivo {
  if (!request.admin) throw new Error('rota sem exigirAdmin');
  return request.admin;
}
