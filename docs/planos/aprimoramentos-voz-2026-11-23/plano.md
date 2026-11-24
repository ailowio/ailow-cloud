# Plano — Aprimoramentos do áudio de 23/11/2026 (orquestrado)

> Skill `execucao-em-sessoes` · teto ~15 KB · diário em `diario/ATUAL.md` (nesta pasta).
> Origem: áudio do Pedro de 23/11 (8 min), transcrição local fora do repo: `D:\apps\_scratch\transcricoes\2026-11-23-aprimoramentos-ailow-cloud.md` (não versionar).
> App: `D:\apps\ailow-cloud` · **tier B** · harness `D:\apps\harness\PROTOCOLO.md`. Plano-mestre do v1: `docs/plano-execucao.md` (não é alterado por este plano).
> **Papéis:** Opus 5.5 = orquestrador (planeja, delega, revisa diff, mede, faz o fechamento de cada onda). Cada sessão = **1 subagente** com o modelo indicado.

## Decisões do Pedro (23/11 + 24/11, registradas; valem como decisão humana p/ as asserções citadas)
- **D-A1** Toque longo para arrastar na tela inicial: **500 ms**, tolerância 5 px (constante única).
- **D-A2** Financeiro: **manter D10** (venda = entrada já recebida, 1 lançamento por forma); a tarefa é **provar** venda→entrada e compra recebida→contas a pagar e **mostrar** isso nos assistentes. Venda a prazo: fora de escopo.
- **D-A3** Nome do app vira **"Ailow Cloud"** em tudo (manifest, `<title>`, topo, tela inicial, catálogo público). Topo: "Ailow" / "Cloud" em 2 linhas.
- **D-A4** Entrega: **1 branch + 1 PR por onda**; cada sessão = 1 commit (commit local autorizado; push/PR o orquestrador pede ao Pedro ao fechar a onda). Merge e deploy: Pedro.
- **D-A5** (24/11) Fundo do tema = o do ailow-index (`ailow-index/src/styles/tokens.css`): escuro `--fundo #111214`, `--superficie #1c1e21`, `--borda/--linha #4a5057`; claro `--fundo #eeeeeb`, `--superficie #ffffff`, `--borda #c9c9c4`. No Cloud: `--mantine-color-body`, `--ailow-superficie`, `--ailow-superficie-2` (um degrau entre superfície e borda), `--ailow-borda`, `--ailow-topo` = superfície.
- **D-A6** (24/11) Avatar do usuário em **azul ciano** da marca (`--ailow-marca` #07bdd5) nos 2 temas, com letra escura (#111214 / `--ailow-sobre-marca`) para AA.
- **D-A7** (24/11) Filtro de cor em Produtos: **exato** (já implementado na P01). Arquivos do Marcos (P03): `ailow-cloud/acervo/marcant/catalogo-teste/` (gitignored; NUNCA versionar nem citar trechos em arquivo versionado): `marcant_produtos_mapeados.csv` (29 produtos), `marcant_skus_teste.csv` (110 SKUs), `marcant_catalogo_erp_teste.xlsx`. Separador `;`. Dados SIMULADOS (ambiente = HOMOLOGACAO, fonte = "FICTÍCIO — TESTE"): carregar só no dev / tenant de teste.
- Asserções de teste existentes que **podem** mudar (e só elas, citando a decisão no commit): `chrome-marca.test.ts` (wordmark, posição do badge) e `pwa.test.ts` (nome) ← D-A3/M03; `selo-perfil.test.ts` / `selo-perfil.e2e.ts` (avatar `--ailow-acao` → `--ailow-marca`) ← D-A6/M05; `inicio-dnd-ui.test.ts` (alça) ← D-A1; `cartao-peca-venda-ui.test.ts`, `selo-estoque-venda.test.ts` (cor/posição) ← V02. Qualquer outra ⇒ PARAR e relatar.

## Contrato de toda sessão (subagente)
1. **Abrir em camadas:** este Contrato + o bloco da sessão (`### XNN`) + Estado de retomada + última entrada do diário + `D:\apps\harness\aprendizado\licoes-ativas.md`. Declarar o gate (tipo, tier B, IDs, critérios).
2. **Estado real:** `git -C <worktree> log -1 --oneline` = commit esperado no prompt, senão PARE. `git status` limpo (CRLF não conta).
3. **Regras duras:** sem migração, GRANT, RLS ou schema; sem `git stash`/`checkout`/`reset`; código só com Write/Edit (nunca `node -e`/heredoc/sed — L-0002); não alterar teste fora da lista das Decisões; não ler `.env`/`acervo/bruto`/`transcricoes`; dependência nova só com versão conferida na doc oficial. **Se algo disso for inevitável: PARE e relate como decisão do Pedro.**
4. **Test-first:** teste vermelho pelo motivo certo → código → verde. Critério mensurável = evidência de código que exercita o comportamento real (L-0017).
5. **Verificar:** `npm run verify` (raiz) verde antes do commit; mexeu em rota/contrato/`packages/shared` ⇒ suíte inteira da API + `npm run build:shared` (L-0026). UI ⇒ medir em 360×640 nos 2 temas `scrollWidth ≤ clientWidth` e fim dos elementos vs contêiner que recorta (L-0015) + screenshot salvo na scratchpad.
6. **Servidores:** ao parar dev/preview, liberar portas de verdade (L-0012).
7. **Fechar:** 1 commit Conventional (`feat(web): …`, corpo cita a sessão e decisões) + relatório ao orquestrador (arquivos tocados, testes novos, evidência colada, dúvidas). Não abrir PR, não dar push, **não escrever no diário** (o orquestrador escreve, para não conflitar entre branches paralelas).

## Fechamento de onda (orquestrador)
Revisar o diff inteiro (não só o relatório, L-0024) → `npm run verify` → `bash scripts/e2e.sh` (ambiente do CI, L-0025) → screenshots 360 claro/escuro → CHANGELOG + versão minor → pedir ao Pedro push + PR (template, issue) → sobrescrever Estado de retomada → lições (MC) se algo falhou.

## Ondas e sessões

### Onda 1 — Marca e topo · branch `feat/ux-marca-topo`

### M01 — Ícone e splash escuros · opus
Escopo: fundo único `#111214` (o do cartão do ailow-index) no ícone e na abertura. Regerar `apps/web/public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png` a partir de `public/logo.svg` (A ciano), sem moldura de outra cor; maskable com o A na zona segura (80%). Reescrever `apps/web/scripts/gerar-icones.mjs` para isso (referência: `D:\apps\ailow-index\scripts\icones.mjs`; usar `sharp` só se já estiver no lockfile, senão PARE). `manifest.webmanifest` `background_color`/`theme_color` e `<meta name="theme-color">` = `#111214`.
Pronto quando: teste lê os PNG e confere o pixel (0,0) e o centro-borda = `#111214` nos 4 arquivos; manifest/index iguais; canário (trocar 1 cor) reprova.
Não fazer: nome do app (M02), cor do A, tema do app.

### M02 — "Ailow Cloud" + wordmark em 2 linhas · opus
Escopo: `Moldura.tsx` topo = `<Logo altura={36}>` + bloco de 2 linhas com altura total ≈ 36 px, alinhado ao A: "Ailow" (fw 700) e "Cloud" (tom `--ailow-marca` ou dimmed, fw 500) — simétrico com o ícone. Nome "Ailow Cloud" em `manifest` (`name`/`short_name`), `index.html` (`<title>`, `apple-mobile-web-app-title`), `App.tsx:182` e `catalogo/Catalogo.tsx:76`. Atualizar só as asserções de nome/wordmark em `chrome-marca.test.ts` e `pwa.test.ts` (D-A3).
Pronto quando: testes novos verdes; 360 px nos 2 temas sem rolagem horizontal com toolbar cheia (Dono: avatar+trocar+tema); screenshot.
Não fazer: badge/ícones da toolbar (M03), seta/título (M04).

### M03 — Badge de perfil, Trocar e Sair · opus
Escopo (`componentes/sessao.tsx`): badge "Dono/Vendedor" sai do topo colado na borda; vai para **baixo-centro** do avatar (sobrepondo a borda inferior), cor **diferente** do avatar (avatar usa `--ailow-marca`; badge com tom de contraste, ex. `ambar` ou neutro forte — checar contraste AA em `tema/contraste.ts`), sem encostar no limite do header (64 px). Ícone de Trocar: setas de ida e volta + pessoa (candidatos `IconUsersArrows`/`IconArrowsExchange`/`IconUserShare` — **conferir que existe em `node_modules/@tabler/icons-react` 3.51.0**); `aria-label` "Trocar de usuário". Sair continua no menu com ícone de saída (`IconLogout`) e vermelho.
Pronto quando: medição: badge inteiro dentro do header e do botão (bounding boxes) nos 2 temas; contraste ≥ 4,5:1; teste de fonte atualizado (D-A3/M03).
Não fazer: lógica de sessão/troca.

### M04 — Topo de módulo compacto · opus
Escopo (`telas/Moldura.tsx`, afeta os 33 usos de `voltar`): seta de voltar e `<h1>` **na mesma linha** (Group nowrap): seta 48 px · divisor vertical sutil · título (fz ~22, quebra com `overflowWrap: anywhere`, nunca reticências — D23). Subtítulo abaixo. Sem `voltar`, layout atual.
Pronto quando: E2E `voltar-modulos`, `navegacao` verdes; medição em 360 de Compras, Produtos, Financeiro, Novo produto: título começa à direita da seta, ganho vertical ≥ 40 px vs `main` (medir `top` do 1º conteúdo); screenshot.
Não fazer: mudar rotas ou rótulos.

### Onda 2 — Início e Nova venda · branch `feat/ux-inicio-venda`

### V01 — Arrastar pelo bloco inteiro com toque longo · sonnet
Escopo (`telas/Inicio.tsx`): listeners do `useSortable` no bloco inteiro; `PointerSensor` com `activationConstraint: { delay: 500, tolerance: 5 }` (**conferir na doc do @dnd-kit/core 6.x**; ver se `TouchSensor` é necessário no Android). Toque curto continua abrindo o módulo; depois de arrastar, **não** abre. `-webkit-touch-callout:none; user-select:none` no bloco. Teclado: manter `KeyboardSensor` acessível (alça visível só no foco ou botão "Reordenar" por teclado). Persistência atual (ADR 018) intacta.
Pronto quando: E2E (Playwright, mouse/touch): segurar 600 ms + mover reordena e persiste após reload; toque de 100 ms abre o módulo; segurar 200 ms + mover **não** reordena (canário); `venda-toques.e2e` verde.
Não fazer: visual dos blocos.

### V02 — Card da peça: quantidade junto do preço + selo verde · opus
Escopo (`telas/vendas/CartaoPecaVenda.tsx`, `selo-estoque-venda.ts`): coluna direita = preço em cima e, quando no carrinho, stepper −/qtd/+ logo abaixo, alinhado à direita. `selo-estoque-venda` devolve tom: `ok` (verde, "12 em estoque"), `baixo` (âmbar + alerta, igual hoje), `zerado` (vermelho/cinza). Alvo de toque ≥ 40 px mantido.
Pronto quando: testes do tom (3 casos + limite = mínimo); 360 px nos 2 temas: stepper não estoura o card (L-0015), contraste do verde AA; screenshot com 1 peça no carrinho.
Não fazer: lógica do carrinho.

### V03 — "Novo produto" no meio das ações da Nova venda · sonnet
Escopo (`telas/vendas/MontarVenda.tsx`): ação "Novo produto" (`IconPlus`) **no centro** da 1ª linha: Escanear · Novo produto · Catálogo; depois Gerenciar/Finalizar. **Só Dono** (a rota de criar é `soDono`). Abre o assistente de Novo produto e, ao salvar ou cancelar, volta à Nova venda **com o carrinho intacto** (conferir onde o carrinho vive antes de navegar; se exigir mudar o estado global, PARE e relate). Vendedor não vê o botão.
Pronto quando: E2E Dono cria produto a partir da venda e volta com o carrinho; Vendedor não vê; `venda-toques.e2e` (≤ 8 toques) verde.
Não fazer: mudar o assistente de produto.

### Onda 3 — Produtos · branch `feat/produtos-catalogo-filtros`

### P01 — Filtros na API de produtos · sonnet
Escopo: `produtosQuerySchema` (`packages/shared/src/produtos.ts`) ganha `categoria_id` (uuid) e `cor` (texto curto) opcionais, combináveis com `q` e o cursor (ADR 016); `apps/api/src/produtos` aplica (SQL parametrizado, via `withEmpresa`); regerar `docs/openapi.json`. Custo do `GET /produtos` (S13b2): rodar `EXPLAIN` no teste ou relatar; índice novo = migração ⇒ PARE.
Pronto quando: testes de integração: filtro por categoria, por cor (sem acento/maiúsc.), combinado com `q`, paginação estável, isolamento entre 2 empresas; `lint:openapi` e `openapi.test.ts` verdes.
Não fazer: UI.

### P02 — Produtos: Lista | Catálogo + Filtros · opus
Escopo (`telas/produtos/Produtos.tsx`): nas ações, alternância **Lista** (atual) e **Catálogo** (grade em widgets como na venda — reaproveitar cards/ícones de `vendas/WizardCatalogo.tsx`/`icone-categoria.ts` em modo navegação, sem carrinho; toque abre o detalhe). Botão **Filtros** (Drawer/Modal) com categoria e cor (usa P01), chips dos filtros ativos com "limpar". Preferência Lista/Catálogo pode ficar local.
Pronto quando: E2E: filtrar por categoria e por cor muda o resultado; alternar visão mantém filtros; 360 px nos 2 temas; screenshot das 2 visões.
Não fazer: API (P01), edição de produto.

### P03 — 🚦 Carga dos produtos do Marcos · sonnet
Pré-requisito: Pedro informa o caminho dos arquivos (extração com ChatGPT). Escopo: mapear para o formato de `apps/api/scripts/seed-marcant-via-api.mjs` (categorias, eixos, SKUs, preço em centavos — RN-01), relatório de linhas rejeitadas, rodar **só no dev**. Arquivo do cliente fica fora do repo (acervo é local; repo é público).
Pronto quando: contagem importada = contagem do arquivo − rejeitadas (listadas); produtos aparecem em Produtos e na venda.
Não fazer: produção (carga na VPS = mudança em produção, pedido separado + AUD).

### Onda 4 — Teclado · branch `fix/teclado-formularios`

### T01 — Teclado menor e "Continuar" sempre visível · sonnet
Escopo: `index.html` viewport + `interactive-widget=resizes-content` (conferir suporte na doc do Chrome/MDN); nos 68 campos (`TextInput`/`NumberInput`/…): `autoComplete="off"` onde não é dado pessoal do próprio usuário, tokens corretos onde é (`tel`, `name` no cliente? decidir caso a caso e listar), `inputMode` (`decimal`/`numeric`) em dinheiro, quantidade e PIN; rodapé do `componentes/Assistente.tsx` (Voltar/Continuar) visível com teclado aberto.
Pronto quando: teste de fonte que reprova campo sem `autoComplete` explícito; E2E em 360×400 (simula teclado): botão Continuar dentro da viewport em Novo produto, Nova despesa, Fechamento. **Limite honesto:** a barra do Gboard/Chrome (cartão, endereço) é do navegador e pode não sumir 100% — 🚦 Pedro valida no celular.
Não fazer: redesenho de telas.

### Onda 5 — Financeiro visível · branch `feat/financeiro-visivel`

### F01 — Provar venda→entrada e compra→contas a pagar · sonnet
Escopo: auditoria de leitura de `apps/api/src/vendas/vendas.ts:205-221` e `compras/compras.ts:226-285` + testes que faltarem: venda com 2 formas ⇒ 2 lançamentos `entrada` `pago` na data, categoria Vendas, somando o total; cancelar ⇒ estornos; receber compra com N parcelas ⇒ N `saida` `aberto` com vencimento, listados em contas a pagar; tudo atômico (falha no meio ⇒ nada gravado). E2E: venda aparece no relatório do Financeiro; compra recebida em Contas a pagar.
Pronto quando: relatório "implementado / lacuna" com evidência; lacuna real vira teste vermelho + correção mínima (sem schema).
Não fazer: UI (F02), venda a prazo (D-A2).

### F02 — Assistentes mostram o financeiro + parcelas no receber · opus
Escopo: Fechamento da venda (`vendas/Fechamento.tsx`) e comprovante: linha "Entra no financeiro hoje: R$ X (Pix) …"; Receber pedido (`compras/Pedidos.tsx:~200`) passa de 1 parcela fixa para **N parcelas** (valor + vencimento, soma = total, `parcelasFecham` de `packages/shared`), com resumo "Gera N contas a pagar"; toasts de sucesso apontam para Financeiro.
Pronto quando: E2E receber com 3 parcelas ⇒ 3 em Contas a pagar; soma divergente bloqueada com toast; `receber-compra.e2e` e `venda-toques.e2e` verdes; 360 px.
Não fazer: API nova.

## Ordem e paralelismo
Serial dentro da onda (mesma branch). Em paralelo só o que não toca os mesmos arquivos: **P01** pode rodar junto da Onda 1; **F01** junto da Onda 2. Ordem: Onda 1 → 2 → 3 → 4 → 5. Worktree manual por onda (`git worktree add -b <branch> D:\apps\_wt-<onda> <commit>`; L-0031), caminho absoluto e commit esperado no prompt.

## Modelo do prompt do subagente
```text
Sessão XNN — <título> (plano "Aprimoramentos voz 23/11").
Worktree: <abs> · commit esperado no topo: <sha> (se não for, PARE).
Plano: D:\apps\ailow-cloud\docs\planos\aprimoramentos-voz-2026-11-23\plano.md
Leia SÓ: Decisões, Contrato, "### XNN", Estado de retomada; e a última entrada de diario/ATUAL.md.
Regras duras do Contrato §3 valem integralmente. Se inevitável: PARE e relate.
Pronto quando: <copiar>. Não fazer: <copiar>.
Ao terminar: 1 commit + relatório (arquivos, testes, evidência, dúvidas). Não escreva no diário.
```

### Estado de retomada — 2026-11-24 (sobrescrever a cada sessão)
- **Worktrees:** `D:\apps\_wt-tema` = `feat/ux-tema-index` (M05 / Onda 1.1, sobre `origin/main` 40c76a7); `D:\apps\_wt-produtos` = `feat/produtos-catalogo-filtros` (P01 `0d2a61a`); `D:\apps\_wt-financeiro` = `feat/financeiro-visivel` (F01 `b7f45ed`). Onda 1 (`feat/ux-marca-topo`) já mergeada (#45).
- **M05 feita:** tema = ailow-index (D-A5); avatar ciano + letra `#111214` (D-A6); D-A5/D-A6/D-A7 registradas. CHANGELOG 1.6.1; fechar com `e2e.sh` + push/PR (Pedro).
- **Próximo (prompts em `D:\apps\_scratch\prompts-cursor-aprimoramentos-voz.md`):** Onda 2 (V01→V03) → Onda 3 (P02; P03 com arquivos do Marcos em `acervo/marcant/catalogo-teste/`) → Onda 4 (T01) → Onda 5 (F02). Uma onda por vez (portas do dev).
- **Pendente do Pedro:** push/PR da M05; validação do teclado no celular (T01); merge/deploy de cada onda.
- **Conhecido:** `npm run dev:parar` quebrado na `main` (aspa faltando); pare o Postgres com `node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe`.
