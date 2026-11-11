# Design System — Ailow Cloud

> Sessão S02 · 2026-11-10 · Status: **proposta — aguarda aprovação do Pedro (🚦)**
> Base: **Mantine** (MIT) + `mantine-datatable` (D20). Versões: Mantine **9.8.0** saiu em 10/11/2026 (hoje) → fixar **9.7.x** (≥ 2 semanas; 9.7.3 de 17/10/2026); `mantine-datatable` 9.7.5 declara compatibilidade com Mantine 9.x. Fontes: [changelog Mantine](https://mantine.dev/changelog/previous-versions/), [mantine-datatable](https://icflorescu.github.io/mantine-datatable/). **Conferir de novo na S03 antes de instalar (IA-05).**
> **Verificado na documentação oficial (10/11/2026):** `createTheme` e `MantineProvider` vêm de `@mantine/core`; `colors` = objeto de arrays com ao menos 10 tons; `primaryShade` aceita número (0–9) ou `{ light, dark }` (padrão `{ light: 6, dark: 8 }`); `autoContrast` + `luminanceThreshold` (padrão 0,3); `defaultRadius`; `headings.fontWeight` é string; `MantineProvider` tem `defaultColorScheme` (`light | dark | auto`) e `forceColorScheme`. Fontes: [theme object](https://mantine.dev/theming/theme-object/), [MantineProvider](https://mantine.dev/theming/mantine-provider/), [getting started](https://mantine.dev/getting-started/).
> **Ainda não verificado:** o tipo `MantineColorsTuple` (as páginas não o citam; usar só se existir na 9.7.x) e a chave exata de `fontSizes`. Instalação (sem framework, vale para Vite): `@mantine/core @mantine/hooks`, dev `postcss postcss-preset-mantine postcss-simple-vars`, `import "@mantine/core/styles.css"`. Confirmar a versão mínima do React na S03.

## 1. Princípios (do discovery para a tela)

| # | Princípio | Regra prática | Referência de padrão |
|---|---|---|---|
| 1 | **Botão grande, pouca escolha** | Toque ≥ **48×48 px**; máx. **3 botões por linha**; 1 ação primária por tela | Material 3 (alvos de toque), Spectrum (acessibilidade) |
| 2 | **Uma palavra** | Módulos e botões com 1 palavra; verbo no infinitivo nas ações ("Vender", "Salvar", "Finalizar") | D4 |
| 3 | **Passo a passo** em vez de formulário longo | Cadastro de produto e fechamento de venda em **etapas** (Stepper), uma decisão por tela | Salesforce Lightning (wizards) |
| 4 | **Nunca tela vazia muda** | Todo vazio diz o que vai aparecer e tem o botão para começar | Shopify Polaris (empty states) |
| 5 | **Estado visível sem ler número** | Estoque baixo = selo vermelho; vencido = faixa; pago = verde | Polaris (badges), Atlassian (feedback) |
| 6 | **Lista que vira tabela** | Celular: **cartões** empilhados; computador: **tabela** (`mantine-datatable`) com filtros no topo | Polaris (index table), GitLab Pajamas (filtros) |
| 7 | **Feedback imediato** | Toda ação responde: notificação curta ("Venda 1827 finalizada"); erro diz o que fazer | Atlassian (flags/banners) |
| 8 | **Cor semântica ≠ cor da marca** | Sucesso/alerta/perigo têm tokens próprios; a cor da empresa nunca indica erro | GitHub Primer (tokens semânticos) |

## 2. Tema em duas camadas (multi-tenant)

```
Camada 1 — Ailow Cloud (fixa): neutros, tipografia, espaçamento, raios, cores semânticas, componentes
Camada 2 — Empresa (por tenant, em Configurações): cor primária, cor de destaque, logo/ícone, tema padrão (claro/escuro)
```

O produto é um só; **cada loja vê a própria marca**. A Marcant é o primeiro tema de empresa.

### 2.1 Tema da empresa Marcant

| Token | Escala (10 tons, 0 → 9) | Uso |
|---|---|---|
| `marca` (primária) | `#fde9f1 #f9c6da #f39fc0 #ec77a6 #e4518d #d63777 #b82a63 #952150 #72193d #4f102a` | Botão primário, foco, seleção. **Tom 6 no claro** (contraste com texto branco ≈ 5,9:1) e **tom 5 no escuro** (≈ 4,5:1) |
| `ouro` (destaque) | `#fbf5e6 #f3e5c0 #e9d296 #dfbe6b #d4ab4a #c39836 #a67f2b #856523 #644c1a #433311` | Ícone "M", destaque de totais, selos premium. Texto dourado sobre branco **só no tom 7** (≈ 5,4:1) |
| Tema padrão | **escuro** (o Marcos: "só gosto de tema escuro" — R1 55:00) com troca para claro | |

Origem: parede magenta, "M" dourado e fachada rosé (fotos F18–F25, P3). Os contrastes foram calculados pela fórmula de luminância relativa do WCAG; **reconferir com ferramenta na S05**.

### 2.2 Camada Ailow (fixa)

| Grupo | Tokens |
|---|---|
| Neutros | Escala `escuro` do Mantine levemente puxada para o rosé (fundo escuro `#17131a`, superfície `#211b24`, borda `#3a3140`); claro: fundo `#fbf8fa`, superfície `#ffffff`, borda `#e9e1e6` |
| Semânticas | `sucesso` verde · `alerta` âmbar · `perigo` vermelho · `info` azul (paletas nativas do Mantine `green`, `yellow`, `red`, `blue`) |
| Tipografia | **Inter** (texto e números, `tabular-nums` em valores) · títulos em Inter 700. Base **16 px**; escala 14 · 16 · 18 · 22 · 28 · 36 |
| Espaçamento | Grade de 8: 4 · 8 · 12 · 16 · 24 · 32 · 48 |
| Raio | `md` 12 px nos blocos de ação e cartões; `sm` 8 px em campos |
| Toque | Altura mínima de botão **48 px** (`size="lg"`); blocos da grade ≥ **96 px** de altura |

## 3. Componentes do Ailow Cloud (sobre o Mantine)

| Componente | Base Mantine | Regra |
|---|---|---|
| **BlocoAcao** | `UnstyledButton` + ícone + rótulo | Quadrado da tela inicial; ícone 32 px, 1 palavra, selo de alerta no canto (ex.: estoque baixo) |
| **GradeModulos** | `SimpleGrid cols={3}` | 3 colunas sempre; filtra por perfil (D7) |
| **TopoTela** | `Group` | Voltar · título de 1 palavra · ação secundária; logo da empresa só na tela inicial |
| **TecladoPin** | `SimpleGrid` + `Button` | Teclas 64 px; 4 pontos de progresso; vibra/erro visual após PIN errado |
| **Carrinho** | `Drawer position="bottom"` / painel fixo | Sempre visível na venda: nº de itens + total; abre para editar quantidade |
| **Etapas** | `Stepper` | Cadastro de produto e fechamento; botão "Continuar" fixo no rodapé |
| **ListaIndice** | `Card` (celular) / `DataTable` (computador) | Busca no topo, filtros em chips, vazio com ação |
| **Valor** | `Text` | Sempre `R$ 1.234,56`, `tabular-nums`, nunca ponto flutuante na lógica (RN-01) |
| **SeloEstoque** | `Badge` | ok (neutro) · baixo (alerta) · zerado (perigo) |
| **EstadoVazio** | `Stack` | Ícone + frase + 1 botão |
| **Aviso** | `notifications` | Sucesso 3 s; erro fica até fechar e diz como resolver |

Ícones: **Tabler Icons** (a biblioteca usada nos exemplos do Mantine, MIT) — conferir na S03.

## 4. Textos (voz)

- Curto, segunda pessoa, carinhoso, sem jargão: "Peça sem estoque. Chame o Dono." · "Venda finalizada." · "Qual o celular da cliente?"
- Erro = o que houve + o que fazer. Nunca "Erro 500".
- Dinheiro sempre em reais com vírgula; datas `dd/mm` (e `dd/mm/aaaa` em relatórios).

## 5. Entregáveis da S02

- Este documento.
- `tema-mantine.ts`: proposta do tema (copiado para `apps/web` na S05).
- `prototipo.html`: protótipo navegável (PIN 1234 → tela inicial → Vendas → Fechar → Pronto), claro/escuro, com bloqueio sem estoque. Simula os tokens em HTML puro (não usa Mantine).
