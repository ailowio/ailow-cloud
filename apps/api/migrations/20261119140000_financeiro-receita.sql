-- Up Migration
-- ADR 015 (aceito pelo Pedro em 2026-11-16): receita manual e contas a receber. Nova origem `receita`: sempre
-- ENTRADA, sem origem_id (como a despesa), com descrição obrigatória; pode nascer recebida ou em aberto (conta a
-- receber). Expand: a lista de origens só cresce e as regras da despesa valem igual para a receita; nada existente muda
-- de significado. RLS, FORCE e GRANTs de `lancamentos` não mudam (o UPDATE segue limitado às colunas da baixa).
-- Os nomes das CHECKs sem nome são os gerados pelo Postgres na migração 20261111200000 (conferidos no banco de dev).

ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_origem_tipo_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_origem_tipo_check
  CHECK (origem_tipo IN ('venda', 'compra', 'despesa', 'receita', 'estorno'));

-- "despesa não tem origem_id" passa a ser "despesa e receita não têm origem_id".
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_check2;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_sem_origem_id_check
  CHECK ((origem_tipo IN ('despesa', 'receita')) = (origem_id IS NULL));

ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_receita_entrada_check
  CHECK (origem_tipo <> 'receita' OR tipo = 'entrada');
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_receita_descricao_check
  CHECK (origem_tipo <> 'receita' OR descricao IS NOT NULL);

-- Contas a receber: só as entradas em aberto, por vencimento (espelho de lancamentos_a_pagar_idx).
CREATE INDEX lancamentos_a_receber_idx ON lancamentos (empresa_id, vencimento)
  WHERE status = 'aberto' AND tipo = 'entrada';

-- Down Migration
-- Falha de propósito se já houver receita gravada (nada é apagado em silêncio; OPS-11).
DROP INDEX lancamentos_a_receber_idx;
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_receita_descricao_check;
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_receita_entrada_check;
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_sem_origem_id_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_check2 CHECK ((origem_tipo = 'despesa') = (origem_id IS NULL));
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_origem_tipo_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_origem_tipo_check
  CHECK (origem_tipo IN ('venda', 'compra', 'despesa', 'estorno'));
