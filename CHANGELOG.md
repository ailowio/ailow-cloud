# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento [SemVer](https://semver.org/lang/pt-BR/). A primeira versão publicada será `v1.0.0` (S14).

## [Não lançado]

### Adicionado
- Monorepo com npm workspaces: `apps/api`, `apps/web`, `packages/shared`; `npm run verify` único na raiz (lint, tipos, testes e build).
- API Fastify 5 + Zod 4 com `GET /health`, `GET /openapi.json` (OpenAPI 3.1), logs JSON com `request_id` e configuração validada por variável de ambiente (falha cedo).
- PostgreSQL 18 com migrações SQL reversíveis; tabelas `empresas` e `categorias` com RLS forçada por `empresa_id` e o papel de runtime `ailow_app`; teste de integração de isolamento entre empresas.
- Docker Compose local (Postgres com healthcheck, migração one-shot, API não-root com `read_only`).
- CI no GitHub Actions: `verify`, `seguranca-segredos` (gitleaks), `seguranca-sast` (Semgrep), `seguranca-sca` (npm audit), `imagem` (Trivy) e `compose` (smoke do Compose); actions fixadas por SHA.
- ADR 001 (stack) e ADR 002 (multi-tenant com RLS), `CLAUDE.md`/`AGENTS.md`, `CONTRIBUTORS.md` e template de PR.

- Acesso (S04): empresas e usuários Dono/Vendedor; login do Dono (e-mail + senha, argon2id + pepper), aparelho vinculado, "Quem está usando?" + PIN de 4 dígitos com bloqueio após 5 erros, sessão no servidor (cookie httpOnly/Secure/SameSite=Strict, inatividade por empresa e validade de 12 h), sair/derrubar/desativar, trilha de auditoria; Admin da plataforma com TOTP (criar empresa + Dono, redefinir senha do Dono). Migração `20261111120000_acesso` (reversível), ADR 004, testes de isolamento 2 empresas × 2 perfis.

### Alterado
- Nova variável obrigatória `AUTH_PEPPER` (e opcional `COOKIE_SECURE`) na API, no Compose e no CI.
- Lockfile único na raiz (removido o `package-lock.json` de `apps/web`).
