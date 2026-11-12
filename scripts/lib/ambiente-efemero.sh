#!/usr/bin/env bash
# Ambiente EFÊMERO comum a scripts/contrato.sh (S13a) e scripts/carga.sh (S13b): Postgres em contêiner, migrações,
# empresa descartável com um Dono, API construída e login. Para ser lido com `source`, depois de definir:
#   PORTA_API, PORTA_PG, BANCO (nome do contêiner)  e  `trap ambiente_limpar EXIT`.
# Nenhum segredo vai para o repositório: senhas e pepper são gerados a cada execução e somem junto com o banco.
# Armadilhas já resolvidas aqui (não desfazer):
#  - esperar o log "PostgreSQL init process complete": a imagem sobe um servidor TEMPORÁRIO para o initdb e o
#    pg_isready já responde nele;
#  - MSYS_NO_PATHCONV=1: o git-bash no Windows trocaria argumentos que parecem caminho (ex.: '^/acesso/sair$');
#  - porta do Postgres fora das faixas que o Windows reserva (ex.: 55391-55590): por isso 15432/15433.

export MSYS_NO_PATHCONV=1
IMAGEM_POSTGRES="postgres:18.6-alpine3.24" # a mesma do compose.yaml
API_PID=""

aleatorio() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

ambiente_variaveis() {
  SENHA_PG="$(aleatorio 18)"
  export CONTRATO_SENHA="$(aleatorio 18)"
  export AUTH_PEPPER="$(aleatorio 24)" # 48 caracteres (a API exige >= 32)
  # Base64 de 32 bytes (a API exige exatamente isso). `base64` é do coreutils: não depende de openssl no Git Bash.
  export TOTP_CHAVE="$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
  # Só neste ambiente efêmero de teste: contrato, carga e E2E fazem centenas de logins do mesmo IP. Em produção vale o
  # padrão (10 por minuto por IP, SEC-07). O que prova o limite real é apps/api/test/rate-limit.test.ts.
  export LOGIN_RATE_MAX=100000
  export DATABASE_URL="postgresql://ailow:${SENHA_PG}@127.0.0.1:${PORTA_PG}/ailow"
  export COOKIE_SECURE=false PORT="${PORTA_API}" LOG_LEVEL="${LOG_LEVEL:-warn}"
  export ALVO_LOCAL="http://127.0.0.1:${PORTA_API}"
}

ambiente_limpar() {
  [ -n "${API_PID}" ] && { kill "${API_PID}" 2>/dev/null || true; }
  docker rm -f "${BANCO}" >/dev/null 2>&1 || true
}

ambiente_subir_postgres() {
  echo "== Postgres efêmero (${IMAGEM_POSTGRES}) na porta ${PORTA_PG}"
  docker rm -f "${BANCO}" >/dev/null 2>&1 || true
  docker run -d --name "${BANCO}" -e POSTGRES_USER=ailow -e POSTGRES_DB=ailow -e "POSTGRES_PASSWORD=${SENHA_PG}" \
    -p "127.0.0.1:${PORTA_PG}:5432" "${IMAGEM_POSTGRES}" >/dev/null
  for _ in $(seq 1 60); do
    docker logs "${BANCO}" 2>&1 | grep -q "PostgreSQL init process complete" && break
    sleep 1
  done
  # Só então confere o servidor definitivo.
  for _ in $(seq 1 60); do
    docker exec "${BANCO}" pg_isready -h 127.0.0.1 -U ailow -d ailow >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "${BANCO}" pg_isready -h 127.0.0.1 -U ailow -d ailow >/dev/null
  # Consulta de verdade pela porta publicada (a que a API usa): só ela prova que o banco está de pé para o host.
  npx tsx apps/api/scripts/esperar-banco.ts
}

ambiente_migrar_e_semear() {
  echo "== Migrações"
  npm run build:shared >/dev/null
  npm run migrate -w @ailow/api -- up >/dev/null
  echo "== Empresa descartável"
  npx tsx apps/api/scripts/contrato-seed.ts
}

# Constrói e sobe a API (variáveis extras, como METRICS_TOKEN, vão no ambiente de quem chama).
ambiente_subir_api() {
  echo "== API construída na porta ${PORTA_API}"
  npm run build -w @ailow/api >/dev/null
  node apps/api/dist/main.js &
  API_PID=$!
  for _ in $(seq 1 40); do
    curl -fs "${ALVO_LOCAL}/health" >/dev/null 2>&1 && break
    sleep 1
  done
  curl -fs "${ALVO_LOCAL}/health" >/dev/null
}

# Entra como o Dono descartável e imprime só o cabeçalho Cookie (stdout).
ambiente_cookie() { npx tsx apps/api/scripts/contrato-sessao.ts; }
