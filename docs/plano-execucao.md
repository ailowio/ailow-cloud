# Plano de execução em sessões — Ailow Cloud v1

> **Fonte de contexto entre chats** (skill `execucao-em-sessoes`; leitura em camadas, teto deste arquivo ~15 KB). Diário em `docs/diario/`.
> Especificação: `D:\apps\ailow-cloud\docs\prd\PRD-ailow-cloud-v1.md` (PRD). Decisões: `D:\apps\ailow-cloud\acervo\marcant\discovery\decisoes-brainstorm.md` (D1…D19).
> Harness: `D:\apps\harness\PROTOCOLO.md` — **tier B**, Curso **Projeto A**, prazo **16/11/2026**. Repo remoto: https://github.com/ailowio/ailow-cloud

## Contrato de toda sessão

1. **Abrir em camadas (não ler o diário antigo):** este Contrato + a linha da sessão na tabela + o Estado de retomada + a **última** entrada de `docs/diario/ATUAL.md`; o PRD só nas seções citadas; as lições ativas do harness; as skills do handoff. O resto (diário arquivado, ADRs, pesquisas) é lido **sob demanda**, com Grep, quando a tarefa pedir. Declarar o que foi lido e o **gate do harness** (tipo de trabalho, tier B, IDs de regra da sessão, critérios de aceite).
2. **Estado real:** conferir o repositório antes de escrever (`git status`, `verify`, testes, migrações aplicadas). Os números do handoff são dicas.
3. **Proteção:** sessão que altera schema → migração nova, reversível (expand → migrate → contract, OPS-11); nunca editar migração já aplicada.
4. **Test-first:** Red → Green → Refactor. Teste nunca é alterado só para passar (TEST-08).
5. **Escopo fechado:** só a sessão atual; respeitar o "Não fazer".
6. **Verificar:** `verify` (lint + tipos + testes + build) verde + o critério "pronto quando" da sessão com evidência colada no Diário.
7. **Commit/push/PR/deploy:** **só com autorização explícita do Pedro** (Conventional Commits, branch curta, PR com template).
8. **Fechar:** entrada **curta** (≤ 2 KB) no `diario/ATUAL.md` + poda (passou de 3 entradas ou ~8 KB: mover as mais antigas, sem editar, para `diario/ARQUIVO-*.md`) + **sobrescrever** o Estado de retomada + docs vivas tocadas (README, OpenAPI, ADR, CHANGELOG) + lição registrada se algo falhou (MC) + prompt da próxima sessão **no chat** (ou "aguardando portão"). Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
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
| S09 | Clientes | Cadastro mínimo, celular único/validado, busca, ficha com histórico, botão WhatsApp, aviso LGPD, editar, inativar/excluir | RF-CLI-01…05 | Vendas | — |
| S10 | Vendas | Nova venda, scanner (câmera), busca, carrinho, bloqueio sem estoque, fechamento (cliente, desconto, múltiplas formas), finalização atômica, comprovante (link WhatsApp + imprimível), excluir venda (estorno), relatório | RF-VEN-01…10; RN-02/07/08; **RNF-04 (≤ 8 toques) medido em E2E** | Compras | — |
| S11 | Compras | Fornecedores, pedido (rascunho → enviado → recebido), enviar pelo WhatsApp, receber (estoque + parcelas, atômico), relatório | RF-COM-01…05; RN-11 | Pessoas | — |
| S12 | Pessoas | Bater ponto, espelho de ponto | RF-PES-01/02 | — | — |
| S13a | Qualidade final: contrato da API | Spectral (lint do OpenAPI) no `verify` e no CI; Schemathesis contra a API real com Postgres (job `contrato` no CI); falhas que o fuzz achar viram teste vermelho → correção | PRD §10.6: lint com 0 erros e Schemathesis com 0 falhas, e os dois **reprovam** com um defeito proposital (canário) | k6, docs de arquitetura, deploy | — |
| S13b | Qualidade final: carga e SLO | k6 smoke/carga/estresse com thresholds de RNF-01/02 (por contêiner); métricas RED + SLO (RNF-03) e o alerta | PRD §10.7: três cenários rodados com números e thresholds que reprovam de verdade | Schemathesis, docs, deploy | — |
| S13b2 | Desempenho da venda (RNF-01/02) | 🚦 ADR 009 da numeração da venda (lock de `venda_sequencia` serializa as vendas); pool configurável; custo de `GET /produtos`; re-medir com `scripts/carga.sh` | Carga 50 VUs passa RNF-01 (venda p95 ≤ 500 ms, erro < 1%) e RNF-02 (busca p95 ≤ 300 ms) pelo k6, ou relatório honesto + decisão do Pedro registrada | E2E, docs de arquitetura, deploy, relaxar threshold | ✅ feita: ADR 009 aceito (A), carga passa |
| S13c | Qualidade final: E2E e documentação (**feita**: docs na S13b2; E2E no CI e runbooks na S13c, ver diário; falta só o CI verde no PR) | E2E dos fluxos críticos (nova venda, receber compra, ponto, cancelar venda); threat model 1 página; C4 contexto/contêineres + mapa de contextos; runbooks (deploy, rollback, migrar VPS); `docs/harness-adoption.md`; checklist do PRD §10 marcado com evidência; remover o aviso "em breve" da tela inicial | PRD §10.1–5 e 8 marcáveis com evidência | Deploy | — |
| S14 | Deploy + entrega do curso | Compose na VPS (isolado, limites), proxy HTTPS, deploy pelo pipeline, smoke em produção, rollback ensaiado, inventários de auditoria (sistema, acessos, rotinas, interfaces), tag `v1.0.0`; roteiro do vídeo; pacote Moodle | URL no ar + checklist do curso + evidências | Enviar no Moodle sem pedido | 🚦 Pedro autoriza deploy, chave SSH de deploy (acesso novo → AUD) e push da tag |

