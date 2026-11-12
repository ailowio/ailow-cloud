-- Up Migration
-- S09b (decisão do Pedro): "excluir" é excluir (apaga do banco) ou inativar, nunca anonimizar; o cliente se edita
-- (RF-CLI-04/05, ADR 007). Substitui a coluna `anonimizado_em` por `ativo` e devolve o `DELETE` ao papel de runtime.
-- A migração 20261113120000 já foi aplicada: não se edita (OPS-11), por isso esta é nova.

-- Cliente anonimizado era uma linha sem celular, com dado nenhum a preservar, e ainda não existe venda (S10) que
-- aponte para ela: sai. A RLS forçada esconderia a linha até do dono da tabela, então ela é desligada só por este passo.
ALTER TABLE clientes NO FORCE ROW LEVEL SECURITY;
DELETE FROM clientes WHERE anonimizado_em IS NOT NULL;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;

-- A restrição "ativo tem celular, anonimizado não tem" envolve esta coluna e cai junto com ela.
ALTER TABLE clientes DROP COLUMN anonimizado_em;
ALTER TABLE clientes ALTER COLUMN celular SET NOT NULL;

-- false = inativado pelo Dono: some da busca padrão, o número continua reservado e dá para reativar.
ALTER TABLE clientes ADD COLUMN ativo boolean NOT NULL DEFAULT true;

-- Só mudam nome, celular (edição), o aviso e a situação; quem criou e quando nunca se reescrevem.
GRANT UPDATE (ativo) ON clientes TO ailow_app;
-- Excluir de verdade (pedido do cliente): na S10 a venda aponta para o cliente com ON DELETE SET NULL.
GRANT DELETE ON clientes TO ailow_app;

-- Down Migration
-- Volta ao desenho da S09. Clientes excluídos não voltam e os inativos voltam como ativos: só em ambiente sem dado real.
REVOKE DELETE ON clientes FROM ailow_app;
ALTER TABLE clientes DROP COLUMN ativo;
ALTER TABLE clientes ALTER COLUMN celular DROP NOT NULL;
ALTER TABLE clientes ADD COLUMN anonimizado_em timestamptz;
ALTER TABLE clientes ADD CHECK ((anonimizado_em IS NULL) = (celular IS NOT NULL));
GRANT UPDATE (anonimizado_em) ON clientes TO ailow_app;
