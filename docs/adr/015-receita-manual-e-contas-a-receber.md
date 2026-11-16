# ADR 013: Receita manual e contas a receber no Financeiro

- **Status:** proposto (decisão do Pedro pendente)
- **Data:** 2026-11-13
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** ARQ (decisão estrutural), SEC-03, AUD-10; produto: RF-FIN-01…06, RN-06

## Contexto

O Pedro pediu, no Financeiro, "Nova receita" (lançamento manual) e, no menu em ícones, "Contas a receber". Hoje o backend **não permite**:

- `lancamentos.origem_tipo` só aceita `venda`, `compra`, `despesa` e `estorno` (CHECK da migração `20261111200000_financeiro.sql`).
- `venda` é a única origem de **entrada**, e exige `origem_id` de uma venda; `despesa` e `compra` são sempre **saída** (CHECKs na mesma migração e `lancamentoNovoSchema` em `packages/shared`).
- `GET /financeiro/contas-a-pagar` filtra `tipo = 'saida'`; não há lista de entradas em aberto nem baixa de recebível (boleto/recebível está fora do v1, ADR 005 item 8).

Criar a receita manual exige **migração** (ampliar o CHECK, e o CHECK `(origem_tipo = 'despesa') = (origem_id IS NULL)`), por isso ficou fora da S11 (regra: sem migração nem mudança de schema nesta sessão). A tela **não tem botão** para isso (sem botão morto).

## Opções

1. **Nova origem `receita` (entrada, sem `origem_id`)**: migração amplia os CHECKs; `POST /financeiro/receitas` espelha `/despesas` (categoria financeira, valor, data, forma, já recebida ou não). Contas a receber = entradas `aberto`, com `POST …/receber` análogo ao pagar. Prós: simétrico à despesa, histórico imutável preservado, reaproveita estorno. Contras: migração em tabela com RLS/GRANT forçados; relatório e extrato passam a ter entradas sem venda (categoria de receita?).
2. **Só receita já recebida (sem contas a receber)**: mesma migração, sem fluxo de baixa. Prós: menor; contras: o Pedro pediu "contas a receber".
3. **Usar `venda` com origem fictícia**: descartada. Falsifica a origem, quebra o estorno de venda (RN-08) e o relatório de vendas.
4. **Não ter receita manual no v1** (vendas são a única entrada): mantém o modelo atual; custo é o dono não lançar sinal, aporte ou outras entradas.

## Perguntas ao Pedro

- Receita manual entra como categoria financeira existente ou precisa de tipo de categoria "receita" (outra mudança de schema)?
- Contas a receber (com vencimento e baixa) é necessária já, ou basta registrar a receita no dia em que o dinheiro entra (opção 2)?

## Consequências (se a opção 1 ou 2 for escolhida)

Migração nova (expand), teste de isolamento entre empresas e dos CHECKs, OpenAPI regenerado, e o wizard de despesa da S11 vira base do wizard de receita (`componentes/Assistente.tsx`).
