### S14a — Hospedagem (ADR 010) + rate limit e cifra do TOTP — 2026-11-12 — Claude Sonnet 5.5
Gate: segurança/infra, **tier B**; SEC-01/04/07/17, ENV-*, AUD-*, L-0005/0006. Branch `feature/s14-deploy` (de `main` em a0f03f4; PR #25 da S13c mergeado, 10 jobs verdes). **S14 só parcial**: nada tocou a VPS (só SSH de leitura).
Feito: ADR 010 **aceito** (opção C: VPS existente, desenhada para migrar; Postgres próprio, rede `ailow_internal`, stack parametrizada, backup cifrado com rclone crypt no Drive). Threat model #3 e #5: `@fastify/rate-limit` 11.2.2 (10/min por IP em `/acesso/entrar` e `/admin/login`, 429 `muitas_tentativas`), `TRUST_PROXY` só IP/CIDR, TOTP do Admin cifrado AES-256-GCM (`TOTP_CHAVE` obrigatória, formato `v1.`). OpenAPI 0.14.0.
Achado: no Fastify 5.12.8 `trustProxy` por número de saltos está desativado e falha fechado (todos no mesmo balde); por isso a config recusa `true`, `*` e números.
Números: testes API 766 -> 781; web 250, shared 237.
Decisões (Pedro): domínio `cloud.ailow.com.br` vai por último (A record, nslookup, deploy). Admins de dev antigos precisam de `npm run admin:criar`. No ambiente efêmero (contrato/carga/E2E) `LOGIN_RATE_MAX=100000`, thresholds intactos.
Pendências para a próxima: ver Estado de retomada (stack, Traefik, web, GHCR, backup, inventários, protect `main`, VPS por último).
Verificação: `verify` exit 0; canários: sem o limite na rota 5 testes reprovam, com `trustProxy: true` 2 reprovam (revertidos); `check-harness` ok; `docker compose config` ok.