Se o prazo apertar: cortar **do fim** (S12 → S11), nunca no meio de um módulo (D1).


## Modelo do prompt de sessão (curto)

```text
Sessão SNN de 14 — <título> (plano "Ailow Cloud v1").
Plano: D:\apps\ailow-cloud\docs\plano-execucao.md · Diário: D:\apps\ailow-cloud\docs\diario\ATUAL.md
Abra em camadas (NÃO leia o plano inteiro): Contrato + linha da SNN + Estado de retomada,
e a última entrada do Diário. Leia o resto só se precisar (PRD só nas seções citadas).
Cumpra o gate do harness (D:\apps\harness\PROTOCOLO.md §1).
Skills/regras desta sessão: <lista>.

Escopo:
1. ...
Pronto quando: <critério>.
Não fazer: <próximas sessões>.
Ao terminar: diário curto (≤ 2 KB) + poda + Estado de retomada sobrescrito; entregue o prompt
da SNN+1 (ou "aguardando portão do Pedro").
```

O prompt de cada sessão é entregue **no chat** ao fechar a anterior; não é gravado aqui.

## Diário

- **Ativo:** `docs/diario/ATUAL.md` (as 3 últimas entradas; ler só a última por padrão).
- **Arquivo:** `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) e `docs/diario/ARQUIVO-S07-S09.md` (S07 em diante); intactos, ler só sob demanda com Grep.

## Pendências transversais (fora de sessão)
- [x] Arquivo de ambiente real na pasta do app (2026-11-12). Não ler/colar conteúdo (SEC-01).
- [ ] Reescrita do histórico do Git (acervo): **adiada** (Pedro, 2026-11-12). Sem force-push/ruleset neste ciclo.
- [x] WSL2 + Docker Desktop + Compose local (2026-11-12); guia `docs/dev-windows.md`.
- [ ] **Impressão física das etiquetas (S08, Pedro):** comprar a bobina 33 × 22 mm de 3 colunas, informar o modelo da impressora, imprimir o PDF em tamanho real (100%), calibrar espaço entre colunas/margem (`GEOMETRIA_PADRAO`, ADR 003) e fotografar a leitura pela câmera do celular. É o "pronto quando" da S08; não bloqueia a S09.
- [ ] **Domínio `cloud.ailow.com.br` (Pedro, 2026-11-12): domínio em transição.** Fazer **por último** na S14: registro A `cloud` → IP da VPS (TTL baixo, sem AAAA), conferir com `nslookup`, só então deploy na VPS, certificado e smoke em produção. Até lá a S14 avança só com o que não depende dele.
- [ ] **Fechamento conjunto (Pedro, 2026-11-12: resolver todas juntas no fim da implementação, depois da S14):**
  - CI verde do job `e2e` no GitHub (nunca rodou lá) e então marcar ✅ o item 2 de `docs/prd-checklist-10.md`.
  - Ensaiar e medir os runbooks (`docs/runbooks/`): deploy, rollback, migração/restore; preencher "tempo medido"; confirmar o gatilho numérico de reversão (health 3×, 5xx > 1 %, 15 min).
  - Backup: restaurado ao menos uma vez com evidência; retenção e local; onde ficam os arquivos enviados (logo); `ailow_app` no restore.
  - Checks obrigatórios da `main` (`contrato`, `e2e`, `carga-smoke`, `alertas`?), rate limit e cifra do TOTP, `/metrics` fora da internet, RNF-01/02 na VPS.
  - Impressão física das etiquetas (S08), acima.
  - Menores: `npm run dev:parar` quebrado na `main`; Zod/chunk 763 kB no bundle web; edição/desativação de produto; reescrita do histórico (acervo); ADR 003 e 006 propostos; perguntas Q1–Q5 para o Marcos.


### Estado de retomada — 2026-11-12 (pós-S14b; sobrescrever a cada sessão)
- **Git:** `main` em `db171df` (PR #26 da S14a mergeado). Branch `feature/s14b-deploy-portavel` com a S14b **não commitada** (commit, push e PR só com pedido do Pedro). O `git status` também mostra ~34 arquivos `M` que são só ruído de CRLF (`git diff --ignore-cr-at-eol` dá 0): não commitar.
- **Ambiente:** Docker Desktop de pé, **sem Swarm** (o `stack-local.sh` cria e remove o dele); portas 3000, 5173 e 54329 livres; volume `ailow-cloud_dbdata` do compose de dev preservado. Testes: API 783, web 250, shared 237; OpenAPI 0.14.0.
- **S14a feita** (ADR 010, rate limit, cifra do TOTP). **S14b feita (parcial):** stack, imagem do web, Traefik de host novo, backup/restore (ensaio local), `stack-local.sh` + job `stack`, `publicar.yml`, runbooks e inventários. **Não feitos na S14b:** proteger `main` + checks obrigatórios (é do humano, EX-01), roteiro do vídeo, pacote do curso. **Nunca executados:** `publicar.yml` (precisa de tag), job `stack` no GitHub (só rodou local), `restore` a partir do Drive real.
- **Próxima: S14c (toca a VPS; só com o Pedro presente):** DNS de `cloud.ailow.com.br` (em 2026-11-12 o 8.8.8.8 ainda dava "Non-existent domain": conferir `nslookup`); descobrir na VPS o nome real do resolvedor, da rede e do entrypoint do Traefik; criar os 3 Swarm secrets; chave SSH de deploy; publicar o app OAuth do Drive e configurar rclone `crypt`; agendar e alertar o backup; deploy por tag; smoke; ensaiar rollback e restore **com tempos**; RNF-01/02 na VPS; tag `v1.0.0` só depois do smoke.
- **S14c (por último, toca a VPS):** Pedro cria o A de `cloud.ailow.com.br` → `nslookup` → chave SSH de deploy → deploy pelo pipeline → certificado → smoke (`/health` 200, `/metrics` inacessível da internet) → rollback e restore ensaiados com tempos nos runbooks → RNF-01/02 na VPS → tag `v1.0.0`. Autorizações dadas por Pedro ("OK, autorizado": deploy, chave SSH, tag); tag só depois do smoke.
- **Fatos da VPS (leitura, 2026-11-12):** Ubuntu 20.04, 15,6 GB RAM (≈11,7 GB livres), sem swap, `ufw` inativo, Swarm com Traefik v2.11 (`letsencryptresolver`, rede `CopelNet`). Detalhes e credenciais ficam fora do repositório público.
- **Em aberto (não bloqueiam):** `npm run dev:parar` quebrado na `main`; chunk web 763 kB; edição/desativação de produto; reescrita do histórico (acervo); impressão física das etiquetas (S08); perguntas Q1–Q5 ao Marcos; Marcant aceitar dividir servidor é palavra do Pedro, sem registro escrito.
