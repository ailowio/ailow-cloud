-- Up Migration
-- S09: o Dono edita o produto (nome, categoria, porte, atributos, fornecedor, custo, preço) e o arquiva (ativo = false).
-- O ADR 006 previa esta migração ("o produto não pode ser editado ainda"). Só GRANT de colunas: nenhuma coluna, tabela
-- ou restrição nova. Continuam fora do alcance do papel de runtime: id, empresa_id, numero (compõe o código dos SKUs),
-- criado_por e criado_em; e continua sem DELETE (nada é apagado). Os itens de venda já guardam nome e preço da época (vendas: produto_nome, preco_unitario_centavos).
GRANT UPDATE (nome, categoria_id, porte, atributos, fornecedor, custo_centavos, preco_centavos, ativo) ON produtos TO ailow_app;

-- Down Migration
REVOKE UPDATE (nome, categoria_id, porte, atributos, fornecedor, custo_centavos, preco_centavos, ativo) ON produtos FROM ailow_app;
