# Plano de execução em sessões — Ailow Cloud v1

> **Fonte única de contexto entre chats** (skill `execucao-em-sessoes`).
> Especificação: `D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md` (PRD). Decisões: `D:\apps\ailow-cloud\acervo\marcant\discovery\decisoes-brainstorm.md` (D1…D19).
> Harness: `D:\apps\harness\PROTOCOLO.md` — **tier B**, Curso **Projeto A**, prazo **16/11/2026**. Repo remoto: https://github.com/ailowio/ailow-cloud

## Contrato de toda sessão

1. **Abrir:** ler este plano (sessão atual + Diário), o PRD nas seções citadas e as lições ativas do harness; carregar as skills citadas no handoff. Declarar o **gate do harness** (tipo de trabalho, tier B, IDs de regra da sessão, critérios de aceite).
2. **Estado real:** conferir o repositório antes de escrever (`git status`, `verify`, testes, migrações aplicadas). Os números do handoff são dicas.
3. **Proteção:** sessão que altera schema → migração nova, reversível (expand → migrate → contract, OPS-11); nunca editar migração já aplicada.
4. **Test-first:** Red → Green → Refactor. Teste nunca é alterado só para passar (TEST-08).
5. **Escopo fechado:** só a sessão atual; respeitar o "Não fazer".
6. **Verificar:** `verify` (lint + tipos + testes + build) verde + o critério "pronto quando" da sessão com evidência colada no Diário.
7. **Commit/push/PR/deploy:** **só com autorização explícita do Pedro** (Conventional Commits, branch curta, PR com template).
8. **Fechar:** entrada no Diário + docs vivas tocadas (README, OpenAPI, ADR, CHANGELOG) + lição registrada se algo falhou (MC) + prompt da próxima sessão (ou "aguardando portão").
9. **Portões humanos (🚦):** o prompt da próxima só vale depois do "ok" do Pedro.
10. Identificar a LLM no fim da resposta e na linha do Diário.

## Sessões

| # | Título | Escopo | Pronto quando | Não fazer | 🚦 |
|---|---|---|---|---|---|
| S01 | Pesquisas de domínio | P1 modelagem de lingerie (grade de sutiã, numeração × P/M/G/GG, porte, cor, atributos → produto/SKU); P2 etiqueta + QR (conteúdo, correção de erro, tamanho, formato de impressão); P3 Instagram da marca (via Chrome do Pedro, se disponível) | `docs/pesquisa/P1-modelagem-produto.md`, `P2-etiqueta-qr.md`, `P3-instagram.md` com fontes citadas (L-0005) + planilha-modelo das 20 peças carro-chefe | Código, scaffold, ADR final | 🚦 Pedro valida P1 (afeta o modelo de dados) |
| S02 | Design System | Receber o DS do Pedro; tokens (cores, tipografia, espaçamento, toque ≥ 48 px), componentes-base (botão-bloco, grade 3×N, carrinho, teclado de PIN), temas claro/escuro | `docs/design-system/` + protótipo navegável da tela inicial e da Nova venda, aprovados | Lógica de negócio, API | 🚦 Pedro aprova o DS |
| S03 | Fundação | Monorepo (`apps/api`, `apps/web`, `packages/shared`); `verify`; CI (lint, tipos, testes, build, Semgrep, SCA, gitleaks, Trivy, permissões mínimas, actions por SHA); Docker Compose (healthcheck, não-root, tags fixas); Postgres + migrações + RLS base com `empresa_id`; `/health`; logs JSON com `request_id`; ADR 001 e 002; README, CLAUDE.md/AGENTS.md, CONTRIBUTORS, CHANGELOG, `.env.example`, template de PR | `docker compose up` sobe tudo; `verify` verde; teste de integração prova que o RLS isola 2 empresas | Telas, módulos de negócio | 🚦 Pedro assina ADR 001/002 e autoriza o 1º commit/push + branch protection |
| S04 | Acesso (API) | Empresas, usuários (Dono/Vendedor), senha + PIN (argon2id), sessão no servidor, aparelho vinculado, bloqueio após 5 PINs, TOTP do Admin, derrubar sessões; OpenAPI | RF-ACE-01…08 e RN-09/RN-10 com testes (2 empresas × 2 perfis — TEST-17) | Telas | — |
| S05 | Shell PWA + Configurações | PWA instalável; Entrar; "Quem está usando?" + teclado de PIN; trava por inatividade; tela inicial 3×N filtrada por perfil; Configurações (usuários, dados da empresa, markup, categorias) | Fluxo Entrar → PIN → grade funcionando em viewport 360×640; RF-CFG-01…04 | Financeiro, Produtos | — |
| S06 | Financeiro (núcleo) | Lançamentos (interface pública para os módulos), nova despesa, contas a pagar, marcar pago, estorno, relatório dia/mês | RF-FIN-01…06; RN-01/RN-06 com testes | Vendas, Compras | — |
| S07 | Produtos | Categorias/atributos, novo produto passo a passo, SKUs, estoque (movimentos, entrada/ajuste), estoque mínimo + aviso na tela inicial, busca por nome/código/preço, custo oculto ao Vendedor | RF-PRO-01…05/07; RN-03/RN-05 | Etiquetas | — |
| S08 | Etiquetas QR | Geração do QR por SKU + PDF no tamanho da etiqueta (seleção de SKUs e quantidades, no computador); ADR 003 | Etiqueta impressa na térmica do Pedro e lida pela câmera do celular (evidência: foto) | Leitor na venda | — |
| S09 | Clientes | Cadastro mínimo, celular único/validado, busca, ficha com histórico, botão WhatsApp, aviso LGPD, excluir/anonimizar | RF-CLI-01…04 | Vendas | — |
| S10 | Vendas | Nova venda, scanner (câmera), busca, carrinho, bloqueio sem estoque, fechamento (cliente, desconto, múltiplas formas), finalização atômica, comprovante (link WhatsApp + imprimível), excluir venda (estorno), relatório | RF-VEN-01…10; RN-02/07/08; **RNF-04 (≤ 8 toques) medido em E2E** | Compras | — |
| S11 | Compras | Fornecedores, pedido (rascunho → enviado → recebido), enviar pelo WhatsApp, receber (estoque + parcelas, atômico), relatório | RF-COM-01…05; RN-11 | Pessoas | — |
| S12 | Pessoas | Bater ponto, espelho de ponto | RF-PES-01/02 | — | — |
| S13 | Qualidade final | k6 smoke/carga/estresse com thresholds (RNF-01/02); Spectral + Schemathesis no CI; E2E dos fluxos críticos; threat model 1 página; C4 contexto/contêineres + mapa de contextos; runbooks (deploy, rollback, migrar VPS); `docs/harness-adoption.md`; métricas RED + SLO | Critérios de aceite 4–8 do PRD §10 marcáveis com evidência | Deploy | — |
| S14 | Deploy + entrega do curso | Compose na VPS (isolado, limites), proxy HTTPS, deploy pelo pipeline, smoke em produção, rollback ensaiado, inventários de auditoria (sistema, acessos, rotinas, interfaces), tag `v1.0.0`; roteiro do vídeo; pacote Moodle | URL no ar + checklist do curso + evidências | Enviar no Moodle sem pedido | 🚦 Pedro autoriza deploy, chave SSH de deploy (acesso novo → AUD) e push da tag |

Se o prazo apertar: cortar **do fim** (S12 → S11), nunca no meio de um módulo (D1).

## Modelo do prompt de sessão

```text
Sessão SNN de 14 — <título> (plano "Ailow Cloud v1").
Plano e diário: D:\apps\ailow-cloud\docs\plano-execucao.md
PRD: D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md
Leia o plano inteiro, principalmente a sessão SNN, o "Contrato de toda sessão" e o Diário de execução (últimas entradas). Cumpra o gate do harness (D:\apps\harness\PROTOCOLO.md §1).
Skills/regras desta sessão: <lista>.

Escopo desta sessão:
1. ...

Contexto herdado: <do Diário>.
Pronto quando: <critério>.
Não fazer: <próximas sessões>.
Ao terminar: atualize o Diário e me entregue o prompt da sessão SNN+1 (ou "aguardando portão do Pedro").
```

## Prompt da S01 (colável)

