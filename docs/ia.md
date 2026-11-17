# Uso de IA — Ailow Cloud (Projeto Final)

IA foi usada como **par de programação**, dentro do protocolo do harness (`D:\apps\harness`): gate antes de agir, teste antes do código, ADR para decisão estrutural, humano aprova o merge.

## O que a IA fez
- Rascunhos de código, testes, migrações, ADRs e runbooks.
- Sugestão de alternativas (nunca a “única” decisão).
- Comentários em PR; **não** aprova nem faz merge.

## O que o humano fez
- Escolha de escopo, ADRs e exceções.
- Revisão linha a linha do que entrou na `main`.
- Deploy, secrets e envio da entrega.

## Evidência
- [`CONTRIBUTORS.md`](../CONTRIBUTORS.md) — Pedro (dono) + Claude como coautor (`Co-Authored-By`).
- [`docs/harness-adoption.md`](harness-adoption.md) — mapa prática → evidência no repo.
- Histórico de commits/PRs no GitHub (`ailowio/ailow-cloud`).

## Prompts que importaram (resumo)
Não há log completo de prompts (conversas longas e com contexto do repo). O padrão recorrente:
1. Ler `PROTOCOLO.md` + práticas roteadas + estado do plano.
2. Pedir teste vermelho antes da implementação.
3. Pedir ADR com alternativas quando a mudança era estrutural.
4. Proibir commit/push/deploy sem pedido explícito.

Código que o autor não souber explicar **não** conta como entregue.
