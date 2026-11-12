#!/usr/bin/env bash
# Teste de carga com k6 (S13b, PRD §10.7, RNF-01/02/03). Uso:
#   bash scripts/carga.sh smoke|carga|estresse
# Mesmo ambiente efêmero do contrato (scripts/lib/ambiente-efemero.sh): Postgres em contêiner, migrações, empresa
# descartável, API construída. O k6 roda em contêiner (grafana/k6, versão fixa) e cria os dados pela própria API no
# setup(). Ao final, lê GET /metrics (Bearer descartável) e mostra o RED por rota que a API mediu durante a carga.
# Sai com o código do k6: 0 = thresholds ok; 99 = algum threshold reprovou.
# NÃO são números da VPS: medem esta máquina (API + Postgres + k6 disputando CPU). Variáveis: PORTA_API, PORTA_PG,
# P95_VENDA_MS e P95_BUSCA_MS (canário: um limite impossível tem de reprovar).
set -euo pipefail
cd "$(dirname "$0")/.."

PERFIL="${1:-smoke}"
case "${PERFIL}" in smoke | carga | estresse) ;; *) echo "uso: bash scripts/carga.sh smoke|carga|estresse" >&2; exit 2 ;; esac

PORTA_API="${PORTA_API:-3003}"
PORTA_PG="${PORTA_PG:-15433}"
BANCO="ailow-carga-db"
IMAGEM_K6="grafana/k6:2.3.0"
RESULTADOS="ops/k6/resultados"

# shellcheck source=lib/ambiente-efemero.sh
source "scripts/lib/ambiente-efemero.sh"
trap ambiente_limpar EXIT
ambiente_variaveis
export METRICS_TOKEN="$(aleatorio 16)" # 32 caracteres; some junto com a execução
ambiente_subir_postgres
ambiente_migrar_e_semear
ambiente_subir_api
COOKIE="$(ambiente_cookie)"
export COOKIE
RUN_ID="$(aleatorio 3)"

mkdir -p "${RESULTADOS}"
chmod 777 "${RESULTADOS}" # o usuário do contêiner k6 não é o do runner
echo "== k6 ${IMAGEM_K6}, perfil ${PERFIL}"
CODIGO=0
# -e NOME (sem valor) herda do ambiente: o cookie não aparece na linha de comando.
docker run --rm --add-host=host.docker.internal:host-gateway \
  -v "${PWD}/ops/k6:/scripts:ro" -v "${PWD}/${RESULTADOS}:/resultados" \
  -e COOKIE -e "BASE_URL=http://host.docker.internal:${PORTA_API}" -e "RUN_ID=${RUN_ID}" -e "PERFIL=${PERFIL}" \
  -e "P95_VENDA_MS=${P95_VENDA_MS:-500}" -e "P95_BUSCA_MS=${P95_BUSCA_MS:-300}" \
  "${IMAGEM_K6}" run --quiet /scripts/carga.js || CODIGO=$?

echo "== RED medido pela API (GET /metrics) nas rotas da carga"
curl -fs -H "Authorization: Bearer ${METRICS_TOKEN}" "${ALVO_LOCAL}/metrics" |
  grep -E '^process_cpu_seconds_total|^nodejs_eventloop_lag_(mean|p99)_seconds|^http_requests_total\{.*route="/(vendas|produtos)"|^http_request_duration_seconds_(sum|count)\{.*route="/(vendas|produtos)"' |
  tee "${RESULTADOS}/${PERFIL}-metricas.txt" || true
exit "${CODIGO}"
