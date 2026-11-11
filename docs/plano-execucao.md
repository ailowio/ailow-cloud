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
