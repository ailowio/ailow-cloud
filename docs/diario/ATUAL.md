# Diário ativo (as 3 últimas entradas)

> Regras (skill `execucao-em-sessoes`): entrada nova ≤ 2 KB; ao passar de 3 entradas ou ~8 KB, mover as mais antigas, **sem editar**, para `ARQUIVO-*.md`. Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
> Arquivo: `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) e `ARQUIVO-S07-S09.md` (S07 em diante); ler só sob demanda.

Template:
```text
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + link do PR/CI.
```

### Limpeza de pendências (pós-plano; paralelo à S07 no Claude Code) — 2026-11-12 — Composer
Gate: feature logo + bugfix PIN + tooling + docs, **tier B**. Branch `chore/limpeza-pendencias-pos-s07` (worktree; S07 ainda WIP fora desta branch).
Feito:
- **ADR 004 aceito** (código já na main desde S04).
- **RF-CFG-02 logo via UI:** migração `logo_bytes`/`logo_mime` (PNG/JPEG/WebP ≤ 512 KiB, sem SVG); `PUT/DELETE/GET /empresa/logo`; Configurações > Empresa envia/troca/remove; OpenAPI 0.5.1; `@fastify/multipart`.
- **L-0011:** asserção SEC-16 parseia JSON do log (não substring solta em `time`/UUID).
- **`npm run dev:parar`** (L-0012 ação 3).
- **Adiados com dono:** reescrita acervo (Pedro); proxy HTTPS → S14; Safari/iOS → só Chromium por ora; texto 13–14 px aceito; nested virt aceito.
Verificação: `npm run verify` (ver PR).

### S08 — Etiquetas QR — 2026-11-11 — Claude Opus 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, CODE-*, SEC-03, ARQ (ADR 003), CI-01, MC. Decisão do Pedro na sessão: **bobina 33 × 22 mm em 3 colunas** (não 40 × 25), PDF **na API com pdfkit**.
Feito (branch `feature/s08-etiquetas`): `POST /etiquetas` (só Dono) devolve PDF com **uma fileira de 3 por página**; QR vetorial só com o código (versão 1, correção M, zona de 4 módulos, módulo 0,5 mm = 4 pontos a 203 dpi); texto: nome, tamanho em destaque, cor, preço, código; **sem custo nem fornecedor**. Até 999 por PDF; SKU de outra empresa, inexistente ou de produto inativo = 404. Tela "Etiquetas" em Produtos: busca, quantidade por SKU, "Usar o estoque", resumo de fileiras/em branco, download com o dia de São Paulo. ADR 003 **proposto**.
Números: testes API 535 -> 571, web 195 -> 215, shared 136 -> 151; OpenAPI 0.6.0 -> 0.7.0; bundle web +7,5 kB.
Evidência: `verify` exit 0; PDF lido por leitor independente (`pdfjs-dist`); PDF **baixado pelo navegador** rasterizado a 203 dpi: **71/71 QRs decodificados** (`jsqr`, fora do repo); mutação **15/15** pegas; Playwright 360×640 nos 2 temas: 0 rolagem, 0 alvo < 48 px, 0 texto cortado (3 cortes achados só no navegador e corrigidos: L-0015). Pedro testou o PDF: "gerou rápido e funcionou".
Pendências: **(1) impressão física (única):** comprar a bobina, informar o modelo da impressora, imprimir, calibrar (espaço entre colunas 2 mm e margem 1 mm são estimativas; papel 105 × 22 mm; tamanho real 100%) e fotografar a leitura pela câmera, que é o "pronto quando" da S08. (2) Zod já vaza no bundle web da `main` (5 marcas, antes desta sessão). (3) PIN do Dono de dev redefinido para 2468 só no banco local (documentar no seed). (4) Prefixo `etiquetas` no proxy HTTPS da S14.
Aprendizado: L-0015 (rótulo cortado em 360 px, recorrência 2; lição ativa 12; E2E na S13). Falhas corrigidas (detalhe no PR): opção inexistente do pdfjs 6, nome de arquivo só por caixa, data em UTC, heredoc (lição 1). `check-harness` OK.

