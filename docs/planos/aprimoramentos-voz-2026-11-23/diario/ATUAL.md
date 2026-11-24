# Diário ativo — Aprimoramentos voz 23/11 (as 3 últimas entradas)

> Quem escreve: **o orquestrador**, a partir do relatório do subagente e do diff revisado. Entrada ≤ 2 KB; passou de 3 entradas ou ~8 KB, mover as antigas (sem editar) para `ARQUIVO-*.md`.

Arquivo (ler só sob demanda): `diario/ARQUIVO-planejamento.md`.

### V01 — toque longo no bloco · 2026-11-24 — Composer · orquestrador
Feito: listeners no bloco; PointerSensor delay 500 / tolerance 5 (D-A1); E2E inicio-dnd + venda-toques.
Números: verify 894/540/265. Commit `44e01e7`.
Pendências: V02→V03; fechar Onda 2.
Verificação: verify + Playwright verde.

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
