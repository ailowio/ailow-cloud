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
| 4 | `verify` local e CI verdes; `main` protegida; cobertura não cai | 🟡 | `verify` local verde. CI: jobs `verify`, `contrato`, `carga-smoke`, `alertas`, `seguranca-segredos`, `seguranca-sast`, `seguranca-sca`, `imagem`, `compose` definidos em `.github/workflows/ci.yml` (resultado do último run no GitHub: não verificado aqui). **`main` protegida e checks obrigatórios: S14** (EX-01). Gate de cobertura: não encontrei configuração de `coverage` no `apps/api` |
| 5 | RN-01…RN-11 com testes; autorização 2 empresas × 2 perfis | 🟡 | Testes de autorização e isolamento em cada módulo (ex.: `vendas.test.ts` "autorização (TEST-17)", `autorizacao.test.ts`). Falta a matriz RN → teste |
| 6 | OpenAPI 3.1 com Spectral e Schemathesis no CI | ✅ | `npm run lint:openapi` dentro do `verify` (0 avisos); `bash scripts/contrato.sh`: 3485 de 3485 casos passaram em 2026-11-12; job `contrato` no CI |
| 7 | k6 smoke + carga + estresse com thresholds de RNF-01/02 | ✅ (local) | `bash scripts/carga.sh carga`: venda p95 309 e 333 ms (meta ≤ 500), busca p95 246 e 268 ms (meta ≤ 300), erro 0%, exit 0, duas rodadas; thresholds não foram relaxados e reprovam de verdade (canário `P95_VENDA_MS=1`, S13b). Estresse mostra onde quebra (ADR 009). `carga-smoke` roda em todo PR; carga completa só manual |

## Curso (Projeto A)
| # | Critério | Situação | Evidência / o que falta |
|---|----------|----------|--------------------------|
| 8 | README, ADR 001–003, OpenAPI, C4 + mapa de contextos, Docker + Compose, k6, CI que falha de verdade, `main` protegida, segredos fora do repo, CONTRIBUTORS, Conventional Commits, board/PRs | 🟡 | README, `docs/adr/001…009`, `docs/openapi.json`, `docs/arquitetura/c4.md` (novo), `compose.yaml`, `ops/k6`, `.github/workflows/ci.yml`, `CONTRIBUTORS.md`, `.env` ignorado (`git check-ignore`), PRs no GitHub (o mais recente, #23). Threat model: `docs/seguranca/threat-model.md`. **Faltam:** `main` protegida (S14); runbooks de deploy/rollback (dependem da VPS, S14); board não verificado |
| 9 | App no ar; vídeo + texto-guia; pacote do Moodle | ⬜ | S14. Envio ao Moodle só com pedido do Pedro |