```text
Sessão S01 de 14 — Pesquisas de domínio (plano "Ailow Cloud v1").
Plano e diário: D:\apps\ailow-cloud\docs\plano-execucao.md
PRD: D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md
Discovery: D:\apps\ailow-cloud\acervo\marcant\discovery\ (sintese-discovery.md, decisoes-brainstorm.md; fotos em bruto/fotos — PII, não copiar para docs versionados)
Leia o plano inteiro, principalmente a S01, o "Contrato de toda sessão" e o Diário. Cumpra o gate do harness (D:\apps\harness\PROTOCOLO.md §1). Lição L-0005: só afirme o que leu; cite as fontes.
Skills/regras desta sessão: anthropic-skills:deep-research (se útil), claude-in-chrome (só para o Instagram, no navegador do Pedro).

Escopo desta sessão:
1. P1 — Modelagem de produto de lingerie: grade de sutiã (as "3 medidas"), numeração (ex.: 40–52+) × P/M/G/GG, porte Slim/Plus por categoria, cor, atributos (bojo, aro, renda, compressão, alça). Como ERPs de moda modelam produto → variação (SKU). Proposta de modelo produto/SKU/atributo compatível com o PRD §7 e de código curto de SKU. Saída: docs/pesquisa/P1-modelagem-produto.md + planilha-modelo (CSV) para o Marcos preencher as 20 peças carro-chefe.
2. P2 — Etiqueta com QR: conteúdo (SKU curto × URL), nível de correção de erro, tamanho mínimo impresso, tamanhos usuais de etiqueta térmica, texto legível junto (SKU, nome, tamanho, cor, preço), formato de impressão (PDF no tamanho da etiqueta × ZPL/TSPL). Perguntar ao Pedro o modelo/conexão da impressora. Saída: docs/pesquisa/P2-etiqueta-qr.md (insumo do ADR 003).
3. P3 — Instagram @marcant_moda_intima e @marcant.men: linha de produtos, linguagem, identidade visual. Saída: docs/pesquisa/P3-instagram.md (insumo do Design System). Se não der acesso, registrar e seguir.

Contexto herdado: PRD revisado e aprovado (D19); exceções EX-01…04 aprovadas; Design System vem na S02; nada de código ainda.
Pronto quando: os 3 docs existem com fontes citadas + a planilha-modelo existe; dúvidas para o Marcos listadas.
Não fazer: código, scaffold, migrações, ADR final, Design System.
Ao terminar: atualize o Diário e diga "aguardando portão do Pedro (validar P1)"; o prompt da S02 só vale após o ok.
```

## Prompt da S06 (colável)

```text
Sessão S06 de 14 — Financeiro (núcleo) (plano "Ailow Cloud v1").
Plano e diário: D:\apps\ailow-cloud\docs\plano-execucao.md
PRD: D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md
Repo: D:\apps\ailow-cloud (remoto https://github.com/ailowio/ailow-cloud, PÚBLICO). Protocolo git completo autorizado (branch curta + PR; humano aprova e mergeia). A main está protegida (ruleset proteger-main): PR obrigatório + 6 checks (verify, seguranca-segredos, seguranca-sast, seguranca-sca, imagem, compose).
Leia o plano inteiro, principalmente a S06, o "Contrato de toda sessão", as últimas entradas do Diário (S05, S05b) e "Pendências transversais". Cumpra o gate do harness (D:\apps\harness\PROTOCOLO.md §1). Lições ativas valem (item 1: código e regex só por Write/Edit, nunca por node -e/heredoc/sed; L-0006 mutação/canário; L-0007 copiar para fora do repo antes de integrar remoção de arquivos rastreados; L-0008 testes de integração nunca contam linhas globais). O guard do harness bloqueia qualquer comando que cite o arquivo de ambiente real: não tente contorná-lo.
Skills/regras desta sessão: superpowers:test-driven-development, karpathy-guidelines, frontend-design e playwright-skill (viewport 360×640, 2 temas) se houver tela.

Escopo desta sessão:
1. Lançamentos (RF-FIN-01): interface pública para os módulos (Vendas, Compras…) gerarem lançamentos; tipo entrada/saída, origem (venda, compra, despesa, estorno + id), categoria, valor em centavos inteiros (RN-01), forma de pagamento, vencimento, pago em, status (aberto/pago/estornado). Migração nova reversível + RLS forçada + GRANT + teste de isolamento entre 2 empresas + OpenAPI, test-first.
2. Nova despesa (RF-FIN-02), contas a pagar (RF-FIN-03), marcar pago, estorno (RN-06: nada é apagado), relatório do dia/mês por forma de pagamento e categoria (RF-FIN-05). Só Dono (RN-10); Vendedor nunca acessa Financeiro.
3. Tela do módulo Financeiro (hoje "em breve" na grade, `apps/web/src/acesso/modulos.ts`) no Design System existente, 360×640, alvos ≥ 48 px, nomes nunca truncados.

Contexto herdado: S05 e S05b na main (PRs #6 e #7): PWA, fluxo Entrar→PIN→grade, Configurações (usuários, empresa, markup em bps, categorias), logo placeholder em apps/web/public/logo.svg. Texto de 13–14 px aceito pelo Pedro por ora (aprovação visual dele depois). Testes: API 202, web 62, shared 22. Dev sem Docker: npm run dev:db → dev:seed → dev:api → dev:web (README; dono@loja.dev / senha-de-desenvolvimento, vendedor "Ana Vendedora" PIN 1357; o Dono do seed já definiu PIN 2468 se o .dev-data/ ainda existir). Pendências do Pedro (não são desta sessão): arquivo de ambiente real para D:\apps\ailow-cloud\; reescrita do histórico do Git (acervo) aguardando ele — NÃO force-push nem altere o ruleset; Docker/WSL2 pós-reinício; logo definitiva e envio de logo por empresa (RF-CFG-02, exige armazenamento de arquivo) em aberto; ADR 004 segue "proposto".
Pronto quando: RF-FIN-01…06 e RN-01/RN-06 com testes; fluxo no navegador 360×640 nos 2 temas (sem overflow nem texto cortado); verify e CI verdes no PR.
Não fazer: Vendas, Compras, Produtos, deploy, mexer no ruleset ou no histórico.
Ao terminar: atualize o Diário e diga "aguardando portão do Pedro (mergear o PR)"; o prompt da S07 só vale após o ok.
```

## Prompt da S07 (colável)

```text
Sessão S07 de 14 — Produtos (plano "Ailow Cloud v1").
Plano e diário: D:\apps\ailow-cloud\docs\plano-execucao.md
PRD: D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md
Repo: D:\apps\ailow-cloud (remoto https://github.com/ailowio/ailow-cloud, PÚBLICO). Protocolo git completo autorizado (branch curta + PR; humano aprova e mergeia). A main está protegida (ruleset proteger-main): PR obrigatório + 6 checks (verify, seguranca-segredos, seguranca-sast, seguranca-sca, imagem, compose).

ANTES DE TUDO: `git rev-parse --show-toplevel` (D:/apps/ailow-cloud) e `git status` (L-0010). PR #10 já está MERGED; `git checkout main && git pull --ff-only` e crie a branch da S07. Conferir portas 54329, 3000 e 5173 (L-0012): o Compose pode estar saudável em :3000 — se for usar `dev:api`, `docker compose down` antes (ou o contrário). Guia Windows: docs/dev-windows.md (L-0013).

Leia o plano inteiro, principalmente a S07, o "Contrato de toda sessão", as últimas entradas do Diário (S06, S06b, Prep ambiente Windows) e "Pendências transversais". Leia também docs/pesquisa/P1-modelagem-produto.md e o ADR 005. Cumpra o gate do harness (D:\apps\harness\PROTOCOLO.md §1). Lições ativas valem (item 1: código/regex só por Write/Edit; L-0006 mutação; L-0007; L-0008; L-0009 proxy Vite + teste proxy-web; L-0013 Docker/WSL/.env). O guard do harness bloqueia comando que cite o arquivo de ambiente real: não contorne.
Skills/regras desta sessão: superpowers:test-driven-development, karpathy-guidelines, frontend-design e playwright-skill (viewport 360×640, 2 temas, medir rolagem horizontal, texto cortado e alvos < 48 px).

Escopo desta sessão (RF-PRO-01…05 e 07; RN-03 e RN-05):
1. Modelo de dados: produtos, SKUs (produto + tamanho + cor) e movimentos de estoque, migração nova reversível, RLS forçada, política isolamento_empresa, GRANT explícito e teste de isolamento entre 2 empresas (ADR 002). Dinheiro em centavos (RN-01). Estoque de SKU nunca negativo (RN-03). Movimentos imutáveis (sem DELETE/UPDATE no runtime) com autor, motivo, quantidade com sinal e origem quando de venda (S10/RN-08). ADR 006 proposto (003 reservado para S08 etiquetas). No ADR: fornecedor texto vs tabela mínima; preço sugerido = custo × (1 + markup_bps/10000) em centavos, sempre editável (RN-05).
2. Novo produto passo a passo (RF-PRO-01): categoria (só tipo produto: GET /categorias?tipo=produto) → porte Slim/Plus → atributos → tamanhos/cores (grade P1) → custo/preço → fornecedor → estoque inicial e mínimo por SKU. Código curto e QR por SKU (RF-PRO-02); PDF de etiquetas NÃO é desta sessão.
3. Lista/busca por nome, código e preço (RF-PRO-03). Vendedor vê produto/preço/estoque, NUNCA custo (RF-PRO-07); API não envia custo ao Vendedor (teste 2 empresas × 2 perfis).
4. Entrada/ajuste de estoque com motivo e autor (RF-PRO-04); só Dono ajusta.
5. Aviso vermelho na tela inicial do Dono com SKUs abaixo do mínimo (RF-PRO-05); Produtos deixa de ser "em breve" (modulos.ts + teste).
6. Telas no DS, 360×640, alvos ≥ 48 px, nomes nunca truncados (D23). Categoria em uso não é apagada (desativa).

Contexto herdado: S06/S06b na main (PRs #9/#10). Testes ao final da S06b: API 386, web 128, shared 59; OpenAPI 0.5.0; 5 migrações. Ambiente: .env em D:\apps\ailow-cloud\; WSL2+Docker ok. Dev sem Docker: npm run dev:db → dev:seed (1ª vez) → dev:api → dev:web (dono@loja.dev / senha-de-desenvolvimento; Ana Vendedora PIN 1357; Dono PIN 2468 se .dev-data/ existir). Pendências fora desta sessão: reescrita do histórico (acervo) — NÃO force-push/ruleset; logo/RF-CFG-02; ADR 004 proposto; texto 13–14 px.
Pronto quando: RF-PRO-01…05/07 e RN-03/RN-05 com testes (saldo 0 não baixa; concorrência no limite; custo ausente para Vendedor); mutação ≥ 8 defeitos (L-0006); navegador 360×640 2 temas; verify+CI verdes; ADR 006 proposto no PR.
Não fazer: Etiquetas/PDF (S08), Vendas, Compras, Clientes, deploy, mexer no Financeiro, ruleset ou histórico.
Ao terminar: atualize o Diário e diga "aguardando portão do Pedro (mergear o PR)"; o prompt da S08 só vale após o ok.
```

