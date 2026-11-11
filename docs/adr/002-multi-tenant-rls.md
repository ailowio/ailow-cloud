# ADR 002: Multi-tenant em banco compartilhado com `empresa_id` e RLS do Postgres

- **Status:** proposto (aguarda assinatura do Pedro)
- **Data:** 2026-11-10
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** SEC-*, TEST-12, TEST-17, ARQ-*, OPS-11, AUD-*

## Contexto

O produto atende várias empresas (lojistas) no mesmo sistema. Vazar dado de uma empresa para outra é o pior defeito possível (RNF-06: 0 vazamentos nos testes). O prazo e a operação (uma VPS, um desenvolvedor, D14) favorecem poucos bancos e poucas migrações por cliente. A D18 pede modelo mínimo: tabela `empresas` e `empresa_id` nas tabelas de negócio.

## Atributos de qualidade afetados

| Atributo | Meta | Efeito |
|---|---|---|
| Isolamento | 0 leituras/escritas cruzadas nos testes de integração | Trava no banco, independente de bug de filtro na API |
| Operação | 1 migração aplica a todas as empresas | Banco único |
| Falha segura | consulta sem empresa definida retorna 0 linhas | Política "falha fechada" |

## Decisão

- **Um banco, um schema, `empresa_id uuid NOT NULL` em toda tabela de negócio** (a própria `empresas` usa `id`).
- **RLS ligada e forçada** (`ENABLE` + `FORCE ROW LEVEL SECURITY`) com a política `isolamento_empresa` por tabela: `empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid`, em `USING` e `WITH CHECK`. Setting ausente ou vazio ⇒ `NULL` ⇒ nenhuma linha.
- **Papel de runtime `ailow_app`:** `NOLOGIN`, `NOBYPASSRLS`, não dono das tabelas, com `GRANT` explícito por tabela (tabela nova sem `GRANT` falha fechada).
- **Contrato na API:** todo acesso a dados de negócio passa por `withEmpresa(pool, empresaId, fn)` (`apps/api/src/db.ts`): abre transação, `SET LOCAL ROLE ailow_app`, `set_config('app.empresa_id', id, true)` (vale só na transação), executa, `COMMIT`. O `empresaId` vem **da sessão autenticada** (S04), nunca do corpo da requisição, e é validado como UUID.
- A trava do banco é a **segunda** linha de defesa; a primeira continua sendo o filtro/autorização na aplicação (testes de autorização, TEST-17).
- Provas: `apps/api/test/rls.test.ts` (10 casos com Postgres real: leitura, escrita, update/delete cruzados, sem empresa, vazamento entre requisições no pool, papel sem superusuário). Foi feito um **teste de mutação** enfraquecendo a política (`USING (true)`): 5 testes falharam, logo os testes detectam a regressão.

## Alternativas consideradas

1. **Schema por empresa** — descartada: N migrações por release, catálogo e pool de conexões crescendo com o número de clientes, e a migração entre VPS (D14) mais pesada. Reavaliar se um cliente exigir isolamento físico.
2. **Banco por empresa** — descartada: máximo isolamento, mas custo operacional e de backup incompatível com 1 pessoa e 1 VPS; inviabiliza relatórios do dono da plataforma sem consolidação.
3. **Só filtro na aplicação (`WHERE empresa_id = ?`)** — descartada: um único `WHERE` esquecido vaza dados; é exatamente o que RNF-06 quer impedir.
4. **Papel de login separado para a API** (em vez de `SET LOCAL ROLE`) — **adiada, não descartada**: ver riscos.

## Consequências

- **Positivas:** o banco recusa leituras e escritas cruzadas mesmo se a API errar; uma só migração; testável com Postgres real.
- **Negativas / custo:** toda consulta de negócio precisa passar por `withEmpresa` (transação por requisição); testes de integração dependem de Postgres; operações administrativas (ex.: relatório global) precisam de caminho próprio e auditado.
- **Riscos e mitigação:**
  - **No Compose local a API conecta com o usuário dono do schema**, que na imagem oficial do Postgres é **superusuário**. O isolamento depende de `SET LOCAL ROLE ailow_app`; uma injeção de SQL poderia executar `RESET ROLE` e voltar ao papel forte. Mitigações: SQL sempre parametrizado (SEC-*), SAST no CI, e **antes do deploy (S14)** criar um papel de login dedicado e sem privilégios (`ailow_app` com `LOGIN` e senha vinda do ambiente, criado fora da migração) — acesso novo, a registrar no inventário de acessos (AUD).
  - Esquecer `GRANT`/política numa tabela nova: mitigado por checklist de migração e por teste de isolamento obrigatório para tabela nova (a ser incluído na S04+).
  - Desempenho: a política usa `(SELECT ...)` para avaliar a expressão uma vez por consulta, e `empresa_id` é coluna líder dos índices únicos; medir no k6 (S13).
  - O papel `ailow_app` é do **cluster**; a migração `down` não o remove.
- **Como saberemos que deu certo:** `rls.test.ts` verde no CI; teste de autorização 2 empresas × 2 perfis (S04, TEST-17); k6 dentro de RNF-01/02.
- **Revisão em:** S14 (papel de login dedicado) ou ao primeiro cliente com exigência de isolamento físico.
