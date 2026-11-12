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

### S09 — Clientes — 2026-11-13 — Claude Sonnet 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, MC. Branch `feature/s09-clientes` (S08 já mergeada, PR #16).
Feito: tabela `clientes` (RLS, celular único por empresa, sem `DELETE`); `GET/POST /clientes`, ficha, `POST …/aviso-lgpd` (Dono e Vendedor) e `POST …/anonimizar` (só Dono); busca por nome (sem acento) ou celular; telas Clientes, Novo cliente e Ficha com botão WhatsApp, aviso com data e apagar com confirmação; módulo "Clientes" ativo na grade. ADR 007 **proposto**; OpenAPI 0.8.0.
Números: testes API 571 -> 634, web 215 -> 231, shared 151 -> 191; migrações +1 (`20261113120000_clientes`).
Decisões a confirmar (Pedro): (1) "excluir" = **anonimizar** (sem `DELETE`, a venda mantém o vínculo); (2) sem editar cliente (fora de RF-CLI-01…04); (3) **histórico de compras vazio até a S10** (não há vendas); (4) o log passa a descartar a query string (a busca leva nome/celular na URL).
Verificação: `verify` exit 0; mutação 5/5 (a 1ª rodada pegou 4/5: o teste de "lista sem anonimizados" era frouxo e foi reforçado); Playwright 360×640 nos 2 temas: 11 telas, 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado (1 falso positivo: trilho do Switch).
Aprendizado: **L-0016** (teste avançou o relógio compartilhado em minutos e derrubou as sessões; comentário no helper). O guard barrou um comando meu com ".env" e não foi contornado. `check-harness` OK.
Pendências: prefixo `clientes` no proxy HTTPS da S14 (o do Vite já tem, por teste de guarda); impressão física das etiquetas (S08, Pedro).

### S09b — Clientes editar/inativar/excluir — 2026-11-12 — Composer
Gate: feature + migração + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, ARQ (ADR 007), MC. Branch `feature/s09b-clientes-editar-excluir` (S09 já mergeada, PR #17). Continuação da sessão Claude Code interrompida por usage limit.
Feito: migração `20261113180000_clientes-inativar-excluir` (`ativo` no lugar de `anonimizado_em`; `DELETE` ao runtime); `PUT /clientes/{id}`, `POST …/inativar|reativar`, `DELETE /clientes/{id}`; lista com aba de inativos (só Dono); formulário compartilhado cadastro/edição; ADR 007 **aceito** (decisão do Pedro); OpenAPI 0.9.0; matriz de acessos atualizada.
Números: testes API 634 -> 662, web 231 -> 235, shared 191 -> 200.
Decisões (Pedro): excluir = apagar do banco ou inativar; edição obrigatória; histórico aguarda S10; log sem nome/celular.
Verificação: `verify` exit 0 (API 662, web 235, shared 200); mutação das regras novas (sessão Claude: 8/8); Playwright 360×640 nos 2 temas: 14 telas (lista, inativos, novo, ficha, editar, ficha-inativo, confirmar-excluir × 2 temas), 0 rolagem, 0 alvo < 48 px, 0 texto cortado.
Pendências: impressão física S08 (Pedro); S10 Vendas.

### S10 — Vendas — 2026-11-11 — Grok 4.7
Gate: feature + UI + migração + dado pessoal, **tier B**. TEST-01/03/04/05/06/07/08/09/12/13/17/20, CODE-01/02/06/10/14/18, SEC-01/03/04, OPS-11, ARQ-05, AUD-03, CI-01, IA-05/08/12. Branch `feature/s10-vendas`.
Feito: nova venda (busca, câmera nativa, carrinho, bloqueio sem estoque), fechamento (celular com cadastro se faltar, desconto, várias formas), finalização atômica (estoque + lançamento), comprovante (WhatsApp e impressão), cancelar = estorno, relatório e histórico na ficha. Venda → cliente `ON DELETE SET NULL` (ADR 007). OpenAPI 0.10.0. Migração `20261114120000_vendas`.
Números: API 662 -> 685, web 235 -> 246, shared 200 -> 213.
Decisões: toque do RNF-04 é clique em controle, não tecla; desconto percentual inteiro com piso; preço e estoque vêm do banco; Vendedor cancela só a própria venda e não vê o mês.
Verificação: `verify` exit 0. Mutação do desconto de 100% (`>` virado `>=`) pegou o teste e foi revertida. Playwright 360×640, escuro e claro: 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado. Caminho Pix: 5 cliques (Vendas, peça, Fechar, Pix, Finalizar); 19 teclas à parte.
Pendências: impressão física S08 (Pedro); S11 Compras. `dev:parar` quebrado e Zod no bundle seguem fora desta sessão.
