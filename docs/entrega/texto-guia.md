# Texto-guia para a avaliação — Ailow Cloud (Projeto Final, Engenharia de Software e IA)

> Mapa para o professor achar cada critério do projeto no repositório. Autor: Pedro (individual). Repositório público: <https://github.com/ailowio/ailow-cloud>. App no ar: <https://cloud.ailow.com.br>.
> Nível pretendido: **A** (monólito modular, C4 + mapa de contextos, k6 em 3 estágios) **mais** operação (deploy por pipeline com reversão, backup testado, runbooks).

## Em uma frase

ERP mobile (PWA, telas de 360 px) para uma loja pequena de moda íntima: vender em até 8 toques, controlar estoque por SKU, caixa e contas, clientes e ponto dos funcionários. Multi-empresa com isolamento por Row Level Security no PostgreSQL.

## Onde achar cada critério

| Critério do curso | Onde está | Como conferir |
|---|---|---|
| README que roda | [`README.md`](../../README.md) | "Como rodar": sem Docker (`npm run dev:db` …) ou `docker compose up --build` |
| ADRs (decisões com alternativas) | [`docs/adr/`](../adr/) (001–017) | Ex.: 002 RLS multi-tenant, 009 numeração da venda sob carga, 010 hospedagem, 012 pipeline de deploy, 016 paginação por cursor |
| OpenAPI 3.1 | [`docs/openapi.json`](../openapi.json) (gerado do código) e `GET /openapi.json` | `npm run lint:openapi` (Spectral, falha em aviso) |
| Contrato testado | [`scripts/contrato.sh`](../../scripts/contrato.sh) (Schemathesis) | Job `contrato` do CI |
| CI: dependências, testes e lint | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | 11 jobs: `verify` (lint, tipos, testes, build), `contrato`, `carga-smoke`, `e2e`, `alertas`, `stack`, `compose`, `imagem`, `seguranca-segredos`, `seguranca-sast`, `seguranca-sca` |
| Branch protegida | Ruleset `proteger-main` (GitHub › Settings › Rules) | Exige PR e checks; bloqueia exclusão e force-push na `main` |
| Segredos fora do repo | [`.env.example`](../../.env.example) (só nomes), `.gitignore`, Swarm secrets em produção | Job `seguranca-segredos` (varredura) |
| Docker / Compose | [`compose.yaml`](../../compose.yaml), `apps/*/Dockerfile`, [`ops/stack/ailow.yaml`](../../ops/stack/ailow.yaml) (Swarm) | Jobs `compose`, `imagem` (Trivy) e `stack` |
| k6 em 3 estágios com thresholds | [`ops/k6/`](../../ops/k6/), [`scripts/carga.sh`](../../scripts/carga.sh) `smoke`/`carga`/`estresse` | Smoke em todo PR (`carga-smoke`); números em [`docs/prd-checklist-10.md`](../prd-checklist-10.md) item 7 |
| Monólito modular | `apps/api/src/<módulo>/` (acesso, admin, configuracoes, produtos, vendas, compras, financeiro, clientes, pessoas) | Interfaces públicas entre módulos (ex.: `financeiro/lancamentos.ts`, ADR 005) |
| C4 + mapa de contextos | [`docs/arquitetura/c4.md`](../arquitetura/c4.md) | Nível 1, nível 2 e mapa de contextos |
| Conventional Commits | `git log` | `feat(…)`, `fix(…)`, `test(…)`, `docs(…)` |
| CONTRIBUTORS | [`CONTRIBUTORS.md`](../../CONTRIBUTORS.md) | — |
| Board / fluxo de PR | Pull requests no GitHub (35 até 2026-11-16) | O trabalho foi planejado em sessões numeradas (`docs/plano-execucao.md`) e cada sessão virou PR com template; **não há board no GitHub Projects** (o PR é a unidade de trabalho). Ex.: #34 e #35 (UX mobile) |
| Deploy contínuo (opcional do nível A) | [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml), [`ops/deploy/`](../../ops/deploy/), [`docs/runbooks/deploy.md`](../runbooks/deploy.md) | Disparo manual com aprovação; backup antes; 3 health checks; reversão automática |
| Operação | [`docs/runbooks/`](../runbooks/) (deploy, rollback, backup, migrar VPS), [`ops/prometheus/`](../../ops/prometheus/) | Backup cifrado diário e ensaio de restauração (`ops/backup/`) |
| Segurança | [`docs/seguranca/threat-model.md`](../seguranca/threat-model.md) | Rate limit no login, TOTP do Admin cifrado, RLS forçada, testes de 2 empresas × 2 perfis |
| Testes | `apps/api/test/` (integração com Postgres real), `*.test.ts`, `apps/web/e2e/` (Playwright 360×640) | `npm run verify`; `bash scripts/e2e.sh` (stack efêmera) |
| Uso de IA | [`docs/harness-adoption.md`](../harness-adoption.md) | Protocolo: gate antes de agir, teste antes do código, ADR para decisões, humano aprova o merge |

## Destaques técnicos (para olhar se houver tempo)

1. **Isolamento entre empresas no banco** (ADR 002): toda tabela de negócio tem `empresa_id`, RLS ligada e forçada e GRANT explícito; cada tabela nova tem teste com 2 empresas.
2. **Venda sob concorrência** (ADR 009): o número da venda é alocado por último, num só comando; a carga caiu de p95 1,8 s para ~0,3 s.
3. **E2E que mede comportamento**: a venda em ≤ 8 toques é contada no navegador; um canário com limite de 1 toque precisa reprovar.
4. **Deploy com reversão**: `ops/deploy/deploy.sh` testado sem VPS (`scripts/deploy-test.sh`) inclusive para "health falha ⇒ reverte".
5. **Paginação por cursor + índice de trigramas** (ADR 016) para listas grandes e busca por pedaço do nome.

## Limitações conhecidas (honestidade)

- **RNF-02** (busca p95 ≤ 300 ms com 50 usuários) **ainda não aprovado de forma estável na VPS** (venda p95 passou). Ver item 7 do checklist.
- Sem emissão fiscal nem recebíveis de cartão no v1 (fora do escopo, PRD).
- Validação em Android real e teste de uso com o dono da loja: pendentes (o PRD pede; dependem de pessoas).