## Diário de execução

<!-- Acrescentar entradas sem apagar as anteriores. Template:
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: ...
Números (antes -> depois): ...
Arquivos: ...
Decisões: ...
Pendências para a próxima: ...
Verificação: <comandos e resultado>
-->

### S00 — Discovery + brainstorm + PRD — 2026-11-10 — Claude Opus 5.5
Feito: transcrição das 2 reuniões (AssemblyAI, pipeline do harness), análise de 25 fotos, síntese do discovery, 19 decisões (D1–D19), PRD v1 revisado pelo Pedro, plano em 14 sessões.
Arquivos: acervo/marcant/discovery/{sintese-discovery,jornadas,decisoes-brainstorm}.md; docs/prd/PRD-ailow-cloud-v1.md; este plano. Brutos em acervo/marcant/discovery/{bruto,transcricoes}/ (gitignored, PII).
Decisões: ver D1–D19; exceções EX-01…04 aprovadas.
Pendências para a próxima: P1/P2/P3; modelo da impressora; Design System (S02); repositório Git ainda não inicializado (S03, com autorização).
Verificação: sem código nesta sessão; nenhum commit feito.

### S01 — Pesquisas de domínio — 2026-11-10 — Claude Opus 5.5
Feito: P1 (modelo Produto → SKU = produto × tamanho × cor; porte no produto; grades LETRAS/NUMERICA_SUTIA/UNICO; código PPPP-TT-CCC), P2 (QR com só o código do SKU, nível M, zona de silêncio de 4 módulos, ≥15 mm a validar, PDF de 1 etiqueta por página 40×25 mm), P3 (Instagram: ~103 mil seguidores, foco plus size, vende online e por consultoria, destaque "ATACADO").
Arquivos: docs/pesquisa/{P1-modelagem-produto,P2-etiqueta-qr,P3-instagram}.md, docs/pesquisa/planilha-20-pecas-carro-chefe.csv.
Decisões: D20 (Mantine), D21 (só PDF; prazo 16/11 confirmado).
Pendências: 🚦 Pedro valida P1; perguntas Q1–Q5 para o Marcos (P1 §6), incluindo atacado.
Verificação: fontes citadas em cada doc; sem código.

### S02 — Design System — 2026-11-10 — Claude Opus 5.5 — PARCIAL (limite de uso atingido)
Feito: docs/design-system/README.md (princípios, tema em 2 camadas Ailow/empresa, paletas Marcant, componentes, voz) e tema-mantine.ts (proposta).
Falta: (1) reconferir a API de tema do Mantine 9.7.x na doc (WebFetch bloqueado por limite); (2) prototipo.html navegável (PIN → início → Nova venda → Fechamento); (3) 🚦 aprovação do Pedro.
Verificação: contrastes calculados à mão pela fórmula WCAG (reconferir com ferramenta).

### S02 — Design System (conclusão) — 2026-11-10 — Claude Sonnet 5.5
Feito: API de tema verificada na doc oficial (README atualizado; MantineColorsTuple e fontSizes ficam marcados como não verificados); prototipo.html criado (PIN 1234 → início → Vendas → Fechar → Pronto, claro/escuro, bloqueio sem estoque, 3 por linha, alvos ≥ 48 px).
Pendências: 🚦 Pedro aprova o DS e valida a P1; protótipo não foi aberto em navegador nesta sessão (sem teste visual).

### S02b — Design System no repositório — 2026-11-10 — Claude Sonnet 5.5
Feito (pedido do Pedro, opção B): apps/web com Vite 8 + React 19 + Mantine 9.7.3 (exato) + mantine-datatable 9.7.5 + Tabler Icons; tema em 2 camadas (src/tema/tema.ts); componentes BlocoAcao, GradeModulos, TecladoPin, Carrinho, Etapas, Valor, SeloEstoque, EstadoVazio (src/componentes); página de catálogo (src/catalogo); formatarReais com teste Red -> Green (RN-01).
Verificação: `npm run verify` em apps/web = tsc OK, 4 testes OK, build OK; captura em 390x844 sem erro de console (só favicon 404).
Defeitos conhecidos: pequeno overflow horizontal à direita no catálogo em 390 px (Etapas/Container); bundle 540 kB (sem code-split); tabela do desktop não foi vista em tela larga.
Fora do escopo (S03): CI, Docker, API, git init. Nada commitado.

### S02c — Identidade Ailow + git — 2026-11-10 — Claude Opus 5.5
Feito: git init em ailow-cloud, 2 commits em main e push para ailowio/ailow-cloud (repo PRIVADO, vazio antes). Branch feature/ds-identidade-ailow: tema com a paleta Ailow (D22), modo claro em camadas, fontes Sora/Manrope (OFL, auto-hospedadas), Etapas sem Stepper (corrigiu o overflow em 390 px), docs/design-system/README.md v1; removidos prototipo.html e tema-mantine.ts (superados pelo código em apps/web).
Verificação: npm run verify verde (tsc, 4 testes, build); Playwright 390x844 nos 2 temas: sem overflow (scrollWidth 375 = largura útil), fundo escuro #0b1126, fontes carregadas.
Pendências: gitleaks ausente na máquina (SEC-05 → S03); branch protection só depois que o CI existir (CI-08/GIT-07 → S03); repo privado → dar acesso ao professor ou tornar público antes da entrega; violeta-texto no escuro ≈ 3,9:1 (só ícone/texto grande).

### S02d — Azul + laranja, sem truncamento — 2026-11-10 — Claude Opus 5.5
Feito: primária azul #2448FF, destaque laranja (coral), violeta removido, perigo = vermelho nativo (D23); tokens --ailow-primario-texto / --ailow-laranja-texto; carrinho e lista sem truncar nomes (nome em linha própria, quebra de linha).
Verificação: npm run verify verde; contrastes calculados (todos >= 5,07:1); Playwright 390 px nos 2 temas: 0 textos visíveis cortados, sem overflow horizontal.

