# Runbook: deploy de uma versão na VPS (stack do Swarm)

- **Serviço:** Ailow Cloud (`db`, `api`, `web`; HTTPS pelo Traefik do host) · **Dono:** Pedro · **Última revisão:** 2026-11-13 · **Ensaiado na VPS:** 2026-11-12 (`v0.1.0`, 1ª implantação) e 2026-11-13 (`v1.0.0` sobre `v0.1.0`) · **tempo medido:** 1ª implantação ≈ 5 min do `docker stack deploy` ao `/health` 200 (inclui o 1º pull das imagens e a 1ª emissão do certificado); **atualização de versão: 86 s** até `api` e `web` convergirem, com 8 de 61 checagens de `/health` de fora ≠ 200 (a troca `stop-first` da `api` derruba a API por alguns segundos) e 0 erros nos logs
- Regras: OPS-04 (deploy repetível e serializado), OPS-05 (gatilho de reversão), OPS-11 (banco compatível com 2 versões), AUD-24/27 (mudança rastreável), ENV-12 (nunca apagar volume sem intenção).

## 0. O que existe e o que não
- **Existe e foi exercitado [verificado local/CI]:** `ops/stack/ailow.yaml` (Swarm: `db` com Postgres 18.6, `api` que **migra e depois sobe**, `web` com nginx) e o script `scripts/stack-local.sh` (job `stack` do CI), que sobe a stack num Swarm descartável e confere: `db`/`api`/`web` em 1/1; `/health` 200 e `/metrics` 404 pelo `web`; `db` e `api` inalcançáveis da rede do proxy; **API sem saída para a internet**; `api` e `web` sem root, FS somente leitura, `cap_drop: ALL`, limite de memória; **nenhum segredo em `docker service inspect`** (vão por Swarm secrets); labels do Traefik (Host, certresolver, HSTS 1 ano). Imagens: `publicar.yml` publica `api` e `web` no GHCR em tag `vX.Y.Z`.
- **Verificado na VPS em 2026-11-12 (S14c, `v0.1.0`):** `publicar.yml` verde em tag real (digests no resumo do run); pull das imagens **sem credencial** (pacotes públicos); stack no Swarm do host com `db`, `api` e `web` em 1/1; `/health` 200 e `/metrics` 404 **pela internet**; HSTS 1 ano, http→https 308, certificado Let's Encrypt emitido na 1ª subida; os 4 fluxos do E2E contra o domínio (venda em 5 toques, limite 8); k6 smoke (1 usuário, 20 s): p95 de busca 209 ms e de venda 170 ms, erro 0 %. Valores reais do host: `CERT_RESOLVER=letsencryptresolver`, `PROXY_NETWORK=CopelNet`, `ENTRYPOINT=websecure` (os do plano, conferidos ao vivo).
- **Carga de 50 usuários na VPS (2026-11-13, k6 `carga`, ~110 s, do PC do Pedro; RTT ≈ 61 ms):** 5 692 vendas e 5 692 buscas, **erro 0 %**; **RNF-01 (venda) p95 447 ms ≤ 500: passou; RNF-02 (busca) p95 474 ms > 300: REPROVOU.** `api` e `db` ficaram em ~100 % de 1 CPU cada (limite da stack) e a carga do host foi a 5,85 em 4 núcleos, dividido com outros serviços. Local (S13b2) a busca dava 246–268 ms. **Hipótese não verificada:** o teto de 1 CPU por serviço e o host compartilhado explicam a diferença; não foi testado com limites maiores. O critério não foi alterado (L-0017); a decisão (aumentar limites, otimizar a busca ou re-medir na VPS própria) é do Pedro. Dados de teste removidos em seguida.
- **Exceção EX-02 (PROTOCOLO §7; proposta, aguarda o Pedro):** o deploy é **manual** (SSH + `docker stack deploy`), o que diverge de OPS-04 (deploy automatizado), AUD-24 e PROTOCOLO §4 fase 9 ("deploy só por pipeline"). Motivo: a S14c entregou a infraestrutura antes do pipeline. Risco aceito: o deploy depende de uma pessoa com SSH, sem aprovação separada nem log imutável. Compensação: runbook, cada comando registrado no diário privado, release com digests conferidos, tag só em commit da `main` com 11 checks. **Revisão: 2026-11-20 ou quando o pipeline existir (o que vier primeiro).** **Atualização 2026-11-13:** o pipeline foi implementado ([ADR 012](../adr/012-pipeline-de-deploy.md), aceito); a EX-02 só é **encerrada depois do 1º deploy feito por ele em produção** (ver §2).
- **Não verificado:** renovação automática do certificado; atualização de versão **com migração nova** e com dados reais (a `v1.0.0` não trouxe migração em relação à `v0.1.0`); `main` protegida pelo ruleset (feito no GitHub pelo Pedro).
- **O host não tem `node`** (nem `rclone` até a S14c): gere segredos com `openssl rand` (§1.6). Docker do host: 28.1.1.
- O Swarm **ignora `security_opt: no-new-privileges`** (conferido no Docker 29.9.3); a defesa aqui é não-root + `cap_drop: ALL` + FS somente leitura.
- Consequência: o deploy é feito pelo **pipeline** (§2, ADR 012); o manual (§2b) fica só para emergência. Alteração manual em produção é **mudança registrada** (AUD-24): anotar no release.

