-- Up Migration
-- ADR 016 (decisão do Pedro em 2026-11-16: "a melhor recomendação com boas práticas, independente do esforço"):
-- a busca por pedaço do nome (LIKE '%…%') passa a usar índice de trigramas (pg_trgm) e as listas que cortavam em 200
-- (produtos, clientes, fornecedores) ganham paginação por cursor (keyset), servida pelos índices de ordem abaixo.
-- Expand puro: extensão, função e índices novos; nenhuma tabela ou coluna muda.
--
-- pg_trgm é extensão "trusted" desde o PostgreSQL 13: quem tem CREATE no banco instala sem superusuário. Existe no
-- Postgres embutido dos testes/dev (conferido: 1.6) e vem no contrib da imagem oficial postgres:18.6-alpine (não
-- conferido na VPS; ver ADR 016, riscos).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Mesma normalização que a API já fazia inline (sem acento, minúsculas): agora num lugar só, IMMUTABLE para poder
-- ser indexada. A tabela de acentos é a de apps/api/src (COM_ACENTO/SEM_ACENTO); um teste confere as duas.
CREATE FUNCTION ailow_busca(t text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  RETURN lower(translate(t, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'));

-- Busca por pedaço (LIKE '%…%') sem varrer a tabela.
CREATE INDEX produtos_nome_trgm_idx     ON produtos     USING gin (ailow_busca(nome) gin_trgm_ops);
CREATE INDEX clientes_nome_trgm_idx     ON clientes     USING gin (ailow_busca(nome) gin_trgm_ops);
CREATE INDEX fornecedores_nome_trgm_idx ON fornecedores USING gin (ailow_busca(nome) gin_trgm_ops);
CREATE INDEX skus_codigo_trgm_idx       ON skus         USING gin (codigo gin_trgm_ops);

-- Ordem das listas (a mesma do ORDER BY e do cursor): cada página é um trecho do índice, não um OFFSET.
CREATE INDEX produtos_lista_idx     ON produtos     (empresa_id, lower(nome), numero) WHERE ativo;
CREATE INDEX clientes_lista_idx     ON clientes     (empresa_id, ativo, ailow_busca(nome), id);
CREATE INDEX fornecedores_lista_idx ON fornecedores (empresa_id, ailow_busca(nome), id);

-- Down Migration
DROP INDEX fornecedores_lista_idx;
DROP INDEX clientes_lista_idx;
DROP INDEX produtos_lista_idx;
DROP INDEX skus_codigo_trgm_idx;
DROP INDEX fornecedores_nome_trgm_idx;
DROP INDEX clientes_nome_trgm_idx;
DROP INDEX produtos_nome_trgm_idx;
DROP FUNCTION ailow_busca(text);
-- A extensão fica: pode ter sido instalada por outro motivo e não guarda dados.
