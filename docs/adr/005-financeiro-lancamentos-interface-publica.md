# ADR 005: Financeiro — lançamentos imutáveis e interface pública em processo

- **Status:** aceito em 2026-11-11 pelo Pedro, com duas alterações pedidas na revisão (itens 6 a 8 abaixo, já incorporados); a numeração 003 segue reservada para a S08
- **Data:** 2026-11-11 (alterado em 2026-11-12)
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** ARQ (fronteira de módulo), TEST-12/17, SEC-03, AUD-10, OPS-11; produto: RF-FIN-01…06, RN-01, RN-06, RN-10

## Contexto

Vendas (S10) e Compras (S11) precisam gravar lançamentos financeiros **na mesma transação** em que finalizam a venda ou recebem o pedido (RF-VEN-06, RN-11: "se algo falha, nada é gravado"). Ao mesmo tempo, o PRD manda que outros módulos só criem lançamentos pela interface pública do Financeiro (RF-FIN-06) e que lançamento nunca seja apagado (RN-06).

## Decisão

1. **Interface pública = funções TypeScript em processo** (`apps/api/src/financeiro/lancamentos.ts`: `registrarLancamento`, `estornarLancamento`) que recebem o **cliente da transação do chamador** (o `withEmpresa()` de Vendas/Compras). Atomicidade vem de graça: o lançamento entra ou sai junto com a venda.
2. **Só o módulo Financeiro toca a tabela `lancamentos`.** Um teste automático (`financeiro-fronteira.test.ts`) reprova se qualquer arquivo fora de `src/financeiro/` citar a tabela.
3. **Imutabilidade garantida no banco, não só no código:** o papel `ailow_app` tem `SELECT`, `INSERT` e `UPDATE` **apenas** das colunas `status`, `pago_em`, `forma_pagamento` e `pago_por`; **sem `DELETE`** e sem `UPDATE` de valor, tipo, origem ou categoria. Correção = estorno: um lançamento inverso ligado ao original (`estorno_de`, `UNIQUE`: um estorno por lançamento), com motivo e autor.
4. **Valor em `integer` de centavos** (`CHECK > 0`, teto R$ 20 milhões por lançamento): evita o `bigint` do `pg` voltar como texto e cabe com folga no varejo; o sentido (entrada/saída) está em `tipo`, nunca em sinal.
5. **O que entra no caixa é o que tem `pago_em`.** Relatório do dia/mês soma lançamentos com `pago_em` no período (fuso `America/Sao_Paulo`, fixo no v1). O original estornado continua com o seu `pago_em` e o estorno entra com o sentido oposto na data do estorno: o saldo de cada dia reflete o que de fato aconteceu naquele dia. Estornar uma conta ainda **em aberto** a cancela: original e estorno ficam `estornado`, sem `pago_em`, e nada entra no caixa.
6. **Dois tipos de categoria, na mesma tabela `categorias`** (coluna `tipo`: `produto` ou `financeira`), com listas separadas em Configurações. A de produto tem atributos (sutiã → bojo, aro); a **financeira** (aluguel, água, luz…) não tem e é a única aceita numa despesa (a rota recusa com `categoria_invalida` o que não for categoria financeira **ativa** da empresa). O mesmo nome pode existir nos dois tipos. Empresa nova já recebe as financeiras mais comuns (`CATEGORIAS_FINANCEIRAS_PADRAO`); o Dono edita, desativa e cria outras. O lançamento guarda o **nome** da categoria como texto (o histórico não muda se a categoria for renomeada ou desativada); o limite é o do nome da categoria (60 caracteres). *Substitui a decisão original de "texto livre"; a tabela única foi escolhida para reaproveitar CRUD, RLS, auditoria e telas.*
7. **Estornar uma venda é estornar todos os seus lançamentos de uma vez** (RN-08): `estornarOrigem(c, ctx, 'venda' | 'compra', origemId, motivo)` trava (`FOR UPDATE`) todos os lançamentos da origem e cria um estorno para cada pagamento, na transação do chamador (Vendas devolve o estoque na mesma transação). O que já tinha sido estornado sozinho é pulado (nunca há estorno em dobro); tudo já estornado devolve `ja_estornado`. Na API do Dono: `POST /financeiro/vendas/{id}/estornar`. O estorno de **um** lançamento continua existindo (corrige um pagamento lançado errado).
8. **Formas de pagamento do v1: dinheiro, Pix, débito e crédito** (as quatro do PRD). Boleto fica fora; entra com o recebível/boleto (PRD §3, fora do escopo).

## Alternativas consideradas

1. **API HTTP interna entre módulos** — descartada: cada chamada seria uma transação separada, quebrando a atomicidade de RF-VEN-06 / RN-11, e adicionaria rede ao monólito (ADR 001).
2. **Eventos/outbox (Vendas publica, Financeiro consome)** — descartada para o v1: dá consistência eventual, mas o PRD exige tudo-ou-nada; custo de infraestrutura sem ganho para uma loja.
3. **Qualquer módulo faz `INSERT` direto** — descartada: espalha as regras de estorno e de imutabilidade; RF-FIN-06 proíbe.
4. **Valor assinado (negativo para saída)** — descartada: um estorno vira "valor negativo" ambíguo; `tipo` + valor positivo evita erro de sinal.
5. **Estorno como `UPDATE` do valor do original** — descartada: apaga o histórico (viola RN-06).
6. **Categoria financeira como texto livre** (decisão original deste ADR) — substituída: grafias divergentes ("Luz" × "Energia") e nenhuma forma de desativar; o Pedro pediu dois tipos de categoria.
7. **Tabela separada `categorias_financeiras`** — descartada: duplicaria CRUD, RLS, auditoria e telas só para uma coluna a menos (`atributos`, que o `CHECK` já mantém vazio nas financeiras).
8. **Mesma lista para produto e financeira, sem tipo** — descartada: atributos de sutiã apareceriam em "Aluguel" e vice-versa.

## Consequências

- **Positivas:** atomicidade com Vendas/Compras; histórico financeiro à prova de edição mesmo com bug na aplicação (o banco recusa); fronteira testada.
- **Custos:** Financeiro e os módulos que o chamam evoluem juntos (mesmo processo); o lançamento guarda o nome da categoria como texto, sem chave estrangeira (de propósito: histórico estável); renomear uma categoria não altera lançamentos antigos, então o relatório por categoria mostra o nome da época.
- **Limites do v1 (não resolvidos aqui):** fuso fixo em São Paulo; sem conciliação com extrato bancário; sem taxa/recebível de cartão (fora do escopo, PRD §3); `DELETE` bloqueado só para o papel de runtime — o dono do schema (migrador) ainda poderia apagar linhas (ADR 002, lacuna da S14).
