# Runbook: rollback (voltar para a versão anterior)

- **Serviço:** Ailow Cloud · **Dono:** Pedro · **Última revisão:** 2026-11-13 · **Ensaiado na VPS:** 2026-11-12 (mecanismo `--rollback`) e 2026-11-13 (rollback real por tag, `v1.0.0` → `v0.1.0`) · **tempo medido:** por tag **73 s** (volta `v0.1.0` → `v1.0.0`: 78 s); `docker service update --rollback`: `web` 37 s, `api` 71 s
- Regras: OPS-05/06/11, AUD-24. Princípio: **voltar o código primeiro (barato, seguro); mexer no banco só se for inevitável.**

## 1. Sintoma (quando usar)
Gatilho do deploy: `GET /health` ≠ 200 em 3 checagens seguidas, 5xx > 1 % nas rotas de venda, fluxo do smoke falhando, ou perda/corrupção de dados suspeita (esta última vai direto para §4).

## 2. Confirmar
- `docker service ls`, `docker service ps ailow_api --no-trunc` e `curl -fsS https://DOMINIO/health`.
- `docker service logs --since 15m ailow_api` (procure `request_id` do erro; a migração roda no início da `api`, então o erro dela aparece aqui: a migração falhou? aplicou parcialmente?).
- O que mudou: a tag implantada (`docker service inspect ailow_api --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'`) e se a versão trouxe migração (`apps/api/migrations/` entre as duas tags).

## 3. Mitigar (em ordem — do mais barato ao mais invasivo)

### 3.1 Versão **sem migração nova**, ou migração compatível com a anterior (caso normal — OPS-11)
```bash
# Opção A (a nova versão nem chegou a ficar saudável): o Swarm já reverte sozinho (failure_action: rollback). Para forçar:
docker service update --rollback ailow_api && docker service update --rollback ailow_web
# Opção B (a versão subiu mas está errada): reimplantar a tag anterior, registrada no release.
#   Edite TAG=vANTERIOR em ailow.env e repita o deploy (deploy.md §2, passos 1 e 3). A migração da `api` não tem nada novo a aplicar.
curl -fsS https://DOMINIO/health
```
O banco fica como está: a versão anterior tem de funcionar com o schema novo (é o que a regra expand → migrate → contract garante; a migração `20261117120000_vendas-fk-adiavel`, por exemplo, só torna FKs adiáveis — pela leitura, a versão antiga continua válida; não ensaiado). Se a versão a ser abandonada fez o **"contract"** (removeu coluna/tabela que a anterior usa), este caminho **não vale**: ir para 3.2.

### 3.2 Migração incompatível com a versão anterior
1. Parar a escrita: `docker service scale ailow_api=0` (o app fica fora; avisar a loja).
2. **Antes de qualquer coisa**, tirar um backup do estado atual (para não perder as vendas feitas depois do deploy): ver [`migrar-vps.md` §3](migrar-vps.md).
3. Desfazer a migração: todas as migrações têm `-- Down Migration`. Com a imagem **da versão nova** (a que conhece a migração):
   ```bash
   # Contêiner avulso na rede do banco, com a imagem DA VERSÃO NOVA e os segredos do Swarm não disponíveis a ele:
   # monte a URL a partir do segredo no próprio host, sem imprimir. Exemplo (ajuste REDE ao nome real: docker network ls):
   docker run --rm --network ailow_ailow_internal -e DATABASE_URL="postgresql://ailow:$(docker exec $(docker ps -q -f name=^ailow_db\.) cat /run/secrets/ailow_postgres_password)@db:5432/ailow" \
     ghcr.io/ailowio/ailow-cloud-api:vNOVA node ../../node_modules/node-pg-migrate/bin/node-pg-migrate.js \
     -m migrations --migrations-table pgmigrations down 1
   ```
   **[NÃO VERIFICADO — S14c]** a rede `ailow_ailow_internal` é `internal` e não anexável por `docker run` simples; se o comando recusar, o caminho é um serviço temporário na stack. Ensaiar antes de precisar.
   `down` perde o que a migração criou (colunas/tabelas novas e seus dados). Só com o backup do passo 2 em mãos.
