# PRD — Ailow Cloud v1 (MVP)

| Campo | Valor |
|---|---|
| Produto | **Ailow Cloud**: ERP mobile multi-tenant para lojistas pequenos, vendido por assinatura por módulo |
| Cliente piloto / caso de uso | Marcant Moda Íntima (box no Centro Fashion Fortaleza). Material em `acervo/marcant/` |
| Status | **Revisado pelo Pedro** (2026-11-10): ajustes D19 aplicados; exceções EX-01…04 aprovadas |
| Dono do produto | Pedro (Ailow) |
| Repositório | https://github.com/ailowio/ailow-cloud |
| Tier do harness | **B**: dinheiro, dados pessoais de terceiros, várias empresas no mesmo sistema |
| Nível do Projeto Final (curso) | **Projeto A**: monólito modular, VPS + Docker, C4, k6 em 3 estágios |
| Prazo do curso | 16/11/2026 (prazo falado no aulão 07; **confirmar no Moodle**) |
| Fontes | `acervo/marcant/discovery/sintese-discovery.md` (S§), `jornadas.md`, `decisoes-brainstorm.md` (D1–D18) |

---

## 1. Problema e visão

**Problema (2 frases).** Lojistas pequenos como a Marcant vendem sem produto cadastrado: escrevem cada venda num talão, passam o cartão numa maquininha separada e relançam no PDV desktop com "códigos de preço" genéricos. Por isso não sabem o que têm em estoque, o que repor nem quanto entrou e saiu, e cada venda passa por 3 ferramentas (S§1, S§3).

**Visão.** Um app no celular, com botões grandes, em que **vender é o primeiro toque** e tudo o que acontece (venda, compra, despesa) cai sozinho no estoque e no financeiro. Ele deve ser simples para quem é leigo e pronto para servir muitas lojas.

**Objetivo do MVP.** Entregar ao Marcos o produto pronto para uso, de forma que a única pendência dele seja passar o inventário (D12).

## 2. Personas

| Persona | Perfil | Precisa de |
|---|---|---|
| **Dono** | Leigo em tecnologia, rejeita sistema "empurrado"; especialista no atendimento | Vender rápido, saber o que tem e o que repor, ver o dinheiro de casa |
| **Vendedor** | 1 funcionário (rotativo) | Vender e bater ponto, sem ver custo nem financeiro |
| **Admin da plataforma** | Pedro (Ailow) | Criar empresas e Donos, redefinir senha, operar o sistema |

Dispositivo: **um celular fixo da loja** (compartilhado, com PIN por pessoa) + o celular do Dono. O computador da loja é usado só para imprimir etiquetas.

## 3. Princípios de produto (valem para toda tela)

1. **Mobile-first**: as telas operacionais são feitas para celular; as demais funcionam no celular e se adaptam ao desktop.
2. **Botões grandes, no máximo 3 por linha**, área de toque ≥ 48×48 px; texto mínimo de 16 px.
3. **Poucos cliques**: fricção = toque. Toda jornada tem meta de toques (§9).
4. **Nomes de uma palavra** nos módulos e botões (D4).
5. **Só sai mercadoria se pagar** (D11).
6. **Tudo que mexe com dinheiro gera lançamento no Financeiro** (D2).
7. **Começar mínimo, expandir com o uso**: coluna nova só quando precisar (D18).

## 4. Escopo

### 4.1 No MVP (v1)

Tela inicial com 7 módulos, 3 por linha (D3, D4, D7):

| | | |
|---|---|---|
| **Vendas** | Produtos | Compras |
| Clientes | Financeiro | Pessoas |
| Configurações | | |

Mais o módulo interno **Acesso** (empresas, usuários, entrada, PIN, sessões). O relatório de cada módulo fica **dentro** dele (D3).

### 4.2 Fora do MVP (v2+)

NFC-e/fiscal e exportação ao contador · recebível de cartão (taxa, D+1/D+30, parcelas) · Pix dinâmico conciliado · boleto · catálogo com fotos / e-commerce · assistente de IA conversacional · notificação push · importar carteira de clientes do WhatsApp · uso do EAN do fornecedor · permissões configuráveis por módulo · cadastro self-service de empresas e cobrança da assinatura · clonar contas recorrentes · backup fora da VPS (**pendência registrada**, D17).

