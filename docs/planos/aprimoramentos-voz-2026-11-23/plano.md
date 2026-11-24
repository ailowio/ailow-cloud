# Plano â€” Aprimoramentos do Ã¡udio de 23/11/2026 (orquestrado)

> Skill `execucao-em-sessoes` Â· teto ~15 KB Â· diÃ¡rio em `diario/ATUAL.md` (nesta pasta).
> Origem: Ã¡udio do Pedro de 23/11 (8 min), transcriÃ§Ã£o local fora do repo: `D:\apps\_scratch\transcricoes\2026-11-23-aprimoramentos-ailow-cloud.md` (nÃ£o versionar).
> App: `D:\apps\ailow-cloud` Â· **tier B** Â· harness `D:\apps\harness\PROTOCOLO.md`. Plano-mestre do v1: `docs/plano-execucao.md` (nÃ£o Ã© alterado por este plano).
> **PapÃ©is:** Opus 5.5 = orquestrador (planeja, delega, revisa diff, mede, faz o fechamento de cada onda). Cada sessÃ£o = **1 subagente** com o modelo indicado.

## DecisÃµes do Pedro (23/11 + 24/11, registradas; valem como decisÃ£o humana p/ as asserÃ§Ãµes citadas)
- **D-A1** Toque longo para arrastar na tela inicial: **500 ms**, tolerÃ¢ncia 5 px (constante Ãºnica).
- **D-A2** Financeiro: **manter D10** (venda = entrada jÃ¡ recebida, 1 lanÃ§amento por forma); a tarefa Ã© **provar** vendaâ†’entrada e compra recebidaâ†’contas a pagar e **mostrar** isso nos assistentes. Venda a prazo: fora de escopo.
- **D-A3** Nome do app vira **"Ailow Cloud"** em tudo (manifest, `<title>`, topo, tela inicial, catÃ¡logo pÃºblico). Topo: "Ailow" / "Cloud" em 2 linhas.
- **D-A4** Entrega: **1 branch + 1 PR por onda**; cada sessÃ£o = 1 commit (commit local autorizado; push/PR o orquestrador pede ao Pedro ao fechar a onda). Merge e deploy: Pedro.
- **D-A5** (24/11) Fundo do tema = o do ailow-index (`ailow-index/src/styles/tokens.css`): escuro `--fundo #111214`, `--superficie #1c1e21`, `--borda/--linha #4a5057`; claro `--fundo #eeeeeb`, `--superficie #ffffff`, `--borda #c9c9c4`. No Cloud: `--mantine-color-body`, `--ailow-superficie`, `--ailow-superficie-2` (um degrau entre superfÃ­cie e borda), `--ailow-borda`, `--ailow-topo` = superfÃ­cie.
- **D-A6** (24/11) Avatar do usuÃ¡rio em **azul ciano** da marca (`--ailow-marca` #07bdd5) nos 2 temas, com letra escura (#111214 / `--ailow-sobre-marca`) para AA.
- **D-A7** (24/11) Filtro de cor em Produtos: **exato** (jÃ¡ implementado na P01). Arquivos do Marcos (P03): `ailow-cloud/acervo/marcant/catalogo-teste/` (gitignored; NUNCA versionar nem citar trechos em arquivo versionado): `marcant_produtos_mapeados.csv` (29 produtos), `marcant_skus_teste.csv` (110 SKUs), `marcant_catalogo_erp_teste.xlsx`. Separador `;`. Dados SIMULADOS (ambiente = HOMOLOGACAO, fonte = "FICTÃCIO â€” TESTE"): carregar sÃ³ no dev / tenant de teste.
- AsserÃ§Ãµes de teste existentes que **podem** mudar (e sÃ³ elas, citando a decisÃ£o no commit): `chrome-marca.test.ts` (wordmark, posiÃ§Ã£o do badge) e `pwa.test.ts` (nome) â† D-A3/M03; `selo-perfil.test.ts` / `selo-perfil.e2e.ts` (avatar `--ailow-acao` â†’ `--ailow-marca`) â† D-A6/M05; `inicio-dnd-ui.test.ts` (alÃ§a) â† D-A1; `cartao-peca-venda-ui.test.ts`, `selo-estoque-venda.test.ts` (cor/posiÃ§Ã£o) â† V02. Qualquer outra â‡’ PARAR e relatar.

## Contrato de toda sessÃ£o (subagente)
1. **Abrir em camadas:** este Contrato + o bloco da sessÃ£o (`### XNN`) + Estado de retomada + Ãºltima entrada do diÃ¡rio + `D:\apps\harness\aprendizado\licoes-ativas.md`. Declarar o gate (tipo, tier B, IDs, critÃ©rios).
2. **Estado real:** `git -C <worktree> log -1 --oneline` = commit esperado no prompt, senÃ£o PARE. `git status` limpo (CRLF nÃ£o conta).
3. **Regras duras:** sem migraÃ§Ã£o, GRANT, RLS ou schema; sem `git stash`/`checkout`/`reset`; cÃ³digo sÃ³ com Write/Edit (nunca `node -e`/heredoc/sed â€” L-0002); nÃ£o alterar teste fora da lista das DecisÃµes; nÃ£o ler `.env`/`acervo/bruto`/`transcricoes`; dependÃªncia nova sÃ³ com versÃ£o conferida na doc oficial. **Se algo disso for inevitÃ¡vel: PARE e relate como decisÃ£o do Pedro.**
4. **Test-first:** teste vermelho pelo motivo certo â†’ cÃ³digo â†’ verde. CritÃ©rio mensurÃ¡vel = evidÃªncia de cÃ³digo que exercita o comportamento real (L-0017).
5. **Verificar:** `npm run verify` (raiz) verde antes do commit; mexeu em rota/contrato/`packages/shared` â‡’ suÃ­te inteira da API + `npm run build:shared` (L-0026). UI â‡’ medir em 360Ã—640 nos 2 temas `scrollWidth â‰¤ clientWidth` e fim dos elementos vs contÃªiner que recorta (L-0015) + screenshot salvo na scratchpad.
6. **Servidores:** ao parar dev/preview, liberar portas de verdade (L-0012).
7. **Fechar:** 1 commit Conventional (`feat(web): â€¦`, corpo cita a sessÃ£o e decisÃµes) + relatÃ³rio ao orquestrador (arquivos tocados, testes novos, evidÃªncia colada, dÃºvidas). NÃ£o abrir PR, nÃ£o dar push, **nÃ£o escrever no diÃ¡rio** (o orquestrador escreve, para nÃ£o conflitar entre branches paralelas).

## Fechamento de onda (orquestrador)
Revisar o diff inteiro (nÃ£o sÃ³ o relatÃ³rio, L-0024) â†’ `npm run verify` â†’ `bash scripts/e2e.sh` (ambiente do CI, L-0025) â†’ screenshots 360 claro/escuro â†’ CHANGELOG + versÃ£o minor â†’ pedir ao Pedro push + PR (template, issue) â†’ sobrescrever Estado de retomada â†’ liÃ§Ãµes (MC) se algo falhou.

## Ondas e sessÃµes

### Onda 1 â€” Marca e topo Â· branch `feat/ux-marca-topo`

### M01 â€” Ãcone e splash escuros Â· opus
Escopo: fundo Ãºnico `#111214` (o do cartÃ£o do ailow-index) no Ã­cone e na abertura. Regerar `apps/web/public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png` a partir de `public/logo.svg` (A ciano), sem moldura de outra cor; maskable com o A na zona segura (80%). Reescrever `apps/web/scripts/gerar-icones.mjs` para isso (referÃªncia: `D:\apps\ailow-index\scripts\icones.mjs`; usar `sharp` sÃ³ se jÃ¡ estiver no lockfile, senÃ£o PARE). `manifest.webmanifest` `background_color`/`theme_color` e `<meta name="theme-color">` = `#111214`.
Pronto quando: teste lÃª os PNG e confere o pixel (0,0) e o centro-borda = `#111214` nos 4 arquivos; manifest/index iguais; canÃ¡rio (trocar 1 cor) reprova.
NÃ£o fazer: nome do app (M02), cor do A, tema do app.

### M02 â€” "Ailow Cloud" + wordmark em 2 linhas Â· opus
Escopo: `Moldura.tsx` topo = `<Logo altura={36}>` + bloco de 2 linhas com altura total â‰ˆ 36 px, alinhado ao A: "Ailow" (fw 700) e "Cloud" (tom `--ailow-marca` ou dimmed, fw 500) â€” simÃ©trico com o Ã­cone. Nome "Ailow Cloud" em `manifest` (`name`/`short_name`), `index.html` (`<title>`, `apple-mobile-web-app-title`), `App.tsx:182` e `catalogo/Catalogo.tsx:76`. Atualizar sÃ³ as asserÃ§Ãµes de nome/wordmark em `chrome-marca.test.ts` e `pwa.test.ts` (D-A3).
Pronto quando: testes novos verdes; 360 px nos 2 temas sem rolagem horizontal com toolbar cheia (Dono: avatar+trocar+tema); screenshot.
NÃ£o fazer: badge/Ã­cones da toolbar (M03), seta/tÃ­tulo (M04).

### M03 â€” Badge de perfil, Trocar e Sair Â· opus
Escopo (`componentes/sessao.tsx`): badge "Dono/Vendedor" sai do topo colado na borda; vai para **baixo-centro** do avatar (sobrepondo a borda inferior), cor **diferente** do avatar (avatar usa `--ailow-marca`; badge com tom de contraste, ex. `ambar` ou neutro forte â€” checar contraste AA em `tema/contraste.ts`), sem encostar no limite do header (64 px). Ãcone de Trocar: setas de ida e volta + pessoa (candidatos `IconUsersArrows`/`IconArrowsExchange`/`IconUserShare` â€” **conferir que existe em `node_modules/@tabler/icons-react` 3.51.0**); `aria-label` "Trocar de usuÃ¡rio". Sair continua no menu com Ã­cone de saÃ­da (`IconLogout`) e vermelho.
Pronto quando: mediÃ§Ã£o: badge inteiro dentro do header e do botÃ£o (bounding boxes) nos 2 temas; contraste â‰¥ 4,5:1; teste de fonte atualizado (D-A3/M03).
NÃ£o fazer: lÃ³gica de sessÃ£o/troca.

### M04 â€” Topo de mÃ³dulo compacto Â· opus
Escopo (`telas/Moldura.tsx`, afeta os 33 usos de `voltar`): seta de voltar e `<h1>` **na mesma linha** (Group nowrap): seta 48 px Â· divisor vertical sutil Â· tÃ­tulo (fz ~22, quebra com `overflowWrap: anywhere`, nunca reticÃªncias â€” D23). SubtÃ­tulo abaixo. Sem `voltar`, layout atual.
Pronto quando: E2E `voltar-modulos`, `navegacao` verdes; mediÃ§Ã£o em 360 de Compras, Produtos, Financeiro, Novo produto: tÃ­tulo comeÃ§a Ã  direita da seta, ganho vertical â‰¥ 40 px vs `main` (medir `top` do 1Âº conteÃºdo); screenshot.
NÃ£o fazer: mudar rotas ou rÃ³tulos.

### Onda 2 â€” InÃ­cio e Nova venda Â· branch `feat/ux-inicio-venda`

### V01 â€” Arrastar pelo bloco inteiro com toque longo Â· sonnet
Escopo (`telas/Inicio.tsx`): listeners do `useSortable` no bloco inteiro; `PointerSensor` com `activationConstraint: { delay: 500, tolerance: 5 }` (**conferir na doc do @dnd-kit/core 6.x**; ver se `TouchSensor` Ã© necessÃ¡rio no Android). Toque curto continua abrindo o mÃ³dulo; depois de arrastar, **nÃ£o** abre. `-webkit-touch-callout:none; user-select:none` no bloco. Teclado: manter `KeyboardSensor` acessÃ­vel (alÃ§a visÃ­vel sÃ³ no foco ou botÃ£o "Reordenar" por teclado). PersistÃªncia atual (ADR 018) intacta.
Pronto quando: E2E (Playwright, mouse/touch): segurar 600 ms + mover reordena e persiste apÃ³s reload; toque de 100 ms abre o mÃ³dulo; segurar 200 ms + mover **nÃ£o** reordena (canÃ¡rio); `venda-toques.e2e` verde.
NÃ£o fazer: visual dos blocos.

### V02 â€” Card da peÃ§a: quantidade junto do preÃ§o + selo verde Â· opus
Escopo (`telas/vendas/CartaoPecaVenda.tsx`, `selo-estoque-venda.ts`): coluna direita = preÃ§o em cima e, quando no carrinho, stepper âˆ’/qtd/+ logo abaixo, alinhado Ã  direita. `selo-estoque-venda` devolve tom: `ok` (verde, "12 em estoque"), `baixo` (Ã¢mbar + alerta, igual hoje), `zerado` (vermelho/cinza). Alvo de toque â‰¥ 40 px mantido.
Pronto quando: testes do tom (3 casos + limite = mÃ­nimo); 360 px nos 2 temas: stepper nÃ£o estoura o card (L-0015), contraste do verde AA; screenshot com 1 peÃ§a no carrinho.
NÃ£o fazer: lÃ³gica do carrinho.

### V03 â€” "Novo produto" no meio das aÃ§Ãµes da Nova venda Â· sonnet
Escopo (`telas/vendas/MontarVenda.tsx`): aÃ§Ã£o "Novo produto" (`IconPlus`) **no centro** da 1Âª linha: Escanear Â· Novo produto Â· CatÃ¡logo; depois Gerenciar/Finalizar. **SÃ³ Dono** (a rota de criar Ã© `soDono`). Abre o assistente de Novo produto e, ao salvar ou cancelar, volta Ã  Nova venda **com o carrinho intacto** (conferir onde o carrinho vive antes de navegar; se exigir mudar o estado global, PARE e relate). Vendedor nÃ£o vÃª o botÃ£o.
Pronto quando: E2E Dono cria produto a partir da venda e volta com o carrinho; Vendedor nÃ£o vÃª; `venda-toques.e2e` (â‰¤ 8 toques) verde.
NÃ£o fazer: mudar o assistente de produto.

### Onda 3 â€” Produtos Â· branch `feat/produtos-catalogo-filtros`

### P01 â€” Filtros na API de produtos Â· sonnet
Escopo: `produtosQuerySchema` (`packages/shared/src/produtos.ts`) ganha `categoria_id` (uuid) e `cor` (texto curto) opcionais, combinÃ¡veis com `q` e o cursor (ADR 016); `apps/api/src/produtos` aplica (SQL parametrizado, via `withEmpresa`); regerar `docs/openapi.json`. Custo do `GET /produtos` (S13b2): rodar `EXPLAIN` no teste ou relatar; Ã­ndice novo = migraÃ§Ã£o â‡’ PARE.
Pronto quando: testes de integraÃ§Ã£o: filtro por categoria, por cor (sem acento/maiÃºsc.), combinado com `q`, paginaÃ§Ã£o estÃ¡vel, isolamento entre 2 empresas; `lint:openapi` e `openapi.test.ts` verdes.
NÃ£o fazer: UI.

### P02 â€” Produtos: Lista | CatÃ¡logo + Filtros Â· opus
Escopo (`telas/produtos/Produtos.tsx`): nas aÃ§Ãµes, alternÃ¢ncia **Lista** (atual) e **CatÃ¡logo** (grade em widgets como na venda â€” reaproveitar cards/Ã­cones de `vendas/WizardCatalogo.tsx`/`icone-categoria.ts` em modo navegaÃ§Ã£o, sem carrinho; toque abre o detalhe). BotÃ£o **Filtros** (Drawer/Modal) com categoria e cor (usa P01), chips dos filtros ativos com "limpar". PreferÃªncia Lista/CatÃ¡logo pode ficar local.
Pronto quando: E2E: filtrar por categoria e por cor muda o resultado; alternar visÃ£o mantÃ©m filtros; 360 px nos 2 temas; screenshot das 2 visÃµes.
NÃ£o fazer: API (P01), ediÃ§Ã£o de produto.

### P03 â€” ðŸš¦ Carga dos produtos do Marcos Â· sonnet
PrÃ©-requisito: Pedro informa o caminho dos arquivos (extraÃ§Ã£o com ChatGPT). Escopo: mapear para o formato de `apps/api/scripts/seed-marcant-via-api.mjs` (categorias, eixos, SKUs, preÃ§o em centavos â€” RN-01), relatÃ³rio de linhas rejeitadas, rodar **sÃ³ no dev**. Arquivo do cliente fica fora do repo (acervo Ã© local; repo Ã© pÃºblico).
Pronto quando: contagem importada = contagem do arquivo âˆ’ rejeitadas (listadas); produtos aparecem em Produtos e na venda.
NÃ£o fazer: produÃ§Ã£o (carga na VPS = mudanÃ§a em produÃ§Ã£o, pedido separado + AUD).

### Onda 4 â€” Teclado Â· branch `fix/teclado-formularios`

### T01 â€” Teclado menor e "Continuar" sempre visÃ­vel Â· sonnet
Escopo: `index.html` viewport + `interactive-widget=resizes-content` (conferir suporte na doc do Chrome/MDN); nos 68 campos (`TextInput`/`NumberInput`/â€¦): `autoComplete="off"` onde nÃ£o Ã© dado pessoal do prÃ³prio usuÃ¡rio, tokens corretos onde Ã© (`tel`, `name` no cliente? decidir caso a caso e listar), `inputMode` (`decimal`/`numeric`) em dinheiro, quantidade e PIN; rodapÃ© do `componentes/Assistente.tsx` (Voltar/Continuar) visÃ­vel com teclado aberto.
Pronto quando: teste de fonte que reprova campo sem `autoComplete` explÃ­cito; E2E em 360Ã—400 (simula teclado): botÃ£o Continuar dentro da viewport em Novo produto, Nova despesa, Fechamento. **Limite honesto:** a barra do Gboard/Chrome (cartÃ£o, endereÃ§o) Ã© do navegador e pode nÃ£o sumir 100% â€” ðŸš¦ Pedro valida no celular.
NÃ£o fazer: redesenho de telas.

### Onda 5 â€” Financeiro visÃ­vel Â· branch `feat/financeiro-visivel`

### F01 â€” Provar vendaâ†’entrada e compraâ†’contas a pagar Â· sonnet
Escopo: auditoria de leitura de `apps/api/src/vendas/vendas.ts:205-221` e `compras/compras.ts:226-285` + testes que faltarem: venda com 2 formas â‡’ 2 lanÃ§amentos `entrada` `pago` na data, categoria Vendas, somando o total; cancelar â‡’ estornos; receber compra com N parcelas â‡’ N `saida` `aberto` com vencimento, listados em contas a pagar; tudo atÃ´mico (falha no meio â‡’ nada gravado). E2E: venda aparece no relatÃ³rio do Financeiro; compra recebida em Contas a pagar.
Pronto quando: relatÃ³rio "implementado / lacuna" com evidÃªncia; lacuna real vira teste vermelho + correÃ§Ã£o mÃ­nima (sem schema).
NÃ£o fazer: UI (F02), venda a prazo (D-A2).

### F02 â€” Assistentes mostram o financeiro + parcelas no receber Â· opus
Escopo: Fechamento da venda (`vendas/Fechamento.tsx`) e comprovante: linha "Entra no financeiro hoje: R$ X (Pix) â€¦"; Receber pedido (`compras/Pedidos.tsx:~200`) passa de 1 parcela fixa para **N parcelas** (valor + vencimento, soma = total, `parcelasFecham` de `packages/shared`), com resumo "Gera N contas a pagar"; toasts de sucesso apontam para Financeiro.
Pronto quando: E2E receber com 3 parcelas â‡’ 3 em Contas a pagar; soma divergente bloqueada com toast; `receber-compra.e2e` e `venda-toques.e2e` verdes; 360 px.
NÃ£o fazer: API nova.

## Ordem e paralelismo
Serial dentro da onda (mesma branch). Em paralelo sÃ³ o que nÃ£o toca os mesmos arquivos: **P01** pode rodar junto da Onda 1; **F01** junto da Onda 2. Ordem: Onda 1 â†’ 2 â†’ 3 â†’ 4 â†’ 5. Worktree manual por onda (`git worktree add -b <branch> D:\apps\_wt-<onda> <commit>`; L-0031), caminho absoluto e commit esperado no prompt.

## Modelo do prompt do subagente
```text
SessÃ£o XNN â€” <tÃ­tulo> (plano "Aprimoramentos voz 23/11").
Worktree: <abs> Â· commit esperado no topo: <sha> (se nÃ£o for, PARE).
Plano: D:\apps\ailow-cloud\docs\planos\aprimoramentos-voz-2026-11-23\plano.md
Leia SÃ“: DecisÃµes, Contrato, "### XNN", Estado de retomada; e a Ãºltima entrada de diario/ATUAL.md.
Regras duras do Contrato Â§3 valem integralmente. Se inevitÃ¡vel: PARE e relate.
Pronto quando: <copiar>. NÃ£o fazer: <copiar>.
Ao terminar: 1 commit + relatÃ³rio (arquivos, testes, evidÃªncia, dÃºvidas). NÃ£o escreva no diÃ¡rio.
```

### Estado de retomada — 2026-11-24 (sobrescrever a cada sessão)
- **Ondas 2–5 concluídas** na `origin/main` (`aa9c0e9`): #47 (1.7.0), #48 (1.8.0), #49 (1.8.1), #50 (1.9.0). Tag `v1.9.0` publicada (imagens no GHCR).
- **Deploy:** https://github.com/ailowio/ailow-cloud/actions/runs/45353314602 — job `implantar em producao` **waiting** no Environment `producao`. 🚦 Pedro Approve (L-0027). Orquestrador NÃO aprovou.
- **Pendente do Pedro:** Approve do Deploy; validar teclado (T01) no celular; P03 cor padrão / categorias (só dev).
- **Conhecido:** `e2e.sh` deixa `vite preview` órfão (L-0012); vencimentos de parcelas no receber precisam ser distintos.
