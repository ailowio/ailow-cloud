# Síntese do discovery — Marcant (cliente piloto do ERP mobile)

> Fontes: 2 reuniões gravadas (87 min na loja em 29/10/2026; 24 min antes, por áudio), 25 fotos da loja e a fala do Pedro no chat (10/11/2026).
> Brutos (gitignored, contêm PII): `bruto/` e `transcricoes/`. Este arquivo é **sanitizado**: sem dados de clientes finais, sem conversas pessoais.
> Marcação: **[R1 mm:ss]** = reunião 1, **[R2 mm:ss]** = reunião 2, **[F nn]** = foto, **[P]** = Pedro no chat.

## 1. Problema (2 frases)

A Marcant vende lingerie em um box do Centro Fashion Fortaleza sem nenhum produto cadastrado: cada venda é escrita à mão num talão, e só as de cartão são relançadas depois no PDV desktop (GDOOR), usando "códigos de preço" genéricos para bater o valor. Por isso o estoque no sistema é negativo em milhares, o dono não sabe o que tem nem o que repor, e cada venda passa por 3 ferramentas (WhatsApp, talão, computador). [R1 18:00–28:02, R2 00:23, F06–F10]

## 2. Pessoas

| Persona | Quem | O que importa |
|---|---|---|
| **Dono/gestor** | Marcos. Leigo em tecnologia, rejeita sistemas "empurrados". Especialista em atendimento (tomara que caia, plus size). | Botões grandes, poucos cliques, "entender a minha limitação, que é a da maioria". Quer consultar a loja de casa e fazer pedido ao fornecedor. [R2 10:44, R2 18:19] |
| **Vendedor(a)** | 1 funcionário (hoje em transição; outro ajuda aos sábados). | Vender rápido no balcão; bater ponto. [R2 06:35, R1 01:13:02] |
| **Contador** | Escritório externo; extrai dados do PC da loja por acesso remoto. | Receber as vendas de cartão do mês. [R1 20:24, R2 00:41] |

Dispositivo operacional: **um celular fixo da loja** + o celular do dono. [R1 01:13:56]

## 3. Como é hoje (antes)

1. Atende, separa as peças e escreve no **talão numerado**: itens por nome ("TQC plus", "bombom"), preço unitário, total, desconto % e forma de pagamento. [F06–F08, R1 17:22]
2. Cartão passa numa maquininha separada (crédito parcelado ocorre). [F08]
3. Depois, no notebook: abre 3 telas do GDOOR e lança **só as vendas de cartão**, combinando códigos genéricos da tabela da parede (ex.: 80 = R$13, 90 = R$83) até bater o total. [F09, F10, R1 21:25–28:02]
4. Uma vez por mês o contador puxa as vendas do sistema. [R2 00:41]
5. Estoque físico: frente da loja + móvel de portas de correr nos fundos. A localização das peças só existe "na cabeça" do dono. [R1 08:11]

## 4. O que o cliente pediu (com a fonte)

| # | Necessidade | Fonte |
|---|---|---|
| N1 | Vender pelo celular: escanear a peça, carrinho, ajustar a quantidade, finalizar. **Não escrever mais nada.** | R2 14:12, R1 29:04, P |
| N2 | A venda **dá baixa no estoque automaticamente** (não pode haver trabalho em dobro). | R2 09:55–10:16, R1 07:59 |
| N3 | Cadastrar uma referência nova com a grade de quantidades por tamanho. | R2 08:02 |
| N4 | Preço de custo → preço de venda calculado por **markup** configurável, com edição manual por peça. Ele também citou um preço de atacado (hoje quase não vende no atacado). | R2 08:47–09:41, R1 12:46 |
| N5 | **Estoque mínimo** por produto (obrigatório no cadastro) com alerta no celular. | R2 05:10, R1 41:25 |
| N6 | Relatórios: vendido no dia, acumulado do mês, por dia, por categoria, por forma de pagamento; consultar de casa. | R2 05:10, R2 18:19, R1 37:42 |
| N7 | Comprovante impresso para o cliente (substituir o talão). | R2 01:05, R1 29:04 |
| N8 | Etiquetas impressas para cada peça (impressora térmica adesiva). | R2 05:03, R1 01:03:50 |
| N9 | Clientes: cadastro (nome + celular) e **atalho direto para o WhatsApp**. | R1 13:50–15:06, R1 01:10:10 |
| N10 | Fornecedor/compra: pedido de compra (código do fornecedor + cor); a compra gera parcelas em contas a pagar. | R1 01:07:36–01:12:06 |
| N11 | Financeiro simples: contas a pagar (fornecedores + despesas fixas: condomínio, água, sacolas). Contas a receber praticamente não existe (recebe na hora). | R1 01:10:50–01:12:17 |
| N12 | Ponto do funcionário (entrada/saída) com aviso de "loja aberta". | R1 01:13:02–01:14:21 |
| N13 | Busca de produto por nome **e por preço**. | R1 26:00–26:13 |

