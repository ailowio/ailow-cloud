#!/usr/bin/env bash
# Alerta do backup (S14c). Uso: alerta.sh falha | alerta.sh ok
#   falha: SEMPRE grava no journal (prioridade crit) e, se ALERTA_URL existir, faz POST de uma mensagem nele.
#   ok:    se ALERTA_PING_OK_URL existir, faz GET (ping de "estou vivo": serviços tipo healthchecks.io alertam quando o
#          ping DEIXA de chegar, o que cobre também "o timer não rodou").
# As URLs ficam em /etc/ailow/alerta.env (0600, FORA do repositório): são segredos (quem tem a URL, dispara alerta).
# Formato do arquivo: ALERTA_URL=https://... e/ou ALERTA_PING_OK_URL=https://...
# Nunca falha o serviço por causa do canal de alerta (sempre exit 0).
set -u
modo="${1:-}"
[ -f /etc/ailow/alerta.env ] && . /etc/ailow/alerta.env
host="$(hostname)"
case "$modo" in
  falha)
    msg="FALHA no backup do Ailow Cloud em ${host} ($(date -u +%FT%TZ)). Veja: journalctl -u ailow-backup.service -n 50"
    logger -p user.crit -t ailow-backup "$msg"
    if [ -n "${ALERTA_URL:-}" ]; then
      curl -fsS -m 15 --retry 3 -d "$msg" "$ALERTA_URL" >/dev/null || logger -p user.err -t ailow-backup "canal de alerta não respondeu"
    else
      logger -p user.warning -t ailow-backup "ALERTA_URL não configurada: a falha só está no journal"
    fi
    ;;
  ok)
    logger -p user.info -t ailow-backup "backup ok em ${host}"
    if [ -n "${ALERTA_PING_OK_URL:-}" ]; then
      curl -fsS -m 15 --retry 3 "$ALERTA_PING_OK_URL" >/dev/null || logger -p user.err -t ailow-backup "ping de sucesso não respondeu"
    fi
    ;;
  *) echo "uso: alerta.sh falha|ok" >&2 ;;
esac
exit 0
