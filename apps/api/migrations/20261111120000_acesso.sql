-- Up Migration
-- S04 (Acesso): usuários, aparelhos, sessões, trilha de eventos e contas de plataforma (Admin).
-- Mudança aditiva (expand): nada existente é removido nem renomeado. ADR 002 (RLS) e ADR 004 (acesso).

-- Minutos sem uso até a sessão expirar no servidor (RF-ACE-04); o app também trava na tela.
ALTER TABLE empresas
  ADD COLUMN inatividade_minutos integer NOT NULL DEFAULT 5
  CHECK (inatividade_minutos BETWEEN 1 AND 120);

-- ---------------------------------------------------------------------------
-- Tabelas de negócio: empresa_id NOT NULL + RLS forçada + GRANT explícito.
-- ---------------------------------------------------------------------------

CREATE TABLE usuarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  nome         text NOT NULL CHECK (length(btrim(nome)) > 0),
  perfil       text NOT NULL CHECK (perfil IN ('dono', 'vendedor')),
  -- Só o Dono entra com e-mail + senha (RF-ACE-02); o Vendedor só tem PIN.
  email        text CHECK (email = lower(btrim(email))),
  senha_hash   text,
  -- NULL até a pessoa definir o PIN (o Dono criado pelo Admin ainda não tem PIN).
  pin_hash     text,
  ativo        boolean NOT NULL DEFAULT true,
  pin_falhas   smallint NOT NULL DEFAULT 0 CHECK (pin_falhas >= 0),
  bloqueado_em timestamptz,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CHECK ((perfil = 'dono') = (email IS NOT NULL AND senha_hash IS NOT NULL)),
  -- Alvo das chaves estrangeiras compostas: impede referência entre empresas (defesa além da RLS).
  UNIQUE (empresa_id, id),
  UNIQUE (empresa_id, email)
);

CREATE TABLE aparelhos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  -- SHA-256 do segredo do cookie; o segredo em si nunca é gravado.
  token_hash    bytea NOT NULL UNIQUE,
  criado_por    uuid NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, id),
  FOREIGN KEY (empresa_id, criado_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);
CREATE INDEX aparelhos_criado_por_idx ON aparelhos (empresa_id, criado_por);

CREATE TABLE sessoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  usuario_id    uuid NOT NULL,
  aparelho_id   uuid NOT NULL,
  token_hash    bytea NOT NULL UNIQUE,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
  -- Validade absoluta, independente do uso.
  expira_em     timestamptz NOT NULL,
  revogada_em   timestamptz,
  FOREIGN KEY (empresa_id, usuario_id)  REFERENCES usuarios  (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, aparelho_id) REFERENCES aparelhos (empresa_id, id) ON DELETE RESTRICT
);
-- "Derrubar sessões" e "trocar de usuário no aparelho" só olham as sessões ativas.
CREATE INDEX sessoes_ativas_usuario_idx  ON sessoes (empresa_id, usuario_id)  WHERE revogada_em IS NULL;
CREATE INDEX sessoes_ativas_aparelho_idx ON sessoes (empresa_id, aparelho_id) WHERE revogada_em IS NULL;

-- Trilha de auditoria (AUD-10): quem fez o quê, em quem, quando. Só-acréscimo para o papel de runtime.
CREATE TABLE eventos_acesso (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  ator_tipo   text NOT NULL CHECK (ator_tipo IN ('usuario', 'admin', 'aparelho', 'sistema')),
  ator_id     uuid,
  alvo_id     uuid,
  tipo        text NOT NULL CHECK (length(tipo) BETWEEN 1 AND 40),
  criado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_acesso_empresa_idx ON eventos_acesso (empresa_id, criado_em DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['usuarios', 'aparelhos', 'sessoes', 'eventos_acesso'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY isolamento_empresa ON %I FOR ALL TO ailow_app
         USING (empresa_id = (SELECT nullif(current_setting(''app.empresa_id'', true), '''')::uuid))
         WITH CHECK (empresa_id = (SELECT nullif(current_setting(''app.empresa_id'', true), '''')::uuid))',
      t);
  END LOOP;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON usuarios, aparelhos, sessoes TO ailow_app;
-- Trilha só-acréscimo: sem UPDATE/DELETE (a identidade bigint precisa de USAGE na sequência).
GRANT SELECT, INSERT ON eventos_acesso TO ailow_app;
GRANT USAGE ON SEQUENCE eventos_acesso_id_seq TO ailow_app;

-- ---------------------------------------------------------------------------
-- Tabelas da PLATAFORMA (sem dados de negócio): NÃO recebem GRANT para ailow_app.
-- ---------------------------------------------------------------------------

CREATE TABLE admins (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
  senha_hash        text NOT NULL,
  totp_segredo      text NOT NULL,
  -- Último passo TOTP aceito: o mesmo código não vale duas vezes (anti-replay).
  totp_ultimo_passo bigint NOT NULL DEFAULT 0,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES admins (id) ON DELETE RESTRICT,
  token_hash    bytea NOT NULL UNIQUE,
  criada_em     timestamptz NOT NULL DEFAULT now(),
  ultimo_uso_em timestamptz NOT NULL DEFAULT now(),
  expira_em     timestamptz NOT NULL,
  revogada_em   timestamptz
);
CREATE INDEX admin_sessoes_admin_idx ON admin_sessoes (admin_id);

-- Diretório do login: e-mail -> (empresa, usuário). Existe porque o login acontece ANTES de
-- se saber a empresa, e a RLS (corretamente) não deixa listar usuários sem empresa definida.
CREATE TABLE diretorio_login (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email))),
  empresa_id uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL,
  FOREIGN KEY (empresa_id, usuario_id) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);
CREATE INDEX diretorio_login_usuario_idx ON diretorio_login (empresa_id, usuario_id);

-- Busca do login (pré-autenticação). Só o dono do schema executa; a API a chama pelo pool.
CREATE FUNCTION buscar_login(p_email text)
RETURNS TABLE (empresa_id uuid, usuario_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT d.empresa_id, d.usuario_id FROM diretorio_login d WHERE d.email = lower(btrim(p_email))
$$;
REVOKE ALL ON FUNCTION buscar_login(text) FROM PUBLIC;

-- Registro do login junto com a criação do usuário, NA MESMA transação do tenant (atômico).
-- Só registra para a empresa da transação: o papel de runtime não consegue gravar para outra.
CREATE FUNCTION registrar_login(p_email text, p_empresa_id uuid, p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_empresa_id IS DISTINCT FROM nullif(current_setting('app.empresa_id', true), '')::uuid THEN
    RAISE EXCEPTION 'empresa diferente da empresa da transação' USING ERRCODE = '42501';
  END IF;
  INSERT INTO diretorio_login (email, empresa_id, usuario_id)
  VALUES (lower(btrim(p_email)), p_empresa_id, p_usuario_id);
END
$$;
REVOKE ALL ON FUNCTION registrar_login(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_login(text, uuid, uuid) TO ailow_app;

-- Down Migration
DROP FUNCTION registrar_login(text, uuid, uuid);
DROP FUNCTION buscar_login(text);
DROP TABLE diretorio_login;
DROP TABLE admin_sessoes;
DROP TABLE admins;
DROP TABLE eventos_acesso;
DROP TABLE sessoes;
DROP TABLE aparelhos;
DROP TABLE usuarios;
ALTER TABLE empresas DROP COLUMN inatividade_minutos;