## 5. Modelo de produto (domínio)

- **Categorias** (o usuário pode criar novas): sutiã · calcinha · baby doll (inclui short doll e camisola) · modeladores · cintas · conjuntos. Também há peças sensuais (4º fornecedor) e acessórios importados. [R1 36:51, R1 03:48]
- **Porte**: Slim / Plus, em todas as categorias. [R1 35:24–38:30]
- **Tamanho**: P, M, G, GG dentro de cada porte. [R1 35:57]
- **Atributos opcionais** (ligar/desligar na criação): bojo, renda, aro, compressão, alça removível / tomara que caia. Nem todo produto tem todos. [R1 38:30, R1 44:58–45:55]
- **Cor**: aparece nas etiquetas e nos pedidos ao fornecedor. [F03, F12, R1 01:08:22]
- **SKU / referência**: precisa existir uma referência interna; o Marcos aceita uma ref. curta (≈4 dígitos). As refs. dos fornecedores têm tamanhos diferentes (6 dígitos, etc.). [R1 01:08:52–01:10:09]
- **Etiquetas dos fornecedores**: Pretty Paty, Fina Paixão e Brilhante trazem **EAN-13**; Anita usa código interno curto; há peças sem etiqueta. O Marcos é **multimarca** e quer **manter as etiquetas do fornecedor**. [F03–F17, R1 01:00:01]
- Ticket por peça: R$8 a R$149 (ex.: tomara que caia slim R$29/R$59/R$89). [F07, R1 40:08]

## 6. Pagamentos

Dinheiro, Pix (chave fixa / QR estático; Pix dinâmico foi **descartado** para ele por causa do custo por transação em ticket baixo), débito e crédito (parcelado, na maquininha). Desconto em %. [R2 16:02, R1 33:00–35:07, F07]

## 7. Tela inicial acordada (esboço — F22 + R1 01:06:56)

Botões grandes, 3 por linha. A ordem atual é esta:

1. **Venda** (canto superior esquerdo, 1 clique)
2. **Produtos** (inclui estoque)
3. **Fornecedores / Compra**
4. **Clientes**
5. **Relatórios de venda**
6. **Financeiro** (contas a pagar)
7. **RH / Ponto** (surgiu no fim da R1; não está no esboço F22)

## 8. Fora do agora (V2+ citado nas reuniões)

Catálogo com fotos / e-commerce · assistente de IA conversacional ("como estão minhas vendas?") · Pix dinâmico conciliado · boleto · clonar contas recorrentes · importar a carteira de clientes do WhatsApp · NFC-e. [R1 56:58, R1 01:14:21, R2 19:38]

## 9. Restrições e contexto

- **Produto**: o Marcant é o piloto de um **ERP mobile multi-tenant** para lojistas do mesmo perfil (boxes do Centro Fashion), vendido por assinatura **por módulo**. [P, R1 01:05:28]
- **Infra**: uma VPS existente; sem orçamento para cloud agora; deve estar pronta para escalar. [P]
- **Comercial**: piloto gratuito; assinatura se funcionar. [R2 04:36]
- **Prazos**: o Pedro prometeu implantar ainda em 2026; o Marcos quer fazer a reorganização/inventário no fechamento de janeiro, com o sistema pronto. [R1 47:21–47:53]
- **Curso**: Projeto Final com prazo falado de **16/11/2026** (confirmar no Moodle). [PROXIMA-SESSAO-PROJETO-FINAL.md]
- **Carga inicial**: o Marcos vai passar as **20 peças carro-chefe** (caderno/áudio). [R2 19:22]
- **Identidade**: "M" dourado como ícone; rosa/magenta da loja, dourado, tijolinho branco. Ele disse que "só gosta de tema escuro". → Design System na próxima sessão. [R1 50:51–55:54, F18–F25]

## 10. Contradições e lacunas (para o PRD)

1. **Tamanhos**: P/M/G/GG por porte [R1] × numeração de sutiã nas etiquetas (46, 52) [F03, F12]. A grade é por letra, por número ou depende da categoria?
2. **QR próprio × EAN do fornecedor**: o plano era colar QR, mas 3 de 4 fornecedores já trazem EAN-13 e ele quer manter a etiqueta deles.
3. **Cliente obrigatório na venda?** O Pedro defendeu que sim (dado para marketing); o Marcos já tentou e não manteve.
4. **Preço de atacado**: ainda existe?
5. **Fiscal (NFC-e / envio ao contador)**: o escopo e as regras dependem do contador. Fora do MVP até haver definição com ele.
6. **Venda sem estoque cadastrado**: na transição, como vender uma peça que ainda não foi cadastrada?
7. **Impressão**: impressora térmica Bluetooth no celular (comprovante + etiqueta) — qual modelo/tamanho? Web Bluetooth tem limites no iOS.
