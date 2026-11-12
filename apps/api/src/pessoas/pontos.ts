import {
  type AjusteEditar,
  type AjusteExcluir,
  type AjusteNovo,
  type ErroSequencia,
  INTERVALO_MINIMO_SEGUNDOS,
  type Espelho,
  type Marca,
  type PontoEstado,
  montarDias,
  proximoTipo,
  sequenciaValida,
} from '@ailow/shared';
import type pg from 'pg';
import { FUSO } from '../financeiro/lancamentos.js';

// Ponto (S12, RF-PES-01/02/03, ADR 008). A hora da batida é sempre a do servidor; a empresa e o usuário vêm da sessão.
// "Marca ativa" = removido_em IS NULL. Excluir é lógico; toda mudança do Dono deixa registro em pontos_ajustes (AUD-03).

export type CodigoErroPonto = 'muito_rapido' | 'nao_encontrado' | 'no_futuro' | ErroSequencia;

export class ErroPonto extends Error {
  constructor(readonly codigo: CodigoErroPonto) {
    super(codigo);
  }
}

const UNIQUE_VIOLATION = '23505';

interface LinhaMarca {
  id: string;
  tipo: 'entrada' | 'saida';
  registrado_em: Date;
  ajustado: boolean;
}

const COLUNAS = 'id, tipo, registrado_em, ajustado';

const comoMarca = (l: LinhaMarca): Marca & { ajustado: boolean } => ({
  id: l.id,
  tipo: l.tipo,
  registrado_em: l.registrado_em.toISOString(),
  ajustado: l.ajustado,
});

