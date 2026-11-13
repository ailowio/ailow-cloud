#!/usr/bin/env bash
# Testes do pipeline de deploy (S14d, ADR 012): ops/deploy/ssh-entrada.sh e ops/deploy/deploy.sh, SEM tocar em VPS.
# `docker`, `curl`, `systemctl` e `sleep` são substituídos por atalhos em um diretório temporário.
# Uso: bash scripts/deploy-test.sh           roda os cenários
#      bash scripts/deploy-test.sh canario   prova que o teste DETECTA uma reversão quebrada (L-0006): exit 0 = detectou
set -uo pipefail
cd "$(dirname "$0")/.."
RAIZ="$PWD"
DEPLOY="${DEPLOY_SCRIPT:-$RAIZ/ops/deploy/deploy.sh}"
ENTRADA="$RAIZ/ops/deploy/ssh-entrada.sh"
FALHAS=0

afirmar() { # descrição, comando que deve dar verdadeiro
  local desc=$1; shift
  if "$@"; then echo "ok   $desc"; else echo "FALHOU $desc"; FALHAS=$((FALHAS + 1)); fi
}

novo_ambiente() {
  TMP="$(mktemp -d)"
  mkdir -p "$TMP/bin" "$TMP/ailow" "$TMP/estado"
  export LOG="$TMP/chamadas.log" ESTADO="$TMP/estado" AILOW_DIR="$TMP/ailow" STACK_FILE="$TMP/stack.yaml"
  : > "$LOG"; : > "$STACK_FILE"
  printf 'TAG=v1.0.0\nDOMINIO=cloud.exemplo.test\nCERT_RESOLVER=r\nPROXY_NETWORK=n\n' > "$AILOW_DIR/ailow.env"
  echo v1.0.0 > "$ESTADO/tag"
  cat > "$TMP/bin/docker" <<'SH'
#!/usr/bin/env bash
echo "docker $*" >> "$LOG"
case "$1 $2" in
  "stack config") exit 0 ;;
  "stack deploy") echo "$TAG" > "$ESTADO/tag"; exit 0 ;;
  "service inspect")
    svc="${3#ailow_}"
    case "$*" in
      *UpdateStatus*) echo "${UPDATE_STATE:-completed}" ;;
      *ContainerSpec.Image*) echo "ghcr.io/ailowio/ailow-cloud-${svc}:$(cat "$ESTADO/tag")@sha256:${svc}fake" ;;
    esac ;;
esac
SH
  cat > "$TMP/bin/curl" <<'SH'
#!/usr/bin/env bash
echo "curl $*" >> "$LOG"
if [ "$(cat "$ESTADO/tag")" = "${FALHA_NA_TAG:-nenhuma}" ]; then echo -n 503; else echo -n 200; fi
SH
  cat > "$TMP/bin/systemctl" <<'SH'
#!/usr/bin/env bash
echo "systemctl $*" >> "$LOG"
exit "${BACKUP_EXIT:-0}"
SH
  printf '#!/usr/bin/env bash\nexit 0\n' > "$TMP/bin/sleep"
  chmod +x "$TMP/bin/"*
  export PATH="$TMP/bin:$PATH" ESPERA_MAX_S=20 INTERVALO_S=1 SAUDAVEL_N=3
  unset FALHA_NA_TAG UPDATE_STATE BACKUP_EXIT
}

chamadas() { grep -c "$1" "$LOG" || true; }
tag_no_env() { grep '^TAG=' "$AILOW_DIR/ailow.env" | cut -d= -f2-; }

cenarios_entrada() {
  echo "== ssh-entrada.sh (comando forçado da chave de deploy)"
  local v
  for v in "deploy v1.2.3" ; do
    afirmar "aceita '$v'" bash -c "SSH_ORIGINAL_COMMAND='$v' ENTRADA_SO_VALIDAR=1 bash '$ENTRADA' | grep -qx v1.2.3"
  done
  local ruim
  for ruim in "" "deploy" "deploy latest" "deploy v1.2" "deploy v1.2.3 " "deploy v1.2.3; rm -rf /" "deploy v1.2.3 && id" 'deploy $(id)' "bash -c id" "rm -rf /" "deploy v1.2.3 v1.2.4" "DEPLOY v1.2.3" "deploy  v1.2.3"; do
    afirmar "recusa '${ruim//$'\n'/\\n}'" bash -c "SSH_ORIGINAL_COMMAND=\$1 ENTRADA_SO_VALIDAR=1 bash '$ENTRADA' >/dev/null 2>&1; [ \$? -eq 2 ]" _ "$ruim"
  done
  afirmar "recusa quebra de linha" bash -c "SSH_ORIGINAL_COMMAND=\$'deploy v1.2.3\nid' ENTRADA_SO_VALIDAR=1 bash '$ENTRADA' >/dev/null 2>&1; [ \$? -eq 2 ]"
}

