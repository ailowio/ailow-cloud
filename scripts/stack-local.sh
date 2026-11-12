#!/usr/bin/env bash
# Valida ops/stack/ailow.yaml num Swarm DESCARTÁVEL (S14b): sobe a stack de verdade, confere o que o desenho promete e
# desmonta tudo. Roda na máquina do dev e no job `stack` do CI. Precisa de Docker.
#
# SEGURANÇA: recusa rodar se o Docker já for um nó de Swarm (pode ser um servidor real). Aqui ele cria o próprio Swarm de
# um nó, usa segredos aleatórios descartáveis e, ao sair, remove stack, segredos, rede e deixa o Swarm (só o que ele criou).
# Uso: bash scripts/stack-local.sh        (exit 0 = tudo conferido; exit != 0 = o que falhou, em stderr)
# Comentários sempre em linha própria (L-0001).
set -euo pipefail
cd "$(dirname "$0")/.."

estado="$(docker info --format '{{.Swarm.LocalNodeState}}')"
if [ "$estado" != "inactive" ]; then
  echo "recuso: este Docker já participa de um Swarm (estado: $estado). Rode num Docker sem Swarm (máquina de dev ou CI)." >&2
  exit 10
fi

STACK=ailowteste
REDE=proxy-teste
FALHAS=0
falha() { echo "FALHOU: $1" >&2; FALHAS=$((FALHAS + 1)); }
ok() { echo "ok: $1"; }

cleanup() {
  set +e
  docker stack rm "$STACK" >/dev/null 2>&1
  # Espera os contêineres saírem antes de apagar rede e volume.
  for _ in $(seq 1 30); do [ -z "$(docker ps -q -f "name=^${STACK}_")" ] && break; sleep 2; done
  docker secret rm ailow_postgres_password ailow_auth_pepper ailow_totp_chave >/dev/null 2>&1
  docker network rm "$REDE" "${STACK}_ailow_internal" >/dev/null 2>&1
  docker volume rm ailow_dbdata >/dev/null 2>&1
  docker swarm leave --force >/dev/null 2>&1
}
trap cleanup EXIT

echo "== imagens"
docker build -q -f apps/api/Dockerfile -t local/ailow-cloud-api:teste . >/dev/null
docker build -q -f apps/web/Dockerfile -t local/ailow-cloud-web:teste . >/dev/null

echo "== swarm descartável"
docker swarm init --advertise-addr 127.0.0.1 >/dev/null
docker network create -d overlay --attachable "$REDE" >/dev/null
node -e "process.stdout.write(require('crypto').randomBytes(24).toString('hex'))" | docker secret create ailow_postgres_password - >/dev/null
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | docker secret create ailow_auth_pepper - >/dev/null
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" | docker secret create ailow_totp_chave - >/dev/null

export REGISTRY=local TAG=teste DOMINIO=app.local PROXY_NETWORK="$REDE" CERT_RESOLVER=le

echo "== variável obrigatória faltando tem de falhar, citando o nome"
saida="$(env -u TAG docker stack config -c ops/stack/ailow.yaml 2>&1 || true)"
echo "$saida" | grep -q "TAG" && ok "sem TAG o deploy é recusado" || falha "stack aceitou deploy sem TAG"

echo "== deploy"
docker stack deploy -c ops/stack/ailow.yaml "$STACK" >/dev/null
sobe=0
for _ in $(seq 1 60); do
  r="$(docker service ls --format '{{.Name}}={{.Replicas}}' | tr '\n' ' ')"
  if echo "$r" | grep -q "${STACK}_db=1/1" && echo "$r" | grep -q "${STACK}_api=1/1" && echo "$r" | grep -q "${STACK}_web=1/1"; then sobe=1; break; fi
  sleep 5
done
if [ "$sobe" = "1" ]; then ok "db, api e web em 1/1"; else
  falha "serviços não ficaram 1/1 em 300 s ($r)"
  docker service logs "${STACK}_api" --tail 30 >&2 || true
  docker service logs "${STACK}_web" --tail 30 >&2 || true
  exit 1
fi

curl_rede() { docker run --rm --network "$REDE" curlimages/curl:8.11.0 -s -m 5 -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || true; }

echo "== o que o Traefik veria (web pela rede do proxy)"
[ "$(curl_rede "http://${STACK}_web:8080/health")" = "200" ] && ok "/health 200 pelo web" || falha "/health não deu 200 pelo web"
[ "$(curl_rede "http://${STACK}_web:8080/")" = "200" ] && ok "/ 200" || falha "/ não deu 200"
[ "$(curl_rede "http://${STACK}_web:8080/metrics")" = "404" ] && ok "/metrics 404 (não sai para fora)" || falha "/metrics não deu 404"

echo "== isolamento de rede"
[ "$(curl_rede "http://${STACK}_api:3000/health")" = "000" ] && ok "api inalcançável pela rede do proxy" || falha "api alcançável pela rede do proxy"
[ "$(curl_rede "http://${STACK}_db:5432")" = "000" ] && ok "db inalcançável pela rede do proxy" || falha "db alcançável pela rede do proxy"
api="$(docker ps -q -f "name=^${STACK}_api\." | head -n1)"
saiu="$(docker exec "$api" node -e "require('https').get('https://example.com',r=>console.log('SAIU')).on('error',()=>console.log('bloqueado'))" 2>/dev/null || true)"
[ "$saiu" = "bloqueado" ] && ok "api sem saída para a internet" || falha "api consegue sair para a internet ($saiu)"

echo "== endurecimento aplicado"
for s in api web; do
  c="$(docker ps -q -f "name=^${STACK}_${s}\." | head -n1)"
  [ "$(docker exec "$c" id -u)" != "0" ] && ok "$s roda sem root" || falha "$s roda como root"
  [ "$(docker inspect -f '{{.HostConfig.ReadonlyRootfs}}' "$c")" = "true" ] && ok "$s com FS somente leitura" || falha "$s com FS gravável"
  [ "$(docker inspect -f '{{.HostConfig.CapDrop}}' "$c")" = "[ALL]" ] && ok "$s com cap_drop ALL" || falha "$s sem cap_drop ALL"
  [ "$(docker inspect -f '{{.HostConfig.Memory}}' "$c")" -gt 0 ] && ok "$s com limite de memória" || falha "$s sem limite de memória"
done

echo "== nenhum segredo visível em docker service inspect"
vazou="$(docker service inspect "${STACK}_api" "${STACK}_db" --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | grep -ciE 'AUTH_PEPPER=|TOTP_CHAVE=|POSTGRES_PASSWORD=|postgresql://' || true)"
[ "$vazou" = "0" ] && ok "segredos só em Swarm secrets" || falha "segredo aparece em variável de ambiente do serviço"

echo "== labels do Traefik"
rotulos="$(docker service inspect "${STACK}_web" --format '{{range $k,$v := .Spec.Labels}}{{$k}}={{$v}}{{"\n"}}{{end}}')"
echo "$rotulos" | grep -q 'ailow-web.rule=Host(`app.local`)' && ok "regra Host do DOMINIO" || falha "regra Host ausente"
echo "$rotulos" | grep -q 'certresolver=le' && ok "certresolver do CERT_RESOLVER" || falha "certresolver ausente"
echo "$rotulos" | grep -q 'stsSeconds=31536000' && ok "HSTS de 1 ano" || falha "HSTS ausente"

if [ "$FALHAS" -ne 0 ]; then echo "$FALHAS verificação(ões) reprovada(s)" >&2; exit 1; fi
echo "TUDO OK: stack validada num Swarm descartável"
