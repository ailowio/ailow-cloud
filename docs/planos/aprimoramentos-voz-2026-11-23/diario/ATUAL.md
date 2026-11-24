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

### Planejamento — 2026-11-23 — Claude Opus 5.5 (orquestrador)
Feito: áudio transcrito (AssemblyAI, 491 s, confiança 0,98; fora do repo); 14 pedidos mapeados no código; plano com 5 ondas e 13 sessões.
Achados: venda já gera entrada paga por forma (D10) e compra recebida já gera contas a pagar por parcela; a UI de receber só aceita 1 parcela; `GET /produtos` só filtra por `q`.
Decisões: D-A1 500 ms · D-A2 manter D10 + provar · D-A3 "Ailow Cloud" · D-A4 1 PR por onda.
Pendências: ok do Pedro no plano; caminho dos arquivos do Marcos (P03).
Verificação: plano medido (`wc -c`).
