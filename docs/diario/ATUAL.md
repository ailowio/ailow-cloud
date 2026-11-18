# Diário ativo (as 3 últimas entradas)

> Regras (skill `execucao-em-sessoes`): entrada nova ≤ 2 KB; ao passar de 3 entradas ou ~8 KB, mover as mais antigas, **sem editar**, para `ARQUIVO-*.md`. Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
> Arquivo: `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) `ARQUIVO-S07-S09.md` e `ARQUIVO-S10-S12.md` (S10 em diante); `ARQUIVO-S14a.md` (S14a–S14e); ler só sob demanda.

Template:
```text
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + link do PR/CI.
```

### UX venda voz 17/11 — 2026-11-17 — Composer
Gate: UI/front-end, **tier B**; UXM-*, TEST-*, GIT-*, AUD-20; sem migração/OpenAPI.
Feito: `CartaoPecaVenda` (preço, estoque, −/+); paginação discreta; catálogo 2 colunas + ícones; Finalizar CTA (`GradeAcoes.destaque`); CHANGELOG 1.5.0; branch `feat/ux-venda-cards-paginacao`.
Números: web 500 testes; `npm run verify` verde.
Decisões: só módulo Vendas; badge de estoque no lugar de texto críptico; destaque usa `--ailow-acao` (não azul hardcoded).
Pendências: merge humano → tag v1.5.0 → Publicar → Deploy; tenant de teste na VPS.
Verificação: `verify` exit 0; PR desta sessão.

### UX 12 itens (chrome + venda + DnD) — 2026-11-16 — Composer
Gate: feature/UI + migração, **tier B**; UXM-06/08, TEST-*, ADR 002/018, AUD-20. Plano A→C→D→B.
Feito: logo/wordmark Ailow; Trocar na toolbar + badges; sugestões-venda + Finalizar + swatch; barra marca + pulse; Finalizar venda; hierarquia do Carrinho; ADR 018 + `preferencias_ui` + DnD home; OpenAPI 0.16.0; protótipo `docs/design/barra-carrinho.html`.
Pendências: (histórico) commit/PR da UX 12 já entregue em PRs posteriores; tenant de teste; Moodle/vídeo; RNF-02.
Verificação: web 469 testes à época; ver PRs #39–#41.

### UX rodada 2 + entrega Moodle — 2026-11-16 — Claude Opus 5.5 / Composer
Gate: feature/UI + docs de entrega, **tier B**; UXM-*, TEST-01/08/10, DOC-*, ADR 013–017. Branch `feat/ux-mobile-rodada-2` (base `feat/ux-mobile-rodada-1`); PRs #34 e #35.
Feito: decisões do checklist (Sair desvincula, ficha após cadastro, seta do wizard, receita/receber, grade configurável, paginação cursor+trigramas, refazer venda); `docs/entrega/`; checklist PRD; CHANGELOG rodada 2.
Decisões (Pedro): ADR 013–017; merge/deploy só com OK.
Pendências: tenant de teste; vídeo; RNF-02.
Verificação: #34 11/11 ✅; #35 corrigido depois.
