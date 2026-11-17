-- Up Migration
-- ADR 018: preferências de UI por usuário (ordem dos módulos da home). Expand puro.

CREATE TABLE preferencias_ui (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  usuario_id  uuid NOT NULL,
  chave       text NOT NULL CHECK (length(btrim(chave)) BETWEEN 1 AND 64),
  valor       jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, usuario_id, chave),
  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id) ON DELETE CASCADE
);

ALTER TABLE preferencias_ui ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_ui FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON preferencias_ui
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

GRANT SELECT, INSERT, UPDATE ON preferencias_ui TO ailow_app;

-- Down Migration
DROP TABLE preferencias_ui;
