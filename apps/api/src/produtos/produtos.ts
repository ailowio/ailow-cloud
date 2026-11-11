import {
  type AlertaEstoque,
  type Movimento,
  type Perfil,
  type Produto,
  type ProdutoNovo,
  type Sku,
  atribuirCodigosDeCor,
  chaveCor,
  compararTamanhos,
  faixaDePreco,
  montarCodigoSku,
  NUMERO_MAXIMO_PRODUTO,
} from '@ailow/shared';
import type pg from 'pg';
import { type ContextoEstoque, registrarMovimento } from './estoque.js';

// Cadastro, consulta e alertas de Produtos (S07). Só este módulo (src/produtos/) toca as tabelas `produtos`, `skus`
// e `movimentos_estoque` (ADR 006). Recebem o cliente da transação do chamador (`withEmpresa`), que já traz a RLS.

export type CodigoErroProduto = 'categoria_invalida' | 'atributos_invalidos' | 'limite_de_produtos';

export class ErroProduto extends Error {
  constructor(readonly codigo: CodigoErroProduto) {
    super(codigo);
    this.name = 'ErroProduto';
  }
}

export const LIMITE_PRODUTOS_NA_LISTA = 200;
export const LIMITE_ALERTAS_NA_LISTA = 50;
export const LIMITE_MOVIMENTOS = 50;

/**
 * RF-PRO-01/02: cria o produto, os seus SKUs (código curto PPPP-TT-CCC) e o estoque inicial, tudo na transação do
 * chamador. O número do produto é sequencial por empresa; a trava de aviso (advisory lock) faz duas criações
 * simultâneas receberem números diferentes, sem buraco.
 */
