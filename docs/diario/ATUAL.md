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

### S14a — Hospedagem (ADR 010) + rate limit e cifra do TOTP — 2026-11-12 — Claude Sonnet 5.5
Gate: segurança/infra, **tier B**; SEC-01/04/07/17, ENV-*, AUD-*, L-0005/0006. Branch `feature/s14-deploy` (de `main` em a0f03f4; PR #25 da S13c mergeado, 10 jobs verdes). **S14 só parcial**: nada tocou a VPS (só SSH de leitura).
Feito: ADR 010 **aceito** (opção C: VPS existente, desenhada para migrar; Postgres próprio, rede `ailow_internal`, stack parametrizada, backup cifrado com rclone crypt no Drive). Threat model #3 e #5: `@fastify/rate-limit` 11.2.2 (10/min por IP em `/acesso/entrar` e `/admin/login`, 429 `muitas_tentativas`), `TRUST_PROXY` só IP/CIDR, TOTP do Admin cifrado AES-256-GCM (`TOTP_CHAVE` obrigatória, formato `v1.`). OpenAPI 0.14.0.
Achado: no Fastify 5.12.8 `trustProxy` por número de saltos está desativado e falha fechado (todos no mesmo balde); por isso a config recusa `true`, `*` e números.
Números: testes API 766 -> 781; web 250, shared 237.
Decisões (Pedro): domínio `cloud.ailow.com.br` vai por último (A record, nslookup, deploy). Admins de dev antigos precisam de `npm run admin:criar`. No ambiente efêmero (contrato/carga/E2E) `LOGIN_RATE_MAX=100000`, thresholds intactos.
Pendências para a próxima: ver Estado de retomada (stack, Traefik, web, GHCR, backup, inventários, protect `main`, VPS por último).
Verificação: `verify` exit 0; canários: sem o limite na rota 5 testes reprovam, com `trustProxy: true` 2 reprovam (revertidos); `check-harness` ok; `docker compose config` ok.
