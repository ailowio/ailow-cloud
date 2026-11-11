# ADR 006: Produtos, SKUs e estoque com movimentos imutáveis

- **Status:** proposto (o Pedro decide ao mergear o PR da S07); a numeração 003 segue reservada para a S08 (etiquetas)
- **Data:** 2026-11-12
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** ARQ (fronteira de módulo), TEST-12/17, SEC-03, AUD-10, OPS-11; produto: RF-PRO-01…05/07, RN-01, RN-03, RN-05, RN-08, RN-10; pesquisa P1 (modelagem) e P2 (QR)

## Contexto

Vendas (S10) e Compras (S11) vão mexer no estoque na mesma transação em que finalizam a venda ou recebem o pedido (RF-VEN-06, RN-11). O PRD manda que o estoque de um SKU **nunca fique negativo** (RN-03, "validado na regra e garantido por restrição no banco"), que o Vendedor veja produto, preço e estoque **mas nunca o custo** (RF-PRO-07) e que todo ajuste vire um movimento com autor (RF-PRO-04). A pesquisa P1 propõe Produto → SKU (tamanho × cor) com código curto `PPPP-TT-CCC`, e a P2 manda o QR levar só esse código.

## Decisão

1. **Modelo.** `produtos` (modelo: nome, categoria, porte Slim/Plus, atributos ligados, fornecedor, custo, preço) e `skus` (produto × tamanho × cor, com código, saldo e mínimo). O **porte é do produto** (Slim e Plus são modelos diferentes, P1 regra 1); o **preço e o custo ficam no produto** (P1 regra 5). Tamanho = 1 a 3 letras/números como está na etiqueta do fornecedor (P, GG, 46, U, G1); cor = texto curto (até 30). Um produto tem no máximo 144 SKUs e 12 cores.
2. **Código do SKU `PPPP-TT-CCC`** (P1 §4): número sequencial do produto na empresa (4 dígitos, máx. 9999), tamanho e 3 caracteres da cor (as 3 primeiras letras sem acento; se colidir com outra cor do mesmo produto, o último caractere vira 2, 3…). Único **por empresa**. O **QR leva só o código** (P2); é gerado no aparelho com a biblioteca `uqr` 0.1.3 (MIT, zero dependências). Medido: `0042-46-CHO` cabe na versão 1 (21×21) com correção M. O PDF de etiquetas é da S08 (ADR 003), que pode ou não reaproveitar esta biblioteca.
3. **Estoque = saldo no SKU + movimentos imutáveis.** `skus.estoque` com `CHECK (estoque >= 0)` (RN-03 no banco); `movimentos_estoque` só-acréscimo (o papel de runtime tem `SELECT` e `INSERT`; sem `UPDATE` nem `DELETE`) com tipo (`inicial`, `entrada`, `ajuste`, `venda`, `estorno_venda`), quantidade com sinal, `saldo_apos`, motivo, autor e, nos tipos de venda, o **id da venda** (`origem_id`, obrigatório nesses tipos e proibido nos outros). Um índice único `(empresa, sku, tipo, origem_id)` impede a mesma venda de baixar (ou estornar) o mesmo SKU duas vezes (RN-08).
4. **Interface pública de estoque em processo** (`apps/api/src/produtos/estoque.ts`, `registrarMovimento`), como o Financeiro (ADR 005): recebe o cliente da transação do chamador, faz `UPDATE skus SET estoque = estoque + $q WHERE id = $1 AND estoque + $q >= 0` (a linha fica travada até o fim da transação: duas baixas simultâneas enfileiram e a 2ª vê o saldo já descontado) e grava o movimento. Só `src/produtos/` cita as tabelas em SQL; um teste (`produtos-fronteira.test.ts`) reprova se outro módulo o fizer.
5. **Custo e fornecedor nunca chegam ao Vendedor.** A API **não seleciona** essas colunas no perfil Vendedor (e o mínimo de estoque também não), e o schema de resposta os declara opcionais: a chave inteira some. Teste com 2 empresas × 2 perfis compara o **texto cru** da resposta. As rotas de criação, ajuste, histórico e aviso são só do Dono (`exigirPerfil('dono')`).
6. **Preço sugerido** = `custo × (1 + markup_bps / 10000)`, em centavos inteiros, **arredondado ao centavo mais próximo (metade para cima)**. O PRD (RN-05) diz "sem arredondamento", o que é impossível com dinheiro em centavos (RN-01); este é o menor desvio possível. É só uma sugestão na tela; **a API guarda o preço digitado** (sempre editável). Cálculo em `@ailow/shared` (uma só fonte), testado, sem ponto flutuante.
7. **Fornecedor = texto livre (até 80)** no v1; a tabela de fornecedores nasce na S11 (Compras), quando houver pedido a enviar, e o campo texto migra por expand → migrate → contract (OPS-11).
8. **Aviso de estoque baixo** = SKU com saldo **estritamente abaixo** do mínimo (`estoque < estoque_minimo`); mínimo 0 significa "sem aviso" (RF-PRO-05 pede o mínimo obrigatório no cadastro, não necessariamente maior que zero). A tela inicial do Dono lista os 3 primeiros e a aba "Abaixo do mínimo" mostra até 50, com o total exato.
9. **Categoria de produto.** A chave estrangeira composta `(empresa, categoria, 'produto')` (coluna gerada fixa) faz o **banco** recusar categoria financeira num produto; `ON DELETE RESTRICT` impede apagar categoria em uso (só se desativa). O produto guarda `categoria_id` (a categoria pode ser renomeada).
10. **Numeração sem buracos nem repetição** por trava de aviso (`pg_advisory_xact_lock` por empresa) + `UNIQUE (empresa, numero)`.
11. **Produto não muda depois de criado** nesta versão: o runtime só tem `SELECT`/`INSERT` em `produtos`; de `skus` só atualiza saldo e mínimo.
12. **Frontend:** as regras puras (preço sugerido, ordem de tamanhos, código da cor) ficam em `@ailow/shared/puro` (subcaminho sem Zod), para o app web usar a mesma regra da API sem levar o Zod ao navegador.

