import { type Cliente, type ClienteNovo, LIMITE_CLIENTES_NA_LISTA, digitosDaBusca } from '@ailow/shared';
import type pg from 'pg';

// Dados de Clientes (S09, RF-CLI-01…04; D8; ADR 007). Toda consulta roda dentro de `withEmpresa`: a RLS isola a empresa.
export class ErroCliente extends Error {
  constructor(readonly codigo: 'celular_ja_cadastrado' | 'cliente_anonimizado' | 'nao_encontrado') {
    super(codigo);
  }
}

const COLUNAS = 'id, nome, celular, aviso_lgpd_em, anonimizado_em, criado_em';
const NOME_ANONIMIZADO = 'Cliente anonimizado';
const UNIQUE_VIOLATION = '23505';

interface Linha {
  id: string;
  nome: string;
  celular: string | null;
  aviso_lgpd_em: Date | null;
  anonimizado_em: Date | null;
  criado_em: Date;
}

const paraCliente = (l: Linha): Cliente => ({
  id: l.id,
  nome: l.nome,
  celular: l.celular,
  aviso_lgpd_em: l.aviso_lgpd_em?.toISOString() ?? null,
  anonimizado_em: l.anonimizado_em?.toISOString() ?? null,
  criado_em: l.criado_em.toISOString(),
});

// Busca sem acento nem caixa, como a de produtos: o Postgres do v1 não traz a extensão `unaccent`.
const COM_ACENTO = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTO = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';
const semAcento = (t: string) =>
  [...t].map((ch) => (COM_ACENTO.includes(ch) ? (SEM_ACENTO[COM_ACENTO.indexOf(ch)] as string) : ch)).join('');
// `%`, `_` e `\` valem como letras na busca, não como curinga do LIKE.
const comoTexto = (t: string) => t.replace(/[\\%_]/g, (m) => `\\${m}`);

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
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) throw new ErroCliente('celular_ja_cadastrado');
    throw err;
  }
}

/** RF-CLI-02: por pedaço do nome ou do celular. Anonimizados ficam de fora (já não há quem procurar). */
export async function listarClientes(
  c: pg.PoolClient,
  q: string | undefined,
): Promise<{ clientes: Cliente[]; truncado: boolean }> {
  const busca = q?.trim() ?? '';
  const digitos = digitosDaBusca(busca);
  const porNome = `%${comoTexto(semAcento(busca).toLowerCase())}%`;
  const porCelular = digitos === '' ? null : `%${digitos}%`;
  const r = await c.query(
    `SELECT ${COLUNAS}
       FROM clientes
      WHERE anonimizado_em IS NULL
        AND ($1::text = ''
             OR lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')) LIKE $2 ESCAPE '\\'
             OR ($3::text IS NOT NULL AND celular LIKE $3))
      ORDER BY lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')), id
      LIMIT ${LIMITE_CLIENTES_NA_LISTA + 1}`,
    [busca, porNome, porCelular],
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

/** Trava a linha até o fim da transação, para decidir (aviso já dado? já anonimizado?) sem corrida. */
async function travar(c: pg.PoolClient, id: string): Promise<Linha> {
  const r = await c.query(`SELECT ${COLUNAS} FROM clientes WHERE id = $1 FOR UPDATE`, [id]);
  if (!r.rows[0]) throw new ErroCliente('nao_encontrado');
  return r.rows[0] as Linha;
}

/** RF-CLI-04: registra a data do aviso de finalidade. Repetir mantém a data do primeiro aviso (evidência). */
export async function registrarAviso(c: pg.PoolClient, id: string, agora: Date): Promise<{ cliente: Cliente; mudou: boolean }> {
  const atual = await travar(c, id);
  if (atual.anonimizado_em) throw new ErroCliente('cliente_anonimizado');
  if (atual.aviso_lgpd_em) return { cliente: paraCliente(atual), mudou: false };
  const r = await c.query(`UPDATE clientes SET aviso_lgpd_em = $2 WHERE id = $1 RETURNING ${COLUNAS}`, [id, agora]);
  return { cliente: paraCliente(r.rows[0] as Linha), mudou: true };
}

/** RF-CLI-04: apaga nome e celular e guarda a data. A linha fica para as vendas (S10) apontarem para ela. */
export async function anonimizarCliente(c: pg.PoolClient, id: string, agora: Date): Promise<Cliente> {
  const atual = await travar(c, id);
  if (atual.anonimizado_em) throw new ErroCliente('cliente_anonimizado');
  const r = await c.query(
    `UPDATE clientes SET nome = $2, celular = NULL, anonimizado_em = $3 WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, NOME_ANONIMIZADO, agora],
  );
  return paraCliente(r.rows[0] as Linha);
}
