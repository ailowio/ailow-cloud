# Arquivo do diário — S13a

> Entrada movida intacta de ATUAL.md na S13c (poda).

### S13a — Qualidade final: contrato da API — 2026-11-12 — Claude Sonnet 5.5
Gate: CI/qualidade + correções do fuzz, **tier B**; CI-*, TEST-*, SEC-01/04, ENV-02, MC. Branch `feature/s13-qualidade-final` (S12 na main, PR #21; ADR 008 **aceito** pelo Pedro). Plano fatiado: S13 virou S13a/b/c.
Feito: Spectral 6.17.0 no `verify` (`lint:openapi`, falha em aviso) sobre `docs/openapi.json` gerado e versionado; `operationId`, `info`, `servers`, 200 binário (logo, etiquetas) e 400 em toda rota com entrada. Schemathesis 4.33.2 (`scripts/contrato.sh`, Postgres em contêiner, job `contrato` no CI). Achados reais: U+0000 → 500 (agora 400 em qualquer rota) e `PUT /empresa/logo` malformado → 500/406 (agora 400). Postgres embutido nascia em WIN1252 (emoji → 500 local): agora UTF-8 ICU pt-BR (L-0018).
Números: Spectral 144 avisos -> 0; Schemathesis 53 falhas -> 0 (68/69 operações, 3485 casos); API 740 -> 753, web 250, shared 237.
Decisões (Pedro confirma): `contrato` ainda **não** é check obrigatório; exclusões do Schemathesis (`/acesso/sair`, `positive_data_acceptance`, `unsupported_method` = 404 em vez de 405); semente fixa; `operation-description` desligada.
Pendências: recriar `.dev-data/pg` (L-0018); S13b k6 + SLO; S13c E2E + docs.
Verificação: `verify` exit 0. Canários: Spectral reprovou (2 erros) e o Schemathesis reprovou sem a doc do 400 (10 × ST103); o do NUL **não** reprovou com semente fixa (o teste `entrada-segura` guarda essa classe).

