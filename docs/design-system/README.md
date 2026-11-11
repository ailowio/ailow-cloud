# Design System — Ailow Cloud

> Status: **v1.1 — identidade Ailow azul + laranja** (2026-11-10, D23). Histórico: v0 magenta/dourado (recusada) → v1 violeta (recusada) → v1.1.
> **Código vivo:** `apps/web/src/tema/` (tokens) e `apps/web/src/componentes/` (componentes). Catálogo: `npm run dev -w apps/web` → http://localhost:5173.
> Base: **Mantine 9.7.3** + **mantine-datatable 9.7.5** (D20), versões exatas. Fontes auto-hospedadas (sem requisição a terceiros): **Sora** (títulos) e **Manrope** (texto), licença OFL-1.1.

## 1. Princípios

| # | Princípio | Regra prática | Referência de padrão |
|---|---|---|---|
| 1 | **Botão grande, pouca escolha** | Toque ≥ **48×48 px**; máx. **3 por linha**; 1 ação primária por tela | Material 3, Adobe Spectrum |
| 2 | **Uma palavra** | Módulos e botões com 1 palavra; ações no infinitivo | D4 |
| 3 | **Passo a passo** | Formulários longos viram etapas com "Passo N de M" + barra | Salesforce Lightning (wizards) |
| 4 | **Nunca tela vazia muda** | Todo vazio diz o que vai aparecer e oferece a ação | Shopify Polaris |
| 5 | **Estado visível sem ler número** | Estoque baixo = âmbar; zerado/erro = vermelho | Polaris, Atlassian |
| 6 | **Lista que vira tabela** | Celular: cartões; computador (≥ 48em): `mantine-datatable` | Polaris, GitLab Pajamas |
| 7 | **Feedback imediato** | Notificação curta no sucesso; erro fica até fechar e diz o que fazer | Atlassian |
| 8 | **Camadas, não um fundo só** | Fundo da página ≠ superfície dos cartões, nos dois temas | GitHub Primer (tokens de superfície) |

## 2. Identidade (brief do Pedro + D23)

Tecnologia premium: **navy profundo e slate escuro** como base, **azul elétrico como primária** e **laranja como destaque** (a mistura azul + laranja é a assinatura). Ciano só em detalhes. Sem violeta.

| Escala Mantine | Tom da marca | Papel |
|---|---|---|
| `azul` | `#2448FF` (índice 6) | **Primária**: botões, bloco "Vendas" com brilho, seleção, barra de progresso |
| `coral` | `#FF7043` (5) | **Destaque laranja**: total do carrinho, pontos do PIN, marca no topo |
| `ambar` | `#FF9A52` (5) | Alerta: estoque baixo |
| `ciano` | `#39CFFF` (5) | Detalhes luminosos, com moderação |
| `red` (nativa) | — | **Perigo**: zerado, erro, contador de alertas (separado do laranja da marca) |
| `dark` (substituída por navy) | `#111832` (7) | Base neutra do tema escuro |

Texto colorido usa tokens próprios com contraste medido: `--ailow-primario-texto` e `--ailow-laranja-texto`.

### Superfícies (`apps/web/src/tema/tema.css`)

| Token | Claro | Escuro |
|---|---|---|
| Fundo da página (`--mantine-color-body`) | `#eef0f7` slate frio | `#0b1126` navy |
| Superfície (`--ailow-superficie`) | `#ffffff` | `#151c36` slate |
| Borda (`--ailow-borda`) | `#dde1ee` | `#2b3454` |
| Sombra (`--ailow-sombra`) | sombra suave azulada | sombra profunda + filete interno |
| Brilho do destaque (`--ailow-brilho`) | halo azul 30% | contorno + halo azul 40–60% |

Tema padrão: **escuro** (`defaultColorScheme="dark"`), com troca no topo.

### Contraste (calculado pela fórmula de luminância do WCAG)

| Par | Razão |
|---|---|
| Branco sobre azul.6 `#2448FF` (botão, claro) | 6,09:1 |
| Branco sobre azul.5 `#3454FF` (botão, escuro) | 5,44:1 |
| `--ailow-primario-texto` claro `#1b37d6` sobre branco | 8,19:1 |
| `--ailow-primario-texto` escuro `#6984ff` sobre navy / superfície | 5,65:1 / 5,07:1 |
| `--ailow-laranja-texto` claro `#bf431e` sobre branco | 5,20:1 |
| `--ailow-laranja-texto` escuro `#ff7043` sobre navy / superfície | 6,82:1 / 6,11:1 |

Tudo ≥ 4,5:1 (AA para texto normal).

### Regra de texto: nunca truncar o que identifica

Nome de produto, cliente ou fornecedor **nunca** usa reticências: quebra linha (`overflow-wrap: anywhere`). No carrinho, o nome ocupa a linha inteira e controles e valor vão para a linha de baixo. Teste automático no catálogo (Playwright, 390 px): 0 textos visíveis cortados.

## 3. Componentes (`apps/web/src/componentes/index.tsx`)

| Componente | Base Mantine | Regra |
|---|---|---|
| **BlocoAcao** | `UnstyledButton` + `Indicator` | Quadrado da tela inicial, ≥ 104 px; `destaque` = azul com brilho; selo vermelho com contagem de alertas |
| **GradeModulos** | `SimpleGrid cols={3}` | Sempre 3 colunas |
| **TecladoPin** | `SimpleGrid` + `Button` | Teclas de 64 px; pontos laranja com brilho conforme o progresso |
| **Carrinho** | `Stack` em cartão | Linha: nome/detalhe, − qtd +, valor; total em laranja |
| **Etapas** | `Progress` | "Passo N de M" + barra; Voltar/Continuar; cabe em 360 px |
| **Valor** | `Text` | `R$ 1.234,56` a partir de **centavos inteiros** (`formatarReais`, RN-01, com teste) |
| **SeloEstoque** | `Badge` | neutro · âmbar (baixo) · vermelho (zerado) |
| **EstadoVazio** | `Stack` em cartão | Título + frase + 1 botão |
| Avisos | `@mantine/notifications` | Sucesso azul 3 s; erro vermelho até fechar |

Classes utilitárias: `.ailow-cartao`, `.ailow-bloco`, `.so-desktop`. Ícones: Tabler Icons, traço 1,75.

## 4. Voz

Curto, segunda pessoa, carinhoso, sem jargão: "Peça sem estoque. Chame o Dono." · "Venda finalizada." Erro = o que houve + o que fazer. Dinheiro em reais com vírgula; datas `dd/mm`.

## 5. Verificação (2026-11-10)

`npm run verify` (tipos + 4 testes + build) verde. Catálogo inspecionado em 390×844 nos dois temas: sem overflow horizontal, fontes Sora/Manrope carregadas, fundo escuro `#0b1126`.
