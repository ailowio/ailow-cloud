-- Up Migration
-- S05 (Configurações): dados da empresa, markup padrão e atributos das categorias (RF-CFG-02/03/04).
-- Mudança aditiva (expand): só colunas novas com default e um índice; nada existente é alterado ou removido.
-- RLS e GRANT das tabelas `empresas` e `categorias` já existem (ADR 002) e cobrem as colunas novas.

ALTER TABLE empresas
  ADD COLUMN telefone  text CHECK (telefone ~ '^[0-9]{10,11}$'),
  ADD COLUMN endereco  text CHECK (length(endereco) BETWEEN 1 AND 200),
  -- Markup em pontos-base (1% = 100): inteiro, sem float (RN-05 / RN-01). 0 a 1000%.
  ADD COLUMN markup_bps integer NOT NULL DEFAULT 0 CHECK (markup_bps BETWEEN 0 AND 100000);

ALTER TABLE categorias
  -- Atributos que a categoria usa (ex.: sutiã -> bojo, aro, renda). Lista curta; o app valida unicidade.
  ADD COLUMN atributos text[] NOT NULL DEFAULT '{}' CHECK (cardinality(atributos) <= 20),
  -- Categoria em uso nunca é apagada (produtos vão referenciá-la): desativa-se.
  ADD COLUMN ativa boolean NOT NULL DEFAULT true;

-- Nome único por empresa sem diferenciar maiúsculas ("Pijama" = "pijama").
CREATE UNIQUE INDEX categorias_nome_ci_idx ON categorias (empresa_id, lower(btrim(nome)));

-- Down Migration
DROP INDEX categorias_nome_ci_idx;
ALTER TABLE categorias DROP COLUMN ativa, DROP COLUMN atributos;
ALTER TABLE empresas DROP COLUMN markup_bps, DROP COLUMN endereco, DROP COLUMN telefone;
