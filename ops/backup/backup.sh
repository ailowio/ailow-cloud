#!/usr/bin/env bash
# Backup lógico do Ailow Cloud (S14b, ADR 010 item 7): pg_dump -> checagem -> envio CIFRADO (rclone crypt) -> retenção.
# Roda no host da stack (cron/systemd timer do Pedro). O dump contém dados pessoais (LGPD): nasce com permissão 0600 em
# $BACKUP_DIR e é apagado ao sair, com sucesso ou erro; só o que está no remoto cifrado fica.
#
# Variáveis:
#   RCLONE_REMOTE   (obrigatória) remoto rclone do tipo `crypt`, ex.: ailowcrypt:backups. Nunca um remoto sem crypt.
#   STACK           nome da stack Swarm (default: ailow)
#   BACKUP_DIR      área temporária local (default: /var/backups/ailow)
#   RETENCAO_DIARIOS_DIAS   (default 7)     RETENCAO_SEMANAIS_DIAS (default 28)
# A configuração do rclone (token do Drive, senhas do crypt) fica em RCLONE_CONFIG, FORA do repositório e da VPS de
# código; a chave do crypt também é guardada separadamente (sem ela o backup é ilegível). Veja docs/runbooks/backup.md.
set -euo pipefail
umask 077

: "${RCLONE_REMOTE:?defina RCLONE_REMOTE (remoto rclone do tipo crypt, ex ailowcrypt:backups)}"
STACK="${STACK:-ailow}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ailow}"
DIARIOS_DIAS="${RETENCAO_DIARIOS_DIAS:-7}"
SEMANAIS_DIAS="${RETENCAO_SEMANAIS_DIAS:-28}"

log() { printf '{"ts":"%s","evento":"backup","msg":"%s"}\n' "$(date -u +%FT%TZ)" "$1"; }

# O remoto tem de ser crypt: backup em claro no Drive é vazamento de dado pessoal (SEC-*).
tipo="$(rclone config show "${RCLONE_REMOTE%%:*}" 2>/dev/null | sed -n 's/^type *= *//p' | head -n1)"
if [ "$tipo" != "crypt" ]; then
  echo "erro: o remoto '${RCLONE_REMOTE%%:*}' não é do tipo crypt (tipo lido: '${tipo:-desconhecido}'); recuso enviar em claro" >&2
  exit 3
fi

agora="$(date -u +%Y%m%d-%H%M%S)"
nome="ailow-${agora}.dump"
db="$(docker ps -q -f "name=^${STACK}_db\." | head -n1)"
[ -n "$db" ] || { echo "erro: contêiner do db da stack '${STACK}' não encontrado" >&2; exit 2; }

mkdir -p "$BACKUP_DIR"
trap 'rm -f "$BACKUP_DIR/$nome" "$BACKUP_DIR/$nome.sha256"' EXIT

log "iniciando dump de ${STACK}_db"
docker exec "$db" pg_dump -U ailow -d ailow -Fc > "$BACKUP_DIR/$nome"

# Um dump vazio ou truncado não pode ser enviado como se fosse backup: o pg_restore precisa conseguir listá-lo.
itens="$(docker exec -i "$db" pg_restore -l < "$BACKUP_DIR/$nome" | grep -c 'TABLE DATA' || true)"
if [ "$itens" -lt 1 ]; then
  echo "erro: dump sem nenhuma tabela de dados; não envio" >&2
  exit 4
fi
tamanho="$(wc -c < "$BACKUP_DIR/$nome" | tr -d ' ')"
( cd "$BACKUP_DIR" && sha256sum "$nome" > "$nome.sha256" )

rclone copyto "$BACKUP_DIR/$nome" "$RCLONE_REMOTE/diarios/$nome"
rclone copyto "$BACKUP_DIR/$nome.sha256" "$RCLONE_REMOTE/diarios/$nome.sha256"
# Domingo (UTC): cópia semanal.
if [ "$(date -u +%u)" = "7" ]; then
  rclone copyto "$BACKUP_DIR/$nome" "$RCLONE_REMOTE/semanais/$nome"
  rclone copyto "$BACKUP_DIR/$nome.sha256" "$RCLONE_REMOTE/semanais/$nome.sha256"
fi

# O que subiu tem de estar lá com o mesmo tamanho.
remoto="$(rclone size --json "$RCLONE_REMOTE/diarios/$nome" | sed -n 's/.*"bytes": *\([0-9]*\).*/\1/p')"
if [ "$remoto" != "$tamanho" ]; then
  echo "erro: tamanho no remoto ($remoto) difere do local ($tamanho)" >&2
  exit 5
fi

# Retenção só depois de confirmar o envio novo (nunca apagar o último bom antes de ter outro).
rclone delete --min-age "${DIARIOS_DIAS}d" "$RCLONE_REMOTE/diarios"
rclone delete --min-age "${SEMANAIS_DIAS}d" "$RCLONE_REMOTE/semanais" 2>/dev/null || true

log "ok ${nome} bytes=${tamanho} tabelas_com_dados=${itens}"
