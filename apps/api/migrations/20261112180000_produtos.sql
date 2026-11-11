-- Up Migration
-- S07 (Produtos): produtos, SKUs e movimentos de estoque (RF-PRO-01…05/07, RN-01, RN-03, RN-08). ADR 002 (RLS) e ADR 006.
-- Mudança aditiva (expand): três tabelas novas e uma restrição única nova em `categorias`; nada existente é alterado.

-- Permite uma chave estrangeira que exige categoria do tipo 'produto' (a financeira não serve a um produto).
ALTER TABLE categorias ADD CONSTRAINT categorias_empresa_id_id_tipo_key UNIQUE (empresa_id, id, tipo);

CREATE TABLE produtos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  -- Número sequencial por empresa: os 4 dígitos do início do código do SKU (P1 §4).
  numero          integer NOT NULL CHECK (numero BETWEEN 1 AND 9999),
  nome            text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  categoria_id    uuid NOT NULL,
  -- Sempre 'produto': a chave estrangeira composta abaixo recusa categoria financeira.
  categoria_tipo  text GENERATED ALWAYS AS ('produto') STORED,
  porte           text NOT NULL CHECK (porte IN ('slim', 'plus')),
  atributos       text[] NOT NULL DEFAULT '{}',
  -- Texto livre no v1 (ADR 006); a tabela de fornecedores nasce na S11 (Compras).
  fornecedor      text CHECK (length(btrim(fornecedor)) BETWEEN 1 AND 80),
  -- RN-01: centavos inteiros. O custo nunca sai para o Vendedor (RF-PRO-07): a API não o seleciona.
  custo_centavos  integer NOT NULL CHECK (custo_centavos BETWEEN 0 AND 2000000000),
  preco_centavos  integer NOT NULL CHECK (preco_centavos BETWEEN 1 AND 2000000000),
  ativo           boolean NOT NULL DEFAULT true,
  criado_por      uuid NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, numero),
  -- Chaves compostas: nada aponta para categoria ou usuário de outra empresa (defesa além da RLS).
  FOREIGN KEY (empresa_id, categoria_id, categoria_tipo) REFERENCES categorias (empresa_id, id, tipo) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, criado_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE TABLE skus (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  produto_id      uuid NOT NULL,
  tamanho         text NOT NULL CHECK (tamanho ~ '^[A-Z0-9]{1,3}$'),
  cor             text NOT NULL CHECK (length(btrim(cor)) BETWEEN 1 AND 30),
  cor_codigo      text NOT NULL CHECK (cor_codigo ~ '^[A-Z0-9]{3}$'),
  -- PPPP-TT-CCC: o conteúdo do QR e da etiqueta (P1 §4, P2). Único por empresa.
  codigo          text NOT NULL CHECK (codigo ~ '^[0-9]{4}-[A-Z0-9]{1,3}-[A-Z0-9]{3}$'),
  -- RN-03: o saldo nunca fica negativo, garantido aqui além da regra na aplicação.
  estoque         integer NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  estoque_minimo  integer NOT NULL DEFAULT 0 CHECK (estoque_minimo BETWEEN 0 AND 100000),
  criado_em       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, codigo),
  FOREIGN KEY (empresa_id, produto_id) REFERENCES produtos (empresa_id, id) ON DELETE RESTRICT
);

-- O aviso vermelho da tela inicial lê só os SKUs abaixo do mínimo.
CREATE INDEX skus_abaixo_do_minimo_idx ON skus (empresa_id) WHERE estoque < estoque_minimo;
CREATE INDEX skus_produto_idx ON skus (empresa_id, produto_id);

CREATE TABLE movimentos_estoque (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ordem de gravação, exata mesmo quando dois movimentos têm o mesmo instante (histórico do SKU).
  seq           bigint GENERATED ALWAYS AS IDENTITY,
  empresa_id    uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  sku_id        uuid NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('inicial', 'entrada', 'ajuste', 'venda', 'estorno_venda')),
  -- Com sinal: positivo entra, negativo sai.
  quantidade    integer NOT NULL CHECK (quantidade <> 0 AND quantidade BETWEEN -100000 AND 100000),
  saldo_apos    integer NOT NULL CHECK (saldo_apos >= 0),
  motivo        text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 3 AND 200),
  -- Id da venda (S10, RN-08): obrigatório na venda e no seu estorno, proibido nos demais.
  origem_id     uuid,
  autor_id      uuid NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  FOREIGN KEY (empresa_id, sku_id)   REFERENCES skus (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, autor_id) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,

  CHECK ((tipo IN ('venda', 'estorno_venda')) = (origem_id IS NOT NULL)),
  CHECK (tipo NOT IN ('inicial', 'entrada', 'estorno_venda') OR quantidade > 0),
  CHECK (tipo <> 'venda' OR quantidade < 0)
);

-- Uma venda baixa (e estorna) cada SKU no máximo uma vez: repetir a chamada não desconta em dobro.
CREATE UNIQUE INDEX movimentos_por_origem_idx ON movimentos_estoque (empresa_id, sku_id, tipo, origem_id)
  WHERE origem_id IS NOT NULL;
CREATE INDEX movimentos_sku_idx ON movimentos_estoque (empresa_id, sku_id, seq DESC);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos FORCE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus FORCE ROW LEVEL SECURITY;
ALTER TABLE movimentos_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos_estoque FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON produtos
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON skus
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON movimentos_estoque
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Sem DELETE e sem TRUNCATE em nenhuma delas. Produto não muda depois de criado (edição virá com a sua migração);
-- do SKU só mudam o saldo e o mínimo; o movimento é só-acréscimo (autor, motivo e quantidade nunca se reescrevem).
GRANT SELECT, INSERT ON produtos TO ailow_app;
GRANT SELECT, INSERT ON skus TO ailow_app;
GRANT UPDATE (estoque, estoque_minimo) ON skus TO ailow_app;
GRANT SELECT, INSERT ON movimentos_estoque TO ailow_app;

-- Down Migration
-- Descarta as tabelas e os seus dados: só em ambiente sem estoque real (OPS-11).
DROP TABLE movimentos_estoque;
DROP TABLE skus;
DROP TABLE produtos;
ALTER TABLE categorias DROP CONSTRAINT categorias_empresa_id_id_tipo_key;
