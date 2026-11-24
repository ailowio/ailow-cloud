# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### P02 — Produtos: Lista | Catálogo + Filtros · 2026-11-24 — Opus (subagente) · orquestrador
Feito: `api.produtos` aceita `{ q, depois, categoria_id, cor }` (a forma `(q, depois)` segue valendo). Barra Lista|Catálogo (preferência local) + Filtros (modal: categoria e cor exata, D-A7) + chips com "limpar"; filtro remonta a lista e vai à API na 1ª página, no "Carregar mais" e na busca. Catálogo = tile `Opcao` + ícones do WizardCatalogo, toque abre o DetalheProduto. `Produtos.tsx` 308→262 linhas (CartaoProduto e AbaixoDoMinimo em arquivos próprios).
Números: web 542→552 (10 novos); verify 910/552/265. E2E `produtos-filtros` 3/3; canários (filtro fora da 1ª carga; tile sem quebra) reprovaram.
Decisões: opções de categoria/cor = cadastro (só Dono lê) ∪ o que está nos produtos (Vendedor). Tile `Opcao` passou a quebrar o preço abaixo de nome longo (afeta também a venda).
Pendências: corrida do Modal com Voltar < ~400 ms após abrir (router em transição); selo "3 EM ESTOQ…" cortado no tile de 2 colunas (já na venda); P03.
Verificação: capturas `_scratch/onda3-capturas/p02-*`; produtos-crud, grade-popup, paginacao-360, venda-toques, navegacao verdes.

### P03 + fecho Onda 3 · 2026-11-24 — Composer · orquestrador
P01 (nota): 16 testes de integração em `produtos-filtros.test.ts`; verify verde no agente anterior (`71e97e8`).
Feito: `apps/api/scripts/converter-marcant-csv.ts` (só local/dev): CSV `;` → formato do `seed-marcant-via-api.mjs`; preço em centavos ("24.9"→2490), cor sem "(simulado)", "A DEFINIR"→vazio, cód. de barras vazio fica vazio; SKU validado com `skuNovoSchema`; 1 produto por produto_id+porte; relatório linhas/importadas/rejeitadas com motivo. Testes só sintéticos (25). CHANGELOG 1.8.0. Commit `69b94d5`.
Números (arquivos locais, só contagens): 29 produtos / 110 SKUs → padrão: 16 SKUs em 2 produtos, 98 rejeitadas (4 categorias fora do seed, 4 SKUs delas, 90 SKUs sem cor); com `--cor-padrao`: 106 SKUs em 44 produtos, 8 rejeitadas, 92 avisos. Importadas + rejeitadas = 110 nos 2 modos.
Decisões: SKU sem cor é rejeitado; `--cor-padrao` é opt-in (🚦 Pedro escolhe). Seed não rodado (nem dev nem produção).
Pendências: 🚦 Pedro: cor padrão? categorias fora do seed? seed ler o JSON (`--saida`) e carga no dev; `e2e.sh` usa contêiner `ailow-e2e-db` fixo (colide entre worktrees); `vite preview` órfão de `_wt-inicio-venda` na 4174 (L-0012).
Verificação: verify 935/552/265; `e2e.sh` 138/138 (portas 4184/3014/15444 por causa do órfão).

### T01 — Teclado menor e Continuar à vista · 2026-11-24 — agente (sessão única) · orquestrador
Feito: viewport `interactive-widget=resizes-content` (MDN + blog Chrome 108: padrão `resizes-visual`; Chrome Android, não iOS). Fechamento: Finalizar em `.ailow-rodape-fixo` (sticky). 37 campos ganharam `autoComplete` (76 no total, todos explícitos); PIN `oneTimeCode={false}`; "Valor da parcela" `inputMode=decimal`. CHANGELOG 1.8.1.
Decisões (PR): token só no dado da própria empresa/usuário — Empresa `organization`/`street-address` (novos), `tel`; Entrar `username`/`current-password`. O resto `off` (clientes, fornecedores, vendedores, produto, valores, buscas, motivos, filtros). Lista campo a campo no corpo do commit.
Números: web 552→556 (`teclado-campos.test.ts` 4); E2E `teclado-360x400` 3/3 (vermelho antes só no Fechamento: Finalizar y=774, área até 371). verify 935/556/265; `e2e.sh` **141/141**.
Limites: `NumberInput` do Mantine 9.7.3 força `inputMode="decimal"`; barra do Gboard/Chrome pode não sumir com `off`; 🚦 Pedro valida no celular.
Pendências: `e2e.sh` deixa `vite preview` órfão a cada execução (o `kill` do Git Bash não mata o node.exe; L-0012).
Verificação: capturas `_scratch/onda4-capturas/` (Fechamento 640/400 claro/escuro; Nova despesa 400); `scrollWidth ≤ clientWidth`.
