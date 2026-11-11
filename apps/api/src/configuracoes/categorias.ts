import { CATEGORIAS_FINANCEIRAS_PADRAO } from '@ailow/shared';
import type pg from 'pg';

// Categorias financeiras (as de despesa e do relatório do Financeiro), separadas das de produto na mesma tabela
// (`categorias.tipo`). Estas funções recebem o cliente da transação do chamador (`withEmpresa`), que já traz a RLS.

/** Empresa nova começa com as categorias financeiras mais comuns; o Dono edita, desativa e cria outras. */
export async function semearCategoriasFinanceiras(c: pg.PoolClient, empresaId: string, em: Date): Promise<void> {
  await c.query(
    `INSERT INTO categorias (empresa_id, nome, tipo, criado_em)
     SELECT $1, nome, 'financeira', $3 FROM unnest($2::text[]) AS nome`,
    [empresaId, [...CATEGORIAS_FINANCEIRAS_PADRAO], em],
  );
}

/**
 * Procura uma categoria financeira ATIVA pelo nome, sem diferenciar maiúsculas nem espaços nas pontas.
 * Devolve o nome como o Dono o cadastrou (é esse que o lançamento guarda), ou null se não existir.
 */
export async function nomeDaCategoriaFinanceira(c: pg.PoolClient, digitado: string): Promise<string | null> {
  const r = await c.query(
    `SELECT nome FROM categorias
      WHERE tipo = 'financeira' AND ativa AND lower(btrim(nome)) = lower(btrim($1))`,
    [digitado],
  );
  return (r.rows[0]?.nome as string | undefined) ?? null;
}
