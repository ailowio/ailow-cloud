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

### M05 — tema index + avatar ciano — 2026-11-24 — Composer · sessão Cursor
Feito: `tema.css` alinhado ao ailow-index (D-A5): body/superfície/borda/topo; `superficie-2` #292d32 / #f2f2ef. Avatar `--ailow-marca` + `--ailow-sobre-marca` #111214 (D-A6). Plano: D-A5/D-A6/D-A7; CHANGELOG 1.6.1. Commit `d0a75d9`.
Números: paleta+selo 6 vermelhos → 47 verdes; verify 894/539/265; contraste AA mantido.
Decisões: D-A5, D-A6; D-A7 só registrada (P01 já exato). Asserção avatar `--ailow-acao` → marca (D-A6).
Pendências: push/PR (Pedro); Onda 2.
Verificação: screenshots `_scratch/m05-capturas/`; e2e.sh rodada1 129/130 (cadastros-wizard light intermitente, igual Onda 1); rodada2 **130/130**.

### V01 — toque longo no bloco · 2026-11-24 — Composer · orquestrador
Feito: `Inicio.tsx` — listeners no bloco inteiro; `PointerSensor` `{ delay: 500, tolerance: 5 }` (D-A1); `role="group"`; alça só no `:focus-within`; click bloqueado após arraste. E2E `inicio-dnd.e2e.ts`.
Números: unit 2 vermelhos → 3 verdes; e2e inicio-dnd 3/3 + venda-toques 1/1; verify 894/540/265.
Decisões: D-A1; asserção `inicio-dnd-ui` atualizada.
Pendências: V02 → V03; fechar Onda 2.
Verificação: verify exit 0; Playwright local verde. Commit `44e01e7`.

### V02 — card peça + selo · 2026-11-24 — Composer · orquestrador
Feito: coluna direita = preço + stepper (−/qtd/+ size 40); `tomEstoqueVenda` ok/baixo/zerado (teal/âmbar/red); rótulo "Zerado"; contraste teal AA. Capturas `_scratch/onda2-capturas/v02-cartao-{dark,light}.png` (stepper dentro do card, sem overflow).
Números: verify 894/542/265.
Decisões: asserções `cartao-peca-venda-ui` + `selo-estoque-venda` atualizadas (lista D-A1/V02).
Pendências: V03; fechar Onda 2 (e2e.sh, CHANGELOG 1.7.0, PR).
Verificação: verify exit 0; medição 360×640 2 temas ok.
