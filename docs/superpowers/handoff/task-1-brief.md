# Task 1 brief — Shared eixos + montarCodigoSku

Workspace: d:\apps\ailow-cloud
Do NOT edit docs/superpowers/plans/*.md or .cursor/plans/*
Do NOT commit unless this brief says so — it does NOT; skip commit.
Do NOT touch unrelated dirty files (logo, transicao, plano-execucao).

## Goal
Shared package: schemas for eixos de grade + extend montarCodigoSku with optional extras suffixes. TDD.

## Required deliverables
1. Create packages/shared/src/eixos-grade-padrao.ts — re-export/adapt TAMANHOS_PADRAO and CORES_PADRAO; export MAX_EIXOS_POR_CATEGORIA = 4; system slugs tamanho/cor.
2. Create packages/shared/src/eixos-grade.ts — Zod: eixo create/list, valor, categoria eixos link; types.
3. Create packages/shared/src/eixos-grade.test.ts — validate MAX and basic schema accepts/rejects.
4. Modify packages/shared/src/produtos-calculos.ts — montarCodigoSku(numero, tamanho, corCodigo, extras: readonly string[] = []) appends -EXTRA for each; validate /^[A-Z0-9]{1,3}$/ per extra.
5. Modify packages/shared/src/produtos.ts — skuNovoSchema keeps tamanho+cor; add optional extras: z.array(z.object({ slug: z.string(), valor: z.string() })).default([]); sku response may include eixos optional array later — add skuEixoValorSchema and optional eixos on skuSchema if clean.
6. Export from packages/shared/src/index.ts; export MAX_EIXOS and padrao from puro.ts if padrao has no Zod.
7. Add tests in produtos.test.ts for montarCodigoSku with extras (as in plan).

## Verify
npm run build:shared && npm test -w @ailow/shared

## Report
Write full report to d:\apps\ailow-cloud\docs\superpowers\handoff\task-1-report.md
Return only: STATUS (DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT), one-line test summary, concerns if any. No commit SHAs required if no commit.
