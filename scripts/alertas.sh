#!/usr/bin/env bash
# Valida as regras de alerta do SLO (S13b): sintaxe (promtool check rules) e comportamento (promtool test rules).
# Precisa de Docker. Imagem fixada; o promtool vem junto do Prometheus.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # git-bash no Windows trocaria os caminhos do contêiner
IMAGEM_PROMETHEUS="prom/prometheus:v3.5.0"
docker run --rm --entrypoint promtool -v "$PWD/ops/prometheus:/regras:ro" -w /regras "${IMAGEM_PROMETHEUS}" check rules alertas.yml
docker run --rm --entrypoint promtool -v "$PWD/ops/prometheus:/regras:ro" -w /regras "${IMAGEM_PROMETHEUS}" test rules alertas.test.yml
