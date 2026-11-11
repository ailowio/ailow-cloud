-- Up Migration
-- S06 (ajustes pedidos na revisão do ADR 005): (1) boleto sai das formas de pagamento do v1;
-- (2) categorias passam a ter dois tipos, produto e financeira. Mudança aditiva/restritiva; nada é apagado.

-- (1) Só as quatro formas do PRD. Falha alto, citando a linha, se algum lançamento já usar boleto.
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_forma_pagamento_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_forma_pagamento_check
  CHECK (forma_pagamento IN ('dinheiro', 'pix', 'debito', 'credito'));

-- O lançamento guarda o nome da categoria (texto, para o histórico não mudar com renomeações). O nome da
-- categoria aceita até 60 caracteres, então o lançamento também: antes, uma categoria de 41 a 60 não podia ser usada.
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_categoria_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_categoria_check
  CHECK (length(btrim(categoria)) BETWEEN 1 AND 60);

-- (2) As categorias que já existem são de produto (default). Financeira não tem atributos.
-- RLS, FORCE e GRANT da tabela `categorias` já existem (ADR 002) e cobrem a coluna nova.
ALTER TABLE categorias
  ADD COLUMN tipo text NOT NULL DEFAULT 'produto' CHECK (tipo IN ('produto', 'financeira')),
  ADD CONSTRAINT categorias_financeira_sem_atributos CHECK (tipo = 'produto' OR cardinality(atributos) = 0);

-- O mesmo nome pode existir nos dois tipos ("Embalagem" de produto e "Embalagem" de despesa).
-- Tanto a restrição UNIQUE (empresa_id, nome) da migração-base quanto o índice sem diferenciar maiúsculas
-- passam a valer por tipo.
ALTER TABLE categorias DROP CONSTRAINT categorias_empresa_id_nome_key;
DROP INDEX categorias_nome_ci_idx;
CREATE UNIQUE INDEX categorias_nome_ci_idx ON categorias (empresa_id, tipo, lower(btrim(nome)));
ALTER TABLE categorias ADD CONSTRAINT categorias_empresa_id_tipo_nome_key UNIQUE (empresa_id, tipo, nome);

-- Down Migration
-- Só em ambiente sem dados reais (OPS-11). As categorias financeiras voltam a ser categorias comuns;
-- se houver o mesmo nome nos dois tipos, recriar o índice único falha de propósito (nada é descartado em silêncio).
DROP INDEX categorias_nome_ci_idx;
ALTER TABLE categorias DROP CONSTRAINT categorias_empresa_id_tipo_nome_key;
ALTER TABLE categorias DROP CONSTRAINT categorias_financeira_sem_atributos;
ALTER TABLE categorias DROP COLUMN tipo;
ALTER TABLE categorias ADD CONSTRAINT categorias_empresa_id_nome_key UNIQUE (empresa_id, nome);
CREATE UNIQUE INDEX categorias_nome_ci_idx ON categorias (empresa_id, lower(btrim(nome)));

ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_forma_pagamento_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_forma_pagamento_check
  CHECK (forma_pagamento IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto'));

-- Falha de propósito se já houver categoria com mais de 40 caracteres gravada (nada é cortado em silêncio).
ALTER TABLE lancamentos DROP CONSTRAINT lancamentos_categoria_check;
ALTER TABLE lancamentos ADD CONSTRAINT lancamentos_categoria_check
  CHECK (length(btrim(categoria)) BETWEEN 1 AND 40);
