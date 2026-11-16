# ADR 015: Receita manual e contas a receber no Financeiro

- **Status:** **aceito, opção 1**, em 2026-11-16 pelo Pedro ("vamos liberar nova receita e contas a receber"). Proposto em 2026-11-13 como ADR 013; renumerado (a `main` já usava 011 e 012).
- **Data:** 2026-11-13 (proposta) · 2026-11-16 (decisão e implementação)
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

## Decisão (2026-11-16)

Opção 1, com contas a receber. Respostas às perguntas acima (recomendação aplicada; o Pedro pode mudar na revisão):

- **Categoria:** a receita usa as **categorias financeiras existentes** (mesma lista da despesa). Separar "categoria de receita" de "categoria de despesa" exigiria outra mudança de schema em `categorias`; fica para quando a lista misturada incomodar (contraponto: "Aluguel" aparece como opção de receita).
- **Contas a receber:** sim, com vencimento e baixa. A baixa reaproveita `POST /financeiro/lancamentos/{id}/pagar` (a função já dava baixa em qualquer conta em aberto); só o texto da tela muda ("Marcar como recebido").

## O que foi feito

- Migração `20261119140000_financeiro-receita.sql` (expand; Down falha de propósito se houver receita gravada): origem `receita`; CHECKs nomeados `lancamentos_sem_origem_id_check` (substitui `lancamentos_check2`), `lancamentos_receita_entrada_check`, `lancamentos_receita_descricao_check`; índice parcial `lancamentos_a_receber_idx`. RLS, FORCE e GRANTs não mudaram (UPDATE segue só nas colunas da baixa).
- API (OpenAPI 0.15.0): `POST /financeiro/receitas` e `GET /financeiro/contas-a-receber`, só Dono; evento `receita_criada` na trilha.
- Web: "Nova receita" (o assistente da despesa com `sentido="receita"`) e "Contas a receber" (a tela de contas com `lado="receber"`).
- Evidência: `apps/api/test/financeiro-receita.test.ts` (23 testes: 2 empresas × 2 perfis, CHECKs no banco, baixa, estorno, relatório; mutação sem a CHECK de entrada reprova) e `apps/web/e2e/financeiro-receita.e2e.ts` (efeito conferido pela API).

## Consequências

- O relatório e o extrato passam a ter entradas sem venda (aparecem pela descrição e pela categoria).
- Recebível de cartão/boleto continua fora do v1 (ADR 005 item 8): conta a receber é só a receita manual em aberto.