// Serializa tudo o que mexe nas marcas de um usuário (batida e ajustes): a sequência é validada sob este lock.
async function travarUsuario(c: pg.PoolClient, usuarioId: string): Promise<void> {
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ponto:${usuarioId}`]);
}

async function ultimaMarca(c: pg.PoolClient, usuarioId: string): Promise<LinhaMarca | null> {
  const r = await c.query(
    `SELECT ${COLUNAS} FROM pontos WHERE usuario_id = $1 AND removido_em IS NULL
      ORDER BY registrado_em DESC, id DESC LIMIT 1`,
    [usuarioId],
  );
  return (r.rows[0] as LinhaMarca | undefined) ?? null;
}

/** Estado do botão: o que a próxima batida vai ser. */
export async function estadoDoPonto(c: pg.PoolClient, usuarioId: string): Promise<PontoEstado> {
  const ultima = await ultimaMarca(c, usuarioId);
  return { proximo: proximoTipo(ultima?.tipo ?? null), ultima: ultima ? comoMarca(ultima) : null };
}

/**
 * RF-PES-01: alterna entrada/saída. O lock por usuário serializa batidas simultâneas.
 * Toque duplo (< 30 s) é recusado sem gravar nada.
 */
export async function baterPonto(
  c: pg.PoolClient,
  ctx: { empresaId: string; usuarioId: string; agora: Date },
): Promise<{ marca: Marca & { ajustado: boolean }; proximo: 'entrada' | 'saida' }> {
  await travarUsuario(c, ctx.usuarioId);
  const ultima = await ultimaMarca(c, ctx.usuarioId);
  if (ultima && (ctx.agora.getTime() - ultima.registrado_em.getTime()) / 1000 < INTERVALO_MINIMO_SEGUNDOS) {
    throw new ErroPonto('muito_rapido');
  }
  const tipo = proximoTipo(ultima?.tipo ?? null);
  const r = await c.query(
    `INSERT INTO pontos (empresa_id, usuario_id, tipo, registrado_em)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUNAS}`,
    [ctx.empresaId, ctx.usuarioId, tipo, ctx.agora],
  );
  return { marca: comoMarca(r.rows[0] as LinhaMarca), proximo: proximoTipo(tipo) };
}

/**
 * RF-PES-02: espelho do mês (fuso São Paulo). Um turno pertence ao mês e ao dia da ENTRADA; a saída que cai
 * depois da virada vem junto. Só aparece quem tem batida ativa no mês.
 */
export async function espelhoDoMes(c: pg.PoolClient, mes: string, usuarioId: string | null): Promise<Espelho> {
  if (usuarioId) {
    const existe = await c.query('SELECT 1 FROM usuarios WHERE id = $1', [usuarioId]);
    if (existe.rowCount !== 1) throw new ErroPonto('nao_encontrado');
  }
  // A janela (lag) é calculada sobre as marcas ativas ANTES do filtro do mês: a saída herda o instante da entrada.
  const r = await c.query(
    `WITH janela AS (
       SELECT date_trunc('month', $1::timestamp) AT TIME ZONE $2::text AS ini,
              (date_trunc('month', $1::timestamp) + interval '1 month') AT TIME ZONE $2::text AS fim
     ), ativas AS (
       SELECT p.id, p.usuario_id, p.tipo, p.registrado_em, p.ajustado,
              lag(p.registrado_em) OVER (PARTITION BY p.usuario_id ORDER BY p.registrado_em, p.id) AS anterior_em
         FROM pontos p
        WHERE p.removido_em IS NULL AND ($3::uuid IS NULL OR p.usuario_id = $3::uuid)
     )
     SELECT a.id, a.usuario_id, a.tipo, a.registrado_em, a.ajustado, u.nome
       FROM ativas a
       JOIN usuarios u ON u.id = a.usuario_id
       CROSS JOIN janela j
      WHERE (a.tipo = 'entrada' AND a.registrado_em >= j.ini AND a.registrado_em < j.fim)
         OR (a.tipo = 'saida' AND a.anterior_em >= j.ini AND a.anterior_em < j.fim)
      ORDER BY lower(u.nome), u.id, a.registrado_em, a.id`,
    [mes, FUSO, usuarioId],
  );
  const linhas = r.rows as (LinhaMarca & { usuario_id: string; nome: string })[];

  const porUsuario = new Map<string, { nome: string; marcas: Marca[] }>();
  for (const l of linhas) {
    const u = porUsuario.get(l.usuario_id) ?? { nome: l.nome, marcas: [] };
    u.marcas.push(comoMarca(l));
    porUsuario.set(l.usuario_id, u);
  }
  return {
    mes: `${mes.slice(0, 7)}-01`,
    usuarios: [...porUsuario].map(([id, u]) => {
      const dias = montarDias(u.marcas);
      return {
        usuario_id: id,
        nome: u.nome,
        total_segundos: dias.reduce((soma, d) => soma + d.trabalhado_segundos, 0),
        dias,
      };
    }),
  };
}

// ------------------------------------------------------------------ ajustes do Dono (RF-PES-03)

interface CtxAjuste {
  empresaId: string;
  autorId: string;
  agora: Date;
}

/** "AAAA-MM-DD" + "HH:MM" no relógio de São Paulo -> instante. Quem converte é o banco (sem conta de fuso no app). */
async function instanteDe(c: pg.PoolClient, data: string, hora: string, agora: Date): Promise<Date> {
  const r = await c.query('SELECT (($1::date + $2::time)::timestamp AT TIME ZONE $3::text) AS em', [data, hora, FUSO]);
  const em = r.rows[0].em as Date;
  if (em.getTime() > agora.getTime()) throw new ErroPonto('no_futuro');
  return em;
}

/** Depois de qualquer mudança, as marcas ativas do usuário têm de continuar alternando. Falhou = a transação desfaz. */
async function exigirSequencia(c: pg.PoolClient, usuarioId: string): Promise<void> {
  const r = await c.query('SELECT tipo, registrado_em FROM pontos WHERE usuario_id = $1 AND removido_em IS NULL', [usuarioId]);
  const marcas = (r.rows as { tipo: 'entrada' | 'saida'; registrado_em: Date }[]).map((m) => ({
    tipo: m.tipo,
    registrado_em: m.registrado_em.toISOString(),
  }));
  const ok = sequenciaValida(marcas);
  if (!ok.ok) throw new ErroPonto(ok.erro);
}

const estadoDaMarca = (l: { tipo: string; registrado_em: Date }) => JSON.stringify({ tipo: l.tipo, registrado_em: l.registrado_em.toISOString() });

async function registrarAjuste(
  c: pg.PoolClient,
  ctx: CtxAjuste,
  e: { pontoId: string; acao: 'adicionar' | 'editar' | 'excluir'; motivo: string; antes: string | null; depois: string | null },
): Promise<void> {
  await c.query(
    `INSERT INTO pontos_ajustes (empresa_id, ponto_id, ator_id, acao, motivo, antes, depois, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
    [ctx.empresaId, e.pontoId, ctx.autorId, e.acao, e.motivo, e.antes, e.depois, ctx.agora],
  );
}

