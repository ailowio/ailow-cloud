import { type MovimentoNovo, movimentoNovoSchema } from '@ailow/shared';
import type pg from 'pg';

// INTERFACE PÚBLICA de estoque (RN-03, RN-08, ADR 006). Vendas e Compras mexem no saldo só por aqui, passando o
// cliente da PRÓPRIA transação: o movimento entra ou sai junto com a venda/compra. Este é o único arquivo (com o
// resto de src/produtos/) que toca as tabelas `skus` e `movimentos_estoque`.

export interface ContextoEstoque {
  empresaId: string;
  // Usuário que está agindo (vem da sessão do chamador, nunca do corpo da requisição).
  autorId: string;
  agora: Date;
}

export type CodigoErroEstoque = 'nao_encontrado' | 'estoque_insuficiente';

// Falha de regra de negócio esperada (a rota a traduz em 404/409); o resto sobe como erro inesperado.
export class ErroEstoque extends Error {
  constructor(readonly codigo: CodigoErroEstoque) {
    super(codigo);
    this.name = 'ErroEstoque';
  }
}

/**
 * Soma `quantidade` (com sinal) ao saldo do SKU e grava o movimento imutável, na transação do chamador.
 * RN-03: o UPDATE só acontece se o saldo resultante for >= 0 e a linha fica travada até o fim da transação;
 * duas baixas simultâneas enfileiram e a 2ª vê o saldo já descontado. O CHECK do banco é a última trava.
 */
export async function registrarMovimento(
  c: pg.PoolClient,
  ctx: ContextoEstoque,
  entrada: MovimentoNovo,
): Promise<{ id: string; estoque: number }> {
  const m = movimentoNovoSchema.parse(entrada);
  const atualizado = await c.query(
    'UPDATE skus SET estoque = estoque + $2 WHERE id = $1 AND estoque + $2 >= 0 RETURNING estoque',
    [m.skuId, m.quantidade],
  );
  if (atualizado.rowCount !== 1) {
    // Nenhuma linha: o SKU não existe (ou é de outra empresa, a RLS esconde) ou o saldo não comporta a baixa.
    const existe = await c.query('SELECT 1 FROM skus WHERE id = $1', [m.skuId]);
    throw new ErroEstoque(existe.rowCount === 1 ? 'estoque_insuficiente' : 'nao_encontrado');
  }
  const estoque = atualizado.rows[0].estoque as number;
  const gravado = await c.query(
    `INSERT INTO movimentos_estoque
       (empresa_id, sku_id, tipo, quantidade, saldo_apos, motivo, origem_id, autor_id, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [ctx.empresaId, m.skuId, m.tipo, m.quantidade, estoque, m.motivo, m.origemId ?? null, ctx.autorId, ctx.agora],
  );
  return { id: gravado.rows[0].id as string, estoque };
}
