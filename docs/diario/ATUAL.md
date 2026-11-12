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

### S12 — Pessoas (ponto) — 2026-11-12 — Claude Sonnet 5.5
Gate: feature + migração + UI, **tier B**; TEST-01..08/17, CODE-*, SEC-01/04, OPS-11, ARQ-05, AUD-03, CI-01, RN-10. Branch `feature/s12-pessoas` (S11 já na main, PR #20). Sem ADR (PRD §5.8/§7 + ADR 004).
Feito: bater ponto (`GET /pontos/estado`, `POST /pontos`) e espelho do mês (`GET /pontos/espelho`); tela Pessoas; módulo pronto para Dono e Vendedor. **Pedido do Pedro:** só o Dono adiciona, edita e exclui ponto (`POST /pontos/manual`, `PUT /pontos/{id}`, `POST /pontos/{id}/excluir`), com motivo; exclusão lógica + log imutável `pontos_ajustes`; sequência entrada/saída validada sob lock; marca "ajustado". **ADR 008 proposto.** OpenAPI 0.13.0. Migrações `20261116120000_pessoas` + `20261116180000_pontos-ajustes` (sai `seq`/paridade).
Números: API 703 -> 740 (30 da S12; o resto são testes de concorrência de compras/vendas do mesmo PR), web 248 -> 250 (sem `toques.test`, trocado pelo E2E), shared 222 -> 237.
Decisões (Pedro): 30 s entre batidas, turno no dia/mês da entrada e "em aberto" sem horas: confirmados. Falta assinar o ADR 008 (Dono ajusta o próprio ponto; sem tela do histórico de ajustes).
Pendências: tirar o aviso "em breve" da tela inicial (S13); prefixo `pontos` no proxy HTTPS (S14); E2E 360 px formal (S13); retenção de ponto (S14).
Verificação: `verify` exit 0. Mutação (30 s, 403, sequência na exclusão, exclusão lógica na batida) pega; revertida. Playwright 360×640, tema escuro: adicionar, editar e excluir com confirmação, 0 rolagem, 0 alvo < 48 px (campos subiram para `lg`). PR #21 (4 commits: compras/vendas, E2E, identidade, S12).

### S13a — Qualidade final: contrato da API — 2026-11-12 — Claude Sonnet 5.5
Gate: CI/qualidade + correções do fuzz, **tier B**; CI-*, TEST-*, SEC-01/04, ENV-02, MC. Branch `feature/s13-qualidade-final` (S12 na main, PR #21; ADR 008 **aceito** pelo Pedro). Plano fatiado: S13 virou S13a/b/c.
Feito: Spectral 6.17.0 no `verify` (`lint:openapi`, falha em aviso) sobre `docs/openapi.json` gerado e versionado; `operationId`, `info`, `servers`, 200 binário (logo, etiquetas) e 400 em toda rota com entrada. Schemathesis 4.33.2 (`scripts/contrato.sh`, Postgres em contêiner, job `contrato` no CI). Achados reais: U+0000 → 500 (agora 400 em qualquer rota) e `PUT /empresa/logo` malformado → 500/406 (agora 400). Postgres embutido nascia em WIN1252 (emoji → 500 local): agora UTF-8 ICU pt-BR (L-0018).
Números: Spectral 144 avisos -> 0; Schemathesis 53 falhas -> 0 (68/69 operações, 3485 casos); API 740 -> 753, web 250, shared 237.
Decisões (Pedro confirma): `contrato` ainda **não** é check obrigatório; exclusões do Schemathesis (`/acesso/sair`, `positive_data_acceptance`, `unsupported_method` = 404 em vez de 405); semente fixa; `operation-description` desligada.
Pendências: recriar `.dev-data/pg` (L-0018); S13b k6 + SLO; S13c E2E + docs.
Verificação: `verify` exit 0. Canários: Spectral reprovou (2 erros) e o Schemathesis reprovou sem a doc do 400 (10 × ST103); o do NUL **não** reprovou com semente fixa (o teste `entrada-segura` guarda essa classe).

### S13b — Qualidade final: carga e SLO — 2026-11-12 — Claude Sonnet 5.5
Gate: qualidade/observabilidade, **tier B**; OBS-*, TEST-*, SEC-01/04, CI-*, AUD (interface nova `/metrics`), L-0006/0012. Branch `feature/s13b-carga-slo`, **sem commit** (aguarda pedido).
Feito: `prom-client` 15.1.3, `apps/api/src/metricas.ts` (RED por rota template, `GET /metrics` com Bearer `METRICS_TOKEN`, 404 sem token, fora do OpenAPI); `ops/prometheus/alertas.yml` (burn 14,4x 1h+5m, 6x 6h+30m, 1x 3d+6h) + testes `promtool`; k6 2.3.0 (`ops/k6/carga.js`, `scripts/carga.sh`) sobre o lib `scripts/lib/ambiente-efemero.sh`, que `contrato.sh` também usa; CI `carga-smoke` e `alertas` em todo PR, `carga.yml` manual; inventários de auditoria.
**Resultado (máquina local, NÃO a VPS; pool 10, API+PG+k6 na mesma máquina):** smoke 1 VU passa (busca p95 71 ms, venda p95 113 ms). **Carga 50 VUs REPROVA RNF-01/02:** busca p95 1145-1355 ms, venda p95 2334-2604 ms, erro 0%. Estresse: já a 25 VUs a venda passa de 500 ms (p95 1482); a 300 VUs p95 ~10 s; erro 0% em todos os degraus; reprova o próprio p99 < 3 s.
Causa: 7-9 conexões em `Lock/transactionid` no `INSERT INTO venda_sequencia` (numeração sem buracos serializa todas as vendas da empresa). Experimentos descartáveis (código restaurado): sem o lock, venda p95 889 ms e 3402 iterações (era ~1900), API a 88 s de CPU, ainda reprova; pool 50 faz a busca passar (p95 114 ms) e a venda piorar (p95 8,4 s).
Números: API 753 -> 761 testes; web 250, shared 237; OpenAPI 0.13.0 sem diff.
Decisões (Pedro): como destravar RNF-01/02 (numeração da venda é decisão estrutural -> ADR; tamanho do pool; custo da resposta de `/produtos`); o think time do k6 (0,3-0,7 s) é agressivo para balcão; limite p99 do estresse (3 s) foi escolha minha.
Verificação: `verify` exit 0; `contrato.sh` 3485/3485; `alertas.sh` ok. Canários: alerta 0,72 em vez de 0,072 reprovou o promtool; `P95_VENDA_MS=1` fez o k6 sair 99. Lição L-0019 (espera do Postgres).
