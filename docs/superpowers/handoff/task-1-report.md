# Task 1 report — Shared eixos + montarCodigoSku

**STATUS:** DONE  
**Verify:** `npm run build:shared && npm test -w @ailow/shared` → **11 files / 264 tests passed**  
**Commit:** none (brief forbids)

## Gate (resumo)

| Campo | Valor |
|-------|--------|
| Tipo | feature (contrato shared) |
| Tier | B |
| Regras | TEST-* (TDD), ARQ/ADR 006/017, contratos Zod em shared |
| Aceite | schemas eixos + `montarCodigoSku` com extras; build+test shared verdes |

## Deliverables

| Item | Resultado |
|------|-----------|
| `packages/shared/src/eixos-grade-padrao.ts` | Criado: reexport `TAMANHOS_PADRAO`/`CORES_PADRAO`; `MAX_EIXOS_POR_CATEGORIA = 4`; `SLUGS_EIXO_SISTEMA = ['tamanho','cor']`; `TIPOS_VALOR_EIXO` |
| `packages/shared/src/eixos-grade.ts` | Criado: Zod create/list/valor/vínculo categoria; `slugDeNomeEixo`, `validarNomeValorEixo`, `ehSlugSistema`; aliases `*CorpoSchema` / `categoriaEixosSchema` |
| `packages/shared/src/eixos-grade.test.ts` | Criado: MAX, slugs sistema, aceita/recusa schemas, `validarNomeValorEixo` |
| `produtos-calculos.ts` | `montarCodigoSku(..., extras = [])` anexa `-EXTRA`; valida `/^[A-Z0-9]{1,3}$/` |
| `produtos.ts` | `skuExtraEixoSchema` + `extras` default `[]` (max 2); `skuEixoValorSchema` + `eixos?` em `skuSchema` |
| `index.ts` / `puro.ts` | Export Zod via index; padrao sem Zod via puro |
| `produtos.test.ts` | Extras no código SKU + schema `skuNovo` |

## Test summary

`npm run build:shared` OK; `npm test -w @ailow/shared` → **264 passed** (11 files).

## Design notes (implementação)

- Create de eixo **não** recebe `slug` no body: servidor deriva com `slugDeNomeEixo(nome)` (evita cliente inventar slug).
- `extras` no create rejeita slugs `tamanho`/`cor` (campos próprios) e limita a 2 (teto de eixos extras com MAX=4 incluindo sistema).
- Resposta de SKU pode incluir `eixos: { slug, nome, valor }[]` opcional.

## Concerns

- Nenhuma bloqueante. Escopo limitado a `packages/shared` (+ report de handoff); plano não editado; sem commit.
