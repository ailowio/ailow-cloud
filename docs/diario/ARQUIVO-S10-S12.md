# Arquivo do diário — S10 em diante (entradas movidas de ATUAL.md, sem edição; ler só sob demanda)

### S10 — Vendas — 2026-11-11 — Grok 4.7
Gate: feature + UI + migração + dado pessoal, **tier B**. TEST-01/03/04/05/06/07/08/09/12/13/17/20, CODE-01/02/06/10/14/18, SEC-01/03/04, OPS-11, ARQ-05, AUD-03, CI-01, IA-05/08/12. Branch `feature/s10-vendas`.
Feito: nova venda (busca, câmera nativa, carrinho, bloqueio sem estoque), fechamento (celular com cadastro se faltar, desconto, várias formas), finalização atômica (estoque + lançamento), comprovante (WhatsApp e impressão), cancelar = estorno, relatório e histórico na ficha. Venda → cliente `ON DELETE SET NULL` (ADR 007). OpenAPI 0.10.0. Migração `20261114120000_vendas`.
Números: API 662 -> 685, web 235 -> 246, shared 200 -> 213.
Decisões: toque do RNF-04 é clique em controle, não tecla; desconto percentual inteiro com piso; preço e estoque vêm do banco; Vendedor cancela só a própria venda e não vê o mês.
Verificação: `verify` exit 0. Mutação do desconto de 100% (`>` virado `>=`) pegou o teste e foi revertida. Playwright 360×640, escuro e claro: 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado. Caminho Pix: 5 cliques (Vendas, peça, Fechar, Pix, Finalizar); 19 teclas à parte. PR #19.
Pendências: impressão física S08 (Pedro); S11 Compras. `dev:parar` quebrado e Zod no bundle seguem fora desta sessão.
