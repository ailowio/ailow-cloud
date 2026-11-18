# ADR 019 — Eixos de grade configuráveis (biblioteca + categoria)

- **Status:** proposto (implementação em curso, 2026-11-17).
- **Decisor:** Pedro. **Tier:** B.
- **Spec:** `docs/superpowers/specs/2026-11-17-eixos-grade-marcant-design.md`
- **Relacionados:** ADR 006 (produto/SKU), ADR 017 (tamanhos/cores), ADR 002 (RLS).

## Contexto

ADR 017 fixou dois tipos (`tamanho` | `cor`) em `opcoes_grade`. A Marcant (e outras lojas) precisam de eixos adicionais que multipliquem SKU (ex.: taça), definidos uma vez na empresa e ligados por categoria — sem promover atributos de ficha (bojo, aro) a eixo.

## Decisão

1. Tabelas `eixos_grade`, `valores_eixo`, `categoria_eixos`, `sku_valores` (RLS, sem DELETE de valores — desativar).
2. Eixos sistema `tamanho` e `cor` (slug fixo); colunas `skus.tamanho` / `cor` / `codigo` permanecem.
3. Código QR: `PPPP-TT-CCC` (+ sufixos `-XXX` por eixo extra).
4. Limite: ≤4 eixos/categoria; ≤144 SKUs/produto.
5. API `/eixos-grade` + `PUT /categorias/:id/eixos`; `/opcoes-grade` permanece na fase expand (contract depois).
6. Seed Marcant: só estrutura (categorias + eixos + valores); Taça na biblioteca, desligada das categorias; zero produtos fictícios.

## Alternativas descartadas

- EAV puro no SKU (quebra etiqueta/QR/contratos).
- Só +1 eixo hardcoded.
- Eixos só por produto (cadastro longo).

## Consequências

- Migração `20261121120000_eixos-grade.sql` (expand + backfill).
- UI: aba Eixos na engrenagem do Novo produto; assistente/venda passam a considerar extras.
- Produção: rodar `seed-estrutura-marcant.ts` só com pedido explícito e `EMPRESA_ID` confirmado.