## 5. Requisitos funcionais

> Formato: `RF-<MÓD>-NN`. A coluna "Perfil" diz quem pode: **D** = Dono, **V** = Vendedor, **A** = Admin da plataforma.

### 5.1 Acesso (interno)

| ID | Requisito | Perfil |
|---|---|---|
| RF-ACE-01 | Admin cria **empresa** e o primeiro usuário **Dono** (nome, e-mail, senha inicial). | A |
| RF-ACE-02 | Dono entra com **e-mail + senha**; o aparelho fica **vinculado à empresa**. | D |
| RF-ACE-03 | Em aparelho vinculado: tela **"Quem está usando?"** com os usuários ativos → **PIN de 4 dígitos** abre a sessão daquela pessoa. | D, V |
| RF-ACE-04 | App **trava** após N minutos sem uso (padrão 5) e volta para "Quem está usando?". | D, V |
| RF-ACE-05 | **5 PINs errados seguidos bloqueiam** o usuário; só o Dono desbloqueia. | D |
| RF-ACE-06 | Admin redefine a senha do Dono (no MVP não há "esqueci a senha" por e-mail). | A |
| RF-ACE-07 | Conta de Admin da plataforma exige **2º fator (TOTP)**. | A |
| RF-ACE-08 | Sair / derrubar sessões de um usuário (ex.: funcionário desligado). | D |

### 5.2 Configurações

| ID | Requisito | Perfil |
|---|---|---|
| RF-CFG-01 | **Usuários**: criar (nome, papel Dono/Vendedor), definir/trocar PIN, desativar. | D |
| RF-CFG-02 | **Dados da empresa**: nome, telefone, endereço, logo. | D |
| RF-CFG-03 | **Markup padrão** (%), usado para sugerir o preço de venda a partir do custo. | D |
| RF-CFG-04 | **Categorias** de produto e os atributos que cada uma usa (ex.: sutiã → bojo, aro, renda, compressão, alça). | D |

### 5.3 Financeiro (núcleo — D2)

| ID | Requisito | Perfil |
|---|---|---|
| RF-FIN-01 | Registrar **lançamento**: tipo (entrada/saída), origem (venda, compra, despesa, estorno + id), categoria, valor, forma de pagamento, vencimento, pago em, status (aberto/pago/estornado). | sistema |
| RF-FIN-02 | **Nova despesa** (ex.: condomínio, água, sacolas): descrição, categoria, valor, vencimento; pode já nascer paga. | D |
| RF-FIN-03 | **Contas a pagar**: lista por vencimento (vencidas em destaque, hoje, próximos 7 dias) e "marcar como pago" com 1 toque + confirmação. | D |
| RF-FIN-04 | **Estornar** lançamento (nunca apagar): gera lançamento inverso ligado ao original, com motivo. | D |
| RF-FIN-05 | **Relatório**: entradas × saídas do dia e do mês, por forma de pagamento e por categoria. | D |
| RF-FIN-06 | Outros módulos só criam lançamentos pela **interface pública** do Financeiro. | sistema |

### 5.4 Produtos

| ID | Requisito | Perfil |
|---|---|---|
| RF-PRO-01 | **Novo produto passo a passo**, por toques: categoria → porte (Slim/Plus) → atributos (liga/desliga) → tamanhos e cores → custo e preço (sugerido pelo markup, editável) → fornecedor → estoque inicial e mínimo por SKU. *A grade de tamanhos final sai da pesquisa P1.* | D |
| RF-PRO-02 | Cada combinação vendável (produto + tamanho + cor) é um **SKU** com **código curto** e **QR próprio** gerados pelo sistema (D5). | sistema |
| RF-PRO-03 | **Lista e busca** por nome, por código e **por preço** (S§4 N13). | D, V |
| RF-PRO-04 | **Entrada/ajuste de estoque** em poucos toques, com motivo; todo ajuste vira um movimento com autor. | D |
| RF-PRO-05 | **Estoque mínimo por SKU** (obrigatório no cadastro); SKUs abaixo do mínimo aparecem como **aviso vermelho na tela inicial** do Dono. | D |
| RF-PRO-06 | **Etiquetas** (no computador): escolher SKUs e quantidades → **PDF no tamanho da etiqueta térmica** com QR + texto legível. Formato definido na pesquisa P2 (ADR 003). | D |
| RF-PRO-07 | Vendedor vê produto, preço e estoque, **nunca o custo**. | V |

