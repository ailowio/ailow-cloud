# ADR 009 — Numeração da venda sob carga (RNF-01)

- **Status:** aceito em 2026-11-12 pelo Pedro, **opção A** (resposta dele: "A"), com a consequência 2 das perguntas ao Pedro aceita (texto novo sem o número gravado). Implementado na S13b2.
- **Contexto de tier:** B. Regras: ARQ-*, OPS-11 (migração reversível), TEST-*, L-0017 (não relaxar RNF-01/02).

## Contexto

`finalizarVenda` (`apps/api/src/vendas/vendas.ts`) aloca o número com `INSERT INTO venda_sequencia … ON CONFLICT DO UPDATE SET ultimo = ultimo + 1`. A linha da empresa fica **travada até o COMMIT**, então todas as vendas da empresa passam uma de cada vez (RF-VEN-10: número sequencial por empresa; ADR 006 §10 pediu "sem buracos nem repetição").

Medido na S13b (máquina local, 50 VUs, pool 10): venda p95 2,3–2,6 s (meta ≤ 500 ms), busca p95 1,1–1,4 s (meta ≤ 300 ms), erro 0%. Experimentos descartáveis: **sem o lock** a venda foi a p95 889 ms (ainda reprova); pool 50 fez a busca passar (p95 114 ms) e a venda piorar. Ou seja, **a numeração é a causa principal, mas tirar a trava sozinha não fecha o RNF-01**: pool e CPU da API também entram (S13b2, itens 3 e 4).

Restrições verificadas no código e nas migrações:
- O texto `Venda {numero}` é gravado em `movimentos_estoque.motivo` e `lancamentos.descricao` **durante** a transação (vendas.ts:200 e :218), e o cancelamento relê `numero` (vendas.ts:245).
- `movimentos_estoque` só tem `GRANT SELECT, INSERT` e `lancamentos` só tem `UPDATE (status, pago_em, forma_pagamento, pago_por)`. **Esses textos não podem ser corrigidos depois** pelo runtime.
- `vendas` tem `UNIQUE (empresa_id, numero)` e `numero NOT NULL`.
- Onde o número aparece para o usuário: comprovante, histórico de vendas do cliente, texto dos movimentos de estoque e dos lançamentos do Financeiro. Não verifiquei o relatório de vendas linha a linha; conferir na implementação.

## Opções

### A — Manter sem buracos e alocar o número no fim da transação
Mover `proximoNumero` para depois dos itens, movimentos e pagamentos, só antes do `INSERT INTO vendas`.
- **Regra de numeração:** igual à de hoje (sem buracos, sem repetição; rollback não consome número).
- **Impacto:** como os textos não são reescritos, `Venda {numero}` precisa sair do `motivo`/`descricao` (ex.: "Venda" + `origem_id`, e a tela monta "Venda N" por join com `vendas`), ou o texto passa a levar só o id curto. Linhas antigas continuam com o número no texto (dois formatos convivendo).
- **Contraponto:** o lock continua até o COMMIT; o ganho é só encurtar a janela (restam o evento de auditoria, a releitura `montar()` e o commit). **Pode não bastar para 500 ms**; é a opção menos intrusiva e a primeira a medir.
- **Migração:** ~~nenhuma de schema~~ **correção feita na implementação:** a venda precisa existir antes dos itens e pagamentos (FK sem `DEFERRABLE`), então a opção A exigiu uma migração pequena e reversível que torna essas duas FKs adiáveis. Eu não tinha conferido as FKs ao propor.

### B — Numeração por sequence do Postgres, aceitando buracos
`nextval` não trava e não espera o COMMIT.
- **Regra de numeração:** muda. Rollback (estoque insuficiente → 409, cliente já cadastrado, erro de pagamento) **consome o número**; o Marcos verá saltos. RF-VEN-10 diz "sequencial", não "sem buracos", mas o ADR 006 §10 e a expectativa de talão sim.
- **Impacto:** o texto "Venda N" continua gravado na transação (o número sai cedo e sem trava). Relatórios e comprovante não mudam.
- **Contraponto:** uma sequence **por empresa** exige DDL por empresa (`CREATE SEQUENCE`), que o runtime `ailow_app` não deve ter (ADR 002, menor privilégio): teria de nascer no cadastro da empresa por um papel de migração. Uma sequence global quebra "sequencial por empresa". **Não verificado:** como a empresa é criada hoje (seed/onboarding) e o custo de ajustar isso.
- **Migração:** expand (sequences + backfill de `ultimo`), depois contract (remover `venda_sequencia`); reversível.

