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
| S09 | Clientes | Cadastro mínimo, celular único/validado, busca, ficha com histórico, botão WhatsApp, aviso LGPD, excluir/anonimizar | RF-CLI-01…04 | Vendas | — |
| S10 | Vendas | Nova venda, scanner (câmera), busca, carrinho, bloqueio sem estoque, fechamento (cliente, desconto, múltiplas formas), finalização atômica, comprovante (link WhatsApp + imprimível), excluir venda (estorno), relatório | RF-VEN-01…10; RN-02/07/08; **RNF-04 (≤ 8 toques) medido em E2E** | Compras | — |
| S11 | Compras | Fornecedores, pedido (rascunho → enviado → recebido), enviar pelo WhatsApp, receber (estoque + parcelas, atômico), relatório | RF-COM-01…05; RN-11 | Pessoas | — |
| S12 | Pessoas | Bater ponto, espelho de ponto | RF-PES-01/02 | — | — |
| S13 | Qualidade final | k6 smoke/carga/estresse com thresholds (RNF-01/02); Spectral + Schemathesis no CI; E2E dos fluxos críticos; threat model 1 página; C4 contexto/contêineres + mapa de contextos; runbooks (deploy, rollback, migrar VPS); `docs/harness-adoption.md`; métricas RED + SLO | Critérios de aceite 4–8 do PRD §10 marcáveis com evidência | Deploy | — |
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
- **Arquivo:** `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows, intactos; ler só sob demanda com Grep).

## Pendências transversais (fora de sessão)
- [x] Arquivo de ambiente real na pasta do app (2026-11-12). Não ler/colar conteúdo (SEC-01).
- [ ] Reescrita do histórico do Git (acervo): **adiada** (Pedro, 2026-11-12). Sem force-push/ruleset neste ciclo.
- [x] WSL2 + Docker Desktop + Compose local (2026-11-12); guia `docs/dev-windows.md`.

### Estado de retomada — 2026-11-11 (pós-S07; sobrescrever a cada sessão)
- **Git:** S07 (PR #14) mergeada; `main` em `812516b`. Esta migração do plano está na branch `docs/plano-enxuto` (PR próprio). Depois do merge: `git checkout main && git pull --ff-only`.
- **Ambiente:** servidores de dev parados, portas 54329/3000/5173 livres, Compose derrubado; `.dev-data/` com dados de teste (categorias e 1 produto). Testes ao fim da S07: API 535, web 195, shared 136; OpenAPI 0.6.0; 6 migrações base + logo.
- **Próxima:** S08 Etiquetas QR (ADR 003 reservado). O QR do SKU já existe na tela (`uqr` 0.1.3, decodificado por leitor independente); a S08 decide o formato de impressão (P2) e o PDF.
- **Decisões do ADR 006 a confirmar pelo Pedro** (arquivo ainda diz "proposto"): aviso com `<` (mínimo 0 = sem aviso), preço sugerido arredondado ao centavo, fornecedor como texto no v1, produto sem edição.
- **Em aberto (não bloqueiam a S08):** edição/desativação de produto (preço errado exige produto novo); consulta de SKU por código para a S10; reescrita do histórico (acervo); proxy HTTPS da S14 (prefixos `produtos`, `skus`, `estoque`, `empresa`); texto 13–14 px; Safari/iOS; perguntas Q1–Q5 para o Marcos (P1 §6); `ATUAL.md` está com ~10 KB por causa da entrada da S07 (podar na S08: mover a S07 para o arquivo).