### 5.5 Clientes

| ID | Requisito | Perfil |
|---|---|---|
| RF-CLI-01 | Cadastro mínimo: **nome + celular** (DDD + 9 dígitos), celular **único por empresa** (D8, D18). | D, V |
| RF-CLI-02 | Busca por celular ou nome; ficha com o histórico de compras. | D, V |
| RF-CLI-03 | **Botão WhatsApp** abre a conversa com o cliente. | D, V |
| RF-CLI-04 | **LGPD**: registrar a data do aviso de finalidade; Dono pode **excluir/anonimizar** um cliente a pedido (as vendas permanecem, sem os dados pessoais). | D |

### 5.6 Vendas (jornada principal — `jornadas.md` J1)

| ID | Requisito | Perfil |
|---|---|---|
| RF-VEN-01 | **Nova venda** é o 1º botão da tela inicial (canto superior esquerdo). | D, V |
| RF-VEN-02 | Tela da venda: **Escanear** (abre a câmera direto e lê o QR) e **Buscar** (nome/código/preço); itens vão para o **carrinho** embaixo. | D, V |
| RF-VEN-03 | No carrinho: aumentar/diminuir quantidade, remover item. Escanear o mesmo SKU de novo soma +1. | D, V |
| RF-VEN-04 | **Bloqueio** (D9): SKU sem estoque suficiente não entra no carrinho; mensagem "Peça sem estoque — chame o Dono". Não existe item avulso. | sistema |
| RF-VEN-05 | **Fechamento**: celular do cliente (se existe, o nome vem sozinho; se não, nome obrigatório e cria o cliente) → desconto (% ou R$) → uma ou mais formas de pagamento (dinheiro, Pix, débito, crédito) → **Finalizar**. | D, V |
| RF-VEN-06 | **Finalizar é atômico** (D11): confere a soma dos pagamentos = total → baixa estoque → gera 1 lançamento de entrada **pago, valor cheio, na data** por forma de pagamento (D10). Se algo falha, nada é gravado. | sistema |
| RF-VEN-07 | **Comprovante digital**: link para enviar ao cliente pelo WhatsApp; versão imprimível pelo computador (D6). | D, V |
| RF-VEN-08 | **Excluir (cancelar) venda finalizada**: devolve o estoque e estorna os lançamentos, com motivo e autor registrados (a venda fica marcada como cancelada; nada é apagado — RN-06). | D, V |
| RF-VEN-09 | **Relatório**: vendas do dia/mês, por forma de pagamento, por vendedor, por categoria, **% de vendas com cliente** e celulares repetidos/suspeitos. Vendedor vê só as próprias vendas do dia. | D (V parcial) |
| RF-VEN-10 | Venda tem **número sequencial por empresa** (substitui o nº do talão). | sistema |

### 5.7 Compras

| ID | Requisito | Perfil |
|---|---|---|
| RF-COM-01 | **Fornecedores**: nome, WhatsApp (CNPJ opcional). | D |
| RF-COM-02 | **Pedido de compra**: fornecedor, itens (SKU ou produto + quantidade + custo), status rascunho → enviado → recebido. | D |
| RF-COM-03 | **Enviar pedido** pelo WhatsApp do fornecedor (texto com código, cor e quantidade). | D |
| RF-COM-04 | **Receber pedido**: entrada de estoque dos itens + lançamentos de **saída** (1 por parcela, com vencimento) no Financeiro, numa única transação. | D |
| RF-COM-05 | **Relatório**: compras por fornecedor e por mês. | D |

### 5.8 Pessoas

