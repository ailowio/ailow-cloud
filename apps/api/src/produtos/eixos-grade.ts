import {
  CORES_PADRAO,
  MAX_EIXOS_POR_CATEGORIA,
  TAMANHOS_PADRAO,
  categoriaEixosDefinirSchema,
  categoriaEixosResponseSchema,
  eixoGradeIdParamsSchema,
  eixoGradeNovoSchema,
  eixosGradeResponseSchema,
  erroSchema,
  slugDeNomeEixo,
  validarNomeValorEixo,
  valorEixoAlterarSchema,
  valorEixoIdParamsSchema,
  valorEixoNovoSchema,
  type TipoValorEixo,
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

/** Garante eixos sistema + valores padrão (ou cópia de opcoes_grade). Idempotente. */
export async function semearEixosSistemaSeVazio(c: pg.PoolClient, empresaId: string, em: Date): Promise<void> {
  await c.query(
    `INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema, criado_em)
     VALUES ($1, 'Tamanho', 'tamanho', 'tamanho', true, $2)
     ON CONFLICT (empresa_id, slug) DO NOTHING`,
    [empresaId, em],
  );
  await c.query(
    `INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema, criado_em)
     VALUES ($1, 'Cor', 'cor', 'cor', true, $2)
     ON CONFLICT (empresa_id, slug) DO NOTHING`,
    [empresaId, em],
  );

  const eixos = await c.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM eixos_grade WHERE slug IN ('tamanho', 'cor')`,
  );
  const idTamanho = eixos.rows.find((e) => e.slug === 'tamanho')?.id;
  const idCor = eixos.rows.find((e) => e.slug === 'cor')?.id;
  if (!idTamanho || !idCor) return;

  const nTam = await c.query(`SELECT count(*)::int AS n FROM valores_eixo WHERE eixo_id = $1`, [idTamanho]);
  if (nTam.rows[0].n === 0) {
    const deOpcoes = await c.query(`SELECT nome FROM opcoes_grade WHERE tipo = 'tamanho' ORDER BY seq`);
    const nomes = deOpcoes.rows.length > 0 ? deOpcoes.rows.map((r) => r.nome as string) : [...TAMANHOS_PADRAO];
    await c.query(
      `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, criado_em)
       SELECT $1, $2, nome, $4 FROM unnest($3::text[]) AS t(nome)
       ON CONFLICT DO NOTHING`,
      [empresaId, idTamanho, nomes, em],
    );
  }

  const nCor = await c.query(`SELECT count(*)::int AS n FROM valores_eixo WHERE eixo_id = $1`, [idCor]);
  if (nCor.rows[0].n === 0) {
    await c.query(
      `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, criado_em)
       SELECT $1, $2, o.nome, o.amostra, $3 FROM opcoes_grade o WHERE o.tipo = 'cor' ORDER BY o.seq
       ON CONFLICT DO NOTHING`,
      [empresaId, idCor, em],
    );
    const ainda = await c.query(`SELECT count(*)::int AS n FROM valores_eixo WHERE eixo_id = $1`, [idCor]);
    if (ainda.rows[0].n === 0) {
      await c.query(
        `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, criado_em)
         SELECT $1, $2, nome, amostra, $5 FROM unnest($3::text[], $4::text[]) AS t(nome, amostra)
         ON CONFLICT DO NOTHING`,
        [empresaId, idCor, CORES_PADRAO.map((x) => x.nome), CORES_PADRAO.map((x) => x.amostra), em],
      );
    }
  }

  // Categorias de produto sem eixos herdam tamanho + cor.
  await c.query(
    `INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq)
     SELECT c.empresa_id, c.id, $1::uuid, 0
     FROM categorias c
     WHERE c.tipo = 'produto'
       AND NOT EXISTS (SELECT 1 FROM categoria_eixos x WHERE x.categoria_id = c.id AND x.eixo_id = $1::uuid)
     ON CONFLICT DO NOTHING`,
    [idTamanho],
  );
  await c.query(
    `INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq)
     SELECT c.empresa_id, c.id, $1::uuid, 1
     FROM categorias c
     WHERE c.tipo = 'produto'
       AND NOT EXISTS (SELECT 1 FROM categoria_eixos x WHERE x.categoria_id = c.id AND x.eixo_id = $1::uuid)
     ON CONFLICT DO NOTHING`,
    [idCor],
  );
}

export async function registrarRotasEixosGrade(app: FastifyInstance, deps: Deps, g: Guardas): Promise<void> {
  const { pool, agora } = deps;
  const rotas = app.withTypeProvider<ZodTypeProvider>();
  const soDono = [g.exigirSessao, g.exigirPerfil('dono')];
  const erros = { 401: erroSchema, 403: erroSchema };

  rotas.get(
    '/eixos-grade',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Biblioteca de eixos da empresa (sistema + custom) com valores; 1ª leitura semeia Tamanho/Cor (Dono)',
        security: sessaoCookie,
        response: { 200: eixosGradeResponseSchema, ...erros },
      },
    },
    async (request) => {
      const s = sessaoDe(request);
      return withEmpresa(pool, s.empresaId, async (c) => {
        await semearEixosSistemaSeVazio(c, s.empresaId, agora());
        const eixos = await c.query(
          `SELECT id, nome, slug, tipo_valor, sistema, ativo FROM eixos_grade ORDER BY sistema DESC, seq, lower(nome)`,
        );
        const valores = await c.query(
          `SELECT id, eixo_id, nome, amostra, ativa FROM valores_eixo ORDER BY seq`,
        );
        const porEixo = new Map<string, { id: string; nome: string; amostra: string | null; ativa: boolean }[]>();
        for (const v of valores.rows) {
          const lista = porEixo.get(v.eixo_id as string) ?? [];
          lista.push({
            id: v.id as string,
            nome: v.nome as string,
            amostra: (v.amostra as string | null) ?? null,
            ativa: v.ativa as boolean,
          });
          porEixo.set(v.eixo_id as string, lista);
        }
        return {
          eixos: eixos.rows.map((e) => ({
            id: e.id as string,
            nome: e.nome as string,
            slug: e.slug as string,
            tipo_valor: e.tipo_valor as TipoValorEixo,
            sistema: e.sistema as boolean,
            ativo: e.ativo as boolean,
            valores: porEixo.get(e.id as string) ?? [],
          })),
        };
      });
    },
  );

  rotas.post(
    '/eixos-grade',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Cria eixo custom na biblioteca (slug derivado do nome); eixos sistema não se criam por aqui (Dono)',
        security: sessaoCookie,
        body: eixoGradeNovoSchema,
        response: { 201: z.object({ id: z.uuid(), slug: z.string() }), 400: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const slug = slugDeNomeEixo(request.body.nome);
      if (slug === 'tamanho' || slug === 'cor') {
        return reply.code(400).send({ erro: 'slug_reservado' });
      }
      try {
        const criado = await withEmpresa(pool, s.empresaId, async (c) => {
          await semearEixosSistemaSeVazio(c, s.empresaId, agora());
          const r = await c.query(
            `INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema, criado_em)
             VALUES ($1, $2, $3, $4, false, $5) RETURNING id, slug`,
            [s.empresaId, request.body.nome, slug, request.body.tipo_valor, agora()],
          );
          const id = r.rows[0].id as string;
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: id,
            tipo: 'eixo_grade_criado',
            em: agora(),
          });
          return { id, slug: r.rows[0].slug as string };
        });
        return reply.code(201).send(criado);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'eixo_ja_existe' });
        }
        throw err;
      }
    },
  );

  rotas.post(
    '/eixos-grade/:id/valores',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Adiciona valor a um eixo (regra conforme tipo_valor do eixo) (Dono)',
        security: sessaoCookie,
        params: eixoGradeIdParamsSchema,
        body: valorEixoNovoSchema,
        response: { 201: z.object({ id: z.uuid() }), 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { id: eixoId } = request.params;
      try {
        const res = await withEmpresa(pool, s.empresaId, async (c) => {
          const eixo = await c.query(`SELECT tipo_valor FROM eixos_grade WHERE id = $1`, [eixoId]);
          if (eixo.rows.length === 0) return 'nao_encontrado' as const;
          const tipo = eixo.rows[0].tipo_valor as TipoValorEixo;
          let nome: string;
          try {
            nome = validarNomeValorEixo(tipo, request.body.nome);
          } catch {
            return 'invalido' as const;
          }
          const amostra = tipo === 'cor' ? (request.body.amostra ?? null) : null;
          if (tipo !== 'cor' && request.body.amostra != null) return 'invalido' as const;
          const r = await c.query(
            `INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, criado_em)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [s.empresaId, eixoId, nome, amostra, agora()],
          );
          const novo = r.rows[0].id as string;
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: novo,
            tipo: 'valor_eixo_criado',
            em: agora(),
          });
          return { id: novo };
        });
        if (res === 'nao_encontrado') return naoEncontrado(reply);
        if (res === 'invalido') return reply.code(400).send({ erro: 'valor_invalido' });
        return reply.code(201).send(res);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'valor_ja_existe' });
        }
        throw err;
      }
    },
  );

  rotas.put(
    '/eixos-grade/valores/:id',
    {
      preValidation: soDono,
      schema: {
        tags: ['produtos'],
        summary: 'Renomeia, troca amostra ou (des)ativa um valor; nada é apagado (Dono)',
        security: sessaoCookie,
        params: valorEixoIdParamsSchema,
        body: valorEixoAlterarSchema,
        response: { 204: semConteudo, 400: erroSchema, 404: erroSchema, 409: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { id } = request.params;
      try {
        const res = await withEmpresa(pool, s.empresaId, async (c) => {
          const atual = await c.query(
            `SELECT v.id, e.tipo_valor FROM valores_eixo v
             JOIN eixos_grade e ON e.id = v.eixo_id WHERE v.id = $1 FOR UPDATE`,
            [id],
          );
          if (atual.rows.length === 0) return 'nao_encontrado' as const;
          const tipo = atual.rows[0].tipo_valor as TipoValorEixo;
          let nome: string;
          try {
            nome = validarNomeValorEixo(tipo, request.body.nome);
          } catch {
            return 'invalido' as const;
          }
          if (tipo !== 'cor' && request.body.amostra !== null) return 'invalido' as const;
          await c.query(`UPDATE valores_eixo SET nome = $2, amostra = $3, ativa = $4 WHERE id = $1`, [
            id,
            nome,
            request.body.amostra,
            request.body.ativa,
          ]);
          await registrarEvento(c, {
            empresaId: s.empresaId,
            atorTipo: 'usuario',
            atorId: s.usuarioId,
            alvoId: id,
            tipo: 'valor_eixo_alterado',
            em: agora(),
          });
          return 'ok' as const;
        });
        if (res === 'nao_encontrado') return naoEncontrado(reply);
        if (res === 'invalido') return reply.code(400).send({ erro: 'valor_invalido' });
        return reply.code(204).send(null);
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
          return reply.code(409).send({ erro: 'valor_ja_existe' });
        }
        throw err;
      }
    },
  );

  rotas.get(
    '/categorias/:id/eixos',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: 'Eixos ativos da categoria de produto, na ordem do wizard (Dono)',
        security: sessaoCookie,
        params: z.object({ id: z.uuid() }),
        response: { 200: categoriaEixosResponseSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { id } = request.params;
      const res = await withEmpresa(pool, s.empresaId, async (c) => {
        await semearEixosSistemaSeVazio(c, s.empresaId, agora());
        const cat = await c.query(`SELECT id FROM categorias WHERE id = $1 AND tipo = 'produto'`, [id]);
        if (cat.rows.length === 0) return null;
        const r = await c.query(
          `SELECT ce.eixo_id, e.slug, e.nome, e.tipo_valor, ce.seq
           FROM categoria_eixos ce
           JOIN eixos_grade e ON e.id = ce.eixo_id
           WHERE ce.categoria_id = $1
           ORDER BY ce.seq, e.slug`,
          [id],
        );
        return {
          eixos: r.rows.map((x) => ({
            eixo_id: x.eixo_id as string,
            slug: x.slug as string,
            nome: x.nome as string,
            tipo_valor: x.tipo_valor as TipoValorEixo,
            seq: x.seq as number,
          })),
        };
      });
      if (!res) return naoEncontrado(reply);
      return res;
    },
  );

  rotas.put(
    '/categorias/:id/eixos',
    {
      preValidation: soDono,
      schema: {
        tags: ['configuracoes'],
        summary: `Define quais eixos a categoria usa (máx. ${MAX_EIXOS_POR_CATEGORIA}) e a ordem (Dono)`,
        security: sessaoCookie,
        params: z.object({ id: z.uuid() }),
        body: categoriaEixosDefinirSchema,
        response: { 204: semConteudo, 400: erroSchema, 404: erroSchema, ...erros },
      },
    },
    async (request, reply) => {
      const s = sessaoDe(request);
      const { id } = request.params;
      const res = await withEmpresa(pool, s.empresaId, async (c) => {
        await semearEixosSistemaSeVazio(c, s.empresaId, agora());
        const cat = await c.query(`SELECT id FROM categorias WHERE id = $1 AND tipo = 'produto' FOR UPDATE`, [id]);
        if (cat.rows.length === 0) return 'nao_encontrado' as const;
        if (request.body.eixos.length > MAX_EIXOS_POR_CATEGORIA) return 'limite' as const;
        const ids = request.body.eixos.map((e) => e.eixo_id);
        if (ids.length > 0) {
          const ok = await c.query(`SELECT count(*)::int AS n FROM eixos_grade WHERE id = ANY($1::uuid[]) AND ativo`, [
            ids,
          ]);
          if (ok.rows[0].n !== ids.length) return 'eixo_invalido' as const;
        }
        await c.query(`DELETE FROM categoria_eixos WHERE categoria_id = $1`, [id]);
        for (const item of request.body.eixos) {
          await c.query(
            `INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq) VALUES ($1, $2, $3, $4)`,
            [s.empresaId, id, item.eixo_id, item.seq],
          );
        }
        await registrarEvento(c, {
          empresaId: s.empresaId,
          atorTipo: 'usuario',
          atorId: s.usuarioId,
          alvoId: id,
          tipo: 'categoria_eixos_definidos',
          em: agora(),
        });
        return 'ok' as const;
      });
      if (res === 'nao_encontrado') return naoEncontrado(reply);
      if (res === 'limite') return reply.code(400).send({ erro: 'limite_eixos' });
      if (res === 'eixo_invalido') return reply.code(400).send({ erro: 'eixo_invalido' });
      return reply.code(204).send(null);
    },
  );
}
