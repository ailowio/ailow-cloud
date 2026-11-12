# Runbook: deploy de uma versão na VPS (stack do Swarm)

- **Serviço:** Ailow Cloud (`db`, `api`, `web`; HTTPS pelo Traefik do host) · **Dono:** Pedro · **Última revisão:** 2026-11-12 · **Ensaiado na VPS:** nunca **[NÃO VERIFICADO — S14c]** · tempo medido: __ min
- Regras: OPS-04 (deploy repetível e serializado), OPS-05 (gatilho de reversão), OPS-11 (banco compatível com 2 versões), AUD-24/27 (mudança rastreável), ENV-12 (nunca apagar volume sem intenção).

## 0. O que existe e o que não
- **Existe e foi exercitado [verificado local/CI]:** `ops/stack/ailow.yaml` (Swarm: `db` com Postgres 18.6, `api` que **migra e depois sobe**, `web` com nginx) e o script `scripts/stack-local.sh` (job `stack` do CI), que sobe a stack num Swarm descartável e confere: `db`/`api`/`web` em 1/1; `/health` 200 e `/metrics` 404 pelo `web`; `db` e `api` inalcançáveis da rede do proxy; **API sem saída para a internet**; `api` e `web` sem root, FS somente leitura, `cap_drop: ALL`, limite de memória; **nenhum segredo em `docker service inspect`** (vão por Swarm secrets); labels do Traefik (Host, certresolver, HSTS 1 ano). Imagens: `publicar.yml` publica `api` e `web` no GHCR em tag `vX.Y.Z` (**ainda nunca rodou**, só roda numa tag real).
- **Não existe / não verificado:** a VPS e o Traefik dela; o domínio `cloud.ailow.com.br` (em 2026-11-12 o resolvedor público ainda respondia "Non-existent domain"); o certificado; o pull do GHCR a partir do host; o agendamento do backup; `main` protegida (decisão do Pedro).
- O Swarm **ignora `security_opt: no-new-privileges`** (conferido no Docker 29.9.3); a defesa aqui é não-root + `cap_drop: ALL` + FS somente leitura.
- Consequência: o deploy é **manual** (SSH + `docker stack deploy`) até existir pipeline de deploy. Alteração manual em produção é **mudança registrada** (AUD-24): anotar no release.

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
   Guarde `AUTH_PEPPER` e `TOTP_CHAVE` no gerenciador de senhas **antes** de seguir (perdê-las tem custo: `migrar-vps.md §0`). Se a VPS não tiver Node, gere em outra máquina e passe por `docker secret create` via stdin; nunca por argumento de linha de comando.

## 2. Deploy (na VPS)
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

## Não verificado (depende da S14c)
VPS, Traefik do host e nome do resolvedor/rede/entrypoint dele, DNS, certificado, pull do GHCR no host, `publicar.yml` numa tag real, rotina e restauração de backup a partir do Drive, janela com o cliente, tempos medidos, contato de escalonamento, valores finais do gatilho numérico.
