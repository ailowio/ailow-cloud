-- Up Migration
-- S06 (Financeiro): lançamentos imutáveis (RF-FIN-01…06, RN-01, RN-06). ADR 002 (RLS) e ADR 005 (Financeiro).
-- Mudança aditiva (expand): uma tabela nova; nada existente é alterado.

CREATE TABLE lancamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  -- O sentido está em `tipo`; o valor é sempre positivo (um estorno é o lançamento de sentido oposto).
  tipo            text NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  origem_tipo     text NOT NULL CHECK (origem_tipo IN ('venda', 'compra', 'despesa', 'estorno')),
  -- Id da venda/compra de origem (despesa não tem; no estorno é o lançamento estornado).
  origem_id       uuid,
  descricao       text CHECK (length(btrim(descricao)) BETWEEN 1 AND 120),
  -- Texto livre curto (ADR 005): "categorias" é de produto, não de despesa.
  categoria       text CHECK (length(btrim(categoria)) BETWEEN 1 AND 40),
  -- RN-01: centavos inteiros. Teto de R$ 20 milhões (cabe no integer; pg devolve bigint como texto).
  valor_centavos  integer NOT NULL CHECK (valor_centavos BETWEEN 1 AND 2000000000),
  forma_pagamento text CHECK (forma_pagamento IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto')),
  vencimento      date NOT NULL,
  -- Só o que tem pago_em entra no caixa (relatórios). O original estornado mantém o seu pago_em.
  pago_em         timestamptz,
  status          text NOT NULL CHECK (status IN ('aberto', 'pago', 'estornado')),
  -- RN-06: correção = lançamento inverso ligado ao original; no máximo um por original (UNIQUE).
  estorno_de      uuid,
  estorno_motivo  text CHECK (length(btrim(estorno_motivo)) BETWEEN 3 AND 200),
  criado_por      uuid NOT NULL,
  pago_por        uuid,
  criado_em       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (empresa_id, id),
  UNIQUE (estorno_de),
  -- Chaves compostas: impedem apontar para lançamento ou usuário de outra empresa (defesa além da RLS).
  FOREIGN KEY (empresa_id, estorno_de) REFERENCES lancamentos (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, criado_por) REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (empresa_id, pago_por)   REFERENCES usuarios (empresa_id, id) ON DELETE RESTRICT,

  CHECK (origem_tipo <> 'venda' OR tipo = 'entrada'),
  CHECK (origem_tipo NOT IN ('compra', 'despesa') OR tipo = 'saida'),
  CHECK ((origem_tipo = 'despesa') = (origem_id IS NULL)),
  CHECK (origem_tipo <> 'despesa' OR descricao IS NOT NULL),
  CHECK ((origem_tipo = 'estorno') = (estorno_de IS NOT NULL)),
  CHECK (origem_tipo <> 'estorno' OR (origem_id = estorno_de AND estorno_motivo IS NOT NULL)),
  CHECK (status <> 'pago' OR (pago_em IS NOT NULL AND forma_pagamento IS NOT NULL)),
  CHECK (status <> 'aberto' OR pago_em IS NULL)
);

-- Contas a pagar: só as saídas em aberto, por vencimento.
CREATE INDEX lancamentos_a_pagar_idx ON lancamentos (empresa_id, vencimento)
  WHERE status = 'aberto' AND tipo = 'saida';
-- Relatórios e extrato do dia: lançamentos que movimentaram o caixa.
CREATE INDEX lancamentos_pago_em_idx ON lancamentos (empresa_id, pago_em)
  WHERE pago_em IS NOT NULL;

ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON lancamentos
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Imutável para o papel de runtime (RN-06, RN-01): sem DELETE, sem TRUNCATE e UPDATE só das colunas
-- da baixa/estorno (status, pago_em, forma_pagamento, pago_por). Valor, tipo, origem e categoria
-- nunca mudam: correção é estorno + novo lançamento.
GRANT SELECT, INSERT ON lancamentos TO ailow_app;
GRANT UPDATE (status, pago_em, forma_pagamento, pago_por) ON lancamentos TO ailow_app;

-- Down Migration
-- Descarta a tabela e os seus dados: só em ambiente sem dados financeiros reais (OPS-11).
DROP TABLE lancamentos;
