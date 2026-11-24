# Diário arquivado — entradas antigas, intactas

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
