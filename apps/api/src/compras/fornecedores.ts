import {
  type Fornecedor,
  type FornecedorEditar,
  type FornecedorNovo,
  LIMITE_FORNECEDORES_NA_LISTA,
  digitosDaBusca,
} from '@ailow/shared';
import type pg from 'pg';

// Fornecedores (S11, RF-COM-01). Toda consulta roda dentro de `withEmpresa`. WhatsApp único por empresa.

export class ErroFornecedor extends Error {
  constructor(readonly codigo: 'whatsapp_ja_cadastrado' | 'nao_encontrado') {
    super(codigo);
    this.name = 'ErroFornecedor';
  }
}

const COLUNAS = 'id, nome, whatsapp, cnpj, criado_em';
const UNIQUE_VIOLATION = '23505';

interface Linha {
  id: string;
  nome: string;
  whatsapp: string;
  cnpj: string | null;
  criado_em: Date;
}

const paraFornecedor = (l: Linha): Fornecedor => ({
  id: l.id,
  nome: l.nome,
  whatsapp: l.whatsapp,
  cnpj: l.cnpj,
  criado_em: l.criado_em.toISOString(),
});

const COM_ACENTO = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTO = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';
const semAcento = (t: string) =>
  [...t].map((ch) => (COM_ACENTO.includes(ch) ? (SEM_ACENTO[COM_ACENTO.indexOf(ch)] as string) : ch)).join('');
const comoTexto = (t: string) => t.replace(/[\\%_]/g, (m) => `\\${m}`);
const eRepetido = (err: unknown) => (err as { code?: string }).code === UNIQUE_VIOLATION;

export async function criarFornecedor(
  c: pg.PoolClient,
  ctx: { empresaId: string },
  novo: FornecedorNovo,
): Promise<{ id: string }> {
  try {
    const r = await c.query(
      `INSERT INTO fornecedores (empresa_id, nome, whatsapp, cnpj)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [ctx.empresaId, novo.nome, novo.whatsapp, novo.cnpj],
    );
    return { id: r.rows[0].id as string };
  } catch (err) {
    if (eRepetido(err)) throw new ErroFornecedor('whatsapp_ja_cadastrado');
    throw err;
  }
}

export async function editarFornecedor(c: pg.PoolClient, id: string, dados: FornecedorEditar): Promise<Fornecedor> {
  try {
    const r = await c.query(
      `UPDATE fornecedores SET nome = $2, whatsapp = $3, cnpj = $4 WHERE id = $1 RETURNING ${COLUNAS}`,
      [id, dados.nome, dados.whatsapp, dados.cnpj],
    );
    if (r.rowCount !== 1) throw new ErroFornecedor('nao_encontrado');
    return paraFornecedor(r.rows[0] as Linha);
  } catch (err) {
    if (err instanceof ErroFornecedor) throw err;
    if (eRepetido(err)) throw new ErroFornecedor('whatsapp_ja_cadastrado');
    throw err;
  }
}

export async function buscarFornecedor(c: pg.PoolClient, id: string): Promise<Fornecedor | null> {
  const r = await c.query(`SELECT ${COLUNAS} FROM fornecedores WHERE id = $1`, [id]);
  const linha = r.rows[0] as Linha | undefined;
  return linha ? paraFornecedor(linha) : null;
}

/** Busca por pedaço do nome ou do WhatsApp. */
export async function listarFornecedores(
  c: pg.PoolClient,
  q: string | undefined,
): Promise<{ fornecedores: Fornecedor[]; truncado: boolean }> {
  const busca = q?.trim() ?? '';
  const digitos = digitosDaBusca(busca);
  const porNome = `%${comoTexto(semAcento(busca).toLowerCase())}%`;
  const porZap = digitos === '' ? null : `%${digitos}%`;
  const r = await c.query(
    `SELECT ${COLUNAS}
       FROM fornecedores
      WHERE $1::text = ''
         OR lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')) LIKE $2 ESCAPE '\\'
         OR ($3::text IS NOT NULL AND whatsapp LIKE $3)
      ORDER BY lower(translate(nome, '${COM_ACENTO}', '${SEM_ACENTO}')), id
      LIMIT ${LIMITE_FORNECEDORES_NA_LISTA + 1}`,
    [busca, porNome, porZap],
  );
  return {
    fornecedores: (r.rows as Linha[]).slice(0, LIMITE_FORNECEDORES_NA_LISTA).map(paraFornecedor),
    truncado: r.rows.length > LIMITE_FORNECEDORES_NA_LISTA,
  };
}
