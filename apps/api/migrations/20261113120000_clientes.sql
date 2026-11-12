-- Up Migration
-- S09 (Clientes): cadastro mínimo, celular único por empresa, aviso de finalidade (LGPD) e anonimização
-- (RF-CLI-01…04, D8, D18). ADR 002 (RLS) e ADR 007.
-- Mudança aditiva (expand): uma tabela nova; nada existente é alterado.

CREATE TABLE clientes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  nome            text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 80),
  -- Só dígitos: DDD (sem zero) + 9 + 8 dígitos. NULL só depois da anonimização (RF-CLI-04); a regra de cima
  -- para baixo vive em packages/shared, o banco é a segunda trava.
  celular         text CHECK (celular ~ '^[1-9][1-9]9[0-9]{8}$'),
  -- Quando a loja avisou o cliente para que o celular é usado (finalidade). NULL = ainda não avisou.
  aviso_lgpd_em   timestamptz,
  -- Preenchido quando o Dono anonimiza a pedido do cliente. A linha fica: as vendas (S10) apontam para ela.
  anonimizado_em  timestamptz,
  criado_por      uuid NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  -- Celular único por empresa (D8). Vários NULL convivem: anonimizar libera o número.
  UNIQUE (empresa_id, celular),
  -- Cliente ativo tem celular; anonimizado não tem (e vice-versa).
  CHECK ((anonimizado_em IS NULL) = (celular IS NOT NULL)),
  -- Chave composta: nada aponta para usuário de outra empresa (defesa além da RLS).
  FOREIGN KEY (empresa_id, criado_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON clientes
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Sem DELETE e sem TRUNCATE: "excluir" é anonimizar (a venda mantém o vínculo, sem dado pessoal). Só mudam o
-- nome e o celular (anonimização) e as datas do aviso e da anonimização; quem criou e quando nunca se reescrevem.
GRANT SELECT, INSERT ON clientes TO ailow_app;
GRANT UPDATE (nome, celular, aviso_lgpd_em, anonimizado_em) ON clientes TO ailow_app;

-- Down Migration
-- Descarta a tabela e os seus dados: só em ambiente sem clientes reais (OPS-11).
DROP TABLE clientes;