const eHorarioRepetido = (err: unknown) => (err as { code?: string }).code === UNIQUE_VIOLATION;

/** Marca ativa por id, com o lock do dono dela já tomado. 404 se não existe, é de outra empresa ou já foi excluída. */
async function carregarAtiva(c: pg.PoolClient, id: string): Promise<LinhaMarca & { usuario_id: string }> {
  const achar = () =>
    c.query(`SELECT ${COLUNAS}, usuario_id FROM pontos WHERE id = $1 AND removido_em IS NULL`, [id]);
  const primeira = await achar();
  if (primeira.rowCount !== 1) throw new ErroPonto('nao_encontrado');
  await travarUsuario(c, primeira.rows[0].usuario_id as string);
  const r = await achar(); // relê sob o lock: outra requisição pode ter excluído nesse meio tempo
  if (r.rowCount !== 1) throw new ErroPonto('nao_encontrado');
  return r.rows[0] as LinhaMarca & { usuario_id: string };
}

export async function adicionarPonto(c: pg.PoolClient, ctx: CtxAjuste, n: AjusteNovo): Promise<Marca & { ajustado: boolean }> {
  const existe = await c.query('SELECT 1 FROM usuarios WHERE id = $1', [n.usuario_id]);
  if (existe.rowCount !== 1) throw new ErroPonto('nao_encontrado');
  await travarUsuario(c, n.usuario_id);
  const em = await instanteDe(c, n.data, n.hora, ctx.agora);
  try {
    const r = await c.query(
      `INSERT INTO pontos (empresa_id, usuario_id, tipo, registrado_em, ajustado)
       VALUES ($1, $2, $3, $4, true)
       RETURNING ${COLUNAS}`,
      [ctx.empresaId, n.usuario_id, n.tipo, em],
    );
    const linha = r.rows[0] as LinhaMarca;
    await registrarAjuste(c, ctx, { pontoId: linha.id, acao: 'adicionar', motivo: n.motivo, antes: null, depois: estadoDaMarca(linha) });
    await exigirSequencia(c, n.usuario_id);
    return comoMarca(linha);
  } catch (err) {
    if (eHorarioRepetido(err)) throw new ErroPonto('horario_repetido');
    throw err;
  }
}

export async function editarPonto(c: pg.PoolClient, ctx: CtxAjuste, id: string, e: AjusteEditar): Promise<Marca & { ajustado: boolean }> {
  const antes = await carregarAtiva(c, id);
  const em = await instanteDe(c, e.data, e.hora, ctx.agora);
  try {
    const r = await c.query(`UPDATE pontos SET registrado_em = $2, ajustado = true WHERE id = $1 RETURNING ${COLUNAS}`, [id, em]);
    const linha = r.rows[0] as LinhaMarca;
    await registrarAjuste(c, ctx, { pontoId: id, acao: 'editar', motivo: e.motivo, antes: estadoDaMarca(antes), depois: estadoDaMarca(linha) });
    await exigirSequencia(c, antes.usuario_id);
    return comoMarca(linha);
  } catch (err) {
    if (eHorarioRepetido(err)) throw new ErroPonto('horario_repetido');
    throw err;
  }
}

export async function excluirPonto(c: pg.PoolClient, ctx: CtxAjuste, id: string, e: AjusteExcluir): Promise<void> {
  const antes = await carregarAtiva(c, id);
  await c.query('UPDATE pontos SET removido_em = $2, removido_por = $3 WHERE id = $1', [id, ctx.agora, ctx.autorId]);
  await registrarAjuste(c, ctx, { pontoId: id, acao: 'excluir', motivo: e.motivo, antes: estadoDaMarca(antes), depois: null });
  await exigirSequencia(c, antes.usuario_id);
}
