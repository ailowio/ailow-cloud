import {
  type Cliente,
  type ClienteEditar,
  type ClienteNovo,
  LIMITE_CLIENTES_NA_LISTA,
  type SITUACOES_CLIENTE,
  digitosDaBusca,
} from '@ailow/shared';
import type pg from 'pg';

// Dados de Clientes (S09/S09b, RF-CLI-01…05; D8; ADR 007). Toda consulta roda dentro de `withEmpresa`: a RLS isola a empresa.
// Nome e celular são dado pessoal: nunca entram em erro, log nem auditoria (a trilha guarda só o id).
export class ErroCliente extends Error {
  constructor(readonly codigo: 'celular_ja_cadastrado' | 'cliente_ja_inativo' | 'cliente_ja_ativo' | 'nao_encontrado') {
    super(codigo);
  }
}

const COLUNAS = 'id, nome, celular, aviso_lgpd_em, ativo, criado_em';
const UNIQUE_VIOLATION = '23505';

interface Linha {
  id: string;
  nome: string;
  celular: string;
  aviso_lgpd_em: Date | null;
  ativo: boolean;
  criado_em: Date;
}

const paraCliente = (l: Linha): Cliente => ({
  id: l.id,
  nome: l.nome,
  celular: l.celular,
  aviso_lgpd_em: l.aviso_lgpd_em?.toISOString() ?? null,
  ativo: l.ativo,
  criado_em: l.criado_em.toISOString(),
});

// Busca sem acento nem caixa, como a de produtos: o Postgres do v1 não traz a extensão `unaccent`.
const COM_ACENTO = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTO = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';
const semAcento = (t: string) =>
  [...t].map((ch) => (COM_ACENTO.includes(ch) ? (SEM_ACENTO[COM_ACENTO.indexOf(ch)] as string) : ch)).join('');
// `%`, `_` e `\` valem como letras na busca, não como curinga do LIKE.
const comoTexto = (t: string) => t.replace(/[\\%_]/g, (m) => `\\${m}`);

const eRepetido = (err: unknown) => (err as { code?: string }).code === UNIQUE_VIOLATION;

export async function criarCliente(
  c: pg.PoolClient,
  ctx: { empresaId: string; autorId: string; agora: Date },
  novo: ClienteNovo,
): Promise<{ id: string }> {
  try {
    const r = await c.query(
      `INSERT INTO clientes (empresa_id, nome, celular, aviso_lgpd_em, criado_por, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [ctx.empresaId, novo.nome, novo.celular, novo.aviso_lgpd ? ctx.agora : null, ctx.autorId, ctx.agora],
    );
    return { id: r.rows[0].id as string };
  } catch (err) {
    if (eRepetido(err)) throw new ErroCliente('celular_ja_cadastrado');
    throw err;
  }
}

/** RF-CLI-02: por pedaço do nome ou do celular. Por padrão só os ativos; os inativos ficam numa lista à parte. */
export async function listarClientes(
  c: pg.PoolClient,
  q: string | undefined,
  situacao: (typeof SITUACOES_CLIENTE)[number],
): Promise<{ clientes: Cliente[]; truncado: boolean }> {
  const busca = q?.trim() ?? '';
  const digitos = digitosDaBusca(busca);
  const porNome = `%${comoTexto(semAcento(busca).toLowerCase())}%`;
  const porCelular = digitos === '' ? null : `%${digitos}%`;
  const r = await c.query(
    `SELECT ${COLUNAS}
       FROM clientes
      WHERE ativo = $4
        AND ($1::text = ''
             OR lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')) LIKE $2 ESCAPE '\\'
             OR ($3::text IS NOT NULL AND celular LIKE $3))
      ORDER BY lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')), id
      LIMIT ${LIMITE_CLIENTES_NA_LISTA + 1}`,
    [busca, porNome, porCelular, situacao === 'ativos'],
  );
  return {
    clientes: (r.rows as Linha[]).slice(0, LIMITE_CLIENTES_NA_LISTA).map(paraCliente),
    truncado: r.rows.length > LIMITE_CLIENTES_NA_LISTA,
  };
}

export async function buscarCliente(c: pg.PoolClient, id: string): Promise<Cliente | null> {
  const r = await c.query(`SELECT ${COLUNAS} FROM clientes WHERE id = $1`, [id]);
  return r.rows[0] ? paraCliente(r.rows[0] as Linha) : null;
}

/** Trava a linha até o fim da transação, para decidir (aviso já dado? já inativo?) sem corrida. */
async function travar(c: pg.PoolClient, id: string): Promise<Linha> {
  const r = await c.query(`SELECT ${COLUNAS} FROM clientes WHERE id = $1 FOR UPDATE`, [id]);
  if (!r.rows[0]) throw new ErroCliente('nao_encontrado');
  return r.rows[0] as Linha;
}

/** RF-CLI-04: registra a data do aviso de finalidade. Repetir mantém a data do primeiro aviso (evidência). */
export async function registrarAviso(c: pg.PoolClient, id: string, agora: Date): Promise<{ cliente: Cliente; mudou: boolean }> {
  const atual = await travar(c, id);
  if (atual.aviso_lgpd_em) return { cliente: paraCliente(atual), mudou: false };
  const r = await c.query(`UPDATE clientes SET aviso_lgpd_em = $2 WHERE id = $1 RETURNING ${COLUNAS}`, [id, agora]);
  return { cliente: paraCliente(r.rows[0] as Linha), mudou: true };
}

/** RF-CLI-05: corrige nome e celular. Sem mudança real não grava nada (e a rota não gera auditoria). */
export async function editarCliente(
  c: pg.PoolClient,
  id: string,
  novo: ClienteEditar,
): Promise<{ cliente: Cliente; mudou: boolean }> {
  const atual = await travar(c, id);
  if (atual.nome === novo.nome && atual.celular === novo.celular) return { cliente: paraCliente(atual), mudou: false };
  try {
    const r = await c.query(`UPDATE clientes SET nome = $2, celular = $3 WHERE id = $1 RETURNING ${COLUNAS}`, [id, novo.nome, novo.celular]);
    return { cliente: paraCliente(r.rows[0] as Linha), mudou: true };
  } catch (err) {
    if (eRepetido(err)) throw new ErroCliente('celular_ja_cadastrado');
    throw err;
  }
}

/** RF-CLI-04: inativar (`ativo = false`) some da busca padrão e é reversível; o número continua reservado. */
export async function mudarSituacao(c: pg.PoolClient, id: string, ativo: boolean): Promise<Cliente> {
  const atual = await travar(c, id);
  if (atual.ativo === ativo) throw new ErroCliente(ativo ? 'cliente_ja_ativo' : 'cliente_ja_inativo');
  const r = await c.query(`UPDATE clientes SET ativo = $2 WHERE id = $1 RETURNING ${COLUNAS}`, [id, ativo]);
  return paraCliente(r.rows[0] as Linha);
}

/** RF-CLI-04: excluir de verdade (pedido do cliente). Apaga a linha e libera o número; irreversível. */
export async function excluirCliente(c: pg.PoolClient, id: string): Promise<void> {
  const r = await c.query('DELETE FROM clientes WHERE id = $1', [id]);
  if (r.rowCount === 0) throw new ErroCliente('nao_encontrado');
}
