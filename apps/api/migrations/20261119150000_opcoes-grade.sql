-- Up Migration
-- ADR 017 (decisão do Pedro em 2026-11-16): tamanhos e cores da grade de produtos passam a ser configuráveis por
-- empresa, na engrenagem do "Novo produto". Antes eram listas fixas no código do app. Expand puro: tabela nova.
-- Não há semente aqui: `empresas` tem RLS forçada e o papel que roda a migração pode não enxergá-las; a API grava as
-- opções padrão na primeira leitura, dentro do withEmpresa (ADR 017). Os SKUs continuam guardando o texto do
-- tamanho e da cor (histórico não muda ao renomear ou desativar uma opção).

CREATE TABLE opcoes_grade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas (id) ON DELETE RESTRICT,
  tipo        text NOT NULL CHECK (tipo IN ('tamanho', 'cor')),
  nome        text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 30),
  -- Cor da bolinha do chip (#rrggbb). Só para cor; tamanho não tem.
  amostra     text CHECK (amostra ~ '^#[0-9a-f]{6}$'),
  ativa       boolean NOT NULL DEFAULT true,
  -- Ordem de cadastro estável para a lista de cores (L-0014: nunca ordenar por instante ou uuid).
  seq         bigint GENERATED ALWAYS AS IDENTITY,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, id),
  -- Tamanho segue a mesma regra do SKU (tamanhoSchema): 1 a 3 letras maiúsculas ou números.
  CHECK (tipo <> 'tamanho' OR (nome ~ '^[A-Z0-9]{1,3}$' AND amostra IS NULL))
);
-- Sem repetir o mesmo nome no mesmo tipo (sem diferenciar maiúsculas). Acento ("Rosa Chá" x "Rosa Cha") é
-- conferido pela API com a mesma chave do SKU (chaveCor); este índice é a trava de concorrência e da semente.
CREATE UNIQUE INDEX opcoes_grade_nome_idx ON opcoes_grade (empresa_id, tipo, lower(btrim(nome)));

ALTER TABLE opcoes_grade ENABLE ROW LEVEL SECURITY;
ALTER TABLE opcoes_grade FORCE ROW LEVEL SECURITY;

CREATE POLICY isolamento_empresa ON opcoes_grade
  FOR ALL TO ailow_app
  USING (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid))
  WITH CHECK (empresa_id = (SELECT nullif(current_setting('app.empresa_id', true), '')::uuid));

-- Nada é apagado (desativar some da escolha, mas o nome segue nos SKUs): sem DELETE; tipo e empresa nunca mudam.
GRANT SELECT, INSERT ON opcoes_grade TO ailow_app;
GRANT UPDATE (nome, amostra, ativa) ON opcoes_grade TO ailow_app;

-- Down Migration
-- Descarta só a configuração de tamanhos e cores; os SKUs não dependem desta tabela (guardam o texto).
DROP TABLE opcoes_grade;
