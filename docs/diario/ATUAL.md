# Diário ativo (as 3 últimas entradas)

> Regras (skill `execucao-em-sessoes`): entrada nova ≤ 2 KB; ao passar de 3 entradas ou ~8 KB, mover as mais antigas, **sem editar**, para `ARQUIVO-*.md`. Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
> Arquivo: `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) e `ARQUIVO-S07-S09.md` (S07 em diante); ler só sob demanda.

Template:
```text
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + link do PR/CI.
```

### S10 — Vendas — 2026-11-11 — Grok 4.7
Gate: feature + UI + migração + dado pessoal, **tier B**. TEST-01/03/04/05/06/07/08/09/12/13/17/20, CODE-01/02/06/10/14/18, SEC-01/03/04, OPS-11, ARQ-05, AUD-03, CI-01, IA-05/08/12. Branch `feature/s10-vendas`.
Feito: nova venda (busca, câmera nativa, carrinho, bloqueio sem estoque), fechamento (celular com cadastro se faltar, desconto, várias formas), finalização atômica (estoque + lançamento), comprovante (WhatsApp e impressão), cancelar = estorno, relatório e histórico na ficha. Venda → cliente `ON DELETE SET NULL` (ADR 007). OpenAPI 0.10.0. Migração `20261114120000_vendas`.
Números: API 662 -> 685, web 235 -> 246, shared 200 -> 213.
Decisões: toque do RNF-04 é clique em controle, não tecla; desconto percentual inteiro com piso; preço e estoque vêm do banco; Vendedor cancela só a própria venda e não vê o mês.
Verificação: `verify` exit 0. Mutação do desconto de 100% (`>` virado `>=`) pegou o teste e foi revertida. Playwright 360×640, escuro e claro: 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado. Caminho Pix: 5 cliques (Vendas, peça, Fechar, Pix, Finalizar); 19 teclas à parte. PR #19.
Pendências: impressão física S08 (Pedro); S11 Compras. `dev:parar` quebrado e Zod no bundle seguem fora desta sessão.

### S11 — Compras — 2026-11-11 — Composer
Gate: feature + migração + UI, **tier B**. TEST-01..08/17, CODE-*, SEC-01/03/04, OPS-11, ARQ-05, AUD-03, CI-01, RN-10/11. Branch `feature/s11-compras` (S10 já na main, PR #19). Desenho do PRD §5.7/§7 + ADR 005/006 (sem ADR novo).
Feito: `fornecedores` + pedidos (`rascunho` → `enviado` → `recebido`); enviar = `wa.me` com código/cor/qtd; receber atômico (`registrarMovimento` tipo `compra` + parcelas → lançamentos saída); relatório do mês por fornecedor; só Dono. OpenAPI 0.11.0. Migração `20261115120000_compras`. Telas Pedidos/Fornecedores/Relatório. `produtos.fornecedor` texto permanece (contract ADR 006 depois).
Números: API 685 -> 703, web 246 -> 248, shared 213 -> 222.
Decisões: parcela na UI começa em 1× o total (API aceita até 24); WhatsApp do fornecedor = celular BR; sem ADR próprio.
Verificação: `verify` exit 0. Mutação: `!==`→`>` em `parcelasFecham` (teste a menos reforçado) e status do receber enfraquecido — ambas pegas. Playwright (Chromium, 2 temas): menu/pedidos/fornecedores/novo/relatório — 0 rolagem, 0 alvo < 48 px, 0 texto cortado (viewport CSS efetivo 480 no MCP; `setViewportSize(360)` reportado, `innerWidth` 480). PR #20.
Pendências: impressão S08 (Pedro); S12 Pessoas; proxy HTTPS S14 (`fornecedores`/`compras`); contract texto→FK fornecedor.

### S12 — Pessoas (ponto) — 2026-11-12 — Claude Sonnet 5.5
Gate: feature + migração + UI, **tier B**; TEST-01..08/17, CODE-*, SEC-01/04, OPS-11, ARQ-05, AUD-03, CI-01, RN-10. Branch `feature/s12-pessoas` (S11 já na main, PR #20). Sem ADR (PRD §5.8/§7 + ADR 004).
Feito: bater ponto (`GET /pontos/estado`, `POST /pontos`) e espelho do mês (`GET /pontos/espelho`); tela Pessoas; módulo pronto para Dono e Vendedor. **Pedido do Pedro:** só o Dono adiciona, edita e exclui ponto (`POST /pontos/manual`, `PUT /pontos/{id}`, `POST /pontos/{id}/excluir`), com motivo; exclusão lógica + log imutável `pontos_ajustes`; sequência entrada/saída validada sob lock; marca "ajustado". **ADR 008 proposto.** OpenAPI 0.13.0. Migrações `20261116120000_pessoas` + `20261116180000_pontos-ajustes` (sai `seq`/paridade).
Números: API 703 -> 740 (30 da S12; o resto são testes de concorrência de compras/vendas do mesmo PR), web 248 -> 250 (sem `toques.test`, trocado pelo E2E), shared 222 -> 237.
Decisões (Pedro): 30 s entre batidas, turno no dia/mês da entrada e "em aberto" sem horas: confirmados. Falta assinar o ADR 008 (Dono ajusta o próprio ponto; sem tela do histórico de ajustes).
Pendências: tirar o aviso "em breve" da tela inicial (S13); prefixo `pontos` no proxy HTTPS (S14); E2E 360 px formal (S13); retenção de ponto (S14).
Verificação: `verify` exit 0. Mutação (30 s, 403, sequência na exclusão, exclusão lógica na batida) pega; revertida. Playwright 360×640, tema escuro: adicionar, editar e excluir com confirmação, 0 rolagem, 0 alvo < 48 px (campos subiram para `lg`). PR #21 (4 commits: compras/vendas, E2E, identidade, S12).