## Alternativas consideradas

1. **Saldo só derivado da soma dos movimentos (sem coluna).** Descartada: toda leitura somaria o histórico e a baixa não teria uma linha para travar; o saldo em coluna com `CHECK` dá RN-03 no banco e a serialização das baixas. Custo aceito: coluna e movimentos precisam andar juntos (ver Limites).
2. **Atualizar o saldo por gatilho (trigger) a cada movimento, sem `UPDATE` para o runtime.** Adiada: a função precisaria de `SECURITY DEFINER` e a RLS forçada se aplicaria ao dono da função; complexidade e risco maiores que o ganho no v1. Reavaliar com a S10.
3. **Estoque só como coluna, sem movimentos.** Descartada: viola RF-PRO-04 (autor e motivo) e RN-08 (devolver ao estoque ao estornar venda exige saber o que saiu).
4. **Porte no SKU / preço por SKU.** Descartada pela P1: Slim e Plus têm modelo, fornecedor e preço diferentes; um tamanho que custe mais vira outro produto. A confirmar com o Marcos (P1 Q3).
5. **Fornecedor como tabela já agora.** Descartada: sem pedido nem contato ainda, seria cadastro sem uso; vira tabela com a S11.
6. **Código aleatório ou `uuid` no QR.** Descartada pela P2: código curto cabe na versão 1 do QR (menor e mais fácil de ler em etiqueta pequena) e é legível por humanos.
7. **Esconder o custo só na tela.** Descartada: a API é pública para qualquer cliente; o custo não pode sair do servidor para o Vendedor.
8. **Preço sugerido com aritmética decimal/float.** Descartada (RN-01): inteiros e arredondamento explícito.
9. **Biblioteca `qrcode` (node-qrcode) no navegador.** Alternativa válida (mais usada), mas com mais dependências; `uqr` é zero-dependência, ESM e tipada. A S08 pode trocar sem afetar o modelo (o QR só leva o código).

## Consequências

- **Positivas:** RN-03 garantido no banco e testado sob concorrência; histórico completo e imutável de estoque, com autor e origem da venda; custo fora do alcance do Vendedor mesmo para quem chamar a API direto; a Vendas só precisa chamar `registrarMovimento` na própria transação.
- **Custos:** Produtos e quem o chama evoluem juntos (mesmo processo); saldo e movimentos são consistentes **por disciplina da interface** (o runtime pode atualizar `estoque` sem passar por ela; testes e a fronteira cobrem, o gatilho da alternativa 2 fecharia a brecha); o produto não pode ser editado ainda (preço errado exige novo produto até a migração de edição).
- **Limites do v1 (não resolvidos aqui):** sem edição/desativação de produto e sem edição de grade (adicionar tamanho/cor depois); lista limitada a 200 produtos e busca por `LIKE` sem índice (sobra folga para milhares de SKUs, medir na S13); `DELETE` bloqueado só para o papel de runtime, o dono do schema ainda poderia apagar linhas (ADR 002, lacuna da S14); o `pg_advisory_xact_lock` usa o hash do texto `produtos:<empresa>` (colisão entre empresas só atrasa, nunca erra).
