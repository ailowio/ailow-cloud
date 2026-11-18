# Eixos de grade + seed Marcant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizar a grade (biblioteca de eixos da empresa + ativação por categoria), preservar `PPPP-TT-CCC` (+ sufixo), e semear só estrutura na conta Marcant.

**Architecture:** Expandir ADR 017: tabelas `eixos_grade` / `valores_eixo` / `categoria_eixos` / `sku_valores`; eixos sistema `tamanho`+`cor` espelham colunas atuais do SKU; API nova com fachada temporária em `/opcoes-grade`; UI Config + NovoProduto + WizardCatalogo dinâmicos; script idempotente de seed estrutural.

**Tech Stack:** Node 22 · TypeScript · Fastify 5 + Zod 4 · PostgreSQL 18 (RLS) · Vite + React 19 + Mantine 9 · npm workspaces · `npm run verify`

**Spec:** [docs/superpowers/specs/2026-11-17-eixos-grade-marcant-design.md](../specs/2026-11-17-eixos-grade-marcant-design.md)

## Global Constraints

- Tier B; test-first; nunca alterar teste para passar.
- Toda tabela nova: `empresa_id`, RLS FORCE, política `isolamento_empresa`, GRANT explícito; teste 2 empresas.
- Acesso só via `withEmpresa()`; `empresa_id` da sessão.
- Dinheiro em centavos; nomes não truncados na UI (D23).
- Seed produção: **zero** produtos/preços/estoque fictícios; só categorias + eixos + valores.
- Migração já aplicada nunca é editada; expand → migrate → contract (`opcoes_grade` só deprecada depois).
- Commit/push/deploy/seed em produção **só com pedido explícito** do humano.
- Após shared: `npm run build:shared`.

## File map

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/eixos-grade.ts` | Zod contracts eixos/valores/categoria |
| `packages/shared/src/eixos-grade-padrao.ts` | Defaults (reexport/adapt `TAMANHOS_PADRAO`/`CORES_PADRAO`) |
| `packages/shared/src/produtos-calculos.ts` | `montarCodigoSku` com sufixos extras |
| `packages/shared/src/produtos.ts` | `skuNovo` com `valores_eixo`; resposta SKU com eixos |
| `apps/api/migrations/YYYYMMDDHHMMSS_eixos-grade.sql` | DDL + backfill |
| `apps/api/src/produtos/eixos-grade.ts` | Domínio + seed-on-read |
| `apps/api/src/produtos/rotas-eixos.ts` (ou rotas) | HTTP eixos |
| `apps/api/src/produtos/produtos.ts` | Create SKU grava `sku_valores` |
| `apps/api/src/produtos/opcoes-grade.ts` | Fachada lendo eixos sistema |
| `apps/api/test/eixos-grade.test.ts` | Isolamento + regras |
| `apps/api/scripts/seed-estrutura-marcant.ts` | Seed idempotente estrutura |
| `apps/web/src/telas/config/` + `produtos/ConfigOpcoesGrade.tsx` | UI biblioteca eixos |
| `apps/web/src/telas/produtos/NovoProduto.tsx` | Passos dinâmicos |
| `apps/web/src/telas/vendas/WizardCatalogo.tsx` | Passos por eixo |
| `docs/adr/019-eixos-grade-configuraveis.md` | ADR (próximo número livre se 019 ocupado) |

---

### Task 1: Shared — schemas e código SKU com eixos extras

**Files:**
- Create: `packages/shared/src/eixos-grade.ts`
- Create: `packages/shared/src/eixos-grade-padrao.ts`
- Modify: `packages/shared/src/produtos-calculos.ts`
- Modify: `packages/shared/src/produtos.ts`
- Modify: `packages/shared/src/index.ts` (export)
- Modify: `packages/shared/src/puro.ts` se necessário exportar helpers
- Test: `packages/shared/src/eixos-grade.test.ts`, `packages/shared/src/produtos.test.ts`

**Interfaces:**
- Produces: `MAX_EIXOS_POR_CATEGORIA = 4`, `eixoGradeSchema`, `valorEixoSchema`, `categoriaEixosSchema`, `montarCodigoSku(numero, tamanho, corCodigo, extras?: string[])`

- [ ] **Step 1: Write failing tests for código com sufixo**

```ts
import { describe, expect, it } from 'vitest';
import { montarCodigoSku } from './produtos-calculos.js';

