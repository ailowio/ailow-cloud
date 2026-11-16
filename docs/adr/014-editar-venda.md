# ADR 012 — Editar venda: editar no lugar ou cancelar e refazer

- **Status:** proposto em 2026-11-13 (sessão S08). Aguarda decisão do Pedro. Nada implementado: **não há endpoint de edição de venda**.
- **Decisor:** Pedro. **Tier:** B. **Regras:** ARQ-*, AUD-24 (mudança rastreável), RN-02/07/08 (estoque, caixa, cancelamento).
- **Origem:** feedback do Pedro na S08 ("ícones de gerenciar/editar/excluir venda").

## Contexto

- A API tem `POST /vendas` (finaliza), `GET /vendas/{id}`, `POST /vendas/{id}/cancelar` (devolve estoque, estorna lançamentos; a venda permanece) e leituras (relatório, lista, por cliente). **Não há PATCH/PUT de venda e não há DELETE** (a venda nunca é apagada).
- Uma venda mexe em estoque (movimentos), financeiro (lançamentos por forma de pagamento), numeração sequencial (ADR 009) e histórico do cliente, tudo na mesma transação.
- Na tela, "Excluir venda" foi entregue como **Cancelar venda** (com motivo e confirmação), que é o que o backend suporta. "Editar venda" **não** foi criado (botão morto seria pior que ausência).

## Alternativas

1. **Cancelar e refazer** (sem backend novo): o app oferece "Refazer": cancela a venda e abre o carrinho já com os itens dela. Prós: reaproveita o que existe, mantém trilha (a venda original fica cancelada com motivo); contras: o número da venda muda, dois lançamentos (estorno + novo), o cliente vê duas vendas.
2. **Editar no lugar** (`PATCH /vendas/{id}`: itens, desconto, pagamentos, cliente): mantém o número; contras: exige recalcular estoque e lançamentos por diferença, auditar a mudança (antes/depois), regras de permissão (só o Dono? só do dia?) e tratar concorrência. É mudança estrutural no domínio de Vendas, Estoque e Financeiro.
3. **Edição só de campos sem efeito em caixa/estoque** (ex.: trocar o cliente, corrigir forma de pagamento): menor, mas ainda exige endpoint, evento de auditoria e estorno/relançamento se a forma mudar.

## Pontos em aberto para o Pedro

- Quem pode editar (Dono, Vendedor da própria venda) e até quando (mesmo dia? sem limite?).
- O número da venda deve se manter?
- Qual erro é o mais comum na loja (peça errada, forma de pagamento, cliente)? Isso define a alternativa 1, 2 ou 3.

## Consequências

Sem decisão, a tela segue só com **Cancelar venda**. Qualquer das alternativas 2 e 3 pede migração/contrato novo e entra como sessão própria, test-first.