| ID | Requisito | Perfil |
|---|---|---|
| RF-PES-01 | **Bater ponto**: 1 botão grande alterna entrada/saída do usuário do PIN, com horário do servidor. | D, V |
| RF-PES-02 | **Espelho de ponto**: Vendedor vê o próprio; Dono vê o de todos, por dia e mês. | D, V |

## 6. Regras de negócio (cada uma vira teste antes do código)

| ID | Regra | Origem |
|---|---|---|
| RN-01 | Dinheiro é inteiro em **centavos**; nenhum cálculo em ponto flutuante. | — |
| RN-02 | Venda só finaliza se `Σ pagamentos = total`, com `total = Σ itens − desconto ≥ 0`. | D11 |
| RN-03 | Estoque de um SKU **nunca fica negativo** (validado na regra e garantido por restrição no banco). | D9 |
| RN-05 | Preço sugerido = `custo × (1 + markup)`, sem arredondamento; sempre editável. Desconto nunca torna o total negativo. | S§4 N4 |
| RN-06 | Lançamento financeiro **nunca é apagado**; correção = estorno ligado ao original. | D2 |
| RN-07 | Toda venda tem cliente (nome + celular válido). | D8 |
| RN-08 | Cancelar venda devolve exatamente o que saiu do estoque e estorna exatamente os lançamentos gerados. | — |
| RN-09 | 5 PINs errados seguidos ⇒ usuário bloqueado. | D7 |
| RN-10 | Um usuário **nunca** acessa dado de outra empresa; Vendedor nunca acessa Financeiro, Compras, Configurações nem custo. | D7, TEST-17 |
| RN-11 | Receber pedido de compra é atômico (estoque + parcelas). | D2 |

## 7. Modelo de dados (mínimo — D18)

Toda tabela tem `empresa_id` (RLS). Nomes finais confirmados na S01.

```
Acesso:        empresas · usuarios (papel, senha_hash?, pin_hash, bloqueado) · sessoes · aparelhos
Configurações: config_empresa (markup_padrao, desconto_max_vendedor) · categorias (atributos)
Financeiro:    lancamentos (tipo, origem_tipo, origem_id, categoria, valor_centavos, forma_pagamento,
               vencimento, pago_em, status, estorno_de, taxa_centavos*, data_prevista*)   *nulos no MVP
Produtos:      produtos (categoria, porte, atributos, custo, preco, fornecedor) · skus (codigo, tamanho,
               cor, estoque_atual ≥ 0, estoque_minimo) · movimentos_estoque (sku, qtd, tipo, origem, autor)
Clientes:      clientes (nome, celular, aviso_lgpd_em)
Vendas:        vendas (numero, cliente, vendedor, subtotal, desconto, total, status) · itens_venda · pagamentos_venda
Compras:       fornecedores · pedidos_compra (status) · itens_pedido · parcelas (→ lancamentos)
Pessoas:       pontos (usuario, tipo, registrado_em)
```

## 8. Arquitetura (resumo — detalhes nos ADRs)

- **ADR 001 (D13):** monólito modular — `apps/api` (Node/TS, Fastify + Zod → OpenAPI 3.1), `apps/web` (Vite + React, **PWA instalável**), `packages/shared` (schemas). Descartadas: Supabase self-hosted, Next.js full-stack. *Versões e APIs conferidas na documentação oficial antes de fixar (IA-05, ENV-19).*
- **ADR 002:** multi-tenant em **banco compartilhado** com `empresa_id` + **RLS** do Postgres como segunda trava; a API define a empresa da sessão em cada transação. Descartados: schema por empresa, banco por empresa.
- **ADR 003:** etiqueta e QR (saída da pesquisa P2).
- Módulos só se falam por **interface pública**; nenhum módulo lê tabela de outro (ARQ-05). Venda e recebimento de compra usam **uma transação** atravessando os módulos (D11).
- **Sessão no servidor** (cookie httpOnly, revogável); senha e PIN com **argon2id** (SEC-17).
- **Implantação (D14, D16):** Docker Compose isolado na VPS (rede, Postgres e limites próprios) atrás de um proxy com HTTPS; config só por variáveis de ambiente; estado só no Postgres → migra para outra VPS ou cloud. Referência de infraestrutura: pasta `10_Infraestrutura_VPS` do Pedro (contém credenciais: **o agente não lê**; o Pedro fornece só o necessário e sem segredo na S11).
- **Escala:** API stateless (réplicas), Postgres → gerenciado quando houver receita, front estático em CDN.

