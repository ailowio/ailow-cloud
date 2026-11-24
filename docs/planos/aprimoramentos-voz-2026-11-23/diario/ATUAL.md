# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### Fecho Ondas 2–5 + Deploy waiting · 2026-11-24 — Composer · orquestrador
Feito: Ondas 2–5 na main (#47→#50). Versões CHANGELOG 1.7.0 / 1.8.0 / 1.8.1 / 1.9.0. Tag `v1.9.0` + Publicar imagens OK. Deploy disparado; **waiting** Approve Pedro.
PRs/SHAs: #47 `59647ea` · #48 `3b9272c` · #49 `2b82f87` · #50 `aa9c0e9` (merge).
Deploy: https://github.com/ailowio/ailow-cloud/actions/runs/45353314602
Pendências: 🚦 Approve; celular T01; P03.
Verificação: CI das ondas verde (e2e #50 re-run após 1 intermitência campo-data).

### T01 — Teclado menor e Continuar à vista · 2026-11-24 — agente · orquestrador
Feito: viewport `interactive-widget=resizes-content`; Fechamento Finalizar sticky; autoComplete; CHANGELOG 1.8.1. PR #49 mergeada (`2b82f87`).
Números: `e2e.sh` 141/141. Limite: Gboard/Chrome — 🚦 Pedro no celular.
Verificação: capturas `_scratch/onda4-capturas/`.

### F01+F02 + fecho Onda 5 · 2026-11-24 — Composer · orquestrador
Feito F02: linha financeiro hoje; N parcelas; toasts → Financeiro; CHANGELOG 1.9.0. PR #50.
Números: `e2e.sh` 143/143. Tag `v1.9.0`.
Verificação: merge `aa9c0e9`; Deploy waiting (ver entrada Fecho).
