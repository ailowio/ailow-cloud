#!/usr/bin/env bash
# Deploy da stack `ailow` na VPS (S14d, ADR 012). Chamado SÓ por ops/deploy/ssh-entrada.sh, que já validou a tag
# (formato, existe, está na main) e serializou com flock. Uso: deploy.sh vX.Y.Z
# Regras: OPS-04 (automatizado, repetível, serializado), OPS-05 (gatilho de reversão numérico), OPS-11, AUD-24/27.
#
# Fluxo: backup (aborta sem mexer na stack se falhar) -> grava a TAG -> docker stack deploy -> espera os dois serviços
# convergirem E 3 checagens seguidas de /health = 200 -> se não, volta a TAG anterior e espera de novo.
# Códigos de saída: 0 ok | 2 tag inválida | 10 backup falhou (nada foi alterado) | 20 deploy falhou e a reversão
# FUNCIONOU | 21 falhou e a reversão também falhou (intervenção humana, ver rollback.md).
# Comentários sempre em linha própria.
set -euo pipefail

tag="${1:-}"
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "tag inválida: '${tag}'" >&2; exit 2; }

DIR="${AILOW_DIR:-/opt/ailow}"
STACK="${STACK:-ailow}"
ARQ_ENV="$DIR/ailow.env"
ARQ_STACK="${STACK_FILE:-$(cd "$(dirname "$0")/../.." && pwd)/ops/stack/ailow.yaml}"
ESPERA_MAX_S="${ESPERA_MAX_S:-300}"
INTERVALO_S="${INTERVALO_S:-5}"
# Gatilho de reversão (OPS-05): health 200 em N checagens seguidas.
SAUDAVEL_N="${SAUDAVEL_N:-3}"

log() { printf '{"ts":"%s","evento":"deploy","msg":"%s"}\n' "$(date -u +%FT%TZ)" "$*"; }

valor_env() { grep "^$1=" "$ARQ_ENV" | head -n1 | cut -d= -f2-; }

gravar_tag() {
  local novo
  novo="$(sed "s/^TAG=.*/TAG=$1/" "$ARQ_ENV")"
  printf '%s\n' "$novo" > "$ARQ_ENV"
}

implantar() {
  set -a
  # shellcheck disable=SC1090
  . "$ARQ_ENV"
  set +a
  docker stack config -c "$ARQ_STACK" > /dev/null
  docker stack deploy -c "$ARQ_STACK" --with-registry-auth "$STACK" > /dev/null
}

# 0 = saudável na tag pedida; 1 = não ficou saudável (Swarm reverteu, pausou ou estourou o tempo).
esperar_saudavel() {
  local esperada=$1 dominio saudaveis=0 n=0 maximo svc estado imagem convergiu
  dominio="$(valor_env DOMINIO)"
  maximo=$((ESPERA_MAX_S / INTERVALO_S))
  while [ "$n" -lt "$maximo" ]; do
    n=$((n + 1))
    convergiu=1
    for svc in api web; do
      estado="$(docker service inspect "${STACK}_${svc}" --format '{{.UpdateStatus.State}}' 2>/dev/null || true)"
      imagem="$(docker service inspect "${STACK}_${svc}" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
      case "$estado" in
        rollback_started | rollback_completed | paused) log "serviço ${svc} em estado ${estado}"; return 1 ;;
      esac
      [ "$estado" = completed ] && [[ "$imagem" == *":${esperada}"* ]] || convergiu=0
    done
    if [ "$convergiu" = 1 ] && [ "$(curl -s -o /dev/null -m 5 -w '%{http_code}' "https://${dominio}/health" || true)" = 200 ]; then
      saudaveis=$((saudaveis + 1))
    else
      saudaveis=0
    fi
    [ "$saudaveis" -ge "$SAUDAVEL_N" ] && return 0
    sleep "$INTERVALO_S"
  done
  return 1
}

resumo() {
  local svc
  for svc in api web; do
    printf '%s=%s\n' "$svc" "$(docker service inspect "${STACK}_${svc}" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')"
  done
}

anterior="$(valor_env TAG || true)"
inicio="$(date +%s)"
log "início tag=${tag} anterior=${anterior:-nenhuma}"

# Backup antes de qualquer mudança (a versão pode trazer migração). Falhou: não mexe na stack.
if ! systemctl start ailow-backup.service; then
  log "backup falhou: abortando sem alterar a stack"
  exit 10
fi

gravar_tag "$tag"
implantar
if esperar_saudavel "$tag"; then
  log "deploy ok tag=${tag} segundos=$(($(date +%s) - inicio))"
  resumo
  exit 0
fi

log "gatilho de reversão acionado: tag=${tag} não ficou saudável"
if [ -n "$anterior" ] && [ "$anterior" != "$tag" ]; then
  gravar_tag "$anterior"
  implantar
  if esperar_saudavel "$anterior"; then
    log "reversão concluída para ${anterior} segundos=$(($(date +%s) - inicio))"
    resumo
    exit 20
  fi
fi
log "REVERSÃO NÃO CONFIRMADA: intervenção humana (docs/runbooks/rollback.md)"
exit 21
