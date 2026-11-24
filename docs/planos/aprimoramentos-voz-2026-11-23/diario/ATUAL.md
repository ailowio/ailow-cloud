# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### P03 + fecho Onda 3 · 2026-11-24 — Composer · orquestrador
P01 (nota): 16 testes de integração em `produtos-filtros.test.ts`; verify verde no agente anterior (`71e97e8`).
Feito: `apps/api/scripts/converter-marcant-csv.ts` (só local/dev): CSV `;` → formato do `seed-marcant-via-api.mjs`; preço em centavos ("24.9"→2490), cor sem "(simulado)", "A DEFINIR"→vazio, cód. de barras vazio fica vazio; SKU validado com `skuNovoSchema`; 1 produto por produto_id+porte; relatório linhas/importadas/rejeitadas com motivo. Testes só sintéticos (25). CHANGELOG 1.8.0. Commit `69b94d5`.
Números (arquivos locais, só contagens): 29 produtos / 110 SKUs → padrão: 16 SKUs em 2 produtos, 98 rejeitadas (4 categorias fora do seed, 4 SKUs delas, 90 SKUs sem cor); com `--cor-padrao`: 106 SKUs em 44 produtos, 8 rejeitadas, 92 avisos. Importadas + rejeitadas = 110 nos 2 modos.
Decisões: SKU sem cor é rejeitado; `--cor-padrao` é opt-in (🚦 Pedro escolhe). Seed não rodado (nem dev nem produção).
Pendências: 🚦 Pedro: cor padrão? categorias fora do seed? seed ler o JSON (`--saida`) e carga no dev; `e2e.sh` usa contêiner `ailow-e2e-db` fixo (colide entre worktrees); `vite preview` órfão de `_wt-inicio-venda` na 4174 (L-0012).
Verificação: verify 935/552/265; `e2e.sh` 138/138 (portas 4184/3014/15444 por causa do órfão).

### T01 — Teclado menor e Continuar à vista · 2026-11-24 — agente · orquestrador
Feito: viewport `interactive-widget=resizes-content`; Fechamento Finalizar sticky; 37 campos + `autoComplete`; CHANGELOG 1.8.1. PR #49 mergeada (`2b82f87`).
Números: web 556; `e2e.sh` 141/141.
Limites: Gboard/Chrome pode não sumir 100% — 🚦 Pedro no celular.
Pendências: Onda 5.
Verificação: capturas `_scratch/onda4-capturas/`.

### F01+F02 + fecho Onda 5 · 2026-11-24 — Composer · orquestrador
Gate: UI/feature, tier B; TEST-*, CODE-*, UXM-*, GIT-*. F01 já em `b5ab8ff` (rebase em `origin/main` pós-#49).
Feito F02: `textoEntraNoFinanceiroHoje` no Fechamento/Comprovante; toasts → Financeiro; `ReceberPedido` com N parcelas + `parcelasFecham` + vencimentos distintos (contrato API); E2E `financeiro-visivel` (extrato do dia + 3 contas + soma divergente). CHANGELOG 1.9.0.
Números: `e2e.sh` **143/143** (r1: 141+2 fail — vencimentos iguais + uxm-pessoas intermitente; r2 verde).
Decisões: novas parcelas ganham vencimento +N meses; validação client-side de datas duplicadas.
Pendências: PR/merge → tag + Deploy waiting (Pedro Approve).
Verificação: verify verde antes do e2e; receber-compra e venda-toques ok na suíte.
