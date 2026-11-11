# Diário arquivado — S00 a S06b e Prep ambiente Windows

> **Não ler por padrão.** Entradas antigas do diário, movidas **intactas** de `docs/plano-execucao.md` em 2026-11-11 (migração do plano, skill `execucao-em-sessoes`). Consulte só sob demanda, com Grep por palavra-chave (ex.: `Grep "RN-08" docs/diario/`).
> Diário ativo: `docs/diario/ATUAL.md`.

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

