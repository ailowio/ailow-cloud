# Design System — Ailow Cloud

> Status: **v1 — identidade Ailow** (2026-11-10). Substitui a v0 (paleta magenta/dourado da Marcant, recusada pelo Pedro).
> **Código vivo:** `apps/web/src/tema/` (tokens) e `apps/web/src/componentes/` (componentes). Catálogo: `npm run dev -w apps/web` → http://localhost:5173.
> Base: **Mantine 9.7.3** + **mantine-datatable 9.7.5** (D20), versões exatas. Fontes auto-hospedadas (sem requisição a terceiros): **Sora** (títulos) e **Manrope** (texto), licença OFL-1.1.

## 1. Princípios

| # | Princípio | Regra prática | Referência de padrão |
|---|---|---|---|
| 1 | **Botão grande, pouca escolha** | Toque ≥ **48×48 px**; máx. **3 por linha**; 1 ação primária por tela | Material 3, Adobe Spectrum |
| 2 | **Uma palavra** | Módulos e botões com 1 palavra; ações no infinitivo | D4 |
| 3 | **Passo a passo** | Formulários longos viram etapas com "Passo N de M" + barra | Salesforce Lightning (wizards) |
| 4 | **Nunca tela vazia muda** | Todo vazio diz o que vai aparecer e oferece a ação | Shopify Polaris |
| 5 | **Estado visível sem ler número** | Estoque baixo = âmbar; zerado/erro = coral | Polaris, Atlassian |
| 6 | **Lista que vira tabela** | Celular: cartões; computador (≥ 48em): `mantine-datatable` | Polaris, GitLab Pajamas |
| 7 | **Feedback imediato** | Notificação curta no sucesso; erro fica até fechar e diz o que fazer | Atlassian |
| 8 | **Camadas, não um fundo só** | Fundo da página ≠ superfície dos cartões, nos dois temas | GitHub Primer (tokens de superfície) |

## 2. Identidade (brief do Pedro)

Tecnologia premium e futurista: **navy profundo e slate escuro** como base, **violeta elétrico** dominante, **azul elétrico** secundário, **ciano** para detalhes luminosos, **coral e âmbar com moderação**. Acabamento fosco, brilho sutil, sem saturação exagerada e sem gradientes agressivos.

| Escala Mantine | Tom da marca | Papel |
|---|---|---|
| `violeta` | `#9200FF` (índice 6) · `#7000E8` (7) | Cor primária: ação principal, foco, seleção, bloco "Vendas" com brilho |
| `azul` | `#2448FF` (6) | Secundária: informação, selos neutros |
| `ciano` | `#39CFFF` (5) | Detalhes luminosos: pontos do PIN, indicadores ativos |
| `coral` | `#FF7043` (5) | **Perigo** (zerado, erro). Usar pouco |
| `ambar` | `#FF9A52` (5) | **Alerta** (estoque baixo). Usar pouco |
| `dark` (substituída por navy) | `#111832` (7) | Base neutra do tema escuro |

Sucesso usa o próprio violeta (a marca confirma a ação); não há verde na identidade.

### Superfícies (`apps/web/src/tema/tema.css`)

| Token | Claro | Escuro |
|---|---|---|
| Fundo da página (`--mantine-color-body`) | `#eef0f7` slate frio | `#0b1126` navy |
| Superfície (`--ailow-superficie`) | `#ffffff` | `#151c36` slate |
| Borda (`--ailow-borda`) | `#dde1ee` | `#2b3454` |
| Sombra (`--ailow-sombra`) | sombra suave azulada | sombra profunda + filete interno |
| Brilho do destaque (`--ailow-brilho`) | halo violeta 28% | contorno + halo violeta 35–55% |

Tema padrão: **escuro** (`defaultColorScheme="dark"`), com troca no topo.

### Contraste (fórmula de luminância do WCAG; reconferir com ferramenta)

- Texto branco sobre `#9200FF` ≈ **5,7:1** ✓ (botões e bloco primário).
- Violeta como texto no escuro usa `--mantine-color-violeta-text` (`#9c36ff`) sobre navy ≈ **3,9:1**: serve para ícones e texto grande/negrito (≥ 3:1), **não** para texto pequeno. Texto corrido fica sempre em neutro.

## 3. Componentes (`apps/web/src/componentes/index.tsx`)

| Componente | Base Mantine | Regra |
|---|---|---|
| **BlocoAcao** | `UnstyledButton` + `Indicator` | Quadrado da tela inicial, ≥ 104 px; `destaque` = violeta com brilho; selo coral com contagem de alertas |
| **GradeModulos** | `SimpleGrid cols={3}` | Sempre 3 colunas |
| **TecladoPin** | `SimpleGrid` + `Button` | Teclas de 64 px; pontos ciano com brilho conforme o progresso |
| **Carrinho** | `Stack` em cartão | Linha: nome/detalhe, − qtd +, valor; total em violeta |
| **Etapas** | `Progress` | "Passo N de M" + barra; Voltar/Continuar; cabe em 360 px |
| **Valor** | `Text` | `R$ 1.234,56` a partir de **centavos inteiros** (`formatarReais`, RN-01, com teste) |
| **SeloEstoque** | `Badge` | neutro · âmbar (baixo) · coral (zerado) |
| **EstadoVazio** | `Stack` em cartão | Título + frase + 1 botão |
| Avisos | `@mantine/notifications` | Sucesso violeta 3 s; erro coral até fechar |

Classes utilitárias: `.ailow-cartao`, `.ailow-bloco`, `.so-desktop`. Ícones: Tabler Icons, traço 1,75.

## 4. Voz

Curto, segunda pessoa, carinhoso, sem jargão: "Peça sem estoque. Chame o Dono." · "Venda finalizada." Erro = o que houve + o que fazer. Dinheiro em reais com vírgula; datas `dd/mm`.

## 5. Verificação (2026-11-10)

`npm run verify` (tipos + 4 testes + build) verde. Catálogo inspecionado em 390×844 nos dois temas: sem overflow horizontal, fontes Sora/Manrope carregadas, fundo escuro `#0b1126`.
