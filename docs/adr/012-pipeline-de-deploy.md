# ADR 012 — Pipeline de deploy: GitHub Actions por SSH com aprovação, comando forçado e reversão automática

- **Status:** aceito em 2026-11-13 pelo Pedro ("siga sua recomendação para o desenho"). **Decisor:** Pedro. **Tier:** B. **Regras:** OPS-04/05/11, AUD-24/25/27/96, SEC-*, CI-07/18. **Lições:** L-0005, L-0006, L-0021.
- **Escopo do texto:** o repositório é público; sem IP, nomes de outros serviços nem credenciais.

## Contexto
- O harness exige deploy por pipeline (OPS-04; AUD-24; PROTOCOLO §4 fase 9) e o plano da S14 dizia "deploy pelo pipeline". A S14c entregou o deploy **manual** por SSH, registrado como exceção EX-02 (revisão em 2026-11-20).
- A VPS é compartilhada com outros sistemas (ADR 010), tem Swarm de nó único e **SSH acessível pela internet**. O repositório é público, com um único humano (EX-01: aprovação ≠ autor dispensada).
- Medido em produção: deploy da `v1.0.0` 86 s e rollback por tag 73 s, com a API indisponível por poucos segundos na troca (`stop-first`).

## Decisão
1. **Workflow `deploy.yml`**, só por `workflow_dispatch` com a tag como entrada. Valida formato, existência, commit na `main` (mesma regra do `publicar.yml`) e que as duas imagens existem no GHCR.
2. **Aprovação separada do disparo:** o job de deploy roda no Environment `producao` com **revisor obrigatório** e restrito à branch `main`. Os segredos (`DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_HOST_KEY`) existem só nesse Environment. A chave do host é **fixada** (`StrictHostKeyChecking=yes`), nada de confiar na primeira conexão.
3. **Chave SSH dedicada** com `command="/opt/ailow/bin/ssh-entrada.sh",restrict`: só aceita o comando exato `deploy vX.Y.Z`; sem shell, sem pty, sem encaminhamento de porta. O `ssh-entrada.sh` é a única parte instalada à mão (0755, root); ele serializa com `flock`, confere tag e `main` de novo e só então executa o `deploy.sh` **da tag** (clone público somente leitura).
4. **`deploy.sh`:** backup antes (falhou ⇒ não mexe na stack, exit 10); grava a tag; `docker stack deploy`; espera `api` e `web` convergirem **e 3 checagens seguidas de `/health` = 200** (gatilho OPS-05); se não, **volta sozinho** para a tag anterior (exit 20) e reporta. Reversão que não se confirma ⇒ exit 21, intervenção humana.
5. **Evidência (AUD-24/27):** o run guarda aprovador, tag, digests em uso e o log do servidor; mais a verificação de fora (`/health` 200, `/metrics` 404, HSTS). Rollback manual = rodar o mesmo workflow com a tag anterior.
6. **Testado sem VPS** (`scripts/deploy-test.sh`, no job `stack` do CI): recusa de comandos injetados, sucesso, health falhando ⇒ reversão, backup falhando ⇒ nada alterado, Swarm revertendo sozinho. Um **canário** prova que o teste reprova se a reversão quebrar.

## Alternativas consideradas
| Alternativa | Por que não |
|---|---|
| Agente na VPS que busca a tag nova (timer) | Não precisa de SSH aberto, mas aprovação e log ficam fracos (AUD-24/27) |
| Runner self-hosted na VPS | Executa código de workflow num host de produção compartilhado; o repositório é público |
| Webhook do Portainer do host | Dependência de uma ferramenta que não é nossa |
| Continuar manual (EX-02) | Diverge de OPS-04/AUD-24; depende de uma pessoa com SSH, sem aprovação separada |

## Consequências e riscos residuais
- **Acesso novo** (matriz de acessos): chave dedicada + 4 secrets no Environment. **Rotina e interface novas** (inventários). Quem controla o GitHub (conta do Pedro) controla o deploy: mitigado por MFA da conta, revisor obrigatório e tag só de commit da `main` (a `main` só recebe PR com 11 checks). Com a EX-01, o revisor é o próprio disparador: o controle compensatório é o log do run e a janela combinada com o cliente.
- A chave roda como `root` (o Docker já é equivalente a root); o que a limita é o comando forçado, **não** o usuário. Se o `ssh-entrada.sh` tiver falha, a chave vira acesso root: por isso ele é curto, testado e instalado à mão. Mudar esse arquivo é mudança manual registrada.
- SSH continua exposto à internet (a VPS é compartilhada e não é nossa): fora do escopo deste ADR.
- A API fica indisponível por poucos segundos a cada deploy (`stop-first`, uma réplica); aceitável sem clientes reais, rever com cliente (janela combinada, ou `start-first` com migração compatível).
- Na VPS nova (`migrar-vps.md`): instalar o `ssh-entrada.sh`, a chave e o clone; trocar `DEPLOY_HOST` e `DEPLOY_HOST_KEY`.
