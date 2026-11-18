-- Up Migration
-- Eixos de grade configuráveis (biblioteca da empresa + ativação por categoria). Expand ADR 017.
-- Compat: skus.tamanho/cor/codigo permanecem; sku_valores guarda todos os eixos (incl. sistema).
-- Código QR passa a aceitar sufixos de eixos extras: PPPP-TT-CCC(-XXX)*.

CREATE TABLE eixos_grade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  nome        text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 40),
  slug        text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9_]{0,39}$'),
  tipo_valor  text NOT NULL CHECK (tipo_valor IN ('tamanho', 'cor', 'texto')),
  sistema     boolean NOT NULL DEFAULT false,
  ativo       boolean NOT NULL DEFAULT true,
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, slug)
);

CREATE UNIQUE INDEX eixos_grade_nome_idx ON eixos_grade (empresa_id, lower(btrim(nome)));

ALTER TABLE eixos_grade ENABLE ROW LEVEL SECURITY;
ALTER TABLE eixos_grade FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_empresa ON eixos_grade
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));
GRANT SELECT, INSERT ON eixos_grade TO ailow_app;
GRANT UPDATE (nome, ativo) ON eixos_grade TO ailow_app;

CREATE TABLE valores_eixo (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  eixo_id     uuid NOT NULL,
  nome        text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 30),
  amostra     text CHECK (amostra ~ '^#[0-9a-f]{6}$'),
  ativa       boolean NOT NULL DEFAULT true,
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, eixo_id, id),
  FOREIGN KEY (empresa_id, eixo_id) REFERENCES eixos_grade (empresa_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX valores_eixo_nome_idx ON valores_eixo (empresa_id, eixo_id, lower(btrim(nome)));

ALTER TABLE valores_eixo ENABLE ROW LEVEL SECURITY;
ALTER TABLE valores_eixo FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_empresa ON valores_eixo
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));
GRANT SELECT, INSERT ON valores_eixo TO ailow_app;
GRANT UPDATE (nome, amostra, ativa) ON valores_eixo TO ailow_app;

CREATE TABLE categoria_eixos (
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  categoria_id    uuid NOT NULL,
  -- Sempre produto: mesma trava composta de `produtos` (categoria financeira não entra na grade).
  categoria_tipo  text GENERATED ALWAYS AS ('produto') STORED,
  eixo_id         uuid NOT NULL,
  seq             integer NOT NULL CHECK (seq BETWEEN 0 AND 3),
  PRIMARY KEY (categoria_id, eixo_id),
  UNIQUE (empresa_id, categoria_id, eixo_id),
  UNIQUE (empresa_id, categoria_id, seq),
  FOREIGN KEY (empresa_id, categoria_id, categoria_tipo) REFERENCES categorias (empresa_id, id, tipo) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, eixo_id) REFERENCES eixos_grade (empresa_id, id) ON DELETE RESTRICT
);

ALTER TABLE categoria_eixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria_eixos FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_empresa ON categoria_eixos
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON categoria_eixos TO ailow_app;

CREATE TABLE sku_valores (
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  sku_id      uuid NOT NULL,
  eixo_id     uuid NOT NULL,
  valor_id    uuid NOT NULL,
  PRIMARY KEY (sku_id, eixo_id),
  UNIQUE (empresa_id, sku_id, eixo_id),
  FOREIGN KEY (empresa_id, sku_id) REFERENCES skus (empresa_id, id) ON DELETE CASCADE,
  FOREIGN KEY (empresa_id, eixo_id, valor_id) REFERENCES valores_eixo (empresa_id, eixo_id, id) ON DELETE RESTRICT
);

ALTER TABLE sku_valores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_valores FORCE ROW LEVEL SECURITY;
CREATE POLICY isolamento_empresa ON sku_valores
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));
GRANT SELECT, INSERT ON sku_valores TO ailow_app;

-- Aceita PPPP-TT-CCC e sufixos opcionais -XXX (eixos extras).
ALTER TABLE skus DROP CONSTRAINT IF EXISTS skus_codigo_check;
ALTER TABLE skus ADD CONSTRAINT skus_codigo_check
  CHECK (codigo ~ '^[0-9]{4}-[A-Z0-9]{1,3}-[A-Z0-9]{3}(-[A-Z0-9]{1,3})*$');

-- Backfill: eixos sistema + valores a partir de opcoes_grade (quando existir).
INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema)
SELECT DISTINCT o.empresa_id, 'Tamanho', 'tamanho', 'tamanho', true
FROM opcoes_grade o
WHERE o.tipo = 'tamanho'
  AND NOT EXISTS (
    SELECT 1 FROM eixos_grade e WHERE e.empresa_id = o.empresa_id AND e.slug = 'tamanho'
  );