describe('montarCodigoSku com eixos extras', () => {
  it('sem extras permanece PPPP-TT-CCC', () => {
    expect(montarCodigoSku(42, '46', 'CHO')).toBe('0042-46-CHO');
  });
  it('anexa sufixos na ordem', () => {
    expect(montarCodigoSku(42, '46', 'CHO', ['A'])).toBe('0042-46-CHO-A');
    expect(montarCodigoSku(1, 'GG', 'PRE', ['A', '2'])).toBe('0001-GG-PRE-A-2');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (assinatura atual não aceita 4º arg ou não anexa)

```bash
npm test -w @ailow/shared -- produtos.test.ts
```

- [ ] **Step 3: Implement `montarCodigoSku` e schemas**

```ts
// produtos-calculos.ts
export function montarCodigoSku(
  numeroProduto: number,
  tamanho: string,
  corCodigo: string,
  extras: readonly string[] = [],
): string {
  if (!Number.isInteger(numeroProduto) || numeroProduto < 1 || numeroProduto > NUMERO_MAXIMO_PRODUTO) {
    throw new Error(`número do produto fora de 1 a ${NUMERO_MAXIMO_PRODUTO}`);
  }
  const base = `${String(numeroProduto).padStart(4, '0')}-${tamanho}-${corCodigo}`;
  if (extras.length === 0) return base;
  for (const e of extras) {
    if (!/^[A-Z0-9]{1,3}$/.test(e)) throw new Error('sufixo de eixo inválido');
  }
  return `${base}-${extras.join('-')}`;
}
```

Em `eixos-grade.ts`: Zod para criar/listar eixo, valor, vincular categoria; `MAX_EIXOS_POR_CATEGORIA = 4`. Em `skuNovoSchema`, aceitar `valores: { eixo_slug: string, valor: string }[]` **ou** manter `tamanho`/`cor` obrigatórios + `extras` opcional — preferir **manter `tamanho`+`cor` no create** e `extras: { slug, valor }[]` para não quebrar clientes.

- [ ] **Step 4: Run shared tests — expect PASS**

```bash
npm run build:shared && npm test -w @ailow/shared
```

- [ ] **Step 5: Commit** (só se Pedro pedir commit)

```bash
git add packages/shared && git commit -m "feat(shared): eixos de grade e código SKU com sufixos"
```

---

### Task 2: Migração SQL expand + backfill

**Files:**
- Create: `apps/api/migrations/<timestamp>_eixos-grade.sql`
- Test: `apps/api/test/migracao.test.ts` (padrão existente de up/down)

**Interfaces:**
- Produces: tabelas `eixos_grade`, `valores_eixo`, `categoria_eixos`, `sku_valores` com RLS

- [ ] **Step 1: Write/extend migration test expecting tables exist after up** (seguir padrão em `migracao.test.ts`)

- [ ] **Step 2: Run — FAIL** até migração existir

- [ ] **Step 3: Write migration**

`-- Up Migration`: CREATE das 4 tabelas (espelhar estilo de `20261119150000_opcoes-grade.sql`: CHECK, UNIQUE lower(nome), sem DELETE grant, FORCE RLS).

Backfill **por empresa que já tem `opcoes_grade`**:
1. INSERT eixos `tamanho`/`cor` (`sistema=true`, slugs fixos).
2. Copiar valores de `opcoes_grade`.
3. Para cada categoria `tipo='produto'`, INSERT `categoria_eixos` tamanho+cor.
4. Para cada SKU, resolver `valor_id` por nome e INSERT `sku_valores` (tamanho + cor).

`-- Down Migration`: DROP `sku_valores`, `categoria_eixos`, `valores_eixo`, `eixos_grade` (não dropar `opcoes_grade`).

- [ ] **Step 4: Run migration tests — PASS**

```bash
npm test -w @ailow/api -- migracao.test.ts
```

- [ ] **Step 5: Commit** (se pedido)

---

### Task 3: API domínio eixos + rotas + isolamento

**Files:**
- Create: `apps/api/src/produtos/eixos-grade.ts`
- Modify: `apps/api/src/produtos/rotas.ts` (ou registrar plugin)
- Create: `apps/api/test/eixos-grade.test.ts`
- Modify: `apps/api/src/produtos/opcoes-grade.ts` — seed-on-read cria eixos sistema se vazios; GET `/opcoes-grade` lê de `valores_eixo` dos eixos sistema (fachada)

**Interfaces:**
- Produces: `listarEixos`, `criarEixo`, `criarValor`, `definirEixosDaCategoria`, `semearEixosSistemaSeVazio`
- Consumes: schemas Task 1

- [ ] **Step 1: Failing integration tests**

Cobrir no mínimo:
- semente cria Tamanho+Cor com padrões;
- POST eixo custom “Taça”;
- PUT categoria liga Taça (máx 4; 5º → 400);
- 2 empresas não vazam;
- Vendedor → 403 nas mutações;
- sem DELETE (desativar valor).

- [ ] **Step 2: Run — FAIL**

```bash
npm test -w @ailow/api -- eixos-grade.test.ts
```

- [ ] **Step 3: Implement domínio + rotas OpenAPI**

Endpoints (Dono, salvo GET se Vendedor precisar na venda — alinhar a `/opcoes-grade` atual):
- `GET /eixos-grade`
- `POST /eixos-grade`
- `POST /eixos-grade/:id/valores`
- `PUT /eixos-grade/valores/:id`
- `PUT /categorias/:id/eixos` body `{ eixos: { eixo_id, seq }[] }`

Proxy Vite + nginx: incluir prefixo como feito para `/opcoes-grade`.

- [ ] **Step 4: Tests PASS + `npm run lint:openapi`**

- [ ] **Step 5: Commit** (se pedido)

---

### Task 4: Criar produto grava `sku_valores` + código com extras

**Files:**
- Modify: `apps/api/src/produtos/produtos.ts`
- Modify: `apps/api/test/produtos*.ts` / testes de create
- Modify: shared `produtoNovoSchema` (Task 1) se ainda não fechou `extras`

**Interfaces:**
- Consumes: eixos da categoria; `montarCodigoSku(..., extras)`
- Produces: SKUs com `sku_valores` preenchidos; resposta com eixos por SKU

- [ ] **Step 1: Failing test** — categoria com Taça; create com extras; 2×2×2 = 8 SKUs; códigos `…-A` / `…-B`; produto sem Taça na categoria rejeita extra desconhecido

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Minimal create path**

Na transação de `criarProduto`:
1. Carregar eixos da categoria ordenados.
2. Validar que cada SKU do body tem valor para cada eixo (tamanho/cor via campos atuais; extras via array).
3. Inserir SKU + linhas `sku_valores`.
4. Código = `montarCodigoSku(numero, tamanho, corCodigo, extrasCodigos)`.

Listagem: JOIN/`json_agg` dos valores extras.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit** (se pedido)

---

### Task 5: Web — Config eixos + categoria

**Files:**
- Modify: `apps/web/src/api/endpoints.ts`
- Modify: `apps/web/src/telas/produtos/ConfigOpcoesGrade.tsx` / `ConfigCategorias.tsx`
- Modify: `apps/web/src/telas/config/Configuracoes.tsx` (item “Eixos da grade” opcional; pode viver na engrenagem atual)
- Test: `apps/web/src/api/endpoints-produtos.test.ts`

**Design:** Mantine existente; uma decisão por tela; toque ≥48px; copy da spec §4.1.

- [ ] **Step 1: Failing endpoint client tests** para novos métodos API

- [ ] **Step 2: Implement client + UI lista eixos/valores + switches na categoria**

- [ ] **Step 3: `npm test -w @ailow/web` nos arquivos tocados — PASS**

- [ ] **Step 4: Commit** (se pedido)

---

### Task 6: Web — NovoProduto e WizardCatalogo dinâmicos

**Files:**
- Modify: `apps/web/src/telas/produtos/NovoProduto.tsx`, `PassosGrade.tsx`, `grade.ts`
- Modify: `apps/web/src/telas/vendas/WizardCatalogo.tsx`, `wizard-catalogo.ts`
- Test: `wizard-catalogo.test.ts`, testes de UI existentes

- [ ] **Step 1: Unit tests** — ordem de passos = eixos da categoria; carrinho `detalhe` junta valores com ` · `

- [ ] **Step 2: Implement passos dinâmicos** (Tamanho/Cor reutilizam componentes; eixo texto = chips)

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit** (se pedido)

---

### Task 7: E2E mínimo

**Files:**
- Create/modify: `apps/web/e2e/eixos-grade.e2e.ts` (espelhar `opcoes-grade.e2e.ts`)

- [ ] **Step 1: E2E** — Dono cria eixo Taça, liga em Sutiã, cadastra produto com 1 tamanho × 1 cor × 2 taças, confere 2 códigos via API

- [ ] **Step 2: Rodar** `bash scripts/e2e.sh` ou filtro Playwright do workspace — PASS

- [ ] **Step 3: Commit** (se pedido)

---

### Task 8: Seed estrutura Marcant + ADR + runbook

**Files:**
- Create: `apps/api/scripts/seed-estrutura-marcant.ts`
- Create: `docs/adr/019-eixos-grade-configuraveis.md` (renumerar se 019 existir)
- Modify: `docs/diario/ATUAL.md` entrada curta (se sessão de entrega)
- Documentar no README ops: exige `EMPRESA_ID` + credencial; dry-run; idempotente

**Seed conteúdo (spec §5):** 9 categorias; atributos; eixos Tamanho/Cor/Taça; Taça **não** ligada; valores padrão.

- [ ] **Step 1: Script com `--dry-run` que imprime o plano sem gravar**

- [ ] **Step 2: Teste unitário/integração do mapeamento** (categorias esperadas, 0 produtos) em ambiente de teste com empresa throwaway — **não** apontar para produção no CI

- [ ] **Step 3: ADR** — contexto, decisão abordagem 1, consequências, link ao spec

- [ ] **Step 4: `npm run verify` verde**

- [ ] **Step 5: NÃO rodar seed em produção sem pedido explícito do Pedro** — entregar comando pronto:

```bash
# só após aprovação humana + EMPRESA_ID da Marcant
npx tsx apps/api/scripts/seed-estrutura-marcant.ts --empresa-id <UUID> --dry-run
npx tsx apps/api/scripts/seed-estrutura-marcant.ts --empresa-id <UUID>
```

---

## Spec coverage checklist

| Spec § | Task |
|-------|------|
| 3 Modelo / tabelas | 2 |
| 3.2 Compat SKU + QR | 1, 4 |
| 3.3 Limites | 3, 4 |
| 3.4 Migração | 2, 3 fachada |
| 4.1 Config UX | 5 |
| 4.2 Novo produto | 6 |
| 4.3 Venda | 6 |
| 4.4 Exibição | 6 |
| 5 Seed Marcant | 8 |
| 6 Aceite | 3–8 + verify |
| 7 Fora de escopo | respeitado (sem atacado, sem SKUs fictícios) |

## Self-review notes

- Sem TBD no plano; `extras` no create produto mantém `tamanho`/`cor` para compat.
- Contract de dropar `opcoes_grade` fica fora (spec §7).
- Produção: seed só com pedido explícito (Task 8 Step 5).