## 9. Requisitos não funcionais (com número)

| ID | Atributo | Meta | Como medir |
|---|---|---|---|
| RNF-01 | Desempenho — finalizar venda | p95 ≤ 500 ms, erro < 1% com 50 usuários simultâneos | k6 (carga) |
| RNF-02 | Desempenho — buscar produto | p95 ≤ 300 ms com 50 usuários simultâneos | k6 (carga) |
| RNF-03 | Disponibilidade (SLO) | "finalizar venda" 99,5% em janela de 30 dias | métricas + alerta |
| RNF-04 | Usabilidade — venda | De "Vendas" até finalizar 1 item, cliente já cadastrado, Pix: **≤ 8 toques** | E2E conta os toques |
| RNF-05 | Usabilidade — toque | Alvos ≥ 48×48 px; máx. 3 botões por linha | revisão de UI + E2E em viewport 360×640 |
| RNF-06 | Isolamento | 0 vazamentos entre empresas e entre perfis nos testes de autorização | testes de integração (TEST-17) |
| RNF-07 | Segurança | 0 achados alto/crítico abertos em SAST, SCA, secret scan e scan de imagem | CI |
| RNF-08 | Instalação | PWA instalável em Android (Chrome) e iPhone (Safari) | teste manual com evidência |
| RNF-09 | Onboarding | README sobe o ambiente local com 1 comando em ≤ 15 min | ensaio em máquina limpa |

## 10. Critérios de aceite do MVP

**Produto**
1. Todos os RF de §5 demonstrados (teste automatizado ou roteiro com evidência).
2. Jornada J1 (nova venda) cumpre RNF-04.
3. O Marcos consegue, sem ajuda: entrar com o PIN, vender, ver o relatório do dia e a lista de reposição.

**Engenharia (harness tier B)**
4. `verify` local e CI verdes; `main` protegida; cobertura não cai.
5. RN-01…RN-11 com testes unitários e/ou de integração; teste de autorização com 2 empresas × 2 perfis.
6. OpenAPI 3.1 com lint (Spectral) e teste de contrato (Schemathesis) no CI.
7. k6 smoke + carga + estresse com thresholds de RNF-01/02.

**Curso (Projeto A)**
8. README, ADR 001–003, OpenAPI, C4 (contexto + contêineres) + mapa de contextos, Docker + Compose, k6, CI que falha de verdade, `main` protegida, segredos fora do repo, CONTRIBUTORS, Conventional Commits, board/PRs.
9. App **no ar** (URL) até a avaliação; vídeo + texto-guia; pacote do Moodle pronto (envio só com pedido do Pedro).

## 11. Gate do harness (PROTOCOLO §1)

- **Tipo de trabalho:** criar app novo (lê todas as práticas; checklist `novo-app`).
- **Tier:** B (justificativa no cabeçalho).
- **Regras-chave por área** (lista completa nas tabelas de `harness/practices/`):
  - Processo/Git: PROC-01/02/03/08/11 · GIT-02/03/06/07/11/12/13
  - Código/Arquitetura: CODE-02/06/14/16/17/18 · ARQ-02/03/05/07/08/09/12 · DOC-01/02/03/05/07/10
  - Testes/CI: TEST-01/03/04/05/07/08/09/12/13/14/17/20 · CI-01/02/03/04/05/07/08/10/11/12/14/18
  - Ambientes/Segurança: ENV-01…11/13/15/18/19 · SEC-01/02/03/04/05/07/09/10/12/14/15/16/17/20/21
  - Operação: OPS-02/03/04/05/06/08/11 · OBS-01…08/10/11/13 · PERF-01/03/04/11/12/14
  - Auditoria: AUD-01/02/03/04/10/11/12/20/21/24/27/31/40/43/60/90/96 · IA-01…12
