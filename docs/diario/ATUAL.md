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

### S08 — Etiquetas QR — 2026-11-11 — Claude Opus 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, CODE-*, SEC-03, ARQ (ADR 003), CI-01, MC. Decisão do Pedro na sessão: **bobina 33 × 22 mm em 3 colunas** (não 40 × 25), PDF **na API com pdfkit**.
Feito (branch `feature/s08-etiquetas`): `POST /etiquetas` (só Dono) devolve PDF com **uma fileira de 3 por página**; QR vetorial só com o código (versão 1, correção M, zona de 4 módulos, módulo 0,5 mm = 4 pontos a 203 dpi); texto: nome, tamanho em destaque, cor, preço, código; **sem custo nem fornecedor**. Até 999 por PDF; SKU de outra empresa, inexistente ou de produto inativo = 404. Tela "Etiquetas" em Produtos: busca, quantidade por SKU, "Usar o estoque", resumo de fileiras/em branco, download com o dia de São Paulo. ADR 003 **proposto**.
Números: testes API 535 -> 571, web 195 -> 215, shared 136 -> 151; OpenAPI 0.6.0 -> 0.7.0; bundle web +7,5 kB.
Evidência: `verify` exit 0; PDF lido por leitor independente (`pdfjs-dist`); PDF **baixado pelo navegador** rasterizado a 203 dpi: **71/71 QRs decodificados** (`jsqr`, fora do repo); mutação **15/15** pegas; Playwright 360×640 nos 2 temas: 0 rolagem, 0 alvo < 48 px, 0 texto cortado (3 cortes achados só no navegador e corrigidos: L-0015). Pedro testou o PDF: "gerou rápido e funcionou".
Pendências: **(1) impressão física (única):** comprar a bobina, informar o modelo da impressora, imprimir, calibrar (espaço entre colunas 2 mm e margem 1 mm são estimativas; papel 105 × 22 mm; tamanho real 100%) e fotografar a leitura pela câmera, que é o "pronto quando" da S08. (2) Zod já vaza no bundle web da `main` (5 marcas, antes desta sessão). (3) PIN do Dono de dev redefinido para 2468 só no banco local (documentar no seed). (4) Prefixo `etiquetas` no proxy HTTPS da S14.
Aprendizado: L-0015 (rótulo cortado em 360 px, recorrência 2; lição ativa 12; E2E na S13). Falhas corrigidas (detalhe no PR): opção inexistente do pdfjs 6, nome de arquivo só por caixa, data em UTC, heredoc (lição 1). `check-harness` OK.

### S09 — Clientes — 2026-11-13 — Claude Sonnet 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, MC. Branch `feature/s09-clientes` (S08 já mergeada, PR #16).
Feito: tabela `clientes` (RLS, celular único por empresa, sem `DELETE`); `GET/POST /clientes`, ficha, `POST …/aviso-lgpd` (Dono e Vendedor) e `POST …/anonimizar` (só Dono); busca por nome (sem acento) ou celular; telas Clientes, Novo cliente e Ficha com botão WhatsApp, aviso com data e apagar com confirmação; módulo "Clientes" ativo na grade. ADR 007 **proposto**; OpenAPI 0.8.0.
Números: testes API 571 -> 634, web 215 -> 231, shared 151 -> 191; migrações +1 (`20261113120000_clientes`).
Decisões a confirmar (Pedro): (1) "excluir" = **anonimizar** (sem `DELETE`, a venda mantém o vínculo); (2) sem editar cliente (fora de RF-CLI-01…04); (3) **histórico de compras vazio até a S10** (não há vendas); (4) o log passa a descartar a query string (a busca leva nome/celular na URL).
Verificação: `verify` exit 0; mutação 5/5 (a 1ª rodada pegou 4/5: o teste de "lista sem anonimizados" era frouxo e foi reforçado); Playwright 360×640 nos 2 temas: 11 telas, 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado (1 falso positivo: trilho do Switch).
Aprendizado: **L-0016** (teste avançou o relógio compartilhado em minutos e derrubou as sessões; comentário no helper). O guard barrou um comando meu com ".env" e não foi contornado. `check-harness` OK.
Pendências: prefixo `clientes` no proxy HTTPS da S14 (o do Vite já tem, por teste de guarda); impressão física das etiquetas (S08, Pedro).

### S09b — Clientes editar/inativar/excluir — 2026-11-12 — Composer
Gate: feature + migração + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, ARQ (ADR 007), MC. Branch `feature/s09b-clientes-editar-excluir` (S09 já mergeada, PR #17). Continuação da sessão Claude Code interrompida por usage limit.
Feito: migração `20261113180000_clientes-inativar-excluir` (`ativo` no lugar de `anonimizado_em`; `DELETE` ao runtime); `PUT /clientes/{id}`, `POST …/inativar|reativar`, `DELETE /clientes/{id}`; lista com aba de inativos (só Dono); formulário compartilhado cadastro/edição; ADR 007 **aceito** (decisão do Pedro); OpenAPI 0.9.0; matriz de acessos atualizada.
Números: testes API 634 -> 662, web 231 -> 235, shared 191 -> 200.
Decisões (Pedro): excluir = apagar do banco ou inativar; edição obrigatória; histórico aguarda S10; log sem nome/celular.
Verificação: `verify` exit 0 (API 662, web 235, shared 200); mutação das regras novas (sessão Claude: 8/8); Playwright 360×640 nos 2 temas: 14 telas (lista, inativos, novo, ficha, editar, ficha-inativo, confirmar-excluir × 2 temas), 0 rolagem, 0 alvo < 48 px, 0 texto cortado.
Pendências: impressão física S08 (Pedro); S10 Vendas.
