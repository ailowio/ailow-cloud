# Diário ativo (as 3 últimas entradas)

> Regras (skill `execucao-em-sessoes`): entrada nova ≤ 2 KB; ao passar de 3 entradas ou ~8 KB, mover as mais antigas, **sem editar**, para `ARQUIVO-*.md`. Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
> Arquivo: `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) `ARQUIVO-S07-S09.md` e `ARQUIVO-S10-S12.md` (S10 em diante); ler só sob demanda.

Template:
```text
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + link do PR/CI.
```

### S13b — Qualidade final: carga e SLO — 2026-11-12 — Claude Sonnet 5.5
Gate: qualidade/observabilidade, **tier B**; OBS-*, TEST-*, SEC-01/04, CI-*, AUD (interface nova `/metrics`), L-0006/0012. Branch `feature/s13b-carga-slo`, **sem commit** (aguarda pedido).
Feito: `prom-client` 15.1.3, `apps/api/src/metricas.ts` (RED por rota template, `GET /metrics` com Bearer `METRICS_TOKEN`, 404 sem token, fora do OpenAPI); `ops/prometheus/alertas.yml` (burn 14,4x 1h+5m, 6x 6h+30m, 1x 3d+6h) + testes `promtool`; k6 2.3.0 (`ops/k6/carga.js`, `scripts/carga.sh`) sobre o lib `scripts/lib/ambiente-efemero.sh`, que `contrato.sh` também usa; CI `carga-smoke` e `alertas` em todo PR, `carga.yml` manual; inventários de auditoria.
**Resultado (máquina local, NÃO a VPS; pool 10, API+PG+k6 na mesma máquina):** smoke 1 VU passa (busca p95 71 ms, venda p95 113 ms). **Carga 50 VUs REPROVA RNF-01/02:** busca p95 1145-1355 ms, venda p95 2334-2604 ms, erro 0%. Estresse: já a 25 VUs a venda passa de 500 ms (p95 1482); a 300 VUs p95 ~10 s; erro 0% em todos os degraus; reprova o próprio p99 < 3 s.
Causa: 7-9 conexões em `Lock/transactionid` no `INSERT INTO venda_sequencia` (numeração sem buracos serializa todas as vendas da empresa). Experimentos descartáveis (código restaurado): sem o lock, venda p95 889 ms e 3402 iterações (era ~1900), API a 88 s de CPU, ainda reprova; pool 50 faz a busca passar (p95 114 ms) e a venda piorar (p95 8,4 s).
Números: API 753 -> 761 testes; web 250, shared 237; OpenAPI 0.13.0 sem diff.
Decisões (Pedro): como destravar RNF-01/02 (numeração da venda é decisão estrutural -> ADR; tamanho do pool; custo da resposta de `/produtos`); o think time do k6 (0,3-0,7 s) é agressivo para balcão; limite p99 do estresse (3 s) foi escolha minha.
Verificação: `verify` exit 0; `contrato.sh` 3485/3485; `alertas.sh` ok. Canários: alerta 0,72 em vez de 0,072 reprovou o promtool; `P95_VENDA_MS=1` fez o k6 sair 99. Lição L-0019 (espera do Postgres).

### S13b2 — Desempenho da venda (RNF-01/02) + docs da S13c — 2026-11-12 — Claude Sonnet 5.5
Gate: perf/banco, **tier B**; TEST-*, ARQ-* (ADR 009), OPS-11, SEC-01/04, L-0006/0012/0017. Branch `feature/s13b2-desempenho-venda`, **sem commit** (aguarda pedido). S13b chegou na main pelo PR #23.
Feito: ADR 009 **aceito, opção A** (Pedro). Número da venda alocado por último, num só comando que grava `vendas` e devolve o número; resposta montada antes; migração `20261117120000_vendas-fk-adiavel` (FKs adiáveis, reversível); movimentos e lançamentos novos gravam só "Venda" e a leitura compõe "Venda N". `DB_POOL_MAX` (1-50; padrão 10). Thresholds intactos. Docs da S13c: threat model, C4 + mapa de contextos, checklist PRD §10, harness-adoption; aviso "em breve" condicional.
Números (k6 50 VUs, 2 rodadas): venda p95 1807 -> 309 / 333 ms; busca p95 957 -> 246 / 268 ms; erro 0%; iterações 2534 -> ~5600. Só a alocação por último: 511 / 294 ms. Pool 20: busca 315 ms (reprova), então fica 10. Estresse: 25 VUs venda 1482 -> 169 ms; 300 VUs p95 ~3,4 s; reprova o p99 < 3 s do próprio estresse.
Decisões (Pedro): aceitar "Venda"+leitura composta nos textos novos; limite p99 do estresse; `GET /produtos` não foi otimizado (passa a meta; média no k6 580 -> 156 ms só com a cauda curta); runbooks e E2E da S13c ficaram de fora (dependem de VPS/stack ao vivo).
Verificação: `verify` exit 0 (API 761 -> 766, web 250, shared 237; OpenAPI sem diff); `contrato.sh` 3485/3485; `alertas.sh` ok. Vermelho antes: teste de ordem das instruções; o teste existente do extrato pegou o estorno que eu não tinha coberto na composição.
Pendências: S13c (E2E no CI dos 4 fluxos, runbooks, tirar o aviso de vez), S14 (rate limit, TOTP, `main` protegida).

### S13c — E2E no CI e runbooks — 2026-11-12 — Claude Sonnet 5.5
Gate: teste/CI + docs de entrega, **tier B**; TEST-*, CI-*, OPS-04/05/06/08/11, SEC-01/04, AUD-90, L-0006/0012/0017. Branch `feature/s13c-e2e-ci-runbooks` (de `main` em 408b956, PR #24 mergeado), **sem commit** (aguarda pedido).
Feito: `scripts/e2e.sh` (stack efêmera comum: Postgres em contêiner, migrações, empresa descartável, API e web construídos, `vite preview` com proxy; segredos gerados a cada execução) + job `e2e` no `ci.yml`. 4 fluxos em Chromium 360×640: nova venda (≤ 8 toques), receber compra, ponto, cancelar venda; cada um confere o efeito pela API (saldo, conta a pagar do pedido, estado do ponto). `apoio.ts` cria categoria/produto/cliente por teste (nomes únicos, L-0008). `docs/runbooks/` (deploy, rollback, migrar VPS): escritos, **nada ensaiado**; o que depende da VPS está marcado NÃO VERIFICADO.
Números: E2E no CI 0 -> 4 fluxos; local `E2E_CANARIO=1 bash scripts/e2e.sh`: 4/4 verdes (venda: 5 toques) em 2 execuções.
Decisões: `E2E_LIMITE_TOQUES` só pode apertar (`Math.min(8, …)`); o canário refaz a venda com limite 1 e exige falha (L-0006/L-0017). Job `e2e` ainda **não** obrigatório (S14).
Pendências: CI verde do job `e2e` no PR (nunca rodou no GitHub; `playwright install --with-deps chromium-headless-shell` não testado lá) e então marcar ✅ o item 2 do checklist §10; gatilho numérico de reversão e tempos dos runbooks (S14).
Verificação: `verify` exit 0 (API 766, web 250, shared 237); `check-harness` ok; ci.yml parseia (10 jobs).