- **Exceções APROVADAS pelo Pedro em 2026-11-10** (protocolo §7 — local, justificada, com data de revisão):
  - **EX-01 — AUD-22/CI-08 (aprovação por pessoa ≠ autor):** o Pedro trabalha sozinho. Proposta: PR obrigatório + checks obrigatórios + revisão comentada da IA + auto-revisão registrada; se houver alguém de confiança para aprovar, a exceção cai. Revisão: 16/12/2026.
  - **EX-02 — AUD-43 (backup) adiado (D17):** exigido **antes** de o Marcos operar com dados reais. Revisão: data do go-live.
  - **EX-03 — AUD-02 (MFA de admin) para o Dono:** MFA obrigatório só no Admin da plataforma; para o Dono (leigo), PIN + senha. Revisão: 3 meses após o go-live.
  - **EX-04 — AUD-21 (ambientes separados):** no MVP, dev (local) e produção (VPS); homologação = ambiente local com dados fictícios. Revisão: 2º cliente.

## 12. Plano de execução (skill `execucao-em-sessoes`)

> **Versão vigente: `docs/plano-execucao.md` (14 sessões, S01–S14, com portões e diário).** A tabela abaixo é o rascunho original (S00–S11), mantido só para rastreabilidade.

| Sessão | Escopo | Saída verificável |
|---|---|---|
| S00 | Pesquisas **P1** (modelagem de lingerie + planilha das 20 peças), **P2** (etiqueta/QR → ADR 003), **P3** (Instagram) + **Design System** | Docs de pesquisa + DS aprovado |
| S01 | Fundação: repositório, monorepo, `verify`, CI com gates, Compose, Postgres + migrações + RLS, `/health`, logs JSON, ADR 001/002 | CI verde; `docker compose up` sobe tudo |
| S02 | Acesso + Configurações + estrutura do PWA + tela inicial | Entrar → PIN → grade de módulos; teste de autorização |
| S03 | **Financeiro** | RF-FIN; RN-01/06 |
| S04 | Produtos | RF-PRO-01…05/07; RN-03/05 |
| S05 | Etiquetas QR | RF-PRO-06 + ADR 003 |
| S06 | Clientes | RF-CLI |
| S07 | **Vendas** | RF-VEN; RN-02/07/08; RNF-04 |
| S08 | Compras | RF-COM; RN-11 |
| S09 | Pessoas | RF-PES |
| S10 | Qualidade final: k6 3 estágios, Spectral + Schemathesis, E2E, threat model, C4, runbooks | RNF-01/02/06/07 |
| S11 | Deploy na VPS + pacote de entrega do Moodle | URL no ar; checklist do curso marcado |

Cada sessão: Red → Green → `verify` → docs vivas → HANDOFF. Se o prazo estourar, corta-se do fim da fila (D1).

## 13. Pendências e riscos

| # | Item | Dono | Quando |
|---|---|---|---|
| PD-01 | Design System | Pedro | S00 |
| PD-02 | Grade de tamanhos (letras × números de sutiã) | agente (P1) + Marcos | S00 |
| PD-03 | Modelo e conexão da impressora térmica; tamanho da etiqueta | Pedro (P2) | S00/S05 |
| PD-04 | Inventário / 20 peças carro-chefe | Marcos | antes do go-live |
| PD-05 | Domínio do Ailow Cloud | Pedro | S11 |
| PD-06 | Bucket de backup compatível com S3 | Pedro | antes do go-live (EX-02) |
| PD-07 | Chave de deploy na VPS (acesso novo → inventário AUD) | Pedro autoriza | S11 |
| PD-08 | Prazo 16/11 confirmado no Moodle | Pedro | já |
| PD-09 | Fiscal (NFC-e, contador) | Pedro + contador | v2 |
| R-01 | **Prazo**: 12 sessões em 6 dias | — | mitigação: ordem por valor; corte no fim |
| R-02 | VPS compartilhada com a Copel | — | mitigação: isolamento + limites (D14) |
| R-03 | Adoção por usuário leigo | — | mitigação: RNF-04/05, teste com o Marcos antes do go-live |
