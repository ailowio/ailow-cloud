# ADR 014 — Editar venda: editar no lugar ou cancelar e refazer

- **Status:** **implementada a opção 1 ("cancelar e refazer") como RECOMENDAÇÃO em 2026-11-16 — falta a confirmação do Pedro.** O item 3 do checklist não foi respondido; o Pedro pediu "o aplicativo completo" e autonomia para seguir. A opção 1 não tem migração nem endpoint novo e é só front: reverter custa um commit. Proposto em 2026-11-13 (S08) como ADR 012; renumerado.
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

## Por que a opção 1 (recomendação)

- **Trilha contábil:** venda fechada não se reescreve; corrigir é estornar e lançar de novo (a mesma regra do Financeiro, RN-06). O histórico mostra o que aconteceu, com motivo.
- **Risco:** zero mudança de domínio (estoque, caixa e numeração seguem pelos caminhos já testados: `POST /vendas/{id}/cancelar` e `POST /vendas`). As opções 2 e 3 recalculam estoque e lançamentos por diferença: mais regra, mais concorrência e mais teste.
- **Contraponto aceito:** o número da venda muda e o cliente vê duas vendas (uma cancelada). Se isso incomodar na loja, a opção 3 (trocar só cliente/forma) entra depois, sem desfazer a 1.

## O que foi feito (2026-11-16)

- No detalhe da venda finalizada (Gerenciar vendas): ação **Refazer venda** → confirmação com motivo (mín. 3 letras) → a API cancela a venda → o carrinho abre com as mesmas peças e quantidades, com preço e estoque **atuais** (`telas/vendas/refazer.ts`), e o fechamento já vem com o celular do cliente. Peça arquivada ou sem estoque fica de fora e é avisada em toast.
- Quem pode: quem já podia cancelar (a rota de cancelar é a mesma; nada de permissão nova).
- Evidência: `refazer.test.ts` (3 casos) e `e2e/refazer-venda.e2e.ts` (venda original cancelada com o motivo, estoque 3 → 5 → 3, venda nova com outro número; conferido pela API).

## Pendente

Confirmação do Pedro (manter a opção 1, ou acrescentar a 3).