## 1. Antes (pré-condições — todas verdadeiras, senão não começa)
1. O PR da versão está mergeado em `main` com **todos** os checks verdes (`verify`, `contrato`, `e2e`, `carga-smoke`, `alertas`, `seguranca-*`, `imagem`, `stack`, `compose`) e aprovação humana ≠ autor. Evidência: link do PR.
2. `CHANGELOG.md` com a seção da versão; tag `vX.Y.Z` criada **no commit mergeado**; o workflow `Publicar imagens` terminou verde (digests no resumo do run).
3. Há **backup recente e restaurável** (`backup.md`): rode `backup.sh` agora, antes do deploy, **se a versão tiver migração**.
4. A migração da versão é compatível com a versão **anterior** da API rodando (expand → migrate → contract, OPS-11). Se não for, a versão não é "voltável" sem restaurar backup: tratar como **janela combinada** com o Dono da loja.
5. Janela fora do horário de venda da loja (a combinar com o Marcos). Um deploy por vez.
6. **Primeira implantação apenas:** segredos criados no Swarm (uma vez), sem imprimir valores:
   ```bash
   node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))"  | docker secret create ailow_postgres_password -
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"  | docker secret create ailow_auth_pepper -
   node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" | docker secret create ailow_totp_chave -
   ```
   Guarde `AUTH_PEPPER` e `TOTP_CHAVE` no gerenciador de senhas **antes** de seguir (perdê-las tem custo: `migrar-vps.md §0`). Se a VPS não tiver Node (**é o caso da VPS atual**), gere em outra máquina e passe por `docker secret create` via stdin (foi assim na S14c: pepper e TOTP gerados no PC do Pedro e enviados por `ssh ... docker secret create nome -`; a senha do Postgres, com `openssl rand -hex 24` na própria VPS); nunca por argumento de linha de comando. Apague qualquer arquivo temporário com os valores (`shred -u`) depois que o Pedro guardar a cópia.
7. **Primeira implantação apenas:** crie o **Admin da plataforma** (o banco nasce vazio; `npm run dev:seed` recusa produção de propósito). A imagem não tem npm: rode dentro do contêiner da API, passando `ADMIN_EMAIL` e `ADMIN_SENHA` por ambiente (nunca por argumento) e lendo os segredos de `/run/secrets` como o `command` do serviço faz; `node dist/admin/criar-admin-cli.js`. A senha e a URI do TOTP vão para um arquivo `0600` na VPS que o Pedro copia para o gerenciador de senhas e que é apagado em seguida (nada disso passa por chat). A empresa e o Dono saem pela rota `POST /admin/empresas` (login do Admin com senha + TOTP).

