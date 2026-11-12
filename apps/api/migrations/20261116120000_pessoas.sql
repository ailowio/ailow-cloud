-- Up Migration
-- S12 (Pessoas): ponto (RF-PES-01/02). Expand: tabela nova, sem tocar em nada existente.
-- Cada batida tem uma posicao `seq` por usuario (1, 2, 3...). Posicao impar = entrada, par = saida:
-- o CHECK de paridade + o UNIQUE garantem no banco que nunca ha duas entradas seguidas, mesmo
-- com duas requisicoes simultaneas. O historico e append-only (a aplicacao so le e insere).

CREATE TABLE pontos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  usuario_id     uuid NOT NULL,
  seq            integer NOT NULL CHECK (seq >= 1),
  tipo           text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  registrado_em  timestamptz NOT NULL,

  UNIQUE (empresa_id, usuario_id, seq),
  CHECK ((seq % 2 = 1) = (tipo = 'entrada')),
  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX pontos_usuario_quando_idx ON pontos (empresa_id, usuario_id, registrado_em);
CREATE INDEX pontos_quando_idx ON pontos (empresa_id, registrado_em);

ALTER TABLE pontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON pontos
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Sem UPDATE nem DELETE: ponto registrado nao se reescreve (AUD-03).
GRANT SELECT, INSERT ON pontos TO ailow_app;

-- Down Migration
DROP TABLE pontos;
