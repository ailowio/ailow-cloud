# Design System — Ailow Cloud

> Status: **v2 — paleta única da logo, dark chumbo** (2026-11-13, UXM-08). Histórico: v0 magenta/dourado (recusada) → v1 violeta (recusada) → v1.1 azul + laranja → v2.
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

## 2. Identidade (UXM-08, 2026-11-13: paleta única derivada da logo)

A **marca é a cor do "A" da logo: `#07BDD5`** (lida de `apps/web/public/logo.svg`; o teste falha se divergir). Uma só paleta, em tokens `--ailow-*` (`tema/tema.css`) e escalas Mantine (`tema/tema.ts`). **Nada de hex solto nas telas**: cor de marca, texto e superfície vêm de token. O tema **escuro é cinza chumbo** (saturação HSL ≤ 15%, nunca preto puro); o azul `#2448FF` (antes primário) é só **secundário/de apoio**. Sem violeta, sem laranja, sem ciano separado.

| Escala Mantine | Tom | Papel |
|---|---|---|
| `marca` | `#07BDD5` (índice 5 = A da logo); 7 = `#047e90` (ação no claro); 8 = `#036171` (texto no claro) | **Primária**: botões, bloco "Vendas", seleção, barra, PIN, totais |
| `azul` | `#2448FF` (6) | **Secundária**: avisos informativos, apoio |
| `ambar` | `#FF9A52` (5) | Semântica de alerta: estoque baixo |
| `red` (nativa) | — | **Perigo**: zerado, erro, contador de alertas |
| `dark` (= `chumbo`) | `#1b1c1e` (7) | Base neutra do tema escuro |

Por que dois tons de marca? `#07BDD5` sobre branco dá só 2,1:1 (reprova AA). No **escuro** a marca crua é a ação (7,5:1); no **claro** o botão usa o tom 7 da mesma família (branco sobre ele = 4,78:1) e o texto na cor da marca usa o tom 8. A cor crua continua na logo e em `--ailow-marca`.

### Tokens (`apps/web/src/tema/tema.css`)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--ailow-marca` | `#07bdd5` | `#07bdd5` | Cor do A (idêntica nos dois temas); decorativo |
| `--ailow-acao` / `--ailow-sobre-acao` | `#047e90` / `#ffffff` | `#07bdd5` / `#06161a` | Fundo de botão, bloco em destaque, PIN, pular-conteúdo e o texto sobre ele |
| `--ailow-marca-texto` | `#036171` | `#07bdd5` | Texto e ícones na cor da marca (título "Ailow ERP", saldo, total) |
| `--ailow-secundario` / `--ailow-secundario-texto` | `#2448ff` / `#1b37d6` | `#2448ff` / `#8aa0ff` | Azul de apoio |
| `--mantine-color-body` | `#eff1f2` | `#1b1c1e` | Fundo da página |
| `--ailow-superficie` / `-2` | `#ffffff` / `#f6f7f8` | `#26282b` / `#2f3236` | Cartões, campos |
| `--ailow-borda` / `--ailow-topo` | `#dcdfe2` / `#ffffff` | `#44474c` / `#222325` | Bordas, topo |
| `--ailow-texto` / `--ailow-apagado` | `#16181a` / `#565c62` | `#ececed` / `#a3a7ad` | Texto e texto secundário (`--mantine-color-text` / `-dimmed`) |

Tema padrão: **escuro** (`defaultColorScheme="dark"`), com troca no topo. Camadas, não um fundo só: página ≠ superfície nos dois temas.

### Contraste (WCAG 2.x, calculado em código por `src/tema/paleta.test.ts` e `e2e/paleta.e2e.ts`)

| Par | Claro | Escuro | Mínimo |
|---|---|---|---|
| Texto / fundo · superfície | 15,71 · 17,80 | 14,44 · 12,52 | 4,5 |
| Apagado / fundo · superfície | 5,97 · 6,77 | 7,06 · 6,11 | 4,5 |
| Marca-texto / fundo · superfície | 6,28 · 7,11 | 7,51 · 6,51 | 4,5 |
| Secundário-texto / fundo · superfície | 7,23 · 8,19 | 6,95 · 6,02 | 4,5 |
| Sobre-ação / ação (rótulo do botão) | 4,78 | 8,13 | 4,5 |
| Ação / fundo · superfície (componente) | 4,22 · 4,78 | 7,51 · 6,51 | 3 |

Saturação HSL do escuro: fundo 5,3% · superfície 6,2% · superfície-2 6,9% · borda 5,6% · topo 4,2% (limite 15%).
Não coberto: borda dos campos de formulário (padrão do Mantine) e texto de *placeholder*; medir numa próxima passada.

### Regra de texto: nunca truncar o que identifica

Nome de produto, cliente ou fornecedor **nunca** usa reticências: quebra linha (`overflow-wrap: anywhere`). No carrinho, o nome ocupa a linha inteira e controles e valor vão para a linha de baixo. Teste automático no catálogo (Playwright, 390 px): 0 textos visíveis cortados.

## 3. Componentes (`apps/web/src/componentes/index.tsx`)

| Componente | Base Mantine | Regra |
|---|---|---|
| **BlocoAcao** | `UnstyledButton` + `Indicator` | Quadrado da tela inicial, ≥ 104 px; `destaque` = cor de ação da marca com brilho; selo vermelho com contagem de alertas |
| **GradeModulos** | `SimpleGrid cols={3}` | Sempre 3 colunas |
| **TecladoPin** | `SimpleGrid` + `Button` | Teclas de 64 px; pontos na cor da marca com brilho conforme o progresso |
| **Carrinho** | `Stack` em cartão | Linha: nome/detalhe, − qtd +, valor; total na cor da marca |
| **Etapas** | `Progress` | "Passo N de M" + barra; Voltar/Continuar; cabe em 360 px |
| **Valor** | `Text` | `R$ 1.234,56` a partir de **centavos inteiros** (`formatarReais`, RN-01, com teste) |
| **SeloEstoque** | `Badge` | neutro · âmbar (baixo) · vermelho (zerado) |
| **EstadoVazio** | `Stack` em cartão | Título + frase + 1 botão |
| Avisos | `@mantine/notifications` | Sucesso na cor da marca 3 s; erro vermelho até fechar |

Classes utilitárias: `.ailow-cartao`, `.ailow-bloco`, `.so-desktop`. Ícones: Tabler Icons, traço 1,75.

## 4. Voz

Curto, segunda pessoa, carinhoso, sem jargão: "Peça sem estoque. Chame o Dono." · "Venda finalizada." Erro = o que houve + o que fazer. Dinheiro em reais com vírgula; datas `dd/mm`.

## 5. Verificação (2026-11-10)

`npm run verify` (tipos + 4 testes + build) verde. Catálogo inspecionado em 390×844 nos dois temas: sem overflow horizontal, fontes Sora/Manrope carregadas, fundo escuro `#0b1126` (v1.1; a v2 é `#1b1c1e`).