export async function criarProduto(
  c: pg.PoolClient,
  ctx: ContextoEstoque,
  p: ProdutoNovo,
): Promise<{ id: string; numero: number; skus: { id: string; codigo: string }[] }> {
  // A categoria tem de ser de PRODUTO, ativa e da empresa (a RLS esconde as demais).
  const cat = await c.query("SELECT atributos FROM categorias WHERE id = $1 AND tipo = 'produto' AND ativa", [p.categoria_id]);
  if (cat.rowCount !== 1) throw new ErroProduto('categoria_invalida');

  // O produto guarda a grafia da categoria ("Bojo"), não a digitada ("bojo").
  const daCategoria = new Map((cat.rows[0].atributos as string[]).map((a) => [a.toLowerCase(), a]));
  const atributos = p.atributos.map((a) => daCategoria.get(a.toLowerCase()));
  if (atributos.some((a) => a === undefined)) throw new ErroProduto('atributos_invalidos');

  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`produtos:${ctx.empresaId}`]);
  const proximo = await c.query('SELECT coalesce(max(numero), 0) + 1 AS numero FROM produtos');
  const numero = Number(proximo.rows[0].numero);
  if (numero > NUMERO_MAXIMO_PRODUTO) throw new ErroProduto('limite_de_produtos');

  const criado = await c.query(
    `INSERT INTO produtos
       (empresa_id, numero, nome, categoria_id, porte, atributos, fornecedor, custo_centavos, preco_centavos, criado_por, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      ctx.empresaId,
      numero,
      p.nome,
      p.categoria_id,
      p.porte,
      atributos,
      p.fornecedor,
      p.custo_centavos,
      p.preco_centavos,
      ctx.autorId,
      ctx.agora,
    ],
  );
  const produtoId = criado.rows[0].id as string;

  // A mesma cor tem o mesmo código (e a mesma grafia) em todos os tamanhos do produto.
  const codigosDeCor = atribuirCodigosDeCor(p.skus.map((s) => s.cor));
  const grafia = new Map<string, string>();
  for (const s of p.skus) if (!grafia.has(chaveCor(s.cor))) grafia.set(chaveCor(s.cor), s.cor);

  const skus: { id: string; codigo: string }[] = [];
  for (const s of p.skus) {
    const chave = chaveCor(s.cor);
    const corCodigo = codigosDeCor.get(chave) as string;
    const codigo = montarCodigoSku(numero, s.tamanho, corCodigo);
    const sku = await c.query(
      `INSERT INTO skus (empresa_id, produto_id, tamanho, cor, cor_codigo, codigo, estoque, estoque_minimo, criado_em)
       VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8)
       RETURNING id`,
      [ctx.empresaId, produtoId, s.tamanho, grafia.get(chave), corCodigo, codigo, s.estoque_minimo, ctx.agora],
    );
    const skuId = sku.rows[0].id as string;
    if (s.estoque_inicial > 0) {
      await registrarMovimento(c, ctx, { skuId, tipo: 'inicial', quantidade: s.estoque_inicial, motivo: 'Estoque inicial' });
    }
    skus.push({ id: skuId, codigo });
  }
  return { id: produtoId, numero, skus };
}

// --------------------------------------------------------------------------- consulta (RF-PRO-03, RF-PRO-07)

// Letras com acento -> sem acento, maiúsculas e minúsculas, para a busca não depender do locale do banco.
const COM_ACENTO = 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç';
const SEM_ACENTO = 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc';

const semAcento = (t: string) =>
  [...t].map((ch) => (COM_ACENTO.includes(ch) ? (SEM_ACENTO[COM_ACENTO.indexOf(ch)] as string) : ch)).join('');

// % _ \ viram texto comum no LIKE.
const comoTexto = (t: string) => t.replace(/[\\%_]/g, (m) => `\\${m}`);

// RF-PRO-07: o custo e o fornecedor nunca são nem SELECIONADOS para o Vendedor (a resposta também os descarta).
const COLUNAS_PRODUTO_BASE = `p.id, p.numero, p.nome, p.categoria_id, c.nome AS categoria_nome, p.porte, p.atributos,
  p.preco_centavos, p.ativo`;
const COLUNAS_PRODUTO_DONO = `${COLUNAS_PRODUTO_BASE}, p.custo_centavos, p.fornecedor`;
const COLUNAS_SKU_BASE = 's.id, s.produto_id, s.codigo, s.tamanho, s.cor, s.estoque';
const COLUNAS_SKU_DONO = `${COLUNAS_SKU_BASE}, s.estoque_minimo`;

/**
 * Lista os produtos ativos, com os SKUs. `q` busca por nome (sem acento nem caixa), por código do SKU e por preço
 * ("89,90" exato; "89" a faixa de R$ 89,00 a R$ 89,99). O Vendedor recebe produto, preço e estoque, sem custo.
 */
export async function listarProdutos(
  c: pg.PoolClient,
  perfil: Perfil,
  q: string | undefined,
): Promise<{ produtos: Produto[]; truncado: boolean }> {
  const dono = perfil === 'dono';
  const busca = q?.trim() ?? '';
  const preco = busca === '' ? null : faixaDePreco(busca);
  const porNome = `%${comoTexto(semAcento(busca).toLowerCase())}%`;
  const porCodigo = `%${comoTexto(busca.toUpperCase())}%`;

  const produtos = await c.query(
    `SELECT ${dono ? COLUNAS_PRODUTO_DONO : COLUNAS_PRODUTO_BASE}
       FROM produtos p
       JOIN categorias c ON c.empresa_id = p.empresa_id AND c.id = p.categoria_id
      WHERE p.ativo
        AND ($1::text = ''
             OR lower(translate(p.nome, '${COM_ACENTO}', '${SEM_ACENTO}')) LIKE $2 ESCAPE '\\'
             OR EXISTS (SELECT 1 FROM skus k WHERE k.produto_id = p.id AND k.codigo LIKE $3 ESCAPE '\\')
             OR ($4::int IS NOT NULL AND p.preco_centavos BETWEEN $4::int AND $5::int))
      ORDER BY lower(p.nome), p.numero
      LIMIT ${LIMITE_PRODUTOS_NA_LISTA + 1}`,
    [busca, porNome, porCodigo, preco?.min ?? null, preco?.max ?? null],
  );
  const truncado = produtos.rowCount !== null && produtos.rowCount > LIMITE_PRODUTOS_NA_LISTA;
  const linhas = produtos.rows.slice(0, LIMITE_PRODUTOS_NA_LISTA);
  if (linhas.length === 0) return { produtos: [], truncado: false };

  const skus = await c.query(
    `SELECT ${dono ? COLUNAS_SKU_DONO : COLUNAS_SKU_BASE} FROM skus s WHERE s.produto_id = ANY($1::uuid[])`,
    [linhas.map((l) => l.id)],
  );
  const porProduto = new Map<string, Sku[]>();
  for (const r of skus.rows) {
    const { produto_id, ...sku } = r as Sku & { produto_id: string };
    porProduto.set(produto_id, [...(porProduto.get(produto_id) ?? []), sku]);
  }
  const ordenar = (a: Sku, b: Sku) => compararTamanhos(a.tamanho, b.tamanho) || a.cor.localeCompare(b.cor);
  return {
    produtos: linhas.map((l) => ({ ...(l as Produto), skus: (porProduto.get(l.id) ?? []).sort(ordenar) })),
    truncado,
  };
}

/** RF-PRO-05: SKUs com saldo ESTRITAMENTE abaixo do mínimo (mínimo 0 = sem aviso). Os mais críticos primeiro. */
export async function alertasDeEstoque(c: pg.PoolClient): Promise<{ total: number; itens: AlertaEstoque[] }> {
  const r = await c.query(
    `SELECT s.id AS sku_id, s.codigo, p.nome AS produto, s.tamanho, s.cor, s.estoque, s.estoque_minimo,
            count(*) OVER () AS total
       FROM skus s
       JOIN produtos p ON p.empresa_id = s.empresa_id AND p.id = s.produto_id
      WHERE s.estoque < s.estoque_minimo AND p.ativo
      ORDER BY (s.estoque_minimo - s.estoque) DESC, lower(p.nome), s.codigo
      LIMIT ${LIMITE_ALERTAS_NA_LISTA}`,
  );
  return {
    total: r.rows.length === 0 ? 0 : Number(r.rows[0].total),
    itens: r.rows.map(({ total: _total, ...item }) => item as AlertaEstoque),
  };
}

/** Histórico do SKU, do mais recente ao mais antigo. Devolve null se o SKU não existe (ou é de outra empresa). */
export async function movimentosDoSku(c: pg.PoolClient, skuId: string): Promise<Movimento[] | null> {
  const existe = await c.query('SELECT 1 FROM skus WHERE id = $1', [skuId]);
  if (existe.rowCount !== 1) return null;
  const r = await c.query(
    `SELECT m.id, m.tipo, m.quantidade, m.saldo_apos, m.motivo, m.origem_id, u.nome AS autor_nome, m.criado_em
       FROM movimentos_estoque m
       JOIN usuarios u ON u.empresa_id = m.empresa_id AND u.id = m.autor_id
      WHERE m.sku_id = $1
      ORDER BY m.seq DESC
      LIMIT ${LIMITE_MOVIMENTOS}`,
    [skuId],
  );
  return r.rows.map((m) => ({ ...m, criado_em: (m.criado_em as Date).toISOString() })) as Movimento[];
}
