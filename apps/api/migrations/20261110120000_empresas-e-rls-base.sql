-- Up Migration
-- ADR 002: banco compartilhado, empresa_id em toda tabela + RLS como segunda trava.

-- Papel de runtime: sem login, sem BYPASSRLS, não é dono das tabelas.
-- A API assume este papel por transação (SET LOCAL ROLE) em withEmpresa().
-- Papéis são do cluster, não do banco: criar só se não existir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ailow_app') THEN
    CREATE ROLE ailow_app NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO ailow_app;

CREATE TABLE empresas (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome      text NOT NULL CHECK (length(btrim(nome)) > 0),
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Tabela-modelo do padrão: toda tabela de negócio tem empresa_id NOT NULL + RLS.
-- (empresa_id, nome) UNIQUE também serve de índice por empresa_id (coluna líder).
CREATE TABLE categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  nome       text NOT NULL CHECK (length(btrim(nome)) > 0),
  criado_em  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

ALTER TABLE empresas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas   FORCE  ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias FORCE  ROW LEVEL SECURITY;

-- Empresa não definida (setting ausente ou vazio) => NULL => nenhuma linha (falha fechada).
-- O (SELECT ...) faz o Postgres avaliar a expressão uma vez por consulta, não por linha.
CREATE POLICY isolamento_empresa ON empresas
  FOR ALL TO ailow_app
  USING (id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

CREATE POLICY isolamento_empresa ON categorias
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Grants explícitos por tabela (sem default privileges): tabela nova sem GRANT falha fechada.
GRANT SELECT, INSERT, UPDATE, DELETE ON empresas, categorias TO ailow_app;

-- Down Migration
-- O papel ailow_app NÃO é removido: é do cluster e pode estar em uso por outros bancos.
DROP TABLE categorias;
DROP TABLE empresas;
REVOKE USAGE ON SCHEMA public FROM ailow_app;
