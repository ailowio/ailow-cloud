# Ailow Cloud

**Tier:** B · **Stack:** Node 22 · TypeScript 7 · Fastify 5 + Zod 4 (OpenAPI 3.1) · PostgreSQL 18 (RLS) · Vite + React 19 + Mantine 9 · npm workspaces · **Comando de verificação:** `npm run verify` (na raiz)

## Harness (obrigatório)
Este app herda `D:\apps\harness`. Antes de qualquer trabalho:
1. Leia `D:\apps\harness\PROTOCOLO.md` (gate de leitura, tiers, ciclo de vida, DoD).
2. Declare tarefa → tipo → tier → IDs de regra aplicáveis → critérios de aceite mensuráveis.
3. Siga `D:\apps\harness\checklists\` correspondente.
4. Plano de execução: `docs/plano-execucao.md`; diário ativo: `docs/diario/ATUAL.md` (o antigo está em `docs/diario/ARQUIVO-*.md`: ler só sob demanda). **Abra em camadas, sem ler o plano inteiro**: Contrato + linha da sessão + Estado de retomada + última entrada do diário. PRD: `docs/prd/PRD-ailow-cloud-v1.md` (só as seções citadas).

## Regras do projeto (verificáveis)
- Test-first: teste vermelho antes do código; nunca mude expectativa de teste para passar.
- Toda tabela de negócio tem `empresa_id uuid NOT NULL`, RLS ligada **e forçada**, política `isolamento_empresa` e `GRANT` explícito para `ailow_app` (ADR 002). Tabela nova ⇒ teste de isolamento entre 2 empresas.
- Acesso a dados de negócio **só** via `withEmpresa()` em `apps/api/src/db.ts`; o `empresa_id` vem da sessão, nunca do corpo da requisição. SQL sempre parametrizado.
- Migrações em `apps/api/migrations/*.sql` com `-- Up Migration` e `-- Down Migration`; migração já aplicada nunca é editada (crie outra; expand → migrate → contract).
- Schemas de contrato compartilhados ficam em `packages/shared` (Zod); a API gera o OpenAPI 3.1 deles.
- Config só por variável de ambiente, validada em `apps/api/src/config.ts` (falha cedo, citando o nome da variável).
- Logs: JSON no stdout com `request_id`; nunca segredo/PII (`authorization` e `cookie` já são redigidos).
- Testes de integração rodam em paralelo no MESMO Postgres: nunca conte nem compare linhas globais; assevere só sobre ids/nomes criados no próprio teste (L-0008).
- Testes: `*.test.ts` ao lado do código (`src/`) ou em `apps/api/test/` (integração com Postgres real). Nome descreve a regra.
- Não adicionar dependência sem verificar existência/versão na doc oficial; versões de runtime fixadas exatas.
- Dinheiro em centavos inteiros (RN-01); nome que identifica algo nunca é truncado na UI (D23).

## Fora do escopo / áreas protegidas
- `acervo/` (discovery e material do cliente) é só local, ignorado pelo git e **o repositório é público**: nunca versionar, copiar nem citar trechos dele em arquivos versionados. `bruto/` e `transcricoes/` têm PII: não ler.
- Não aplicar migração, fazer deploy ou mexer na VPS sem pedido explícito (portão da S14).

## Segurança
- Arquivos de ambiente reais nunca são lidos nem colados; use `.env.example` (só nomes). `git check-ignore -v <arquivo>` confirma se está ignorado.
- Ações irreversíveis (push, deploy, migração em produção, `reset --hard`, `down -v`) só com pedido explícito.
- Branch protection, aprovação ≠ autor e merge são do humano (exceção EX-01 documentada).

## Fluxo de entrega
Conventional Commits · branch curta + PR pequena com template · CI verde (`verify`, `seguranca-*`, `imagem`, `compose`) · revisão humana (IA comenta, não aprova) · SemVer + CHANGELOG.

## Ambiente de desenvolvimento
- `npm ci && npm run verify` roda tudo; os testes da API sobem um Postgres embutido temporário (ou usam `DATABASE_URL_TEST`).
- Depois de mexer em `packages/shared`, rode `npm run build:shared` (a API e o web consomem o `dist`).
- E2E (navegador real, 360×640, RNF-04): com `dev:db`, `dev:api` e `dev:web` no ar, `npm run e2e -w @ailow/web`. Ainda não roda no CI nem no `verify` (S13). Na 1ª vez: `npx playwright install chromium-headless-shell`.
- App completo sem Docker: `npm run dev:db` → `dev:seed` (1ª vez) → `dev:api` → `dev:web` (README); segredos de dev ficam em `.dev-data/` (gitignored).
- `docker compose up --build` (precisa de `POSTGRES_PASSWORD` no arquivo de ambiente local) — ver README.

## Handoff
Ao encerrar sessão longa: entrada curta (≤ 2 KB) em `docs/diario/ATUAL.md` com poda das antigas para o arquivo, Estado de retomada sobrescrito em `docs/plano-execucao.md` e o prompt da próxima sessão no chat.
