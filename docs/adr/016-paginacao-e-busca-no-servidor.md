# ADR 016 — Listas cortadas em 200: paginação por cursor e busca com índice de trigramas

- **Status:** **aceito, opções C + D**, em 2026-11-16 pelo Pedro ("seguir a melhor recomendação possível com boas práticas, independente do esforço"). Proposto em 2026-11-13 (S14c) como ADR 014; renumerado (a `main` já usava 011 e 012).
- **Tier:** B. **Regras:** ARQ-*, TEST-*, PERF (RNF-02), L-0006/L-0014/L-0017/L-0020/L-0025.

## Contexto

`GET /produtos`, `/clientes` e `/fornecedores` devolviam no máximo 200 itens, ordenados por nome, com `truncado`. Sem `limit`/`offset`/cursor, o item 201 em diante só era alcançado pela busca (`?q=`, pedaço contínuo do nome sem acento nem caixa), e a busca `LIKE '%…%'` varria a tabela inteira (RNF-02: p95 da busca ≤ 300 ms ainda irregular na VPS).

## Alternativas (da proposta)

- **A. Manter como está:** custo zero; quem passa de 200 itens não navega além do corte.
- **B. Offset (`?pagina=`):** simples; contraponto: `OFFSET` degrada com tabelas grandes e pula/repete itens quando alguém cadastra no meio da navegação.
- **C. Cursor/keyset (`?depois=`):** estável sob escrita concorrente e cada página é um trecho de índice. **Escolhida.**
- **D. `pg_trgm`:** índice GIN para `LIKE '%…%'`. **Escolhida** para acelerar a busca que já existe (mesma semântica).

## Decisão

- Migração `20261119160000_busca-trigramas.sql`: `CREATE EXTENSION IF NOT EXISTS pg_trgm`; função `ailow_busca(text)` (IMMUTABLE, a mesma normalização sem acento que a API já fazia inline); índices GIN `gin_trgm_ops` no nome de produtos, clientes e fornecedores e no código do SKU; índices de ordem `(empresa_id, chave, desempate)` para o keyset.
- Contrato (OpenAPI 0.15.0, aditivo): `?depois=` (cursor opaco, base64url de `[chave, desempate]`) e `proximo` (null na última página) nas três listas; `truncado` continua (= há próxima página). Cursor desconhecido = `400 cursor_invalido`. O cursor não dá acesso: a RLS decide o que cada empresa vê.
- Ordem: produtos `(lower(nome), numero)`; clientes e fornecedores `(ailow_busca(nome), id)`. A chave do cursor sai do próprio banco (sem divergência de collation).
- Web: "Carregar mais" no fim de Produtos, Etiquetas, Clientes, Fornecedores e do seletor de fornecedor do novo pedido (hook `useMaisPaginas`). A paginação da tela só volta à página 1 quando a **busca** muda (antes, a resposta atrasada da busca no servidor também a jogava para a página 1).

## Evidência

- `apps/api/test/paginacao.test.ts`: 205 itens por lista em 2 páginas, sem repetir nem pular, com e sem busca (acento/caixa), Vendedor, 2 empresas, cursor inválido (4 formas), a tabela de acentos igual nos 3 arquivos e no SQL, e o plano da busca de clientes usando `clientes_nome_trgm_idx`. Mutação sem a condição de keyset: 3 testes reprovam.
- `apps/web/e2e/carregar-mais.e2e.ts`: com mais de 200 clientes, "Carregar mais" até acabar, o aviso de corte some e o total de páginas bate com o que a API entrega. Mutação (botão nunca aparece) reprova.

## Riscos e lacunas (não resolvidos aqui)

1. **Extensão na VPS não conferida:** `pg_trgm` é "trusted" (PG ≥ 13) e vem no contrib da imagem oficial `postgres:18.6-alpine`, mas não conferi o papel que roda as migrações em produção. Se ele não tiver CREATE no banco, a migração falha no deploy (o `deploy.sh` reverte). Conferir antes do deploy: `SELECT * FROM pg_available_extensions WHERE name = 'pg_trgm'` e o dono do banco.
2. **Ganho de p95 na VPS não medido:** o índice deve ajudar a busca do RNF-02, mas só um k6 na VPS diz quanto (L-0017: sem número, sem afirmação).
3. **Busca por caracteres soltos** ("cmst") continua só no cliente sobre o que está carregado; similaridade (`%`/`similarity`) mudaria a semântica e a ordem e ficou de fora.
4. **Contas a pagar/receber** cortam em 500 (`LIMITE_LINHAS` em `financeiro/rotas.ts`) **sem avisar**. Uma loja pequena fica longe disso, mas o banco de dev acumulado já passou e o E2E `busca-listas › Contas a pagar` falha lá (passa em banco limpo). Próximo passo: o mesmo cursor + totais calculados no servidor.
5. **E2E instável no dev com mais de 200 produtos** (`busca-paginacao › Produtos/Etiquetas: Próxima/Anterior`): já falhava antes desta mudança (1 em 2 com o código anterior); caiu para ~1 em 4. No CI (banco limpo, menos de 200) o caminho de busca no servidor não é exercitado.
