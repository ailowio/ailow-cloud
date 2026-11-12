#!/usr/bin/env bash
# E2E no navegador (S13c, PRD §10, RNF-04/05): Playwright em Chromium 360×640 contra a stack EFÊMERA — Postgres em
# contêiner, migrações, empresa descartável com um Dono, API construída e o web construído servido pelo
# `vite preview` (o proxy deixa app e API na mesma origem, como o proxy HTTPS da S14).
# Mesmo ambiente de scripts/contrato.sh e scripts/carga.sh (scripts/lib/ambiente-efemero.sh). Segredos descartáveis.
# Uso:
#   bash scripts/e2e.sh            # os 4 fluxos: nova venda (RNF-04), receber compra, ponto, cancelar venda
#   E2E_CANARIO=1 bash scripts/e2e.sh   # depois dos 4 fluxos, prova que o E2E reprova (L-0006): refaz a venda com
#                                       # limite de 1 toque e EXIGE falha; se passar, o script falha.
# Variáveis: PORTA_API, PORTA_PG, PORTA_WEB. Na 1ª vez local: npx playwright install chromium-headless-shell
set -euo pipefail
cd "$(dirname "$0")/.."

PORTA_API="${PORTA_API:-3004}"
PORTA_PG="${PORTA_PG:-15434}"
PORTA_WEB="${PORTA_WEB:-4174}"
BANCO="ailow-e2e-db"
WEB_PID=""

# shellcheck source=lib/ambiente-efemero.sh
source "scripts/lib/ambiente-efemero.sh"
limpar() {
  [ -n "${WEB_PID}" ] && { kill "${WEB_PID}" 2>/dev/null || true; }
  ambiente_limpar
}
trap limpar EXIT

ambiente_variaveis
ambiente_subir_postgres
ambiente_migrar_e_semear
ambiente_subir_api

echo "== Web construído na porta ${PORTA_WEB}"
npm run build -w @ailow/web >/dev/null
(cd apps/web && API_URL="${ALVO_LOCAL}" exec npx --no-install vite preview --port "${PORTA_WEB}" --strictPort --host 127.0.0.1) >/dev/null 2>&1 &
WEB_PID=$!
for _ in $(seq 1 30); do
  curl -fs "http://127.0.0.1:${PORTA_WEB}/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fs "http://127.0.0.1:${PORTA_WEB}/health" >/dev/null # prova que app e API estão na mesma origem

export E2E_BASE_URL="http://127.0.0.1:${PORTA_WEB}"
export E2E_EMAIL="dono@contrato.test" E2E_SENHA="${CONTRATO_SENHA}"

echo "== Playwright: nova venda, receber compra, ponto, cancelar venda"
npm run e2e -w @ailow/web

if [ "${E2E_CANARIO:-0}" = "1" ]; then
  echo "== Canário (L-0006): a venda com limite de 1 toque TEM de reprovar"
  if E2E_LIMITE_TOQUES=1 npm run e2e -w @ailow/web -- venda-toques >/dev/null 2>&1; then
    echo "CANÁRIO FALHOU: o E2E passou com limite de 1 toque; ele não está medindo o que diz medir" >&2
    exit 1
  fi
  echo "canário ok: o E2E reprovou como esperado"
fi