4. Subir a versão anterior: `TAG=vANTERIOR` e repetir o deploy (`deploy.md §2`); conferir `/health` e o smoke.
5. Se o `down` falhar ou o banco ficar inconsistente: **restaurar o backup do §3 do deploy** (pré-deploy) — perde as vendas posteriores a ele; decisão do Pedro com o Dono da loja.

### 3.3 Tag anterior ausente no registro
As imagens vêm do GHCR (publicadas por `publicar.yml` em cada tag `vX.Y.Z`); a VPS não compila nada. Se a imagem da tag anterior não estiver mais no registro (pacote apagado, retenção), republique-a rodando de novo o workflow da tag anterior; **nunca** reconstrua à mão na VPS. O digest de cada versão está no resumo do run do workflow (guardado no release).

## 4. Suspeita de perda ou exposição de dados
Parar a `api` (`docker service scale ailow_api=0`), **não** apagar nada, preservar logs e o volume `ailow_dbdata`, e seguir `harness/checklists/incidente.md`. Nunca `docker stack rm` seguido de remover o volume.

## 5. Depois
Postmortem sem culpa (`harness/templates/postmortem.md`), com ações, dono e prazo; lição no registro (MC); registrar no release: versão revertida, motivo, duração da indisponibilidade, **tempo medido: __ min** (alimenta o MTTR, OPS-01).

## Ensaio na VPS (S14c, 2026-11-12) e o que ele prova e não prova
**Como:** com uma única tag implantada não existe "versão anterior", então o ensaio mudou o spec de cada serviço (`docker service update --env-add ENSAIO_ROLLBACK=1`) e voltou com `docker service update --detach=false --rollback`, medindo o tempo e fazendo `GET /health` de fora a cada 1 s. Não tocou em banco nem volume.

| Serviço | Rollback (comando até convergir) | `/health` de fora durante o ensaio | Estado final |
|---|---|---|---|
| `web` (start-first) | **37 s** | 1 de 53 checagens ≠ 200 | variável sumiu do spec, 1/1 |
| `api` (stop-first, `monitor: 60s`) | **71 s** | 6 de 94 checagens ≠ 200 (indisponibilidade curta na troca) | variável sumiu do spec, 1/1 |

**Prova:** o comando do §3.1 opção A funciona nesta stack e devolve o spec anterior com os dois serviços saudáveis. O tempo da `api` é dominado pelo período de monitoramento de 60 s.

### Ensaio da opção B: rollback real por tag (2026-11-13)
Com a `v1.0.0` publicada passou a existir uma tag anterior. Troca de `TAG` em `ailow.env` + `docker stack deploy` (deploy.md §2), com `GET /health` de fora a cada 1 s:

| Passo | Tempo até `api` e `web` convergirem | `/health` de fora ≠ 200 | Resultado |
|---|---|---|---|
| deploy `v0.1.0` → `v1.0.0` | 86 s | 8 de 61 | imagens = digests publicados; 0 erros nos logs |
| **rollback** `v1.0.0` → `v0.1.0` | **73 s** | 6 de 45 | `api` e `web` na `v0.1.0`, `/health` 200 |
| volta `v0.1.0` → `v1.0.0` | 78 s | 6 de 52 | estado final `v1.0.0` |

**Não prova:** rollback quando a versão nova trouxe **migração** (as duas tags têm o mesmo schema; o §3.2 segue sem ensaio) nem com dados reais. A indisponibilidade medida (cerca de 6 a 8 segundos) é a da API em `stop-first`.

## Não verificado (continua aberto depois da S14c)
O `down` de cada migração contra dados reais e a forma de rodá-lo contra a rede `internal` (§3.2); restauração do banco de produção com dados reais; o gatilho numérico ainda não foi exercitado por uma falha real.
