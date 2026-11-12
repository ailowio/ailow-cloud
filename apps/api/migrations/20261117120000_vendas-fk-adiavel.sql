-- Up Migration
-- S13b2 (ADR 009, opção A): o número da venda passa a ser alocado por último na transação, para a trava de
-- venda_sequencia durar menos. Os itens e pagamentos são gravados antes da linha de `vendas`, então as duas FKs
-- para vendas passam a ser conferidas no COMMIT (DEFERRABLE INITIALLY DEFERRED). Nada é apagado nem reescrito;
-- a integridade é a mesma, só muda o instante da conferência. Compatível com a versão anterior do código
-- (que grava a venda primeiro): FK adiada também aceita essa ordem.

ALTER TABLE itens_venda ALTER CONSTRAINT itens_venda_empresa_id_venda_id_fkey DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE pagamentos_venda ALTER CONSTRAINT pagamentos_venda_empresa_id_venda_id_fkey DEFERRABLE INITIALLY DEFERRED;

-- Down Migration
ALTER TABLE pagamentos_venda ALTER CONSTRAINT pagamentos_venda_empresa_id_venda_id_fkey NOT DEFERRABLE;
ALTER TABLE itens_venda ALTER CONSTRAINT itens_venda_empresa_id_venda_id_fkey NOT DEFERRABLE;
