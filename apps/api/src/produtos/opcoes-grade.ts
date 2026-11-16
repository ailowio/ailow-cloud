import {
  CORES_PADRAO,
  type OpcaoGrade,
  TAMANHOS_PADRAO,
  type TipoOpcaoGrade,
  chaveCor,
  compararTamanhos,
  corSchema,
  erroSchema,
  opcaoGradeAlterarSchema,
  opcaoGradeCorpoSchema,
  opcaoGradeIdParamsSchema,
  opcoesGradeResponseSchema,
  tamanhoSchema,
} from '@ailow/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type pg from 'pg';
import { z } from 'zod';
import { type Deps, naoEncontrado, registrarEvento, semConteudo } from '../acesso/comum.js';
import { type Guardas, sessaoDe } from '../acesso/guardas.js';
import { withEmpresa } from '../db.js';

const sessaoCookie = [{ sessao: [] }];
const UNIQUE_VIOLATION = '23505';

// Chave de "mesma opção": tamanho em maiúsculas; cor sem acento, caixa nem espaço extra (a mesma do SKU).
const chave = (tipo: TipoOpcaoGrade, nome: string) => (tipo === 'tamanho' ? nome.trim().toUpperCase() : chaveCor(nome));

/**
 * Primeira leitura da empresa: grava os tamanhos e as cores padrão (ADR 017). Só semeia o tipo que não tem NENHUMA
 * linha (desativar tudo não faz a semente voltar). ON CONFLICT: duas leituras simultâneas não duplicam.
 */
async function semearSeVazio(c: pg.PoolClient, empresaId: string, em: Date): Promise<void> {
  const r = await c.query('SELECT tipo FROM opcoes_grade GROUP BY tipo');
  const tem = new Set(r.rows.map((x) => x.tipo as string));
  if (!tem.has('tamanho')) {
    await c.query(
      `INSERT INTO opcoes_grade (empresa_id, tipo, nome, criado_em)
       SELECT $1, 'tamanho', nome, $3 FROM unnest($2::text[]) WITH ORDINALITY AS t(nome, ordem) ORDER BY ordem
       ON CONFLICT DO NOTHING`,
      [empresaId, [...TAMANHOS_PADRAO], em],
    );
  }
  if (!tem.has('cor')) {
    await c.query(
      `INSERT INTO opcoes_grade (empresa_id, tipo, nome, amostra, criado_em)
       SELECT $1, 'cor', nome, amostra, $4 FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS t(nome, amostra, ordem)
        ORDER BY ordem
       ON CONFLICT DO NOTHING`,
      [empresaId, CORES_PADRAO.map((x) => x.nome), CORES_PADRAO.map((x) => x.amostra), em],
    );
  }
}

/** Já existe outra opção do mesmo tipo com a mesma chave? (`exceto` = a própria linha, na edição) */
async function repetida(c: pg.PoolClient, tipo: TipoOpcaoGrade, nome: string, exceto: string | null): Promise<boolean> {
  const r = await c.query('SELECT id, nome FROM opcoes_grade WHERE tipo = $1', [tipo]);
  const alvo = chave(tipo, nome);
  return r.rows.some((x) => x.id !== exceto && chave(tipo, x.nome as string) === alvo);
}

// Opções da grade (ADR 017): só o Dono configura (o cadastro de produto também é só dele, RN-10).
export async function registrarRotasOpcoesGrade(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/opcoes-grade',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Tamanhos (ordem de grade) e cores (ordem de cadastro) da empresa; na 1ª leitura grava os padrão (Dono)',
        security: sessaoCookie,
        response: { 200: opcoesGradeResponseSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, async (c) => {
        await semearSeVazio(c, s.empresaId, agora());
        const r = await c.query('SELECT id, tipo, nome, amostra, ativa FROM opcoes_grade ORDER BY seq');
        const linhas = r.rows as (OpcaoGrade & { tipo: TipoOpcaoGrade })[];
        const tirarTipo = ({ tipo: _t, ...o }: OpcaoGrade & { tipo: TipoOpcaoGrade }): OpcaoGrade => o;
        return {
          tamanhos: linhas
            .filter((l) => l.tipo === 'tamanho')
            .sort((x, y) => compararTamanhos(x.nome, y.nome))
            .map(tirarTipo),
          cores: linhas.filter((l) => l.tipo === 'cor').map(tirarTipo),
        };
      });
    },
  );

  rotas.post(
    '/opcoes-grade',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Cria um tamanho (regra do SKU: 1 a 3 letras ou números) ou uma cor, com amostra opcional (Dono)',
        security: sessaoCookie,
        body: opcaoGradeCorpoSchema,
        response: { 201: z.object({ id: z.uuid() }), 400: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const corpo = request.body;
      const amostra = corpo.tipo === 'cor' ? (corpo.amostra ?? null) : null;
      try {
        const id = await withEmpresa(pool, s.empresaId, async (c) => {
          await semearSeVazio(c, s.empresaId, agora());
          if (await repetida(c, corpo.tipo, corpo.nome, null)) return null;
          const r = await c.query(
            'INSERT INTO opcoes_grade (empresa_id, tipo, nome, amostra, criado_em) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [s.empresaId, corpo.tipo, corpo.nome, amostra, agora()],
          );
          const novo = r.rows[0].id as string;
          await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: novo, tipo: 'opcao_grade_criada', em: agora() });
          return novo;
        });
        if (id === null) return reply.code(409).send({ erro: 'opcao_ja_existe' });
        return reply.code(201).send({ id });
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) return reply.code(409).send({ erro: 'opcao_ja_existe' });
        throw err;
      }
    },
  );

  rotas.put(
    '/opcoes-grade/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Renomeia, troca a amostra (só cor) ou (des)ativa uma opção; o tipo não muda e nada é apagado (Dono)',
        security: sessaoCookie,
        params: opcaoGradeIdParamsSchema,
        body: opcaoGradeAlterarSchema,
        response: { 204: semConteudo, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { id } = request.params;
      const { amostra, ativa } = request.body;
      try {
        const res = await withEmpresa(pool, s.empresaId, async (c) => {
          const atual = await c.query('SELECT tipo FROM opcoes_grade WHERE id = $1 FOR UPDATE', [id]);
          const tipo = atual.rows[0]?.tipo as TipoOpcaoGrade | undefined;
          if (!tipo) return 'nao_encontrada' as const;
          // O nome segue a regra do tipo DA LINHA (a mesma do SKU); tamanho não tem amostra.
          const nome = (tipo === 'tamanho' ? tamanhoSchema : corSchema).safeParse(request.body.nome);
          if (!nome.success || (tipo === 'tamanho' && amostra !== null)) return 'invalida' as const;
          if (await repetida(c, tipo, nome.data, id)) return 'repetida' as const;
          await c.query('UPDATE opcoes_grade SET nome = $2, amostra = $3, ativa = $4 WHERE id = $1', [id, nome.data, amostra, ativa]);
          await registrarEvento(c, { empresaId: s.empresaId, atorTipo: 'usuario', atorId: s.usuarioId, alvoId: id, tipo: 'opcao_grade_alterada', em: agora() });
          return 'ok' as const;
        });
        if (res === 'nao_encontrada') return naoEncontrado(reply);
        if (res === 'invalida') return reply.code(400).send({ erro: 'opcao_invalida' });
        if (res === 'repetida') return reply.code(409).send({ erro: 'opcao_ja_existe' });
        return reply.code(204).send(null);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) return reply.code(409).send({ erro: 'opcao_ja_existe' });
        throw err;
      }
    },
  );
}
