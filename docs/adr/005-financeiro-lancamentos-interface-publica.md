# ADR 005: Financeiro — lançamentos imutáveis e interface pública em processo

- **Status:** proposto (o Pedro decide ao mergear o PR da S06; a numeração 003 segue reservada para a S08)
- **Data:** 2026-11-11
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
6. **Categoria é texto livre curto** (comparada sem diferenciar maiúsculas), não a tabela `categorias`: aquela é de **produto** (atributos de sutiã), e despesa tem outro vocabulário (condomínio, água, sacolas).

## Alternativas consideradas

1. **API HTTP interna entre módulos** — descartada: cada chamada seria uma transação separada, quebrando a atomicidade de RF-VEN-06 / RN-11, e adicionaria rede ao monólito (ADR 001).
2. **Eventos/outbox (Vendas publica, Financeiro consome)** — descartada para o v1: dá consistência eventual, mas o PRD exige tudo-ou-nada; custo de infraestrutura sem ganho para uma loja.
3. **Qualquer módulo faz `INSERT` direto** — descartada: espalha as regras de estorno e de imutabilidade; RF-FIN-06 proíbe.
4. **Valor assinado (negativo para saída)** — descartada: um estorno vira "valor negativo" ambíguo; `tipo` + valor positivo evita erro de sinal.
5. **Estorno como `UPDATE` do valor do original** — descartada: apaga o histórico (viola RN-06).
6. **Reutilizar `categorias` (produto) para despesas** — descartada: mistura vocabulários e obrigaria a desativar/atribuir atributos sem sentido.

## Consequências

- **Positivas:** atomicidade com Vendas/Compras; histórico financeiro à prova de edição mesmo com bug na aplicação (o banco recusa); fronteira testada.
- **Custos:** Financeiro e os módulos que o chamam evoluem juntos (mesmo processo); categorias de despesa sem cadastro podem divergir na grafia ("Luz" × "Energia") — mitigação: sugestões na tela e agrupamento sem diferenciar maiúsculas; se incomodar, vira tabela em outra migração.
- **Limites do v1 (não resolvidos aqui):** fuso fixo em São Paulo; sem conciliação com extrato bancário; sem taxa/recebível de cartão (fora do escopo, PRD §3); `DELETE` bloqueado só para o papel de runtime — o dono do schema (migrador) ainda poderia apagar linhas (ADR 002, lacuna da S14).
