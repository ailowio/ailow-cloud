# Checklist do PRD §10 — critérios de aceite do MVP, com evidência

*Rev. 2026-11-12 (S13c, parcial). Marcação honesta: ✅ tem evidência conferida; 🟡 parcial; ⬜ pendente (a sessão indicada fecha); ❓ não verificável por mim (plataforma ou pessoa). Números de carga são desta máquina, não da VPS.*

## Produto
| # | Critério | Situação | Evidência / o que falta |
|---|----------|----------|--------------------------|
| 1 | Todos os RF de §5 demonstrados | 🟡 | Suítes de integração por módulo (API 766 testes, web 250, shared 237 no `verify` de 2026-11-12). Falta a matriz RF → teste, que não foi feita |
| 2 | Jornada J1 (nova venda) cumpre RNF-04 | ✅ | E2E `apps/web/e2e/venda-toques.e2e.ts` (360×640), roda em `bash scripts/e2e.sh` (stack efêmera; 5 toques medidos no navegador) e no job `e2e` do CI com canário de limite 1 toque que TEM de reprovar; job `e2e` verde no PR #25 (S13c, mergeado, 10 jobs) |
| 3 | O Marcos faz sozinho: PIN, vender, relatório do dia, lista de reposição | ❓ | Depende de teste com o Marcos (humano) |

## Engenharia (harness tier B)
| # | Critério | Situação | Evidência / o que falta |
|---|----------|----------|--------------------------|
| 4 | `verify` local e CI verdes; `main` protegida; cobertura não cai | 🟡 | `verify` local verde. CI: jobs `verify`, `contrato`, `carga-smoke`, `alertas`, `seguranca-segredos`, `seguranca-sast`, `seguranca-sca`, `imagem`, `compose` definidos em `.github/workflows/ci.yml` (+ `e2e` e `stack`; **2026-11-16: PR #34 com os 11 jobs verdes**, conferido com `gh pr checks`). **`main` protegida** pelo ruleset `proteger-main` com checks obrigatórios (conferido pela API do GitHub em 2026-11-16). Gate de cobertura: não encontrei configuração de `coverage` no `apps/api` (continua faltando) |
| 5 | RN-01…RN-11 com testes; autorização 2 empresas × 2 perfis | 🟡 | Testes de autorização e isolamento em cada módulo (ex.: `vendas.test.ts` "autorização (TEST-17)", `autorizacao.test.ts`). Falta a matriz RN → teste |
| 6 | OpenAPI 3.1 com Spectral e Schemathesis no CI | ✅ | `npm run lint:openapi` dentro do `verify` (0 avisos); `bash scripts/contrato.sh`: 3485 de 3485 casos passaram em 2026-11-12; job `contrato` no CI |
| 7 | k6 smoke + carga + estresse com thresholds de RNF-01/02 | 🟡 (local ✅; **produção: RNF-01 ✅, RNF-02 ❌**) | **Em produção (S14e, 2026-11-13, `v1.0.1`, 50 usuários):** venda p95 352 ms (≤ 500) passou; **busca p95 427 ms (≤ 300) reprovou**; com 1,5 CPU: 529 ms (SQL da busca ampla = 0,23 ms). **Correção 2026-11-16:** o k6 rodou do PC do Pedro pela internet (RTT ≈ 61 ms), então "CPU descartada" é hipótese; falta medir com o k6 na VPS, 3 rodadas seguidas. Ganho do índice de trigramas (ADR 016) também não medido na VPS. Critério não alterado; decisão do Pedro: otimizar a busca ampla em sessão própria (detalhe em `runbooks/deploy.md` §0). **Local:** `bash scripts/carga.sh carga`: venda p95 309 e 333 ms (meta ≤ 500), busca p95 246 e 268 ms (meta ≤ 300), erro 0%, exit 0, duas rodadas; thresholds não foram relaxados e reprovam de verdade (canário `P95_VENDA_MS=1`, S13b). Estresse mostra onde quebra (ADR 009). `carga-smoke` roda em todo PR; carga completa só manual |

## Curso (Projeto A)
| # | Critério | Situação | Evidência / o que falta |
|---|----------|----------|--------------------------|
| 8 | README, ADR 001–003, OpenAPI, C4 + mapa de contextos, Docker + Compose, k6, CI que falha de verdade, `main` protegida, segredos fora do repo, CONTRIBUTORS, Conventional Commits, board/PRs | 🟡 (só o board) | **2026-11-16:** README, `docs/adr/001…017`, `docs/openapi.json`, `docs/arquitetura/c4.md`, `compose.yaml`, `ops/k6`, `.github/workflows/ci.yml` (11 jobs; PR #34 com todos verdes), `CONTRIBUTORS.md`, `.env` ignorado, runbooks de deploy/rollback/backup com números da VPS (S14), **`main` protegida pelo ruleset `proteger-main`** (PR obrigatório, checks obrigatórios, sem exclusão nem force-push; conferido pela API do GitHub), 35 PRs. Mapa completo: `docs/entrega/texto-guia.md`. **Falta:** board — não há GitHub Projects nem issues (o fluxo foi sessão → PR); decidir se cria um board mínimo ou explica no vídeo |
| 9 | App no ar; vídeo + texto-guia; pacote do Moodle | 🟡 | App no ar `https://cloud.ailow.com.br`; texto-guia, `docs/desempenho.md`, `docs/ia.md` e checklist em `docs/entrega/`. **Falta:** vídeo (opcional/bônus) e o envio definitivo no Moodle (Pedro) |