## 2. Deploy pelo pipeline (caminho normal)
1. Tag `vX.Y.Z` criada **no commit mergeado** e o workflow `Publicar imagens` verde (digests no resumo do run).
2. GitHub → Actions → **Deploy** → *Run workflow* (branch `main`) → informar a tag. O job `validar a tag` confere formato, existência, commit na `main` e as duas imagens no GHCR.
3. O job `implantar em producao` **fica esperando a aprovação** no Environment `producao` (revisor: Pedro). Aprovar só na janela combinada com a loja.
4. No servidor, `ops/deploy/deploy.sh`: backup → grava a tag → `docker stack deploy` → espera `api` e `web` convergirem + 3 `/health` = 200 seguidos → se falhar, **volta sozinho** para a tag anterior.
5. O run termina com a verificação de fora (`/health` 200, `/metrics` 404, HSTS) e o resumo com os **digests em uso**. Registrar no release (versão, digests, aprovador, resultado, tempo).
Códigos de saída do servidor: `0` ok · `2..5` comando/tag recusados (stack intacta) · `10` backup falhou (stack intacta) · `20` falhou e **a reversão funcionou** · `21` falhou e a reversão **não** se confirmou (parar; seguir `rollback.md`).
**Rollback pelo pipeline:** rodar o mesmo workflow com a tag anterior. **Testes do pipeline sem VPS:** `bash scripts/deploy-test.sh` e `bash scripts/deploy-test.sh canario` (rodam no job `stack` do CI).
O que foi instalado à mão na VPS (mudança registrada): `/opt/ailow/bin/ssh-entrada.sh`, o clone `/opt/ailow/repo` e uma linha de `authorized_keys` com comando forçado. Alterar o `ssh-entrada.sh` é mudança manual e exige o registro e o ADR.

## 2b. Deploy manual (emergência: AUD-25, só com registro e revisão em até 2 dias úteis)
```bash
# 1. Variáveis da stack (nomes e valores NÃO secretos). Copie de ops/stack/ailow.env.example para ailow.env (gitignored).
#    Confira só que as 4 obrigatórias existem e não estão vazias: TAG, DOMINIO, CERT_RESOLVER, PROXY_NETWORK.
set -a; . ./ailow.env; set +a

# 2. O Compose/Swarm falha citando o nome se faltar alguma obrigatória. Confira a renderização:
docker stack config -c ops/stack/ailow.yaml > /dev/null && echo "stack ok"

# 3. Implantar a tag exata (nunca "latest"). A API migra o banco antes de subir; se a migração falhar, a API não sobe
#    e o Swarm reverte o serviço (failure_action: rollback).
docker stack deploy -c ops/stack/ailow.yaml --with-registry-auth ailow

# 4. Esperar e conferir
docker service ls                                   # db, api e web em 1/1
docker service ps ailow_api --no-trunc              # sem tarefas em Failed novas
docker service logs --since 5m ailow_api | grep -c '"level":50'   # erros (nível 50): esperado 0
curl -fsS https://DOMINIO/health                    # 200 {"status":"ok",...} (só depois do DNS/certificado)
```
Nota: na primeira subida a `api` pode falhar uma vez (o DNS interno do `db` ainda não existe) e o Swarm a reinicia sozinho; foi o que se viu na validação local. Isso **não** é motivo de rollback; falha repetida (≥ 3 tarefas `Failed` seguidas) é.
O volume `ailow_dbdata` **não** é tocado por um deploy (nunca `docker volume rm`, ENV-12).

## 3. Verificar (smoke manual — 5 min, celular da loja ou 360×640)
Entrar → Vendas: vender 1 peça de teste e **cancelar** a venda (estoque volta) → Pessoas: ver o botão de ponto → Compras abre. Mesmos 4 fluxos do E2E (`scripts/e2e.sh`), agora contra produção, **com dados de teste identificáveis** que o Dono apaga/cancela. Dados de cliente real não entram no smoke.
Conferir pelo lado de fora: `curl -sI https://DOMINIO/` (HSTS presente) e `curl -s -o /dev/null -w '%{http_code}' https://DOMINIO/metrics` = **404**. Olhar os logs: sem 5xx novos, p95 da venda dentro do RNF-01.

## 4. Gatilho de reversão (OPS-05)
Qualquer um dos itens do README (health, 5xx > 1 %, fluxo do smoke falhando) ⇒ **[`rollback.md`](rollback.md)**, sem debate. Investigar depois.

## 5. Depois
- Registrar no release: versão, digests, data/hora, quem executou, resultado do smoke, tempo total (**tempo medido: __ min**).
- Se algo falhou ou quase: lição (`node harness/scripts/licoes.mjs nova`) e atualizar este runbook.

## 6. Quando escalar
Banco não sobe, a migração falha de forma que o rollback não resolve, ou suspeita de perda/exposição de dados ⇒ parar, não improvisar no banco, acionar o Pedro (contato a registrar na S14c) e seguir `harness/checklists/incidente.md`.

## Não verificado (continua aberto depois da S14c)
Janela de deploy com o cliente (Marcos), contato de escalonamento do Pedro, valores finais do gatilho numérico (health 3×, 5xx > 1 %), carga de 50 usuários na VPS, segunda versão e atualização sobre dados reais, renovação do certificado.
