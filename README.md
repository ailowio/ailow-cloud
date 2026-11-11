# Ailow Cloud

ERP mobile multi-tenant para lojistas pequenos: vender pelo celular com QR code, estoque e financeiro integrados, botões grandes para quem não é da tecnologia. Primeiro cliente e caso de uso: Marcant Moda Íntima (`acervo/marcant/`).

**Tier do harness:** B · **Projeto Final (curso):** nível A · **Estado:** fundação em construção (sessão S03 de 14).

## Estrutura

```
apps/api         API Node/TS (Fastify + Zod → OpenAPI 3.1), migrações SQL, testes com Postgres real
apps/web         PWA Vite + React + Mantine (hoje: catálogo do Design System)
packages/shared  schemas Zod compartilhados entre API e web
compose.yaml     Postgres 18 + migração + API (local)
```

## Como rodar

Requisitos: Node 22+. Docker só é necessário para o Compose.

```bash
npm ci
npm run verify              # lint + tipos + testes + build (api, web e shared)
npm run dev -w @ailow/web   # catálogo do Design System em http://localhost:5173
```

Os testes da API usam um **Postgres real**: sem `DATABASE_URL_TEST`, sobem um Postgres 18 temporário (`embedded-postgres`, nada para instalar); com a variável, usam o banco informado (**descartável!**, como no CI).

Depois de alterar `packages/shared`, rode `npm run build:shared` (API e web consomem o `dist`).

### Subir tudo com Docker Compose

```bash
cp .env.example .env        # preencha POSTGRES_PASSWORD e AUTH_PEPPER (instrução no próprio arquivo)
docker compose up --build   # db saudável → migração → api saudável
curl http://127.0.0.1:3000/health        # {"status":"ok","db":"ok"}
curl http://127.0.0.1:3000/openapi.json  # contrato OpenAPI 3.1
docker compose down         # NÃO use -v se quiser manter os dados do banco
```

> Estado do Compose: validado pelo job `compose` do CI; **não foi executado na máquina de desenvolvimento** (sem Docker). Se falhar localmente, abra uma issue com a saída de `docker compose logs`.

### Variáveis de ambiente

Só nomes em `.env.example`. A API falha ao iniciar, citando o nome da variável, se `DATABASE_URL` ou `AUTH_PEPPER` (≥ 32 caracteres) faltarem ou forem inválidas. `COOKIE_SECURE=false` só em desenvolvimento sem HTTPS.

### Criar o Admin da plataforma (acesso privilegiado, com TOTP)

Fora da API, por pessoa autorizada; a senha vai por variável de ambiente (nunca por argumento) e a URI do TOTP é mostrada **uma única vez** (cadastre no app autenticador; não cole em chat/log):

```bash
ADMIN_EMAIL=voce@exemplo.com ADMIN_SENHA=... npm run admin:criar -w @ailow/api   # precisa de DATABASE_URL e AUTH_PEPPER
```

Depois: `POST /admin/login` (e-mail, senha, código) → `POST /admin/empresas` (empresa + Dono). Contrato completo em `/openapi.json`.

## Documentação

| Doc | Onde |
|---|---|
| PRD | `docs/prd/PRD-ailow-cloud-v1.md` |
| Decisões de arquitetura (ADR) | `docs/adr/` (001 stack · 002 multi-tenant com RLS · 004 acesso: sessão, aparelho, PIN, TOTP) |
| Instruções para agentes de IA | `CLAUDE.md` / `AGENTS.md` |
| Como contribuir | `CONTRIBUTORS.md`, `.github/pull_request_template.md` |
| Matriz de acessos (auditoria) | `docs/auditoria/matriz-acessos.md` |
| Plano de execução e diário | `docs/plano-execucao.md` |
| Design System | `docs/design-system/README.md` |
| Pesquisas (produto, etiqueta QR, Instagram) | `docs/pesquisa/` |
| Discovery do cliente piloto | `acervo/` — material de inspiração, **só local, não versionado** |

Regras de engenharia: harness em `D:\apps\harness\PROTOCOLO.md` (repositório pessoal do autor).
