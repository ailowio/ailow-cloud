# ADR 001: Monólito modular em Node/TypeScript com Fastify, Zod e PostgreSQL

- **Status:** aceito (assinado pelo Pedro ao mergear o PR que altera este status, 2026-11-10)
- **Data:** 2026-11-10
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** ARQ-*, ENV-02, ENV-19, IA-05, DOC-05, TEST-12, CI-05

## Contexto

O Ailow Cloud é um ERP multi-tenant para lojistas pequenos (PRD v1). O prazo do Projeto Final é 16/11/2026, com um desenvolvedor. A decisão D13 escolheu a "arquitetura A" (API própria + Postgres compartilhado com RLS + PWA), e D16 pede portabilidade: roda igual em qualquer VPS ou cloud, configuração só por variáveis de ambiente, Postgres padrão. Metas relevantes: RNF-01 (finalizar venda p95 ≤ 500 ms com 50 usuários), RNF-06 (0 vazamentos entre empresas), RNF-07 (0 achados alto/crítico), RNF-09 (ambiente sobe em ≤ 15 min).

## Atributos de qualidade afetados

| Atributo | Meta | Efeito desta decisão |
|---|---|---|
| Isolamento entre empresas | 0 vazamentos nos testes (RNF-06) | SQL explícito + RLS; testado com Postgres real |
| Desempenho de "finalizar venda" | p95 ≤ 500 ms (RNF-01) | Fastify + `pg` direto, sem camada de ORM |
| Portabilidade | roda em qualquer VPS/cloud (D16) | Containers, Postgres padrão, config por env |
| Contrato | OpenAPI 3.1 verificado em CI (DOC-05) | Spec gerada dos mesmos schemas Zod da validação |

## Decisão

- **Monólito modular**, um repositório (npm workspaces): `apps/api`, `apps/web`, `packages/shared`.
- **API:** Node 22, TypeScript, **Fastify 5.12.8** + **Zod 4.6.7**; `fastify-type-provider-zod` 7.0.0 e `@fastify/swagger` 9.9.3 geram **OpenAPI 3.1** dos schemas. Os schemas compartilhados entre API e front vivem em `packages/shared`.
- **Banco:** PostgreSQL **18** (imagem `postgres:18.6-alpine3.24`), acesso por `pg` 8.23.1 com SQL parametrizado; **migrações em SQL** via `node-pg-migrate` 9.0.0 (arquivo único com `-- Up Migration` / `-- Down Migration`, sempre reversível).
- **Qualidade:** Vitest 5 (testes de integração com Postgres real, TEST-12); **Biome 2.6.6** como linter; TypeScript 7.
- **Testes sem Docker:** `embedded-postgres` (devDependency) sobe um Postgres 18 temporário localmente; no CI vale o serviço Postgres do job.
- Versões das dependências de runtime fixadas **exatas** (sem `^`) e conferidas na documentação/registro oficial em 2026-11-10 (IA-05).

## Alternativas consideradas

> A D13 registra que B e C foram descartadas pelo Pedro, sem os motivos. Os motivos abaixo são **proposta da IA para o Pedro confirmar ou corrigir** ao assinar.

1. **Supabase self-hosted (arquitetura B)** — descartada na D13. Motivo proposto: muitos serviços para operar numa VPS compartilhada, e regras de negócio atômicas (finalizar venda) ficariam divididas entre SQL/Edge Functions e o cliente.
2. **Next.js full-stack (arquitetura C)** — descartada na D13. Motivo proposto: acopla UI e regras de negócio num runtime só e dificulta o contrato OpenAPI independente exigido pelo curso.
3. **ESLint + typescript-eslint** (em vez do Biome) — descartada **por fato verificado**: `typescript-eslint@8.72.2` declara peer `typescript >=4.8.4 <6.1.0`, e o projeto já usa TypeScript 7.0.2. Manter dois TypeScripts só para o linter foi considerado pior que trocar de linter.
4. **ORM (Prisma/Drizzle)** — adiada, **julgamento do autor, não verificado por medição**: o isolamento depende de `SET LOCAL ROLE` + `set_config` por transação, que é explícito em SQL; um ORM adicionaria uma camada a validar. Reavaliar se o volume de consultas repetitivas justificar.
5. **Express/NestJS** — descartadas: Fastify dá validação e serialização por schema e geração de OpenAPI com menos código próprio.

## Consequências

- **Positivas:** um só idioma (TypeScript) de ponta a ponta; contrato único (Zod) para validação, tipos e OpenAPI; ambiente reproduzível por Compose.
- **Negativas / custo:** várias dependências em versões muito recentes (TypeScript 7, Zod 4, Vitest 5, Biome 2) — mais risco de arestas; SQL manual exige disciplina de parametrização.
- **Riscos e mitigação:**
  - `embedded-postgres` baixa binários de terceiros (pacote `@embedded-postgres/*`, tag `beta`) — usado **só em desenvolvimento/teste local**, nunca na imagem (`npm ci --ignore-scripts` na imagem). O CI usa a imagem oficial do Postgres.
  - `npm audit` mostra 3 avisos **moderados** em `minimatch`/`glob` (dependências do `node-pg-migrate`): negação de serviço em padrões glob; nós só passamos um diretório fixo. Abaixo do limiar do gate (alto/crítico); reavaliar a cada atualização.
  - O Docker/Compose **não pôde ser executado na máquina de desenvolvimento** (sem Docker/WSL); a verificação do Compose acontece no job `compose` do CI.
- **Como saberemos que deu certo:** `npm run verify` verde; job `compose` do CI verde; k6 (S13) dentro de RNF-01/02.
- **Revisão em:** fim da S13 (resultado do k6) ou antes, se o ORM virar necessidade.