INSERT INTO eixos_grade (empresa_id, nome, slug, tipo_valor, sistema)
SELECT DISTINCT o.empresa_id, 'Cor', 'cor', 'cor', true
FROM opcoes_grade o
WHERE o.tipo = 'cor'
  AND NOT EXISTS (
    SELECT 1 FROM eixos_grade e WHERE e.empresa_id = o.empresa_id AND e.slug = 'cor'
  );

INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, ativa)
SELECT o.empresa_id, e.id, o.nome, o.amostra, o.ativa
FROM opcoes_grade o
JOIN eixos_grade e ON e.empresa_id = o.empresa_id AND e.slug = o.tipo
WHERE NOT EXISTS (
  SELECT 1 FROM valores_eixo v
  WHERE v.empresa_id = o.empresa_id AND v.eixo_id = e.id AND lower(btrim(v.nome)) = lower(btrim(o.nome))
);

-- Categorias de produto herdam tamanho + cor.
INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq)
SELECT c.empresa_id, c.id, e.id, 0
FROM categorias c
JOIN eixos_grade e ON e.empresa_id = c.empresa_id AND e.slug = 'tamanho'
WHERE c.tipo = 'produto'
  AND NOT EXISTS (
    SELECT 1 FROM categoria_eixos x WHERE x.categoria_id = c.id AND x.eixo_id = e.id
  );

INSERT INTO categoria_eixos (empresa_id, categoria_id, eixo_id, seq)
SELECT c.empresa_id, c.id, e.id, 1
FROM categorias c
JOIN eixos_grade e ON e.empresa_id = c.empresa_id AND e.slug = 'cor'
WHERE c.tipo = 'produto'
  AND NOT EXISTS (
    SELECT 1 FROM categoria_eixos x WHERE x.categoria_id = c.id AND x.eixo_id = e.id
  );

-- SKUs existentes: valores de tamanho e cor (cria valor órfão se opção não existia).
INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, ativa)
SELECT DISTINCT s.empresa_id, e.id, s.tamanho, NULL, true
FROM skus s
JOIN eixos_grade e ON e.empresa_id = s.empresa_id AND e.slug = 'tamanho'
WHERE NOT EXISTS (
  SELECT 1 FROM valores_eixo v
  WHERE v.empresa_id = s.empresa_id AND v.eixo_id = e.id AND lower(btrim(v.nome)) = lower(btrim(s.tamanho))
);

INSERT INTO valores_eixo (empresa_id, eixo_id, nome, amostra, ativa)
SELECT DISTINCT s.empresa_id, e.id, s.cor, NULL, true
FROM skus s
JOIN eixos_grade e ON e.empresa_id = s.empresa_id AND e.slug = 'cor'
WHERE NOT EXISTS (
  SELECT 1 FROM valores_eixo v
  WHERE v.empresa_id = s.empresa_id AND v.eixo_id = e.id AND lower(btrim(v.nome)) = lower(btrim(s.cor))
);

INSERT INTO sku_valores (empresa_id, sku_id, eixo_id, valor_id)
SELECT s.empresa_id, s.id, e.id, v.id
FROM skus s
JOIN eixos_grade e ON e.empresa_id = s.empresa_id AND e.slug = 'tamanho'
JOIN valores_eixo v ON v.empresa_id = s.empresa_id AND v.eixo_id = e.id AND lower(btrim(v.nome)) = lower(btrim(s.tamanho))
WHERE NOT EXISTS (
  SELECT 1 FROM sku_valores x WHERE x.sku_id = s.id AND x.eixo_id = e.id
);

INSERT INTO sku_valores (empresa_id, sku_id, eixo_id, valor_id)
SELECT s.empresa_id, s.id, e.id, v.id
FROM skus s
JOIN eixos_grade e ON e.empresa_id = s.empresa_id AND e.slug = 'cor'
JOIN valores_eixo v ON v.empresa_id = s.empresa_id AND v.eixo_id = e.id AND lower(btrim(v.nome)) = lower(btrim(s.cor))
WHERE NOT EXISTS (
  SELECT 1 FROM sku_valores x WHERE x.sku_id = s.id AND x.eixo_id = e.id
);

-- Down Migration
ALTER TABLE skus DROP CONSTRAINT IF EXISTS skus_codigo_check;
ALTER TABLE skus ADD CONSTRAINT skus_codigo_check
  CHECK (codigo ~ '^[0-9]{4}-[A-Z0-9]{1,3}-[A-Z0-9]{3}$');

DROP TABLE IF EXISTS sku_valores;
DROP TABLE IF EXISTS categoria_eixos;
DROP TABLE IF EXISTS valores_eixo;
DROP TABLE IF EXISTS eixos_grade;
