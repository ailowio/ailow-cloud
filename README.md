# Ailow Cloud

ERP mobile multi-tenant para lojistas pequenos: vender pelo celular com QR code, estoque e financeiro integrados, botões grandes para quem não é da tecnologia. Primeiro cliente e caso de uso: Marcant Moda Íntima (`acervo/marcant/`).

**Tier do harness:** B · **Projeto Final (curso):** nível A · **Estado:** em construção (S11 Compras na branch; S10 Vendas, S09b/S09 Clientes e S08 Etiquetas na main; próxima: **S12 Pessoas**).

## Estrutura

```
apps/api         API Node/TS (Fastify + Zod → OpenAPI 3.1), migrações SQL, testes com Postgres real
apps/web         PWA Vite + React + Mantine (acesso, tela inicial, Configurações, Financeiro, Produtos, Etiquetas, Clientes, Vendas e Compras; catálogo do DS em /?catalogo só em dev)
packages/shared  schemas Zod compartilhados entre API e web
compose.yaml     Postgres 18 + migração + API (local)
```

## Como rodar

Requisitos: Node 22+. Docker só é necessário para o Compose. No Windows (WSL2 + Docker Desktop + BIOS AMD), use o guia `docs/dev-windows.md` antes do primeiro `compose up`.

```bash
npm ci
npm run verify              # lint + tipos + testes + build (api, web e shared)
```

### Desenvolver o app completo SEM Docker

Para ver e usar o app inteiro na sua máquina (sem Docker/WSL), use o Postgres embutido. São 4 janelas de terminal, todas na raiz do repositório:

```bash
npm run dev:db     # 1) Postgres 18 persistente em 127.0.0.1:54329 + migrações. Deixe aberta; Ctrl+C para.
npm run dev:seed   # 2) (uma vez) cria uma empresa de exemplo e mostra e-mail/senha do Dono e o PIN do Vendedor
npm run dev:api    # 3) API em http://127.0.0.1:3000 (COOKIE_SECURE=false só aqui, porque o dev usa http)
npm run dev:web    # 4) app em http://localhost:5173 (o proxy do Vite leva a API para a MESMA origem)
npm run dev:parar  # encerra Postgres embutido + libera portas 54329/3000/5173 (L-0012)
```

- Os dados e os segredos de dev (senha do banco, `AUTH_PEPPER`) ficam em `.dev-data/` (ignorado pelo git), gerados na primeira execução. Apague a pasta para recomeçar do zero.
- O banco de dev (`ailow_dev`) é separado do banco temporário dos testes (ENV-13). Estes scripts recusam rodar com `NODE_ENV=production`.
- O proxy mantém navegador e API na mesma origem, então o cookie de sessão (httpOnly, `SameSite=Strict`) funciona sem CORS e **nenhum token passa pelo JavaScript**. Se a API estiver em outra porta, use `API_URL=http://127.0.0.1:PORTA npm run dev:web`.
- O proxy só repassa à API os prefixos listados em `apps/web/vite.config.ts`. Criou um prefixo novo de rota (ex.: `/produtos`)? Acrescente-o lá: o teste `apps/api/test/proxy-web.test.ts` reprova se faltar.
- O catálogo do Design System fica em `http://localhost:5173/?catalogo` (só em desenvolvimento).
- O service worker só é registrado no build de produção (`npm run build` + `npx vite preview` em `apps/web`), para não guardar arquivos velhos durante o desenvolvimento.
- O Compose (abaixo) segue como caminho oficial e o da VPS; `dev:db` é só conveniência local.

Os testes da API usam um **Postgres real**: sem `DATABASE_URL_TEST`, sobem um Postgres 18 temporário (`embedded-postgres`, nada para instalar); com a variável, usam o banco informado (**descartável!**, como no CI).

Depois de alterar `packages/shared`, rode `npm run build:shared` (API e web consomem o `dist`).

### Subir tudo com Docker Compose

O arquivo de ambiente real fica em `D:\apps\ailow-cloud\.env` (gitignored), **ao lado** do `compose.yaml` — não na raiz `D:\apps\`. Não ler/colar o conteúdo (SEC-01).

```bash
cp .env.example .env        # só se ainda não existir; preencha POSTGRES_PASSWORD e AUTH_PEPPER
docker info                 # engine tem de responder (Docker Desktop aberto no Windows)
docker compose up --build   # db saudável → migração → api saudável
curl http://127.0.0.1:3000/health        # {"status":"ok","db":"ok"}
curl http://127.0.0.1:3000/openapi.json  # contrato OpenAPI 3.1
docker compose down         # NÃO use -v se quiser manter os dados do banco
```

> Windows: WSL2 + Ubuntu são pré-requisito do Docker Desktop. Checklist, BIOS (SVM) e recovery de freeze: `docs/dev-windows.md`. O job `compose` do CI valida o caminho; smoke local após o setup de 2026-11-12.

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
| Decisões de arquitetura (ADR) | `docs/adr/` (001 stack · 002 multi-tenant com RLS · 004 acesso: sessão, aparelho, PIN, TOTP · 005 Financeiro: lançamentos imutáveis e interface pública · 006 Produtos: SKU e estoque com movimentos imutáveis, proposto · 003 Etiquetas: PDF com QR na API, proposto · 007 Clientes: celular único, edição, inativar e excluir, aceito) |
| Instruções para agentes de IA | `CLAUDE.md` / `AGENTS.md` |
| Como contribuir | `CONTRIBUTORS.md`, `.github/pull_request_template.md` |
| Matriz de acessos (auditoria) | `docs/auditoria/matriz-acessos.md` |
| Plano de execução e diário | `docs/plano-execucao.md` (plano enxuto) · `docs/diario/ATUAL.md` (diário ativo) · `docs/diario/ARQUIVO-S00-S06.md` (arquivo) |
| Windows: WSL2 + Docker Desktop | `docs/dev-windows.md` |
| Design System | `docs/design-system/README.md` |
| Pesquisas (produto, etiqueta QR, Instagram) | `docs/pesquisa/` |
| Discovery do cliente piloto | `acervo/` — material de inspiração, **só local, não versionado** |

Regras de engenharia: harness em `D:\apps\harness\PROTOCOLO.md` (repositório pessoal do autor).
