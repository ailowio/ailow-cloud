# Diário arquivado — entradas antigas, intactas

### V03 + fecho Onda 2 · 2026-11-24 — Composer · orquestrador
Feito: Novo produto no centro (só Dono); assistente embutido; grade `densidade=compacta` (paginação ok). CHANGELOG 1.7.0. Commits V01–V03 + fix compacta.
Números: e2e.sh r1 134/135 (uxm-pessoas light intermitente); r2 **135/135**.
Decisões: montar-venda-ui + grade-popup atualizados (V03).
Pendências: PR/merge Onda 2 → Onda 3.
Verificação: e2e.sh 135/135.

### V02 — card peça + selo · 2026-11-24 — Composer · orquestrador
Feito: stepper à direita do preço; tom ok/baixo/zerado (teal/âmbar/red). Capturas `onda2-capturas/v02-*`.
Números: verify 894/542/265. Commit `225a3a9`.
Pendências: V03; fechar Onda 2.
Verificação: verify + medição 360×640 ok.

### V01 — toque longo no bloco · 2026-11-24 — Composer · orquestrador
Feito: listeners no bloco; PointerSensor delay 500 / tolerance 5 (D-A1); E2E inicio-dnd + venda-toques.
Números: verify 894/540/265. Commit `44e01e7`.
Pendências: V02→V03; fechar Onda 2.
Verificação: verify + Playwright verde.

### M05 — tema index + avatar ciano — 2026-11-24 — Composer · sessão Cursor
Feito: `tema.css` alinhado ao ailow-index (D-A5): body/superfície/borda/topo; `superficie-2` #292d32 / #f2f2ef. Avatar `--ailow-marca` + `--ailow-sobre-marca` #111214 (D-A6). Plano: D-A5/D-A6/D-A7; CHANGELOG 1.6.1. Commit `d0a75d9`.
Números: paleta+selo 6 vermelhos → 47 verdes; verify 894/539/265; contraste AA mantido.
Decisões: D-A5, D-A6; D-A7 só registrada (P01 já exato). Asserção avatar `--ailow-acao` → marca (D-A6).
Pendências: push/PR (Pedro); Onda 2.
Verificação: screenshots `_scratch/m05-capturas/`; e2e.sh rodada1 129/130 (cadastros-wizard light intermitente, igual Onda 1); rodada2 **130/130**.

### M03 + M04 — 2026-11-24 — Opus (subagentes) · orquestrador Opus 5.5
Feito: M03 (53961fd): selo de perfil no baixo-centro do avatar, neutro forte (`--ailow-selo`), Trocar = `IconReplaceUser`, Sair = `IconDoorExit`; corrigiu o avatar que saía cinza (placeholder do Mantine) para `--ailow-acao`. M04: seta (default, 48 px) · divisor · h1 22 px na mesma linha em todas as telas com `voltar`; título longo quebra sem mover a seta; Entrar usa `IconReplaceUser`.
Números: M03 contraste do selo 12,9:1 / 10,2:1; M04 verify 894/533/265.
Falha: subagente da M04 parou no limite de uso do Opus depois dos testes vermelhos; o orquestrador implementou o `Moldura.tsx`, rodou os E2E e fechou. `voltar-modulos.e2e` tinha "Ailow ERP" como título de carregamento (resto da M02/D-A3): trocado para "Ailow Cloud". 2 casos de assistente (novo produto/pedido) falham só no dev desta worktree por falta de categoria/fornecedor no seed (L-0025): confirmar no `scripts/e2e.sh`.
Pendências: fechamento da Onda 1 (e2e.sh, CHANGELOG, push/PR com ok do Pedro); decisões: fundo escuro do tema, cor do avatar, cor exata no filtro.
Verificação: `topo-modulo.e2e` + `navegacao` + `uxm-pessoas` verdes no dev; `voltar-modulos` 19/21 (2 por dado do dev).

### F01 + M02 — 2026-11-23 — Sonnet (F01) / Opus (M02) · orquestrador Opus 5.5
Feito: F01 (`feat/financeiro-visivel` b7f45ed): sem lacuna no código; 5 testes de integração novos provam venda em 2 formas → 2 entradas pagas no relatório, cancelamento zera, receber 3 parcelas → 3 contas a pagar, atomicidade do receber, RN-10. M02: "Ailow Cloud" no manifest, `<title>`, App, catálogo, sw (comentário); topo com wordmark Ailow/Cloud em 2 linhas; asserções D-A3 alteradas (chrome-marca, pwa.test) + `nome-app.test.ts`.
Números: F01 mutação (categoria/paga) reprovou 3 testes. M02 verify 894/518/265 verdes.
Falha: o subagente da M02 caiu por erro de rede antes do verify; orquestrador revisou o diff, viu os screenshots 360 (claro/escuro), parou dev:db/dev:api órfãos (portas livres), rodou verify e commitou. Vermelho→verde da M02 não registrado.
Pendências: M03 → M04; P02 depois da Onda 1 (portas); decisão do fundo escuro do tema.
Verificação: verify exit 0; screenshots `m02-topo-*.png` na scratchpad.

### P01 + M01 — 2026-11-23 — Sonnet (P01) / Opus (M01) · orquestrador Opus 5.5
Feito: P01 (`feat/produtos-catalogo-filtros` 0d2a61a): `GET /produtos` aceita `categoria_id` e `cor` (exata após tirar acento/caixa/espaços), no mesmo WHERE da busca e do cursor; OpenAPI regerado. M01 (`feat/ux-marca-topo` 8d6caa0): 4 ícones regerados por script sem dependência a partir do `logo.svg`, fundo #111214 de borda a borda; manifest e meta theme-color #111214.
Números: P01 16 testes novos (14 vermelhos → 16 verdes), API 910 testes; M01 14 testes novos (vermelhos → verdes, canário #111215 reprovou 9); verify exit 0 nos dois.
Decisões p/ Pedro: cor exata vs "contém" (P01); ícones "any" viraram quadrado cheio; o corpo do tema escuro segue #1b1c1e (só a abertura ficou #111214).
Pendências: M02 a seguir; P02 depois (UI serial: portas do dev).
Verificação: diff revisado pelo orquestrador (SQL parametrizado, sem migração; PNG conferidos visualmente).

### Planejamento — 2026-11-23 — Claude Opus 5.5 (orquestrador)
Feito: áudio transcrito (AssemblyAI, 491 s, confiança 0,98; fora do repo); 14 pedidos mapeados no código; plano com 5 ondas e 13 sessões.
Achados: venda já gera entrada paga por forma (D10) e compra recebida já gera contas a pagar por parcela; a UI de receber só aceita 1 parcela; `GET /produtos` só filtra por `q`.
Decisões: D-A1 500 ms · D-A2 manter D10 + provar · D-A3 "Ailow Cloud" · D-A4 1 PR por onda.
Pendências: ok do Pedro no plano; caminho dos arquivos do Marcos (P03).
Verificação: plano medido (`wc -c`).
