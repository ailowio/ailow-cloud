# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Template:
```text
### XNN — <título> — <AAAA-MM-DD> — <LLM do subagente> / orquestrador Opus 5.5
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + commit/PR.
```

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### F01 + M02 — 2026-11-23 — Sonnet (F01) / Opus (M02) · orquestrador Opus 5.5
Feito: F01 (`feat/financeiro-visivel` b7f45ed): sem lacuna no código; 5 testes de integração novos provam venda em 2 formas → 2 entradas pagas no relatório, cancelamento zera, receber 3 parcelas → 3 contas a pagar, atomicidade do receber, RN-10. M02: "Ailow Cloud" no manifest, `<title>`, App, catálogo, sw (comentário); topo com wordmark Ailow/Cloud em 2 linhas; asserções D-A3 alteradas (chrome-marca, pwa.test) + `nome-app.test.ts`.
Números: F01 mutação (categoria/paga) reprovou 3 testes. M02 verify 894/518/265 verdes.
Falha: o subagente da M02 caiu por erro de rede antes do verify; orquestrador revisou o diff, viu os screenshots 360 (claro/escuro), parou dev:db/dev:api órfãos (portas livres), rodou verify e commitou. Vermelho→verde da M02 não registrado.
Pendências: M03 → M04; P02 depois da Onda 1 (portas); decisão do fundo escuro do tema.
Verificação: verify exit 0; screenshots `m02-topo-*.png` na scratchpad.

### M03 + M04 — 2026-11-24 — Opus (subagentes) · orquestrador Opus 5.5
Feito: M03 (53961fd): selo de perfil no baixo-centro do avatar, neutro forte (`--ailow-selo`), Trocar = `IconReplaceUser`, Sair = `IconDoorExit`; corrigiu o avatar que saía cinza (placeholder do Mantine) para `--ailow-acao`. M04: seta (default, 48 px) · divisor · h1 22 px na mesma linha em todas as telas com `voltar`; título longo quebra sem mover a seta; Entrar usa `IconReplaceUser`.
Números: M03 contraste do selo 12,9:1 / 10,2:1; M04 verify 894/533/265.
Falha: subagente da M04 parou no limite de uso do Opus depois dos testes vermelhos; o orquestrador implementou o `Moldura.tsx`, rodou os E2E e fechou. `voltar-modulos.e2e` tinha "Ailow ERP" como título de carregamento (resto da M02/D-A3): trocado para "Ailow Cloud". 2 casos de assistente (novo produto/pedido) falham só no dev desta worktree por falta de categoria/fornecedor no seed (L-0025): confirmar no `scripts/e2e.sh`.
Pendências: fechamento da Onda 1 (e2e.sh, CHANGELOG, push/PR com ok do Pedro); decisões: fundo escuro do tema, cor do avatar, cor exata no filtro.
Verificação: `topo-modulo.e2e` + `navegacao` + `uxm-pessoas` verdes no dev; `voltar-modulos` 19/21 (2 por dado do dev).

### M05 — tema index + avatar ciano — 2026-11-24 — Composer · sessão Cursor
Feito: `tema.css` alinhado ao ailow-index (D-A5): body/superfície/borda/topo; `superficie-2` #292d32 / #f2f2ef. Avatar `--ailow-marca` + `--ailow-sobre-marca` #111214 (D-A6). Plano: D-A5/D-A6/D-A7; CHANGELOG 1.6.1.
Números: paleta+selo 6 vermelhos → 47 verdes; contraste AA mantido (ajuste de token de texto não necessário).
Decisões aplicadas: D-A5, D-A6; D-A7 só registrada (P01 já exato). Asserção avatar `--ailow-acao` → marca (autorizada).
Pendências: e2e.sh + push/PR (Pedro); Onda 2.
Verificação: screenshots 360×640 em `_scratch/m05-capturas/`; E2E paleta/selo-perfil/topo-modulo.
