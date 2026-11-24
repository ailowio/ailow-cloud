# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### V02 — card peça + selo · 2026-11-24 — Composer · orquestrador
Feito: stepper à direita do preço; tom ok/baixo/zerado (teal/âmbar/red). Capturas `onda2-capturas/v02-*`.
Números: verify 894/542/265. Commit `225a3a9`.
Pendências: V03; fechar Onda 2.
Verificação: verify + medição 360×640 ok.

### V03 + fecho Onda 2 · 2026-11-24 — Composer · orquestrador
Feito: Novo produto no centro (só Dono); assistente embutido; grade `densidade=compacta` (paginação ok). CHANGELOG 1.7.0. Commits V01–V03 + fix compacta.
Números: e2e.sh r1 134/135 (uxm-pessoas light intermitente); r2 **135/135**.
Decisões: montar-venda-ui + grade-popup atualizados (V03).
Pendências: PR/merge Onda 2 → Onda 3.
Verificação: e2e.sh 135/135.

### P02 — Produtos: Lista | Catálogo + Filtros · 2026-11-24 — Opus (subagente) · orquestrador
Feito: `api.produtos` aceita `{ q, depois, categoria_id, cor }` (a forma `(q, depois)` segue valendo). Barra Lista|Catálogo (preferência local) + Filtros (modal: categoria e cor exata, D-A7) + chips com "limpar"; filtro remonta a lista e vai à API na 1ª página, no "Carregar mais" e na busca. Catálogo = tile `Opcao` + ícones do WizardCatalogo, toque abre o DetalheProduto. `Produtos.tsx` 308→262 linhas (CartaoProduto e AbaixoDoMinimo em arquivos próprios).
Números: web 542→552 (10 novos); verify 910/552/265. E2E `produtos-filtros` 3/3; canários (filtro fora da 1ª carga; tile sem quebra) reprovaram.
Decisões: opções de categoria/cor = cadastro (só Dono lê) ∪ o que está nos produtos (Vendedor). Tile `Opcao` passou a quebrar o preço abaixo de nome longo (afeta também a venda).
Pendências: corrida do Modal com Voltar < ~400 ms após abrir (router em transição); selo "3 EM ESTOQ…" cortado no tile de 2 colunas (já na venda); P03.
Verificação: capturas `_scratch/onda3-capturas/p02-*`; produtos-crud, grade-popup, paginacao-360, venda-toques, navegacao verdes.
