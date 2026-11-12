-- Up Migration
-- S11 (Compras): fornecedores, pedidos (rascunho -> enviado -> recebido), itens e parcelas
-- (RF-COM-01..05, RN-11, ADR 005/006). Expand: tabelas novas + tipo `compra` em movimentos_estoque.
-- `produtos.fornecedor` (texto) permanece; a migracao texto -> FK fica para contract (ADR 006 #7).

CREATE TABLE fornecedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  nome        text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  whatsapp    text NOT NULL CHECK (whatsapp ~ '^[1-9][1-9]9[0-9]{8}$'),
  cnpj        text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  criado_em   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, whatsapp)
);

CREATE INDEX fornecedores_nome_idx ON fornecedores (empresa_id, lower(nome));

CREATE TABLE pedido_compra_sequencia (
  empresa_id uuid PRIMARY KEY REFERENCES empresas (id) ON DELETE RESTRICT,
  ultimo     integer NOT NULL CHECK (ultimo >= 0)
);

CREATE TABLE pedidos_compra (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  numero             integer NOT NULL CHECK (numero >= 1),
  fornecedor_id      uuid NOT NULL,
  status             text NOT NULL CHECK (status IN ('rascunho', 'enviado', 'recebido')),
  total_centavos     integer NOT NULL CHECK (total_centavos BETWEEN 1 AND 2000000000),
  criado_por         uuid NOT NULL,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  enviado_em         timestamptz,
  recebido_em        timestamptz,
  recebido_por       uuid,

  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, numero),
  CHECK (
    (status = 'rascunho' AND enviado_em IS NULL AND recebido_em IS NULL AND recebido_por IS NULL)
    OR (status = 'enviado' AND enviado_em IS NOT NULL AND recebido_em IS NULL AND recebido_por IS NULL)
    OR (status = 'recebido' AND enviado_em IS NOT NULL AND recebido_em IS NOT NULL AND recebido_por IS NOT NULL)
  ),
  FOREIGN KEY (empresa_id, fornecedor_id) REFERENCES fornecedores (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, criado_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, recebido_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX pedidos_compra_quando_idx ON pedidos_compra (empresa_id, criado_em);
CREATE INDEX pedidos_compra_fornecedor_idx ON pedidos_compra (empresa_id, fornecedor_id);
CREATE INDEX pedidos_compra_status_idx ON pedidos_compra (empresa_id, status);

CREATE TABLE itens_pedido_compra (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  pedido_id                 uuid NOT NULL,
  sku_id                    uuid NOT NULL,
  quantidade                integer NOT NULL CHECK (quantidade > 0),
  custo_unitario_centavos   integer NOT NULL CHECK (custo_unitario_centavos BETWEEN 1 AND 2000000000),
  produto_nome              text NOT NULL CHECK (length(btrim(produto_nome)) BETWEEN 1 AND 80),
  codigo                    text NOT NULL,
  tamanho                   text NOT NULL,
  cor                       text NOT NULL,

  UNIQUE (pedido_id, sku_id),
  FOREIGN KEY (empresa_id, pedido_id) REFERENCES pedidos_compra (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, sku_id) REFERENCES skus (empresa_id, id) ON DELETE RESTRICT
);

-- Parcelas gravadas no recebimento; cada uma vira um lancamento (origem_tipo = compra).
CREATE TABLE parcelas_pedido_compra (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  pedido_id        uuid NOT NULL,
  ordem            integer NOT NULL CHECK (ordem >= 0),
  valor_centavos   integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 2000000000),
  vencimento       date NOT NULL,
  lancamento_id    uuid NOT NULL,

  UNIQUE (pedido_id, ordem),
  UNIQUE (pedido_id, vencimento),
  FOREIGN KEY (empresa_id, pedido_id) REFERENCES pedidos_compra (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, lancamento_id) REFERENCES lancamentos (empresa_id, id) ON DELETE RESTRICT
);

-- Expand do CHECK de movimentos: compra entra estoque com origem_id do pedido (RN-11).
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_tipo_check;
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_tipo_check
  CHECK (tipo IN ('inicial', 'entrada', 'ajuste', 'venda', 'estorno_venda', 'compra'));

ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_check;
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_check1;
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_check2;

ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_origem_check
  CHECK ((tipo IN ('venda', 'estorno_venda', 'compra')) = (origem_id IS NOT NULL));
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_qtd_positiva_check
  CHECK (tipo NOT IN ('inicial', 'entrada', 'estorno_venda', 'compra') OR quantidade > 0);
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_venda_negativa_check
  CHECK (tipo <> 'venda' OR quantidade < 0);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores FORCE ROW LEVEL SECURITY;
ALTER TABLE pedido_compra_sequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_compra_sequencia FORCE ROW LEVEL SECURITY;
ALTER TABLE pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_compra FORCE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido_compra FORCE ROW LEVEL SECURITY;
ALTER TABLE parcelas_pedido_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas_pedido_compra FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON fornecedores
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON pedido_compra_sequencia
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON pedidos_compra
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON itens_pedido_compra
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON parcelas_pedido_compra
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

GRANT SELECT, INSERT, UPDATE ON fornecedores TO ailow_app;
GRANT SELECT, INSERT ON pedido_compra_sequencia TO ailow_app;
GRANT UPDATE (ultimo) ON pedido_compra_sequencia TO ailow_app;
GRANT SELECT, INSERT ON pedidos_compra TO ailow_app;
GRANT UPDATE (status, enviado_em, recebido_em, recebido_por, total_centavos, fornecedor_id) ON pedidos_compra TO ailow_app;
GRANT SELECT, INSERT, DELETE ON itens_pedido_compra TO ailow_app;
GRANT SELECT, INSERT ON parcelas_pedido_compra TO ailow_app;

-- Down Migration
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_origem_check;
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_qtd_positiva_check;
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_venda_negativa_check;
ALTER TABLE movimentos_estoque DROP CONSTRAINT movimentos_estoque_tipo_check;

ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_tipo_check
  CHECK (tipo IN ('inicial', 'entrada', 'ajuste', 'venda', 'estorno_venda'));
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_check
  CHECK ((tipo IN ('venda', 'estorno_venda')) = (origem_id IS NOT NULL));
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_check1
  CHECK (tipo NOT IN ('inicial', 'entrada', 'estorno_venda') OR quantidade > 0);
ALTER TABLE movimentos_estoque
  ADD CONSTRAINT movimentos_estoque_check2
  CHECK (tipo <> 'venda' OR quantidade < 0);

DROP TABLE parcelas_pedido_compra;
DROP TABLE itens_pedido_compra;
DROP TABLE pedidos_compra;
DROP TABLE pedido_compra_sequencia;
DROP TABLE fornecedores;
