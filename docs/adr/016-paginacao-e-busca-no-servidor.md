# ADR 014 — Listas cortadas em 200: busca no servidor, sem paginação por página (lacuna)

- **Status:** proposto (decisão do Pedro pendente)
- **Data:** 2026-11-13 · **Sessão:** S14c · **Tier:** B

## Contexto

`GET /produtos`, `/clientes` e `/fornecedores` devolvem no máximo 200 itens (`LIMITE_*_NA_LISTA`), ordenados por nome, com a flag `truncado`. A API não tem `limit`/`offset`/cursor: só `?q=` (pedaço contínuo do nome, código do SKU ou preço, sem acento nem caixa). Com mais de 200 itens, a busca ampla e a paginação feitas no cliente só enxergavam os 200 primeiros.

## Decisão (o que a S14c fez, sem mexer na API)

Quando `truncado` é verdadeiro, a busca (debounce de 300 ms) também consulta `?q=` com o **termo mais longo** digitado e une o resultado com a lista carregada (`lib/busca-servidor.ts`): sem repetição, ordem por relevância, servidor na frente no empate; vários termos passam pelo filtro completo no cliente. A tela avisa "Mostrando os primeiros 200; refine a busca." e, se a rede falhar, mantém a lista local com um toast.

## Lacunas (não resolvidas)

1. **Sem navegar por página no servidor:** quem tem mais de 200 itens só alcança os de fora do corte pela busca; sem busca não há como listar o item 201 em diante.
2. **Busca por caracteres soltos não chega ao servidor:** `?q=` é substring; "cmst" só acha, entre os itens fora do corte, se outro termo digitado (ex.: o sufixo do nome) for um pedaço contínuo.
3. **Faixa de preço:** o servidor casa "89" como R$ 89,00 a 89,99; a busca local casa só exato. Com um termo só, vale o servidor.

4. **(S15) Seletor de fornecedor do "Novo pedido"** também usa a lista cortada: corrigido com a mesma busca (campo "Buscar fornecedor" + `?q=` e aviso de corte). `GET /fornecedores?q=` já existia, sem mudança de API. Sem busca, quem passa de 200 fornecedores ainda não alcança o 201º (mesma lacuna 1).

## Alternativas (para o Pedro decidir)

- **A. Manter como está** (custo zero; aceitável enquanto a loja tiver poucas centenas de itens).
- **B. Paginação por offset** (`?limite=&pagina=` + `total`): contrato novo e aditivo na API, teste novo antes, atualizar OpenAPI. Contraponto: `OFFSET` degrada com tabelas grandes; ordenação por nome precisa de índice.
- **C. Paginação por cursor** (`?depois=<nome,id>`): estável sob escrita concorrente, mais complexa para o cliente e para a busca ampla (que hoje é local).
- **D. Busca ampla no servidor** (`pg_trgm`/similaridade): resolve a lacuna 2; exige extensão e migração.

Nada disso foi implementado: B–D mudam contrato ou schema e ficam fora do escopo da S14c.