cenario_sucesso() {
  echo "== deploy.sh: sucesso"
  novo_ambiente
  bash "$DEPLOY" v1.1.0 > "$TMP/saida.txt" 2>&1; local rc=$?
  afirmar "exit 0" test "$rc" -eq 0
  afirmar "TAG gravada no ailow.env" test "$(tag_no_env)" = v1.1.0
  afirmar "backup feito ANTES do deploy" bash -c "grep -n 'systemctl start ailow-backup' '$LOG' | head -1 | cut -d: -f1 | { read b; d=\$(grep -n 'stack deploy' '$LOG' | head -1 | cut -d: -f1); [ \"\$b\" -lt \"\$d\" ]; }"
  afirmar "um único stack deploy" test "$(chamadas 'stack deploy')" -eq 1
  afirmar "resumo traz os digests em uso" grep -q 'api=ghcr.io/ailowio/ailow-cloud-api:v1.1.0@sha256:apifake' "$TMP/saida.txt"
}

cenario_health_falha() {
  echo "== deploy.sh: health falha => reversão automática"
  novo_ambiente
  export FALHA_NA_TAG=v1.1.0
  bash "$DEPLOY" v1.1.0 > "$TMP/saida.txt" 2>&1; local rc=$?
  afirmar "exit 20 (reversão executada)" test "$rc" -eq 20
  afirmar "TAG do ailow.env restaurada para v1.0.0" test "$(tag_no_env)" = v1.0.0
  afirmar "dois stack deploy (nova e reversão)" test "$(chamadas 'stack deploy')" -eq 2
  afirmar "stack termina na versão anterior" test "$(cat "$ESTADO/tag")" = v1.0.0
}

cenario_backup_falha() {
  echo "== deploy.sh: backup falha => não mexe na stack"
  novo_ambiente
  export BACKUP_EXIT=1
  bash "$DEPLOY" v1.1.0 > "$TMP/saida.txt" 2>&1; local rc=$?
  afirmar "exit 10" test "$rc" -eq 10
  afirmar "nenhum stack deploy" test "$(chamadas 'stack deploy')" -eq 0
  afirmar "TAG intacta" test "$(tag_no_env)" = v1.0.0
}

cenario_atualizacao_revertida_pelo_swarm() {
  echo "== deploy.sh: Swarm reverte sozinho (update_status rollback_completed) => falha sem fingir sucesso"
  novo_ambiente
  export UPDATE_STATE=rollback_completed
  bash "$DEPLOY" v1.1.0 > "$TMP/saida.txt" 2>&1; local rc=$?
  afirmar "exit diferente de 0" test "$rc" -ne 0
  afirmar "TAG do ailow.env não fica na versão que falhou" test "$(tag_no_env)" != v1.1.0
}

cenario_tag_invalida() {
  echo "== deploy.sh: tag inválida"
  novo_ambiente
  bash "$DEPLOY" "latest" > /dev/null 2>&1; local rc=$?
  afirmar "exit 2 e nada executado" bash -c "[ $rc -eq 2 ] && [ ! -s '$LOG' ]"
}

if [ "${1:-}" = canario ]; then
  # Mutante: a reversão não restaura a TAG. O cenário de falha de health TEM de reprovar.
  MUT="$(mktemp -d)/deploy.sh"
  sed 's/^\( *\)gravar_tag "\$anterior"/\1true/' "$DEPLOY" > "$MUT"
  if cmp -s "$DEPLOY" "$MUT"; then echo "canário inválido: o mutante é idêntico ao original (o padrão não casou)"; exit 1; fi
  DEPLOY_SCRIPT="$MUT" bash "$0" so-saude > /tmp/canario-saida.txt 2>&1 && { echo "CANÁRIO REPROVADO: o teste não detectou a reversão quebrada"; exit 1; }
  echo "canário ok: o teste detecta a reversão quebrada"
  exit 0
fi
if [ "${1:-}" = so-saude ]; then cenario_health_falha; [ "$FALHAS" -eq 0 ]; exit; fi

cenarios_entrada
cenario_sucesso
cenario_health_falha
cenario_backup_falha
cenario_atualizacao_revertida_pelo_swarm
cenario_tag_invalida
if [ "$FALHAS" -eq 0 ]; then echo "TODOS OS CENÁRIOS OK"; else echo "$FALHAS verificação(ões) falharam"; exit 1; fi
