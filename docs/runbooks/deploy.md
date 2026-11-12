# Runbook: deploy de uma versão na VPS

- **Serviço:** Ailow Cloud (api + db; web servido pelo proxy HTTPS) · **Dono:** Pedro · **Última revisão:** 2026-11-12 · **Ensaiado em staging/VPS:** nunca **[NÃO VERIFICADO — S14]**
- Regras: OPS-04 (deploy repetível e serializado), OPS-05 (gatilho de reversão), OPS-11 (banco compatível com 2 versões), AUD-24/27 (mudança rastreável).

## 0. O que existe hoje e o que não
- **Existe [verificado no CI]:** `compose.yaml` com `db` (Postgres 18.6), `migrate` (roda as migrações e termina) e `api` (só sobe depois do `migrate` terminar com sucesso; usuário não-root, FS somente leitura, `cap_drop: ALL`, healthcheck em `/health`). O job `compose` sobe isso com segredos efêmeros; o job `imagem` constrói e escaneia (Trivy) a imagem da API.
- **Não existe:** a VPS; o proxy HTTPS e a forma de servir o web (arquivos estáticos do `apps/web/dist` atrás do proxy, com `/acesso`, `/vendas`… repassados à API — mesmo desenho do `vite preview` usado no E2E); registro de imagens; pipeline de deploy; `main` protegida. Tudo isso é decisão/entrega da **S14**.
- Consequência: hoje o "deploy" é **manual** (SSH + `docker compose`). Alteração manual em produção é **mudança registrada** (AUD-24): anotar no release.

## 1. Antes (pré-condições — todas verdadeiras, senão não começa)
1. O PR da versão está mergeado em `main` com **todos** os checks verdes (`verify`, `contrato`, `e2e`, `carga-smoke`, `alertas`, `seguranca-*`, `imagem`, `compose`) e aprovação humana ≠ autor. Evidência: link do PR.
2. `CHANGELOG.md` com a seção da versão; tag `vX.Y.Z` (SemVer) criada **no commit mergeado**.
3. Há **backup recente e restaurável** do banco (ver [`migrar-vps.md` §3](migrar-vps.md)): feito agora, antes do deploy, **se a versão tiver migração** **[NÃO VERIFICADO — S14: ainda não existe rotina de backup]**.
4. A migração da versão é compatível com a versão **anterior** da API rodando (expand → migrate → contract, OPS-11). Se não for, a versão não é "voltável" sem restaurar backup: tratar como **janela combinada** com o Dono da loja e dizer no release.
5. Janela fora do horário de venda da loja (a combinar com o Marcos). Um deploy por vez.

## 2. Deploy (na VPS, no diretório do compose)
```bash
# 1. Código na tag exata (nunca "main solta")
git fetch --tags && git checkout vX.Y.Z

# 2. Conferir o arquivo de ambiente SEM imprimir valores: só nomes presentes e não vazios
#    (POSTGRES_PASSWORD, AUTH_PEPPER; METRICS_TOKEN se /metrics for usado). Chave duplicada vazia sobrescreve a boa (L-0013).

# 3. Construir e subir. O serviço `migrate` roda antes da `api`; se ele falhar, a api NÃO sobe.
docker compose up -d --build

# 4. Esperar e conferir
docker compose ps                      # db healthy, migrate Exited (0), api healthy
curl -fsS http://127.0.0.1:3000/health  # 200 {"status":"ok",...}
docker compose logs --since 5m api | grep -c '"level":50'   # erros (nível 50) — esperado 0
```
`up -d --build` recria só o que mudou. O Postgres e o volume `dbdata` **não** são tocados (nunca `down -v`, ENV-12).

## 3. Verificar (smoke manual — 5 min, celular da loja ou 360×640)
Entrar → Vendas: vender 1 peça de teste e **cancelar** a venda (estoque volta) → Pessoas: ver o botão de ponto → Compras abre. Mesmos 4 fluxos do E2E (`scripts/e2e.sh`), agora contra produção, **com dados de teste identificáveis** que o Dono apaga/cancela. Dados de cliente real não entram no smoke.
Olhar `/metrics` (rede interna) ou os logs: sem 5xx novos, p95 da venda dentro do RNF-01.

## 4. Gatilho de reversão (OPS-05)
Qualquer um dos itens do README (health, 5xx > 1 %, fluxo do smoke falhando) ⇒ **[`rollback.md`](rollback.md)**, sem debate. Investigar depois.

## 5. Depois
- Registrar no release: versão, data/hora, quem executou, resultado do smoke, tempo total (**tempo medido: __ min**).
- Se algo falhou ou quase: lição (`node harness/scripts/licoes.mjs nova`) e atualizar este runbook.

## 6. Quando escalar
Banco não sobe, `migrate` falha de forma que o rollback não resolve, ou suspeita de perda/exposição de dados ⇒ parar, não improvisar no banco, acionar o Pedro (contato a registrar na S14) e seguir `harness/checklists/incidente.md`.

## Não verificado (depende da S14)
VPS, proxy HTTPS, forma de servir o web, rotina e restauração de backup, janela com o cliente, tempos medidos, contato de escalonamento, valores finais do gatilho numérico.
