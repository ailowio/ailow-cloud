import type { FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';
import type { CifraTotp } from './cifra-totp.js';
import type { Hasher } from './senhas.js';

// Regras de tempo e limites (ADR 004). Constantes nomeadas para o teste e o ADR apontarem para um lugar só.
export const SESSAO_VALIDADE_HORAS = 12;
export const APARELHO_VALIDADE_DIAS = 365;
export const ADMIN_INATIVIDADE_MINUTOS = 15;
export const ADMIN_VALIDADE_HORAS = 8;
export const PIN_MAX_FALHAS = 5;

export interface Deps {
  pool: pg.Pool;
  hasher: Hasher;
  agora: () => Date;
  cookieSecure: boolean;
  cifraTotp: CifraTotp;
  // Limite por IP das rotas que conferem senha (config.rateLimit do @fastify/rate-limit; janela em ms).
  limiteSenha: { max: number; timeWindow: number };
}

// Resposta 204: sem corpo (declarada para constar no OpenAPI).
export const semConteudo = z.null().describe('Sem conteúdo');

export const somarHoras = (d: Date, h: number) => new Date(d.getTime() + h * 3_600_000);
export const somarDias = (d: Date, dias: number) => new Date(d.getTime() + dias * 86_400_000);

// Respostas de erro com formato único (erroSchema do pacote shared). Nunca ecoam dados da entrada.
export const naoAutenticado = (reply: FastifyReply) => reply.code(401).send({ erro: 'nao_autenticado' });
export const semPermissao = (reply: FastifyReply) => reply.code(403).send({ erro: 'sem_permissao' });
export const naoEncontrado = (reply: FastifyReply) => reply.code(404).send({ erro: 'nao_encontrado' });
export const credenciaisInvalidas = (reply: FastifyReply) =>
  reply.code(401).send({ erro: 'credenciais_invalidas' });

// Atributos fixos dos cookies de acesso: httpOnly (JS não lê), Secure (só HTTPS), SameSite=Strict.
export function opcoesCookie(secure: boolean, maxAgeSegundos?: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    path: '/',
    ...(maxAgeSegundos === undefined ? {} : { maxAge: maxAgeSegundos }),
  };
}

export async function registrarEvento(
  c: pg.PoolClient,
  e: { empresaId: string; atorTipo: 'usuario' | 'admin' | 'aparelho' | 'sistema'; atorId?: string; alvoId?: string; tipo: string; em: Date },
): Promise<void> {
  await c.query(
    `INSERT INTO eventos_acesso (empresa_id, ator_tipo, ator_id, alvo_id, tipo, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.empresaId, e.atorTipo, e.atorId ?? null, e.alvoId ?? null, e.tipo, e.em],
  );
}
