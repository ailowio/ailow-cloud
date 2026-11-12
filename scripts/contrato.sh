#!/usr/bin/env bash
# Teste de contrato da API com Schemathesis (S13a, PRD §10.6, ADR 001). Roda igual na máquina do Pedro e no CI:
#   bash scripts/contrato.sh
# Sobe um Postgres EFÊMERO em contêiner, aplica as migrações, cria uma empresa descartável, sobe a API construída,
# entra como Dono e deixa o Schemathesis (contêiner) testar o contrato que a própria API publica em /openapi.json.
# O ambiente efêmero é o mesmo da carga (scripts/lib/ambiente-efemero.sh, S13b).
# Precisa de: Docker, Node 22 e `npm ci` já feito. Variáveis opcionais: PORTA_API, PORTA_PG, MAX_EXAMPLES.
set -euo pipefail
cd "$(dirname "$0")/.."

PORTA_API="${PORTA_API:-3002}"
PORTA_PG="${PORTA_PG:-15432}"
BANCO="ailow-contrato-db"
MAX_EXAMPLES="${MAX_EXAMPLES:-25}"
# Semente fixa: o mesmo PR dá o mesmo resultado (gate estável). Para caçar bug novo: SEED=$RANDOM$RANDOM bash scripts/contrato.sh
SEED="${SEED:-20261112}"
IMAGEM_SCHEMATHESIS="schemathesis/schemathesis:4.33.2"

# shellcheck source=lib/ambiente-efemero.sh
source "scripts/lib/ambiente-efemero.sh"
trap ambiente_limpar EXIT
ambiente_variaveis
ambiente_subir_postgres
ambiente_migrar_e_semear
ambiente_subir_api
COOKIE="$(ambiente_cookie)"

echo "== Schemathesis ${IMAGEM_SCHEMATHESIS} (até ${MAX_EXAMPLES} exemplos por operação)"
# Exclusões justificadas:
#  - /acesso/sair: encerra a sessão usada pelo próprio teste;
#  - positive_data_acceptance: dado "válido pelo schema" bate em regra de negócio (estoque, cliente inexistente,
#    sequência de ponto) e recebe 404/409 de propósito; a regra de negócio tem teste de integração próprio;
#  - unsupported_method: método não registrado numa rota existente recebe 404 do Fastify (e não 405). O app só fala
#    com os métodos documentados, então responder 405 não muda nada para quem chama; revisar se a API virar pública.
# Os demais checks (5xx, status e conteúdo documentados, schema da resposta, rejeição de dado inválido, autenticação
# ignorada) ficam todos ligados.
docker run --rm --add-host=host.docker.internal:host-gateway ${DOCKER_EXTRA:-} "${IMAGEM_SCHEMATHESIS}" run \
  "http://host.docker.internal:${PORTA_API}/openapi.json" \
  --url "http://host.docker.internal:${PORTA_API}" \
  --header "Cookie: ${COOKIE}" --generation-with-security-parameters false \
  --checks all --exclude-checks positive_data_acceptance,unsupported_method \
  --exclude-path-regex '^/acesso/sair$' \
  --max-examples "${MAX_EXAMPLES}" --phases examples,coverage,fuzzing \
  --seed "${SEED}" --request-retries 2 \
  --workers 1 --continue-on-failure --no-color ${SCHEMATHESIS_EXTRA:-}