### C — Número atribuído numa transação curta separada, logo após o COMMIT da venda
A venda grava com `numero` nulo; uma segunda transação de poucos milissegundos aloca o número e o grava; a resposta já sai com o número.
- **Regra de numeração:** sem buracos entre vendas numeradas, mas a venda existe por instantes (ou para sempre, se a 2ª transação falhar) **sem número**: exige retry e rotina de reparo.
- **Impacto:** o texto "Venda N" não pode ir nos movimentos/lançamentos (mesmo problema da A). `numero` vira nulável (relaxa um `NOT NULL` e uma invariante).
- **Contraponto:** mais código e mais estados de falha; a trava continua serializando, só que por ~1 ms em vez de pela transação inteira. Quebra o "tudo ou nada" da RF-VEN-06 para o número.
- **Migração:** `ALTER COLUMN numero DROP NOT NULL` (reversível só enquanto não houver nulos).

### D — Não mexer na numeração; só pool e CPU
Descartada como solução isolada: com a trava mantida, o experimento do pool 50 piorou a venda. Fica como linha de base da medição.

## O que cada opção muda

| | A | B | C |
|---|---|---|---|
| Número sem buracos | sim | **não** | sim (após reparo) |
| "Venda N" nos textos novos | **sai** (deriva por join) | fica | **sai** |
| Muda schema | sim, pouco (FKs adiáveis; ver correção acima) | sim (sequences) | sim (`numero` nulável) |
| Elimina a serialização | não, encurta | **sim** | não, encurta mais |
| Risco principal | pode não bastar | buracos visíveis; DDL por empresa | estado "sem número" |

## Recomendação provisória (não é "a melhor")
Medir **A primeiro**: é a menor mudança e não toca na regra de numeração; se com A (mais pool configurável) a venda ficar ≤ 500 ms no k6, as outras ficam descartadas. Se não ficar, a escolha real é entre B (aceitar buracos) e C (complexidade); isso é decisão de negócio do Pedro/Marcos, não técnica.

## Pergunta ao Pedro (portão 🚦)
1. Escolher A, B ou C (ou outra).
2. Se A ou C: aceitar que o texto novo seja "Venda" + id/derivação em vez de "Venda 1827" nos movimentos e lançamentos?
3. Se B: aceitar buracos na numeração quando uma venda falhar?

## Decisão e como ficou
Opção A. Em `finalizarVenda` o número é alocado por último, por **um só comando** (`WITH n AS (INSERT … venda_sequencia … RETURNING ultimo) INSERT INTO vendas … RETURNING numero`); a resposta é montada **antes** dele, então depois do número só resta o COMMIT. Para a ordem funcionar:
- Migração `20261117120000_vendas-fk-adiavel` (reversível, testada pelo teste de subida e descida): as FKs de `itens_venda` e `pagamentos_venda` para `vendas` passam a `DEFERRABLE INITIALLY DEFERRED` (conferidas no COMMIT). Compatível com o código antigo.
- Movimentos de estoque e lançamentos novos gravam só `Venda`; o `GET /skus/{id}/movimentos` e as listagens do Financeiro compõem "Venda N" na leitura (pelo `origem_id`, e pelo `estorno_de` no estorno). Linhas antigas, com o número no texto, seguem iguais. A API devolve o mesmo texto de antes.
- A regra de numeração não mudou: sem buracos, sem repetição, rollback não consome número.

## Consequências
- **Medido (k6, 50 VUs, esta máquina, pool 10):** venda p95 1807 -> 309 ms e 333 ms (duas rodadas); busca p95 957 -> 246 ms e 268 ms; erro 0%; iterações 2534 -> ~5600. Cada variável medida sozinha: só a alocação por último (venda 511 ms, busca 294 ms) e depois a cauda mínima (309 ms, 246 ms). Pool 20 não ajuda (rodada com a cauda mínima: busca 315 ms reprova, venda 401 ms), então o padrão fica em 10; `DB_POOL_MAX` (1 a 50) existe para ajuste por medição na VPS.
- **Estresse:** 25 VUs venda p95 1482 -> 169 ms. Acima de 50 VUs ainda reprova o p99 < 3 s do próprio estresse (300 VUs: p95 ~3,4 s, erro 0%); o RNF só vale até 50 VUs. No degrau de 50 VUs do perfil de estresse a busca deu 307 ms (perfil de carga: 246–268 ms): margem estreita, números de máquina local.
- **Custos:** o lock continua até o COMMIT (serialização mais curta, não eliminada); dois formatos de texto convivem nos dados antigos e novos; quem ler `movimentos_estoque.motivo` ou `lancamentos.descricao` direto no banco vê só "Venda" nas linhas novas.
- **Reavaliar** B (sequence, aceitando buracos) se na VPS a venda voltar a passar de 500 ms com 50 vendedores.
