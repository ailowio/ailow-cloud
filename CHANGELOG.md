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

- Shell PWA (S05): app instalável (manifest, ícones, service worker mínimo que só guarda a casca estática e nunca a API); fluxo Entrar → "Quem está usando?" → PIN → tela inicial 3×N filtrada por perfil, tratamento de PIN errado (tentativas restantes), usuário bloqueado e sessão expirada; trava por inatividade alinhada ao limite do servidor (`GET /acesso/eu` agora informa `inatividade_minutos`).
- Configurações (S05, só Dono): usuários (criar Vendedor, redefinir PIN, desbloquear, derrubar sessões, desativar, trocar o próprio PIN), dados da empresa, trava por inatividade, markup padrão (em pontos-base, inteiro) e categorias com atributos. API: `GET/PUT /empresa`, `GET/POST /categorias`, `PUT /categorias/{id}` (OpenAPI 0.3.0). Migração reversível `20261111180000_configuracoes` (colunas novas em `empresas` e `categorias`; RLS e GRANT já existentes cobrem).
- Logo placeholder (S05): `apps/web/public/logo.svg` aparece no topo de todas as telas e em Configurações > Empresa; para usar a logo definitiva basta substituir o arquivo (teste garante SVG seguro e fora do cache do service worker). O envio da logo por empresa (RF-CFG-02) segue pendente.
- Financeiro (S06, só Dono): lançamentos imutáveis (RF-FIN-01) com tipo entrada/saída, origem (venda, compra, despesa, estorno + id), categoria, valor em centavos inteiros, forma de pagamento, vencimento, pago em e status; **interface pública em processo** (`registrarLancamento`, `estornarLancamento`, `pagarLancamento` em `apps/api/src/financeiro/lancamentos.ts`) que Vendas/Compras chamarão dentro da própria transação (RF-FIN-06, ADR 005, teste de fronteira); nova despesa em aberto ou já paga, contas a pagar por situação (vencidas, hoje, próximos 7 dias), marcar como pago, estorno com motivo (RN-06: sem DELETE e sem UPDATE de valor nem para o papel de runtime, provado no banco) e relatório do dia/mês por forma de pagamento e por categoria no fuso de São Paulo. API: `POST /financeiro/despesas`, `GET /financeiro/contas-a-pagar`, `POST /financeiro/lancamentos/{id}/pagar|estornar`, `GET /financeiro/extrato|relatorio` (OpenAPI 0.4.0). Migração reversível `20261111200000_financeiro` (tabela `lancamentos`, RLS forçada, GRANT por coluna). Telas no app (360×640, dois temas): menu Financeiro, Nova despesa, Contas a pagar e Relatório com extrato do dia e estorno.
- Teste que liga as rotas da API à lista de prefixos do proxy do app web (uma rota nova sem entrada no proxy dava 404 no navegador com tudo verde).
- Desenvolvimento sem Docker: `npm run dev:db` (Postgres embutido persistente, banco separado dos testes), `dev:seed`, `dev:api` (COOKIE_SECURE=false só no dev) e `dev:web` (proxy do Vite para a API, mesma origem).

### Alterado
- Nova variável obrigatória `AUTH_PEPPER` (e opcional `COOKIE_SECURE`) na API, no Compose e no CI.
- Lockfile único na raiz (removido o `package-lock.json` de `apps/web`).
