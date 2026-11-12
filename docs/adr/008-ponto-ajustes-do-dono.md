# ADR 008: Ponto — o Dono adiciona, edita e exclui, sem reescrever a história

- **Status:** proposto (a assinar pelo Pedro). Pedido do Pedro em 2026-11-12: "adicionar, editar e excluir ponto, apenas para o dono". O **como** abaixo é proposta, com alternativas.
- **Data:** 2026-11-12 (S12)
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** TEST-17, SEC-01/04, AUD-03, AUD-90, OPS-11; produto: RF-PES-01/02/03, RN-10, D18

## Contexto

A S12 nasceu com ponto "só insere e lê": a garantia de que nunca há duas entradas seguidas estava no banco (posição `seq` com paridade). O Pedro pediu que o Dono possa **adicionar** um ponto esquecido, **editar** o horário e **excluir**. Isso reabre a tensão entre corrigir erro e preservar evidência: ponto é dado de pessoa e pode virar prova numa disputa trabalhista, então a correção não pode apagar o rastro.

## Decisão

1. **Excluir é lógico.** A linha de `pontos` fica, com `removido_em` e `removido_por`; o espelho, as horas e a próxima batida só olham marcas **ativas**. O runtime nunca tem `DELETE`.
2. **Toda mudança do Dono grava `pontos_ajustes`** (imutável: só `SELECT`/`INSERT`): quem, quando, ação (`adicionar`/`editar`/`excluir`), **motivo obrigatório** (1 a 200 caracteres) e o estado antes e depois (tipo e instante).
3. **Marca ajustada fica visível.** `pontos.ajustado = true` quando o Dono criou ou mudou o horário; o espelho mostra "ajustado" tanto para o Dono quanto para o Vendedor dono daquele ponto.
4. **A sequência é regra da aplicação, validada sob lock.** `seq` e o CHECK de paridade saem. Depois de qualquer ajuste, as marcas ativas do usuário, em ordem de relógio, precisam começar em entrada e alternar; senão a transação desfaz e a API devolve 409 (`comecar_com_entrada`, `nao_alterna`, `horario_repetido`). Um índice único parcial (`usuario + instante`, só ativas) é a rede de segurança no banco. O lock por usuário (`pg_advisory_xact_lock`) serializa batida e ajuste.
5. **Editar muda só o horário.** Trocar entrada por saída é excluir e adicionar (a sequência é validada nos dois passos).
6. **Hora em dia + `HH:MM` de São Paulo**; o banco converte (`AT TIME ZONE`), o app não faz conta de fuso. Horário no futuro é recusado (400 `no_futuro`).
7. **Só o Dono** ajusta (`exigirPerfil('dono')`), em qualquer usuário da própria empresa, inclusive ele mesmo. Vendedor recebe 403; outra empresa recebe 404.
8. **Privilégios por coluna:** o runtime atualiza só `registrado_em`, `ajustado`, `removido_em`, `removido_por`; nunca `tipo`, `usuario_id` nem `DELETE`.

## Alternativas consideradas

1. **Excluir de verdade (`DELETE`), com log.** Descartada: o log guardaria o que foi apagado, mas quem lê só `pontos` perde o fato; a exclusão lógica entrega o mesmo efeito na tela sem perder o registro.
2. **Só acrescentar linhas de correção (event sourcing puro), sem `UPDATE`.** Mais forte em evidência, mas o espelho precisaria "dobrar" eventos para saber o que vale; custo alto para o tamanho do produto. Fica como evolução se uma auditoria exigir.
3. **Manter `seq` com paridade.** Descartada: inserir ou excluir no meio da linha do tempo obriga a renumerar, e a garantia viraria teatro.
4. **Dono edita sem motivo.** Descartada: sem motivo o log não explica nada (AUD-90).
5. **Aprovação em dois passos (Vendedor contesta, Dono aprova).** Boa prática trabalhista, fora do escopo desta versão.

## Consequências

- Não há tela do histórico de ajustes nesta versão: o rastro existe no banco (`pontos_ajustes`) e deve ganhar consulta se for preciso mostrar a alguém.
- O Dono pode ajustar o próprio ponto. Se isso for um problema para o seu contexto, a regra é uma linha na rota.
- Excluir marca em aberto deixa a pessoa "dentro" ou "fora" conforme sobrou na lista; a próxima batida segue a última marca ativa.
- Backups e retenção de ponto (dado de funcionário) entram na revisão de retenção da S14.
- Quem lê a S12 inicial: o desenho `seq`/paridade foi substituído por esta migração (`20261116180000_pontos-ajustes`) ainda na mesma PR.
