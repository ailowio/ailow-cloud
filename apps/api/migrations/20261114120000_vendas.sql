-- Up Migration
-- S10 (Vendas): venda com número por empresa, itens, pagamentos e vínculo com o cliente
-- (RF-VEN-06/08/10, RN-02/08, ADR 007). Expand: tabelas novas; nada existente é alterado.
-- Postgres 18: ON DELETE SET NULL (cliente_id) zera só o vínculo. A empresa da venda permanece.

CREATE TABLE venda_sequencia (
  empresa_id uuid PRIMARY KEY REFERENCES empresas (id) ON DELETE RESTRICT,
  ultimo     integer NOT NULL CHECK (ultimo >= 0)
);

CREATE TABLE vendas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  numero                integer NOT NULL CHECK (numero >= 1),
  cliente_id            uuid,
  vendedor_id           uuid NOT NULL,
  subtotal_centavos     integer NOT NULL CHECK (subtotal_centavos BETWEEN 0 AND 2000000000),
  desconto_centavos     integer NOT NULL CHECK (desconto_centavos >= 0),
  total_centavos        integer NOT NULL CHECK (total_centavos BETWEEN 0 AND 2000000000),
  desconto_tipo         text NOT NULL CHECK (desconto_tipo IN ('nenhum', 'percentual', 'valor')),
  desconto_percentual   integer CHECK (desconto_percentual BETWEEN 0 AND 100),
  status                text NOT NULL CHECK (status IN ('finalizada', 'cancelada')),
  motivo_cancelamento   text CHECK (motivo_cancelamento IS NULL OR length(btrim(motivo_cancelamento)) BETWEEN 3 AND 200),
  cancelado_por         uuid,
  cancelado_em          timestamptz,
  criado_em             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, numero),
  CHECK (desconto_centavos <= subtotal_centavos),
  CHECK (total_centavos = subtotal_centavos - desconto_centavos),
  CHECK ((desconto_tipo = 'percentual') = (desconto_percentual IS NOT NULL)),
  CHECK (
    (status = 'finalizada' AND motivo_cancelamento IS NULL AND cancelado_por IS NULL AND cancelado_em IS NULL)
    OR (status = 'cancelada' AND motivo_cancelamento IS NOT NULL AND cancelado_por IS NOT NULL AND cancelado_em IS NOT NULL)
  ),
  FOREIGN KEY (empresa_id, vendedor_id) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, cliente_id) REFERENCES clientes (empresa_id, id) ON DELETE SET NULL (cliente_id)
);

CREATE INDEX vendas_cliente_idx ON vendas (empresa_id, cliente_id);
CREATE INDEX vendas_quando_idx ON vendas (empresa_id, criado_em);

CREATE TABLE itens_venda (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  venda_id                 uuid NOT NULL,
  sku_id                   uuid NOT NULL,
  quantidade               integer NOT NULL CHECK (quantidade > 0),
  preco_unitario_centavos  integer NOT NULL CHECK (preco_unitario_centavos > 0),
  produto_nome             text NOT NULL CHECK (length(btrim(produto_nome)) BETWEEN 1 AND 80),
  codigo                   text NOT NULL,
  tamanho                  text NOT NULL,
  cor                      text NOT NULL,
  categoria_nome           text NOT NULL,

  UNIQUE (venda_id, sku_id),
  FOREIGN KEY (empresa_id, venda_id) REFERENCES vendas (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, sku_id) REFERENCES skus (empresa_id, id) ON DELETE RESTRICT
);

CREATE TABLE pagamentos_venda (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  venda_id        uuid NOT NULL,
  forma           text NOT NULL CHECK (forma IN ('dinheiro', 'pix', 'debito', 'credito')),
  valor_centavos  integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 2000000000),
  ordem           integer NOT NULL CHECK (ordem >= 0),

  UNIQUE (venda_id, ordem),
  FOREIGN KEY (empresa_id, venda_id) REFERENCES vendas (empresa_id, id) ON DELETE RESTRICT
);

ALTER TABLE venda_sequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE venda_sequencia FORCE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas FORCE ROW LEVEL SECURITY;
ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda FORCE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos_venda FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON venda_sequencia
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON vendas
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON itens_venda
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON pagamentos_venda
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- A venda não se apaga (RF-VEN-08). Cancelar só preenche status, motivo e autor.
-- cliente_id entra no GRANT porque o ON DELETE SET NULL do cliente roda como o papel da transação.
GRANT SELECT, INSERT ON venda_sequencia TO ailow_app;
GRANT UPDATE (ultimo) ON venda_sequencia TO ailow_app;
GRANT SELECT, INSERT ON vendas TO ailow_app;
GRANT UPDATE (status, motivo_cancelamento, cancelado_por, cancelado_em, cliente_id) ON vendas TO ailow_app;
GRANT SELECT, INSERT ON itens_venda TO ailow_app;
GRANT SELECT, INSERT ON pagamentos_venda TO ailow_app;

-- Down Migration
-- Descarta as vendas. Só em ambiente sem dado real (OPS-11).
DROP TABLE pagamentos_venda;
DROP TABLE itens_venda;
DROP TABLE vendas;
DROP TABLE venda_sequencia;