### S03 — Fundação — 2026-11-10 — Claude Sonnet 5.5
Gate declarado: infra de app novo, **tier B**; regras CI-01/03/05/07/08/17/18, ENV-02/04/05/06/09/10/11/13, SEC-01/05/10/12/14, TEST-12/17, OBS-01/02, IA-05, OPS-11, AUD-20/22/24.
Feito (branch `feature/s03-fundacao`, **PR #2**; PR #1 já estava mergeado):
- Monorepo npm workspaces (`apps/api`, `apps/web`, `packages/shared`), lockfile único na raiz; `npm run verify` = build shared + Biome + tipos + testes + build (api, web).
- API Fastify 5.12.8 + Zod 4.6.7 (OpenAPI 3.1 em `/openapi.json`); `GET /health` (200 ok / 503 degradado quando o banco cai); logs JSON com `request_id` (aceita `x-request-id` só se `^[A-Za-z0-9._-]{1,64}$`, senão UUID; `authorization`/`cookie` redigidos); config por env que falha cedo citando o nome da variável.
- Postgres 18 + migração SQL reversível: `empresas` e `categorias`, RLS `ENABLE`+`FORCE`, política falha-fechada, papel `ailow_app` (NOLOGIN, NOBYPASSRLS); `withEmpresa()` = `SET LOCAL ROLE` + `set_config(..., true)`.
- Dockerfile multi-stage não-root (sem npm no runtime), `compose.yaml` (db com healthcheck → migrate one-shot → api com healthcheck, `read_only`, `cap_drop: ALL`), `.dockerignore`, `.env.example` só com nomes.
- CI (`.github/workflows/ci.yml`): `verify`, `seguranca-segredos` (gitleaks v8.30.1 por digest), `seguranca-sast` (Semgrep 1.185.0), `seguranca-sca` (npm audit alto+), `imagem` (Trivy), `compose` (smoke); `permissions: contents: read`; actions por SHA.
- ADR 001 e 002 (status **proposto**), CLAUDE.md, AGENTS.md, CONTRIBUTORS.md, CHANGELOG.md, template de PR, README.
Números (antes -> depois): testes api 0 -> 25 (config 6, RLS 10, migração up/down 1, app 8), shared 0 -> 3, web 4 -> 4; jobs de CI 0 -> 6; Dockerfile/compose 0 -> 1.
Evidência do "pronto quando":
- `npm run verify` verde local (exit 0) e job `verify` verde no CI (Postgres 18.6 de serviço).
- RLS: `apps/api/test/rls.test.ts` 10/10. **Teste de mutação** (política `USING (true)`): 5 testes falharam; migração restaurada.
- `docker compose up`: **não executado localmente (a máquina não tem Docker nem WSL)**. Verificado no job `compose` do CI (run 42947205992, commit 550abd6): `db: healthy`, `api: healthy`, migração com exit 0, `/health` -> `{"status":"ok","db":"ok"}`, `uid=1000` (não-root).
- CI verde (6/6) no commit 550abd6. O 1º run (commit 03cc84f) reprovou `imagem`: Trivy achou 10 HIGH, todos no npm embutido na imagem base (`/usr/local/lib/node_modules/npm`); corrigido removendo o npm do runtime (a migração chama o node-pg-migrate com `node`).
Decisões: Biome em vez de ESLint (typescript-eslint declara peer `typescript <6.1.0`, o projeto usa TS 7.0.2); `embedded-postgres` só em dev/teste para rodar Postgres real sem Docker; papel de runtime assumido por `SET LOCAL ROLE` (ver riscos no ADR 002); tabela de exemplo = `categorias` (será reaproveitada em Configurações/Produtos — se mudar o modelo, nova migração).
Pendências para a próxima / riscos honestos:
- 🚦 **Aguardando o Pedro:** assinar ADR 001/002 (os motivos de descarte de Supabase/Next.js no ADR 001 são proposta da IA — D13 só registra o descarte), mergear o PR #2, ativar a proteção da `main`.
- Proposta de proteção da `main` (não aplicada): PR obrigatório; checks obrigatórios `verify`, `seguranca-segredos`, `seguranca-sast`, `seguranca-sca`, `imagem`, `compose`; branch atualizada; sem bypass de admin; aprovação ≠ autor **dispensada pela exceção EX-01** (autor único). Não verifiquei se o plano da conta permite proteger `main` em repositório privado — conferir em Settings → Branches.
- ADR 002: a API conecta como dono do schema (superusuário na imagem do Postgres); criar papel de login dedicado e sem privilégios na S14 (acesso novo -> inventário AUD).
- `npm audit`: 3 moderados (minimatch/glob via node-pg-migrate), abaixo do gate; 1 aviso de lint pré-existente em `apps/web/src/main.tsx`; gitleaks não instalado localmente (o CI cobre o histórico inteiro).
- Teste de config: o Red foi observado só indiretamente (falha do `globalSetup`, módulo ausente), não pela asserção.
- Dependabot/atualização automática de dependências e actions ainda não configurado; cobertura de testes ainda sem gate (CI-04, tier B) -> avaliar na S13.
- L-0006 (canário de lint/mutação reproduzível, prazo 2026-11-14) aberta; L-0003 teve recorrência (guard de .env x heredoc).
Verificação: `npm run verify` (exit 0; 25+4+3 testes); `gh pr checks 2` -> 6/6 pass; `node harness/scripts/check-harness.mjs` -> Harness OK.

**Aguardando portão do Pedro (assinar ADR 001/002, ativar branch protection, mergear PRs).** O prompt da S04 só vale após o ok.

### S03 — Fundação (fechamento do portão) — 2026-11-11 — Claude Sonnet 5.5
Feito (PRs #2–#4 mergeados pelo Pedro): fundação mergeada; ADR 001 e ADR 002 **aceitos** (PR #4); proteção da `main` **ativa** via ruleset `proteger-main` (PR obrigatório com 0 aprovações exigidas — EX-01 —, branch atualizada, sem force-push nem exclusão, 6 checks: verify, seguranca-segredos, seguranca-sast, seguranca-sca, imagem, compose); repositório agora **público**; `acervo/` removido do git e ignorado (PR #3).
Pendência de decisão do Pedro: o **histórico** do Git ainda contém os 3 arquivos do discovery (o PR #3 só os tirou do estado atual). Reescrever histórico (ex.: `git filter-repo` + force-push) é irreversível e só com pedido explícito; enquanto isso, tratar o conteúdo como já público.
Incidente: o merge do PR #3 apagou do disco as cópias locais dos arquivos recém-ignorados → lição L-0007 (item 7 das lições ativas). Cópias hoje presentes em `acervo/marcant/discovery/`.
Verificação: `gh pr list --state all` -> #1–#4 MERGED; `gh repo view` -> PUBLIC; `gh api repos/ailowio/ailow-cloud/rules/branches/main` -> pull_request, required_status_checks (6, strict), deletion, non_fast_forward (a API clássica de branch protection devolve 404 porque a regra é um ruleset); `git check-ignore -v acervo` -> `.gitignore:23`.

### S04 — Acesso (API) — 2026-11-11 — Claude Sonnet 5.5
Gate declarado: feature + mudança de banco + acessos/credenciais, **tier B**; regras SEC-03/04/07/16/17, AUD-02/03/04/06/09/10/11, TEST-12/17, OPS-11, IA-05, MC.
Feito (branch `feature/s04-acesso-api`, **PR #5**):
- Migração reversível `20261111120000_acesso`: `usuarios`, `aparelhos`, `sessoes`, `eventos_acesso` (empresa_id + RLS forçada + GRANT; trilha só-acréscimo; FKs compostas impedem referência entre empresas) e tabelas de plataforma `admins`, `admin_sessoes`, `diretorio_login` (sem GRANT ao `ailow_app`; funções `buscar_login`/`registrar_login`); `empresas.inatividade_minutos`.
- Senha/PIN: argon2id (`argon2` 0.45.2; 19 MiB/2/1 = mínimo OWASP, conferido na fonte) + pepper `AUTH_PEPPER`. Sessão no servidor (cookie httpOnly/Secure/SameSite=Strict; token 256 bits, só SHA-256 no banco; inatividade por empresa; 12 h absolutas). Aparelho vinculado (365 d), "Quem está usando?", PIN com bloqueio em 5 (linha travada com `FOR UPDATE`), sair/derrubar/desativar/desbloquear, redefinir PIN. Admin: senha + TOTP (`otpauth` 9.6.0, anti-replay atômico), criar empresa + Dono, redefinir senha do Dono, CLI `admin:criar`.
- `empresa_id` só vem do banco (a partir do segredo do cookie); corpo/query/cabeçalho são ignorados (testado). `exigirPerfil('dono')` é o ponto único que barra o Vendedor.
- OpenAPI 0.2.0 com esquemas de cookie, tags e as 16 rotas (teste de contrato). ADR 004 (**proposto**), `docs/auditoria/matriz-acessos.md`, README, CHANGELOG, `.env.example`, compose e CI (`AUTH_PEPPER`; passo que prova argon2id na imagem musl).
Números (antes -> depois): testes API 25 -> 165 (acesso 21, admin 19, autorização 22, rls-acesso 20, openapi 19, argon2/tokens/totp 21, criar-admin 5, config +2…); shared 3 -> 15; web 4; migrações 1 -> 2; rotas 1 -> 17.
Evidência do "pronto quando" (RF-ACE-01…08, RN-09/10, 2 empresas × 2 perfis): `npm run verify` exit 0 (165+15+4 testes); `gh pr checks 5` -> 6/6 pass no commit eeb6ae6 (verify, compose com argon2id na imagem musl, imagem, sast, sca, segredos). 1º run: segredos falhou (falso positivo, exceção por fingerprint) e 2º: verify falhou (teste com contagem global, corrigido).
Mutação (L-0006): 16 mutações dos controles reprovaram a suíte (perfil não exigido, inatividade, validade absoluta, sessão revogada, bloqueio, limite de 5, `FOR UPDATE`, usuário inativo, desativar sem derrubar, anti-replay TOTP, TOTP/senha do Admin, cookie sem httpOnly/SameSite=Lax, sem pepper, sem `SET ROLE`). 5 sobreviveram na 1ª rodada: 3 eram lacunas reais de teste (corrigidas: TOTP concorrente, sessões revogadas no banco, mutação no arquivo errado) e 2 eram mutantes equivalentes (TOTP/senha também barrados por outra condição; mutados juntos, reprovaram). Lint: canário `any` -> Biome acusou.
Decisões: ADR 004 (numeração 003 reservada à S08); login com senha libera Dono bloqueado por PIN; um aparelho = uma sessão ativa; autenticação em `preValidation` (401 antes de 400); Spectral **não adicionado**: medido fora do repo (6.17.1, `spectral:oas`) = 0 erros, 54 avisos (operationId/description) -> S13 com CI.
Pendências / riscos honestos:
- Sem limite de tentativas/rate limit de senha (Dono e Admin) -> S13; segredo TOTP do Admin em texto na coluna (inacessível ao runtime) -> cifrar antes do deploy; sem revogação de aparelho; API ainda conecta como dono do schema (S14); procedimento de troca do `AUTH_PEPPER` por escrever; revisão periódica de acessos por definir (AUD-05).
- O CLI `admin:criar` foi testado só na parte de entrada (`lerEntradaAdmin`); a execução ponta a ponta contra o banco não foi rodada. O argon2 na imagem Alpine só é provado pelo job `compose` do CI.
- Incidentes/aprendizado: L-0007 (merge apagou cópias locais), L-0008 (teste com contagem global instável no CI). Erros meus no caminho: `replace` JS com `$'` corrompeu o `ci.yml` (visto e corrigido antes do commit); gitleaks acusou o pepper fictício de teste (exceção por fingerprint em `.gitleaksignore`).
- Decisão do Pedro ainda pendente: histórico do Git contém o acervo (S03).
Verificação: `npm run verify` (exit 0); `node harness/scripts/check-harness.mjs` -> Harness OK.

**Aguardando portão do Pedro (mergear o PR #5).** O prompt da S05 só vale após o ok.

### S05 — Shell PWA + Configurações — 2026-11-11 — Claude Sonnet 5.5
Gate declarado: feature com UI + mudança de banco + acessos, **tier B**; regras TEST-01..08/12/17, CODE-*, SEC-03/07, OPS-11, ENV-13, AUD-02/09, MC. Sem decisão estrutural nova (sem ADR): o service worker e o `dev:db` são ferramental, documentados no README.
Feito (branch `feature/s05-shell-pwa-config`):
- **API (test-first):** migração reversível `20261111180000_configuracoes` (`empresas`: telefone, endereço, `markup_bps` inteiro 0–100000; `categorias`: `atributos text[]`, `ativa`, índice único por nome sem diferenciar maiúsculas). Rotas só-Dono `GET/PUT /empresa`, `GET/POST /categorias`, `PUT /categorias/{id}` (OpenAPI 0.3.0); toda alteração grava `eventos_acesso`. `GET /acesso/eu` passou a informar `inatividade_minutos` (a trava do app usa o limite do servidor). RLS/GRANT das tabelas já existiam e cobrem as colunas novas.
- **PWA:** manifest, 3 ícones PNG (gerados por `apps/web/scripts/gerar-icones.mjs`, sem dependência), service worker mínimo que só atende `/`, `/assets/` e `/icons/` — nada da API vai para o cache.
- **Fluxo:** Entrar → (definir 1º PIN, 2 vezes) → "Quem está usando?" → PIN → tela inicial 3×N por perfil (Dono 7 módulos; Vendedor 4, sem Financeiro/Compras/Configurações); PIN errado com tentativas restantes, bloqueio (423), sessão derrubada (401 em uso), trava por inatividade (servidor expira + app trava e encerra a sessão; aviso ao servidor no máximo 1×/min durante o uso). Cookies httpOnly: `fetch` com `credentials: 'same-origin'`, nenhum token no JS (provado: nenhum cookie legível, `localStorage` vazio de credenciais).
- **Configurações (só Dono):** Usuários (criar Vendedor, redefinir PIN, desbloquear, derrubar sessões, desativar com confirmação nomeada, trocar o próprio PIN), Empresa (nome, telefone, endereço, trava por inatividade), Markup (com exemplo R$ 100 → preço sugerido) e Categorias (nome, atributos, ativa).
- **Dev sem Docker:** `npm run dev:db` (Postgres embutido persistente em `.dev-data/`, porta 54329, banco `ailow_dev` separado dos testes), `dev:seed`, `dev:api` (COOKIE_SECURE=false só aqui), `dev:web` (proxy do Vite, mesma origem). Segredos de dev gerados localmente; scripts recusam `NODE_ENV=production`.
Números (antes -> depois): testes API 165 -> 202; web 4 -> 59; shared 15 -> 22; migrações 2 -> 3; rotas 17 -> 22; bundle de produção 540 kB -> 526 kB (catálogo do DS saiu do bundle).
Evidência do "pronto quando":
- `npm run verify` exit 0 (lint com 1 aviso antigo em `main.tsx`; 202 + 59 + 22 testes; build).
- Playwright em **360×640, tema escuro e claro** (fluxo completo + Configurações, 2 roteiros): sem rolagem horizontal, 0 textos cortados (scrollWidth > clientWidth), todos os alvos de toque ≥ 48 px, grade de 3 colunas, sem erros de console além dos 401/409 provocados de propósito. Trava por inatividade medida: 60–61 s com limite de 1 min, sessão encerrada no servidor (`GET /acesso/eu` = 401). Capturas na pasta temporária da sessão (não versionadas).
- PWA em build de produção (`vite preview`): sem erros de instalabilidade nem de manifest (CDP `Page.getInstallabilityErrors` e `getAppManifest`), service worker ativo, cache só com a casca, offline abre com "Sem conexão".
- Mutação (L-0006): `exigirPerfil('dono')` removido -> 2 testes reprovam; service worker interceptando tudo -> reprova; 6 mutações na lógica do web (aviso ao servidor, limite de trava, 401 só com `nao_autenticado`, `credentials`, Vendedor vendo Compras, 423) reprovaram a suíte (1 "sobrevivente" era mutação no comentário, falha do meu script).
Decisões: markup em pontos-base inteiros (RN-01); logo da empresa **não** entrou (RF-CFG-02 pede logo; exige armazenamento de arquivo, a decidir); após Entrar o app encerra a sessão e leva a "Quem está usando?" (a sessão da senha serve só para o onboarding), exceto no 1º PIN; módulos sem tela mostram "em breve" desabilitado em vez de botão morto; rótulo "Configurações" hifeniza em 360 px em vez de cortar (D23).
Pendências / riscos honestos:
- Rótulos dos blocos e textos secundários usam 13–14 px (o PRD diz mínimo 16 px): herdado do DS (S02), a revisar com o Pedro.
- Dono bloqueado só se desbloqueia entrando de novo com senha ("Entrar com e-mail e senha"); logo da empresa; Dono não pode criar outro Dono (a API só cria Vendedor).
- Telas verificadas só no Chromium (Playwright); não testado em Safari/iOS nem instalado de fato num celular.
- Não testado: Compose (continua só no CI). Os servidores de dev (`dev:db`, `dev:api`, `dev:web`, preview) ficaram rodando nesta sessão: encerrar ao reiniciar o Windows (o encerramento em massa de processos foi negado pelo classificador e não foi contornado).
- Lacunas da S04 seguem: sem rate limit de senha, TOTP sem cifra, sem revogação de aparelho, API como dono do schema (S14).
Aprendizado: L-0002 recorreu (escapes de `node -e`/heredoc destruíram uma regex e um heredoc); recorrência 2 e lição ativa 1 ampliada (código só por Write/Edit). Achado pelos testes: schema de resposta Zod 4 com `.transform()` derruba o serializador com 500 (agora com teste de regressão no `shared`).
Verificação: `npm run verify`; `node harness/scripts/check-harness.mjs` -> Harness OK; `gh pr checks 6` -> 6/6 pass (verify, compose, imagem, seguranca-sast, seguranca-sca, seguranca-segredos) no commit 212bbf3.

**Aguardando portão do Pedro (mergear o PR #6).** O prompt da S06 só vale após o ok.

### S05b — Placeholder da logo — 2026-11-11 — Claude Sonnet 5.5
Pedido do Pedro após o merge do PR #6: placeholder para a logo (ele envia a definitiva depois); texto pequeno (13–14 px) **aceito por ora**, aprovação visual dele depois. Feito: `apps/web/public/logo.svg` (placeholder), componente `Logo`, usado no topo de todas as telas e em Configurações > Empresa ("o envio chega em breve"). Troca = substituir o arquivo; o teste `logo.test.ts` (Red -> Green) exige SVG com viewBox, sem script/link externo, e fora de `/icons` e `/assets` (o service worker guardaria a logo antiga). O texto "Ailow" ao lado da marca fica até a logo definitiva trazer o nome (comentário em `Moldura.tsx`).
Verificação: `npm run verify` exit 0 (202 + 62 + 22 testes); Playwright 360×640 nos 2 temas: logo carrega, sem overflow. Pendente: envio da logo por empresa (RF-CFG-02), exige armazenamento de arquivo.

### S06 — Financeiro (núcleo) — 2026-11-11 — Claude Sonnet 5.5
Gate declarado: feature + mudança de banco + dinheiro + UI, **tier B**; regras TEST-01..08/12/17, CODE-*, SEC-03/07, OPS-11, AUD-02/09/10, ARQ (ADR), MC. Decisão estrutural ⇒ **ADR 005 (proposto)**. Critérios: RF-FIN-01…06 e RN-01/RN-06/RN-10 com teste; 2 empresas × 2 perfis; fluxo no navegador 360×640 nos 2 temas sem overflow nem texto cortado; `verify` e CI verdes.
Estado real ao abrir: o `.git` do app estava corrompido pelo reinício do PC (`HEAD`, `ORIG_HEAD`, 3 refs e 1 reflog só com bytes nulos; o Git caía no repositório pai, vazio). Reparado pelo reflog (`main` e `feature/s06-financeiro` em `b34ee30`, merge do PR #8), `git fsck` limpo, nenhum dado perdido (L-0010). Base: `verify` verde com API 202, web 62, shared 22.
Feito (branch `feature/s06-financeiro`):
- **Banco:** migração reversível `20261111200000_financeiro`: tabela `lancamentos` (empresa_id, tipo, origem + id, descrição, categoria, `valor_centavos integer` 1…2 bi, forma, vencimento, pago_em, status, `estorno_de` único, motivo, autor, `pago_por`), 8 `CHECK`s de coerência, FKs compostas (nada aponta para outra empresa), RLS forçada, `GRANT SELECT, INSERT` + `UPDATE` só de `status, pago_em, forma_pagamento, pago_por`: **o papel de runtime não tem DELETE, TRUNCATE nem UPDATE de valor/tipo/origem/categoria** (RN-06, RN-01 garantidos no banco).
- **Interface pública (RF-FIN-01/06):** `registrarLancamento`, `estornarLancamento`, `pagarLancamento` em `apps/api/src/financeiro/lancamentos.ts`, que recebem o cliente da transação do chamador (Vendas/Compras ficam atômicos). Teste de fronteira: nada fora de `src/financeiro/` cita a tabela em SQL.
- **API só-Dono (RF-FIN-02…05):** `POST /financeiro/despesas`, `GET /financeiro/contas-a-pagar`, `POST /financeiro/lancamentos/{id}/pagar|estornar`, `GET /financeiro/extrato|relatorio` (OpenAPI 0.4.0). Criar/baixar/estornar gravam `eventos_acesso`. "Hoje" e o dia/mês são os de São Paulo (testado com relógio em 22:30 de 11/11 = 01:30 UTC de 12/11, e nas viradas de mês e de meia-noite exata).
- **Web:** módulo Financeiro (menu → Nova despesa, Contas a pagar, Relatório com extrato do dia e estorno) no DS existente; `reaisParaCentavos` sem ponto flutuante; datas por texto; `useAcao` aceita tradutor de erro.
Números (antes -> depois): testes API 202 -> 330, web 62 -> 121, shared 22 -> 51; migrações 3 -> 4; rotas 22 -> 28; arquivos de teste novos: `rls-financeiro`, `financeiro-lancamentos`, `financeiro`, `financeiro-fronteira`, `proxy-web` (API) e `financeiro`, `entrada-dinheiro`, `datas`, `rotulos`, `endpoints-financeiro` (web/shared).
Evidência do "pronto quando":
- `npm run verify` exit 0 (lint com o 1 aviso antigo de `main.tsx`; 330 + 121 + 51 testes; build). Na 1ª rodada final o teste `o PIN em texto não aparece nos logs` falhou por coincidência (o carimbo de tempo do log terminava em `1357`, igual ao PIN de teste); passou na repetição, sem relação com o Financeiro (L-0011, pendência abaixo).
- **Mutação (L-0006):** 11 defeitos plantados e todos reprovaram a suíte: Vendedor sem `exigirPerfil`; fuso UTC no lugar de São Paulo; `<` trocado por `<=` no fim do período; agrupar categoria sem `lower()`; janela de 7 dias `<=` -> `<`; `FOR UPDATE` removido; estorno sem inverter o tipo; baixa sem `AND status = 'aberto'`; `GRANT DELETE`; `UPDATE` de `valor_centavos`; política `USING (true)`. **Um sobreviveu na 1ª tentativa** (`FOR UPDATE`): os testes de concorrência com `Promise.all` não exerciam a corrida; reescrito para segurar a 1ª transação aberta e visto vermelho sem o `FOR UPDATE`. O teste de fronteira também acusava o import legítimo da interface pública (corrigido depois de o teste do próprio detector mostrar).
- **Navegador (Playwright, Chromium 360×640, escuro e claro):** fluxo completo (menu → nova despesa com sugestões de categoria, valor inválido trava o botão → contas a pagar com as 4 seções → marcar como pago exige forma → cancelar conta exige motivo → despesa já paga → relatório do dia, estorno de venda no extrato, dia anterior, mês). Medição automática em cada tela: 0 rolagem horizontal, 0 texto cortado, 0 elementos fora da tela, 0 alvos < 48 px (opções do `Autocomplete` ajustadas para 48 px); nome sem espaço de 70 caracteres e descrição longa quebram sem cortar. Somas conferidas à mão (entradas 129,90 + 45,00 + 89,90 = R$ 264,80). Capturas na pasta temporária da sessão (não versionadas). **Achado só no navegador:** o proxy do Vite não repassava `/financeiro` (404 com tudo verde) ⇒ L-0009 e o teste `proxy-web.test.ts`.
Decisões (propostas por mim; o Pedro confirma):
- Categoria de lançamento = **texto livre** (a tabela `categorias` é de produto); sugestões na tela; "Aluguel" e "aluguel" somam juntas no relatório. Forma `boleto` entrou além das 4 do PRD (despesas de condomínio/aluguel são pagas assim).
- Entra no caixa (relatório) só o que tem `pago_em`; o original estornado mantém o seu `pago_em` e o estorno entra com o sentido oposto na data do estorno. Estornar conta **em aberto** a cancela (os dois ficam `estornado`, nada entra no caixa).
- Marcar como pago **exige escolher a forma** quando a conta não tinha uma prevista (registro verdadeiro > menos um toque): o caminho comum é 3 toques, não 2. Questão de produto para o Pedro.
- Valor em `integer` (teto R$ 20 milhões por lançamento) para o `pg` não devolver texto.
Pendências / riscos honestos:
- ADR 005 segue **proposto** (o Pedro decide ao mergear). Aguardando também ADR 004.
- Vendas (S10) vai precisar **achar os lançamentos de uma venda para estornar** (RN-08): falta uma função de consulta por origem na interface pública; deixei de fora por ser S10 (YAGNI).
- Sem paginação (listas limitadas a 500 linhas; o extrato é por dia). Sem filtro de busca nem edição de despesa (correção = estorno + nova despesa, por RN-06).
- Fuso fixo em São Paulo no v1; dono do schema ainda consegue apagar linhas (lacuna da S14, ADR 002/005).
- O `<input type="date">` nativo foi testado só no Chromium; Safari/iOS e instalação real no celular seguem sem teste. Texto secundário de 13–14 px segue como no DS (aceito pelo Pedro por ora).
- Teste instável pré-existente (L-0011): corrigir a asserção em PR próprio.
- O proxy HTTPS de produção (S14) precisa do mesmo conjunto de prefixos (acrescentar ao checklist do deploy).
- Os servidores de dev e as linhas de teste "(teste S06 …)" ficaram no banco de **dev** local (`.dev-data/`, ignorado pelo git; apague a pasta para recomeçar). Nada foi aplicado fora da máquina.
Aprendizado: L-0009 (proxy), L-0010 (`.git` zerado; lição ativa 8), L-0011 (teste instável), recorrência da L-0006 (mutação achou teste de concorrência sem corrida). `node harness/scripts/check-harness.mjs` -> Harness OK.
Verificação: `npm run verify` exit 0; `gh pr checks 9` -> 6/6 pass (verify, compose, imagem, seguranca-sast, seguranca-sca, seguranca-segredos) no commit 9624672 (run 43045905219).

**PR #9 mergeado pelo Pedro em 2026-11-11 (portão da S06 cumprido).**

### S06b — Ajustes pedidos na revisão da S06 — 2026-11-12 — Claude Sonnet 5.5
Pedido do Pedro ao mergear: (1) dois tipos de categoria, financeiras e de produto; (2) `boleto` fica fora e o resto do ADR 005 está ok; (3) "deve ser necessário poder estornar uma venda"; (4) listar o que falta para seguir. Gate: feature + banco + dinheiro + UI, **tier B**; TEST-01..08/12/17, SEC-03, OPS-11, AUD-02/09/10, ARQ (ADR 005 alterado e aceito), MC. Branch `feature/financeiro-categorias-estorno-venda` (a partir da `main` já com o PR #9).
Feito:
- **ADR 005 aceito** (era proposto), com as alterações: categorias de dois tipos (item 6), estorno de venda inteira (item 7), formas de pagamento sem boleto (item 8) e as alternativas descartadas.
- **Banco:** migração reversível `20261112120000_categorias-tipo-e-sem-boleto`: `categorias.tipo` (`produto` default | `financeira`, esta sem atributos por `CHECK`), unicidade por `(empresa_id, tipo, nome)` com e sem diferenciar maiúsculas (a restrição `UNIQUE` antiga da migração-base também impedia o mesmo nome nos dois tipos: achado pelo teste); `boleto` fora do `CHECK` da forma; limite do nome da categoria no lançamento de 40 para 60 (o nome da categoria já aceitava 60: uma categoria de 41–60 não poderia ser usada). Subir, descer e subir testado.
- **API (OpenAPI 0.5.0):** `GET /categorias?tipo=`, `POST /categorias` com `tipo` (sem tipo = produto), `PUT` recusa atributos em financeira; empresa nova recebe as 10 financeiras padrão (também no `dev:seed`); despesa só aceita categoria **financeira ativa** (`400 categoria_invalida`) e grava o nome como cadastrado; `POST /financeiro/vendas/{id}/estornar` e, na interface pública, `estornarOrigem` (todos os lançamentos da venda, `FOR UPDATE`, um estorno por pagamento, pula o já estornado, `ja_estornado` se tudo estornado; evento `venda_estornada`).
- **Web:** Configurações > Categorias com abas Produtos/Financeiras (financeira sem campo de atributos); Nova despesa com seletor das financeiras ativas (e aviso se não houver); no extrato, "Estornar venda" com o total e quantas formas de pagamento serão estornadas; `boleto` removido; depois de um estorno o relatório inteiro recarrega (antes só a lista: os totais do topo ficavam velhos, achado no navegador).
Números (antes -> depois): API 330 -> 386, web 121 -> 128, shared 51 -> 59; migrações 4 -> 5; rotas 28 -> 29. Arquivos de teste novos: `categorias-tipo` (API); alterados `financeiro`, `financeiro-lancamentos`, `configuracoes`, `rls-financeiro`, `proxy-web`, `openapi`, e os do shared e do web.
Evidência:
- `npm run verify` exit 0 (1 aviso antigo de lint).
- **Mutação (L-0006), 8 defeitos, todos pegos:** `FOR UPDATE` removido do estorno por origem (2 testes); filtro de tipo de origem removido (1); estornar também o já estornado (5); categoria sem filtro de ativa (1); sem filtro de tipo financeira (1); gravar o nome digitado em vez do cadastrado (1); empresa nova sem as categorias padrão (vários); financeira aceitando atributos na edição (1). Cada um desfeito e conferido no código.
- **Navegador (Playwright, Chromium 360×640, escuro e claro):** abas, criar/desativar categoria financeira, seletor só com ativas, formas sem boleto, despesa paga, estorno de venda de 2 formas (aviso, total R$ 89,90, os dois "Estornado", motivo nos dois estornos) e de 1 forma; totais do topo sobem R$ 89,90; 0 rolagem horizontal, 0 texto cortado, 0 fora da tela, 0 alvos < 48 px. **Dois achados só no navegador:** (a) o padrão do proxy do Vite não casava `/categorias?tipo=…` (query string) ⇒ L-0009 recorrência 2 e teste que usa a regex real; (b) totais do relatório não atualizavam depois do estorno (corrigido).
Decisões e limites:
- O estorno de **um** lançamento continua (corrige um pagamento lançado errado); o de **venda** é pela origem. A S10 deve chamar `estornarOrigem` na mesma transação em que devolve o estoque (RN-08).
- O lançamento guarda o nome da categoria (sem chave estrangeira): renomear uma categoria não muda o histórico, e o relatório mostra o nome da época.
- Categorias padrão só nascem em empresa **nova**; a empresa de exemplo do dev recebeu pelo script temporário (apagado). Em produção (S14) não há empresa antiga.
- A venda, hoje, só existe como lançamentos (a tela de Vendas é a S10): "estornar venda" funciona sobre os lançamentos que a Vendas vai gravar.
Aprendizado: L-0012 (servidores de dev órfãos, lição ativa 9), L-0009 e L-0002 com recorrência; `check-harness` OK (12 lições).
Pendências / riscos: ADR 004 segue "proposto"; L-0011 (teste instável do PIN nos logs) sem PR; `dev:parar` (ação da L-0012); S14 (proxy HTTPS com `?` e todos os prefixos); sem paginação (500 linhas); `<input type="date">` só testado no Chromium.

**PR #10 mergeado pelo Pedro em 2026-11-11 (portão da S06b cumprido).** `main` em `c6168a2`.

### Prep ambiente Windows (WSL2/Docker/.env) — 2026-11-12 — Composer
Gate: docs + infra local, **tier B**; DOC, ENV-04/05, SEC-01, MC (L-0013). Sem feature de produto.
Feito: WSL 3.0.5 + Ubuntu WSL2; Docker Desktop sem autostart no login; `.env` movido para a pasta do app; removida chave `AUTH_PEPPER` vazia duplicada; `docker compose up --build` com `/health` ok e OpenAPI 200; `docs/dev-windows.md` + README; diário/pendências atualizados; PR #10 confirmado MERGED; `main` em `c6168a2`.
Verificação: `wsl -l -v` → Ubuntu VERSION 2; `docker info` ok; `curl /health` → `{"status":"ok","db":"ok"}`; `git check-ignore -v .env`; `gh pr view 10` → MERGED.
Pronto para: colar o Prompt da S07 numa conversa nova.

### S07 — Produtos — 2026-11-11 — Claude Sonnet 5.5
Gate declarado: feature + mudança de banco + UI + dinheiro/estoque, **tier B**; regras TEST-01..08/12/17, CODE-*, SEC-03/07, OPS-11, ARQ (ADR), AUD-02/09/10, MC. Decisão estrutural ⇒ **ADR 006 (proposto)**. Critérios: RF-PRO-01…05/07 e RN-03/RN-05 com teste; saldo 0 não baixa; concorrência no limite; custo ausente para o Vendedor (2 empresas × 2 perfis); mutação ≥ 8 defeitos; navegador 360×640 nos 2 temas; `verify` e CI verdes.
Estado real ao abrir: `git rev-parse --show-toplevel` = `D:/apps/ailow-cloud`, `main` limpa em `507a8b2`, portas 54329/3000/5173 livres; **PR #12 (handoff) ainda aberto**, então a branch `feature/s07-produtos` saiu da `main` (o PR #12 só retoca este plano: pode haver conflito trivial em `docs/plano-execucao.md` na hora de mergear).
Feito (branch `feature/s07-produtos`):
- **Banco:** migração reversível `20261112180000_produtos`: `produtos`, `skus` e `movimentos_estoque` (RLS forçada, política `isolamento_empresa`, GRANT explícito, chaves compostas por empresa). Movimentos só-acréscimo (`SELECT`/`INSERT`), com autor, motivo, quantidade com sinal, `saldo_apos`, `seq` (ordem de gravação) e o id da venda nos tipos `venda`/`estorno_venda` (índice único: a mesma venda não baixa nem estorna o mesmo SKU duas vezes, RN-08). `CHECK (estoque >= 0)` (RN-03). Chave estrangeira composta com coluna gerada `'produto'`: **o banco recusa categoria financeira** num produto, e `ON DELETE RESTRICT` impede apagar categoria em uso (só desativa). Subir, descer e subir testado (`migracao.test.ts`).
- **Interface pública de estoque** (`src/produtos/estoque.ts`, `registrarMovimento`): `UPDATE ... AND estoque + $q >= 0` com a linha travada, na transação do chamador; teste de fronteira (só `src/produtos/` cita as tabelas). O estoque inicial do cadastro usa a mesma função.
- **API (OpenAPI 0.6.0):** `GET/POST /produtos` (cadastro com SKUs, código `PPPP-TT-CCC`, estoque inicial e mínimo por SKU; busca por nome sem acento/caixa, código e preço: "89,90" exato, "89" a faixa de R$ 89,00 a R$ 89,99), `POST /skus/{id}/estoque` (entrada/ajuste, só Dono), `GET /skus/{id}/movimentos`, `GET /estoque/alertas`. Numeração sem buraco por `pg_advisory_xact_lock` por empresa. **Vendedor:** custo, fornecedor e mínimo não são nem selecionados e a chave some da resposta; criar, ajustar, histórico e alertas dão 403. Criar e ajustar gravam `eventos_acesso`.
- **Shared:** contrato de Produtos e regras puras sem dependência (`produtos-calculos.ts`: preço sugerido em centavos, código de SKU/cor, ordem de tamanhos, faixa de preço), expostas ao navegador por `@ailow/shared/puro` para o web não levar o Zod (conferido: 0 marcas do Zod no bundle).
- **Web:** módulo Produtos (lista/busca com debounce, cartão por produto com variações, aba "Abaixo do mínimo"), assistente "Novo produto" em 6 passos (categoria → nome e porte → atributos [pulado se a categoria não tem] → tamanhos e cores [grades da P1 + tamanho/cor digitados] → custo, preço com sugestão do markup e fornecedor → estoque inicial e mínimo por SKU, com "aplicar a todos"), folha do SKU (código, **QR gerado no aparelho com `uqr` 0.1.3**, entrada/ajuste com motivo e histórico com autor) e **aviso vermelho na tela inicial do Dono** (3 primeiros itens + selo no bloco Produtos). Produtos deixou de ser "em breve" (`modulos.ts` + teste).
Números (antes -> depois): testes API 386 -> 530, web 128 -> 195, shared 59 -> 136; migrações 5 -> 6; rotas 29 -> 34; OpenAPI 0.5.0 -> 0.6.0; bundle de produção 526 kB -> 599 kB (Mantine + telas novas; sem Zod; code-split fica para a S13).
Evidência do "pronto quando":
- `npm run verify` exit 0 (1 aviso antigo de lint em `main.tsx`; 530 + 195 + 136 testes; build).
- **RN-03:** saldo 0 não baixa (nada gravado); baixar mais que o saldo recusa; baixar exatamente o saldo zera; **concorrência no limite** com a 1ª transação aberta e a 2ª comprovadamente bloqueada (400 ms) e depois recusada, e 5 baixas simultâneas com saldo 3 = exatamente 3 passam; pela API, 2 baixas simultâneas = 200 e 409; `UPDATE` para saldo negativo é recusado pelo banco.
- **RF-PRO-07:** o texto cru da resposta do Vendedor não contém `custo`, `fornecedor` nem `estoque_minimo`; `GET /estoque/alertas` e o histórico dão 403 a ele; 2 empresas × 2 perfis em `produtos.test.ts` e isolamento nas 3 tabelas em `rls-produtos.test.ts` (70 casos).
- **Mutação (L-0006), 17 defeitos plantados por script (`split/join`, sem regex), todos pegos** e os arquivos restaurados (`git status` limpo depois): baixa sem a condição `>= 0`; códigos de erro trocados; `saldo_apos` errado; custo/fornecedor selecionados ao Vendedor; mínimo selecionado ao Vendedor; alerta com `<=`; criar produto sem `exigirPerfil`; histórico aberto ao Vendedor; numeração sem a trava; categoria financeira aceita; busca sem tratar acento; banco sem o `CHECK` de saldo; `GRANT UPDATE` em movimentos; política de `skus` com `USING (true)`; preço sugerido sem arredondar; Produtos "em breve"; sinal de menos como hífen. Nenhum sobreviveu na 1ª rodada.
- **Navegador (Playwright, Chromium 360×640, escuro e claro):** lista, busca por código, os 6 passos do assistente, cadastro de um produto de 24 variações, folha do SKU (ajuste negativo bloqueado quando passa do saldo; "Vai ficar com 0"; histórico com autor), aba "Abaixo do mínimo", tela inicial com o aviso e a visão do Vendedor. Medido em cada tela: 0 rolagem horizontal, 0 texto cortado, 0 elementos fora da tela, 0 alvos < 48 px; nome de produto de 53 caracteres quebra em linhas (D23). **2 defeitos só achados no navegador e corrigidos:** o rótulo "Continuar" era cortado (padding do botão; o último passo agora empilha os botões) e o `Switch` dos atributos tinha alvo de 30 px (linha de 48 px). Contraste do botão do aviso conferido (branco sobre `#c92a2a`, ≈ 6:1; antes ficava abaixo de 4,5:1).
- **QR:** o SVG renderizado na folha foi decodificado por um leitor **independente** (`jsqr`, instalado só fora do repositório) e devolveu exatamente `0001-40-CHO`; e `0042-46-CHO` cabe na versão 1 (21×21) com correção M (teste `qr.test.ts`): resolve o "a validar" da P2 para esse código. **Não** foi lido com câmera de celular nem impresso (S08).
Decisões e limites (propostas por mim; o Pedro confirma ao mergear — também no ADR 006):
- Aviso = estoque **estritamente abaixo** do mínimo (`<`); mínimo 0 = sem aviso. (O selo "Baixo" do DS passou de `<=` para `<` para casar com o aviso.)
- Preço sugerido arredondado ao centavo (metade para cima): o PRD diz "sem arredondamento", impossível em centavos (RN-01). A API guarda o preço digitado.
- Fornecedor = texto livre no v1; tabela na S11. Produto **imutável** nesta versão (sem editar preço, nome, grade nem desativar): preço errado exige produto novo até uma migração de edição (pendência abaixo).
- Limites: 144 variações e 12 cores por produto, 9.999 produtos por empresa (4 dígitos do código), 200 produtos na lista.
- Vendedor também não vê fornecedor nem estoque mínimo (além do custo), por ser decisão de compra.
Pendências / riscos honestos:
- **CI do PR #14:** 6/6 verdes (verify, compose, imagem, seguranca-sast, seguranca-sca, seguranca-segredos; run 43112617551). O Compose não foi rodado localmente (só no CI).
- Sem **edição de produto**, sem acrescentar tamanho/cor depois, sem desativar produto: o produto vai precisar de uma sessão de edição (preço é urgente na prática).
- Para a S10 falta uma função de consulta (buscar SKU por código e preço, na transação da venda): deixei de fora por ser YAGNI até lá.
- Saldo e movimentos são consistentes pela interface (o runtime ainda pode atualizar `estoque` direto); trigger avaliado e adiado (ADR 006, alternativa 2).
- Testado só no Chromium; não em Safari/iOS nem com câmera real. Texto de 13–14 px segue como no DS.
- Perguntas do Marcos da P1 (Q1–Q5: as "3 medidas" do sutiã, Plus por letra ou G1/G2, preço por tamanho, cores, atacado) continuam abertas e podem mexer no modelo.
- O dev local (`.dev-data/`) ganhou categorias e 1 produto de teste (`Tomara que caia Essência…`, nº 0001); apague a pasta para recomeçar. Servidores de dev parados por PID/`pg_ctl` e portas conferidas livres (L-0012).
Aprendizado: **L-0014** (testes com ordem/busca dependentes de uuid/hex aleatório, achados antes do merge; lição ativa 11) e recorrência da L-0011; o guarda do proxy (L-0009) e o contrato OpenAPI funcionaram como desenhados. Falhas minhas no caminho, todas corrigidas antes do commit: expectativa de código de erro do banco errada no teste (`23001`, não `23503`); teste que procurava o código de B na A (o código é único por empresa); conversão centavos→texto improvisada (virou função com teste); um lote de testes de rótulos foi escrito junto com a implementação, **sem observar o vermelho separadamente**. `node harness/scripts/check-harness.mjs` -> Harness OK (14 lições).
Verificação: `npm run verify` exit 0; mutação 17/17; Playwright 360×640 nos 2 temas; decodificação do QR; `check-harness`.

### Pendências transversais (fora de sessão) — 2026-11-11
- [x] **Mover o arquivo de ambiente real para a pasta do app.** Feito 2026-11-12: `D:\apps\.env` → `D:\apps\ailow-cloud\.env`; `git check-ignore -v .env` ok; removida linha duplicada vazia `AUTH_PEPPER=` que quebrava o Compose (last-wins). Não ler/colar conteúdo (SEC-01).
- [ ] Decidir a reescrita do histórico do Git (acervo): **adiada** (Pedro 2026-11-12: não limpar ainda). Sem force-push/ruleset neste ciclo.
- [x] **WSL2 + Docker Desktop + Compose local.** Feito 2026-11-12. Nested virt `ERROR_INVALID_DATA` = limitação aceita (`docs/dev-windows.md`).

### Limpeza de pendências (pós-plano; paralelo à S07 no Claude Code) — 2026-11-12 — Composer
Gate: feature logo + bugfix PIN + tooling + docs, **tier B**. Branch `chore/limpeza-pendencias-pos-s07` (worktree; S07 ainda WIP fora desta branch).
Feito:
- **ADR 004 aceito** (código já na main desde S04).
- **RF-CFG-02 logo via UI:** migração `logo_bytes`/`logo_mime` (PNG/JPEG/WebP ≤ 512 KiB, sem SVG); `PUT/DELETE/GET /empresa/logo`; Configurações > Empresa envia/troca/remove; OpenAPI 0.5.1; `@fastify/multipart`.
- **L-0011:** asserção SEC-16 parseia JSON do log (não substring solta em `time`/UUID).
- **`npm run dev:parar`** (L-0012 ação 3).
- **Adiados com dono:** reescrita acervo (Pedro); proxy HTTPS → S14; Safari/iOS → só Chromium por ora; texto 13–14 px aceito; nested virt aceito.
Verificação: `npm run verify` (ver PR).

### Estado de retomada — 2026-11-12 (pronto para S07; sanado)
- **Git:** PRs #9–#12 mergeados na main de base desta limpeza. S07 segue no Claude Code (`feature/s07-produtos`) — mergear limpeza e S07 com cuidado (proxy/modulos).
- **Ambiente / docs:** `.env` ok; WSL/Docker ok; `docs/dev-windows.md`; `dev:parar` disponível.
- **Em aberto (adiados):** reescrita histórico acervo; proxy HTTPS S14; Safari/iOS; polish visual 13–14 px (aceito).

### Estado de retomada — 2026-11-11 (histórico)
- **Git:** S05 (PR #6) e S05b (PR #7) mergeados; handoff apontava para S06. Superado pelos estados e PRs #9/#10 acima.
- **Fazer depois do reinício:** Docker/WSL, mover `.env`, `compose up`. **Cumprido** no estado de 2026-11-12 pós-WSL/Docker.

### Estado de retomada — 2026-11-11 (fim da S07; aguardando o portão do Pedro)
- **Git:** branch `feature/s07-produtos` com a S07 completa, a partir da `main` em `507a8b2`; PR da S07 = **#14** (6/6 checks verdes); PR #12 (handoff) ainda aberto: se for mergeado antes, resolver o conflito trivial neste arquivo. Depois do merge: `git checkout main && git pull --ff-only`.
- **Ambiente:** servidores de dev parados, portas 54329/3000/5173 livres, Compose derrubado; `.dev-data/` com dados de teste da S07.
- **Portão 🚦:** o Pedro revisa e mergeia o PR da S07 (confirma ou altera o ADR 006: aviso `<`, arredondamento do preço, fornecedor texto, produto imutável). **O prompt da S08 só vale depois do ok.**
- **Em aberto (não bloqueiam a S08):** edição/desativação de produto; consulta de SKU para a S10; ADR 004 "proposto"; reescrita do histórico (acervo); logo definitiva (RF-CFG-02); L-0011; `dev:parar` (L-0012); proxy HTTPS S14 (prefixos novos: `produtos`, `skus`, `estoque`); texto 13–14 px; Safari/iOS; perguntas Q1–Q5 para o Marcos.
