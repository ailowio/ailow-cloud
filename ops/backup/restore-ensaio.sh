#!/usr/bin/env bash
# Ensaio de restauração (S14b; evidência exigida pelo tier A/B e pela ADR 010): restaura um dump em um Postgres
# DESCARTÁVEL e confere o resultado. Não toca a stack nem a produção.
#
# Uso: bash ops/backup/restore-ensaio.sh <arquivo.dump> [<arquivo.sha256>]
# Saída: tempo de restauração, papéis, RLS e GRANTs conferidos; exit 0 só se tudo bateu. Apaga o contêiner ao sair.
#
# Observação: um pg_dump de UM banco não leva papéis (cluster). O papel `ailow_app` (migração 20261110120000) é criado
# aqui antes do restore, igual à migração, para os GRANTs do dump terem onde cair. O mesmo vale na VPS nova.
set -euo pipefail

dump="${1:?uso: restore-ensaio.sh <arquivo.dump> [<arquivo.sha256>]}"
sha="${2:-}"
[ -f "$dump" ] || { echo "erro: $dump não existe" >&2; exit 2; }

if [ -n "$sha" ]; then
  ( cd "$(dirname "$dump")" && sha256sum -c "$(basename "$sha")" ) || { echo "erro: checksum não confere" >&2; exit 3; }
fi

nome="ailow-restore-ensaio-$$"
senha="$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"
cleanup() { docker rm -f "$nome" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$nome" -e POSTGRES_USER=ailow -e POSTGRES_DB=ailow -e "POSTGRES_PASSWORD=$senha" \
  postgres:18.6-alpine3.24 >/dev/null

# A imagem sobe um servidor temporário (só socket Unix) para inicializar e depois reinicia o definitivo. Só o definitivo
# aceita TCP: esperar por TCP evita restaurar no servidor que está prestes a cair.
subiu=0
for _ in $(seq 1 60); do
  if docker exec -e "PGPASSWORD=$senha" "$nome" psql -h 127.0.0.1 -U ailow -d ailow -Atc "select 1" >/dev/null 2>&1; then subiu=1; break; fi
  sleep 1
done
[ "$subiu" = "1" ] || { echo "erro: postgres de ensaio não subiu em 60 s" >&2; exit 4; }

docker exec "$nome" psql -U ailow -d ailow -v ON_ERROR_STOP=1 -c "CREATE ROLE ailow_app NOLOGIN NOBYPASSRLS" >/dev/null

inicio="$(date +%s)"
docker exec -i "$nome" pg_restore -U ailow -d ailow --no-owner --exit-on-error < "$dump"
fim="$(date +%s)"

q() { docker exec "$nome" psql -U ailow -d ailow -Atc "$1"; }
# Exceção documentada (ADR 004): `diretorio_login` é tabela de plataforma, sem RLS e SEM GRANT ao papel de runtime; só o
# dono do schema a lê, via buscar_login(). Ela sai da regra "toda tabela com empresa_id tem RLS forçada + GRANT", e o
# ensaio confere o inverso: o papel de runtime continua SEM acesso a ela depois do restore (falha fechada).
EXCECAO_ADR004="'diretorio_login'"
tabelas="$(q "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
migracoes="$(q "select count(*) from pgmigrations")"
sem_rls="$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'pgmigrations' and c.relname not in ($EXCECAO_ADR004) and exists (select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=c.relname and k.column_name='empresa_id') and not (c.relrowsecurity and c.relforcerowsecurity)")"
sem_grant="$(q "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'pgmigrations' and c.relname not in ($EXCECAO_ADR004) and exists (select 1 from information_schema.columns k where k.table_schema='public' and k.table_name=c.relname and k.column_name='empresa_id') and not has_table_privilege('ailow_app', c.oid, 'SELECT')")"

excecao_aberta="$(q "select count(*) from pg_class where relname='diretorio_login' and has_table_privilege('ailow_app', oid, 'SELECT,INSERT,UPDATE,DELETE')")"
echo "restore_segundos=$((fim - inicio)) tabelas=$tabelas migracoes=$migracoes tabelas_empresa_sem_rls_forcada=$sem_rls tabelas_empresa_sem_grant=$sem_grant diretorio_login_aberto_ao_runtime=$excecao_aberta"
[ "$tabelas" -ge 1 ] && [ "$migracoes" -ge 1 ] && [ "$sem_rls" = "0" ] && [ "$sem_grant" = "0" ] && [ "$excecao_aberta" = "0" ] \
  || { echo "FALHOU: restauração incompleta ou permissões diferentes do desenho" >&2; exit 5; }
echo "OK: dump restaurado e consistente (RLS forçada e GRANT em toda tabela com empresa_id, exceto diretorio_login que segue fechada ao runtime)"
