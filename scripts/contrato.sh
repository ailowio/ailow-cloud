#!/usr/bin/env bash
# Teste de contrato da API com Schemathesis (S13a, PRD §10.6, ADR 001). Roda igual na máquina do Pedro e no CI:
#   bash scripts/contrato.sh
# Sobe um Postgres EFÊMERO em contêiner, aplica as migrações, cria uma empresa descartável, sobe a API construída,
# entra como Dono e deixa o Schemathesis (contêiner) testar o contrato que a própria API publica em /openapi.json.
# Nenhum segredo vai para o repositório: senhas e pepper são gerados a cada execução e somem junto com o banco.
# Precisa de: Docker, Node 22 e `npm ci` já feito. Variáveis opcionais: PORTA_API, PORTA_PG, MAX_EXAMPLES.
set -euo pipefail
cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # git-bash no Windows trocaria '^/acesso/sair$' por um caminho do disco

PORTA_API="${PORTA_API:-3002}"
PORTA_PG="${PORTA_PG:-15432}" # fora das faixas que o Windows reserva (ex.: 55391-55590)
MAX_EXAMPLES="${MAX_EXAMPLES:-25}"
# Semente fixa: o mesmo PR dá o mesmo resultado (gate estável). Para caçar bug novo: SEED=$RANDOM$RANDOM bash scripts/contrato.sh
SEED="${SEED:-20261112}"
IMAGEM_SCHEMATHESIS="schemathesis/schemathesis:4.33.2"
IMAGEM_POSTGRES="postgres:18.6-alpine3.24" # a mesma do compose.yaml
BANCO="ailow-contrato-db"

aleatorio() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }
SENHA_PG="$(aleatorio 18)"
export CONTRATO_SENHA="$(aleatorio 18)"
export AUTH_PEPPER="$(aleatorio 24)" # 48 caracteres (a API exige >= 32)
export DATABASE_URL="postgresql://ailow:${SENHA_PG}@127.0.0.1:${PORTA_PG}/ailow"
export COOKIE_SECURE=false PORT="${PORTA_API}" LOG_LEVEL=warn
export ALVO_LOCAL="http://127.0.0.1:${PORTA_API}"

API_PID=""
limpar() {
  [ -n "${API_PID}" ] && { kill "${API_PID}" 2>/dev/null || true; }
  docker rm -f "${BANCO}" >/dev/null 2>&1 || true
}
trap limpar EXIT

echo "== Postgres efêmero (${IMAGEM_POSTGRES}) na porta ${PORTA_PG}"
docker rm -f "${BANCO}" >/dev/null 2>&1 || true
docker run -d --name "${BANCO}" -e POSTGRES_USER=ailow -e POSTGRES_DB=ailow -e "POSTGRES_PASSWORD=${SENHA_PG}" \
  -p "127.0.0.1:${PORTA_PG}:5432" "${IMAGEM_POSTGRES}" >/dev/null
# A imagem sobe um servidor TEMPORÁRIO para o initdb e o reinicia: pg_isready já responde nele. Espera o fim da
# inicialização no log e só então confere o servidor definitivo (pela porta publicada, como a API vai usar).
for _ in $(seq 1 60); do
  docker logs "${BANCO}" 2>&1 | grep -q "PostgreSQL init process complete" && break
  sleep 1
done
for _ in $(seq 1 60); do
  docker exec "${BANCO}" pg_isready -h 127.0.0.1 -U ailow -d ailow >/dev/null 2>&1 && break
  sleep 1
done
docker exec "${BANCO}" pg_isready -h 127.0.0.1 -U ailow -d ailow >/dev/null

echo "== Migrações"
npm run build:shared >/dev/null
npm run migrate -w @ailow/api -- up >/dev/null

echo "== Empresa descartável e API"
npx tsx apps/api/scripts/contrato-seed.ts
npm run build -w @ailow/api >/dev/null
node apps/api/dist/main.js &
API_PID=$!
for _ in $(seq 1 40); do
  curl -fs "${ALVO_LOCAL}/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -fs "${ALVO_LOCAL}/health" >/dev/null

COOKIE="$(npx tsx apps/api/scripts/contrato-sessao.ts)"

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
