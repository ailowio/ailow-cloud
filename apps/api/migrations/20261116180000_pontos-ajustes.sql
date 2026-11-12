-- Up Migration
-- S12 (RF-PES-03, ADR 008): o Dono adiciona, edita e exclui ponto. A garantia "nunca duas entradas seguidas" deixa de
-- ser paridade de `seq` e passa a ser regra da aplicacao (validada sob lock por usuario, depois de cada mudanca).
-- Excluir e logico (a linha fica); toda mudanca do Dono grava um registro imutavel em `pontos_ajustes` (AUD-03).
-- A tabela `pontos` ainda nao foi aplicada em producao (nasce na mesma PR), entao nao ha dado a converter.

ALTER TABLE pontos DROP COLUMN seq; -- derruba junto o UNIQUE e o CHECK de paridade que usavam a coluna

ALTER TABLE pontos
  ADD COLUMN ajustado     boolean NOT NULL DEFAULT false,
  ADD COLUMN removido_em  timestamptz,
  ADD COLUMN removido_por uuid,
  ADD CONSTRAINT pontos_removido_check CHECK ((removido_em IS NULL) = (removido_por IS NULL)),
  ADD CONSTRAINT pontos_empresa_id_id_key UNIQUE (empresa_id, id),
  ADD CONSTRAINT pontos_removido_por_fkey FOREIGN KEY (empresa_id, removido_por)
    REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT;

-- Rede de seguranca no banco: duas marcas ativas do mesmo usuario nunca no mesmo instante.
CREATE UNIQUE INDEX pontos_instante_ativo_idx ON pontos (empresa_id, usuario_id, registrado_em) WHERE removido_em IS NULL;

CREATE TABLE pontos_ajustes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  ponto_id    uuid NOT NULL,
  ator_id     uuid NOT NULL,
  acao        text NOT NULL CHECK (acao IN ('adicionar', 'editar', 'excluir')),
  motivo      text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 200),
  antes       jsonb,
  depois      jsonb,
  criado_em   timestamptz NOT NULL,

  CHECK ((acao = 'adicionar') = (antes IS NULL)),
  CHECK ((acao = 'excluir') = (depois IS NULL)),
  FOREIGN KEY (empresa_id, ponto_id) REFERENCES pontos (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, ator_id) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

CREATE INDEX pontos_ajustes_ponto_idx ON pontos_ajustes (empresa_id, ponto_id, criado_em);

ALTER TABLE pontos_ajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pontos_ajustes FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON pontos_ajustes
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Marca: so o horario, a flag e a exclusao logica mudam; nunca tipo, dono nem DELETE. Log: so le e insere.
GRANT UPDATE (registrado_em, ajustado, removido_em, removido_por) ON pontos TO ailow_app;
GRANT SELECT, INSERT ON pontos_ajustes TO ailow_app;

-- Down Migration
-- Volta ao desenho da S12 inicial. Marcas excluidas logicamente sao apagadas (o log vai junto).
DROP TABLE pontos_ajustes;
DELETE FROM pontos WHERE removido_em IS NOT NULL;
DROP INDEX pontos_instante_ativo_idx;
ALTER TABLE pontos DROP CONSTRAINT pontos_removido_por_fkey;
ALTER TABLE pontos DROP CONSTRAINT pontos_empresa_id_id_key;
ALTER TABLE pontos DROP CONSTRAINT pontos_removido_check;
ALTER TABLE pontos DROP COLUMN removido_por, DROP COLUMN removido_em, DROP COLUMN ajustado;

ALTER TABLE pontos ADD COLUMN seq integer;
UPDATE pontos p SET seq = x.n
  FROM (SELECT id, row_number() OVER (PARTITION BY empresa_id, usuario_id ORDER BY registrado_em, id) AS n FROM pontos) x
 WHERE p.id = x.id;
ALTER TABLE pontos ALTER COLUMN seq SET NOT NULL;
ALTER TABLE pontos ADD CONSTRAINT pontos_seq_check CHECK (seq >= 1);
ALTER TABLE pontos ADD CONSTRAINT pontos_empresa_id_usuario_id_seq_key UNIQUE (empresa_id, usuario_id, seq);
ALTER TABLE pontos ADD CONSTRAINT pontos_paridade_check CHECK ((seq % 2 = 1) = (tipo = 'entrada'));
