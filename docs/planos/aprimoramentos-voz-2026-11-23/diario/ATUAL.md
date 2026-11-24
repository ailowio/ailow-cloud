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

### M03 + M04 — 2026-11-24 — Opus (subagentes) · orquestrador Opus 5.5
Feito: M03 (53961fd): selo de perfil no baixo-centro do avatar, neutro forte (`--ailow-selo`), Trocar = `IconReplaceUser`, Sair = `IconDoorExit`; corrigiu o avatar que saía cinza (placeholder do Mantine) para `--ailow-acao`. M04: seta (default, 48 px) · divisor · h1 22 px na mesma linha em todas as telas com `voltar`; título longo quebra sem mover a seta; Entrar usa `IconReplaceUser`.
Números: M03 contraste do selo 12,9:1 / 10,2:1; M04 verify 894/533/265.
Falha: subagente da M04 parou no limite de uso do Opus depois dos testes vermelhos; o orquestrador implementou o `Moldura.tsx`, rodou os E2E e fechou. `voltar-modulos.e2e` tinha "Ailow ERP" como título de carregamento (resto da M02/D-A3): trocado para "Ailow Cloud". 2 casos de assistente (novo produto/pedido) falham só no dev desta worktree por falta de categoria/fornecedor no seed (L-0025): confirmar no `scripts/e2e.sh`.
Pendências: fechamento da Onda 1 (e2e.sh, CHANGELOG, push/PR com ok do Pedro); decisões: fundo escuro do tema, cor do avatar, cor exata no filtro.
Verificação: `topo-modulo.e2e` + `navegacao` + `uxm-pessoas` verdes no dev; `voltar-modulos` 19/21 (2 por dado do dev).

### M05 — tema index + avatar ciano — 2026-11-24 — Composer · sessão Cursor
Feito: `tema.css` alinhado ao ailow-index (D-A5): body/superfície/borda/topo; `superficie-2` #292d32 / #f2f2ef. Avatar `--ailow-marca` + `--ailow-sobre-marca` #111214 (D-A6). Plano: D-A5/D-A6/D-A7; CHANGELOG 1.6.1. Commit `d0a75d9`.
Números: paleta+selo 6 vermelhos → 47 verdes; verify 894/539/265; contraste AA mantido.
Decisões: D-A5, D-A6; D-A7 só registrada (P01 já exato). Asserção avatar `--ailow-acao` → marca (D-A6).
Pendências: push/PR (Pedro); Onda 2.
Verificação: screenshots `_scratch/m05-capturas/`; e2e.sh rodada1 129/130 (cadastros-wizard light intermitente, igual Onda 1); rodada2 **130/130**.

### V01 — toque longo no bloco · 2026-11-24 — Composer · orquestrador
Feito: `Inicio.tsx` — listeners no bloco inteiro; `PointerSensor` `{ delay: 500, tolerance: 5 }` (D-A1; doc @dnd-kit/core 6.x); `role="group"` no wrapper (evita 2 botões "Vendas"); alça visual só no `:focus-within`; click bloqueado após arraste. E2E `inicio-dnd.e2e.ts` (100 ms abre / 600 ms reordena+persiste / 200 ms canário). Sem `TouchSensor` à parte (Pointer cobre touch).
Números: unit 2 vermelhos → 3 verdes; e2e inicio-dnd 3/3 + venda-toques 1/1; verify 894/540/265.
Decisões: D-A1 aplicada; asserção `inicio-dnd-ui` atualizada.
Pendências: V02 → V03; fechar Onda 2 (e2e.sh, CHANGELOG 1.7.0, PR).
Verificação: verify exit 0; Playwright local verde.
