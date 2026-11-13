# Runbook: migrar o sistema para outra VPS (ou recriar a atual)

- **Serviço:** Ailow Cloud · **Dono:** Pedro · **Última revisão:** 2026-11-12 · **Ensaiado:** nunca **[NÃO VERIFICADO — S14]** · tempo medido: __ min
- Regras: ENV-*, SEC-01/04, OPS-04/11, AUD-24 (mudança de infraestrutura é mudança registrada), AUD-90 (evidência).

## 0. O que precisa viajar
| Item | Onde está | Observação |
|---|---|---|
| Banco | volume `dbdata` do Compose (Postgres 18.6; diretório `/var/lib/postgresql`) | `pg_dump -Fc` / `pg_restore` (lógico, portável entre máquinas) |
| `AUTH_PEPPER` | arquivo de ambiente da VPS | **Tem de ser o MESMO.** Os hashes de senha e PIN o misturam (ADR 004): pepper novo ⇒ ninguém consegue entrar. Copiar por canal seguro, nunca por chat/e-mail em claro |
| `TOTP_CHAVE` | arquivo de ambiente da VPS | **Tem de ser a MESMA** (como o pepper): o segredo TOTP dos Admins no dump está cifrado com ela; chave nova ⇒ os Admins não entram até refazer o TOTP (`npm run admin:criar`). Guardar **fora** do backup do Drive |
| `POSTGRES_PASSWORD` | arquivo de ambiente | Pode ser **nova** na VPS nova (o banco é recriado e restaurado); atualizar só no arquivo de ambiente |
| `METRICS_TOKEN` | arquivo de ambiente | Pode ser novo; atualizar o scraper. Acesso novo ⇒ matriz de acessos |
| Código | repositório (tag) | `git checkout vX.Y.Z` |
| Proxy HTTPS / DNS / certificado | VPS | **[NÃO VERIFICADO — S14]** ainda não existe |
| Arquivos enviados (logo da empresa) | **no banco** (`empresas.logo_bytes`, `bytea`; migração `20261112200000_empresa-logo`; conferido em 2026-11-12) | já viaja no `pg_dump`; não há arquivo em disco a copiar |
| Segredos da stack | **Swarm secrets** `ailow_postgres_password`, `ailow_auth_pepper`, `ailow_totp_chave` (S14b) | recriar no host novo com `docker secret create` (`deploy.md §1.6`); `AUTH_PEPPER` e `TOTP_CHAVE` **os mesmos**, vindos do gerenciador de senhas |
| Proxy do host novo | `ops/traefik/traefik.yaml` (S14b) | flags aceitas pelo Traefik v2.11.20; ACME e provider Swarm **não testados** (precisam de host real) |
| Chave do `crypt` do backup | gerenciador de senhas (nunca na VPS de código) | necessária para ler o backup do Drive no host novo (`backup.md §2`) |

## 1. Antes
1. VPS nova provisionada, Docker/Compose instalados, firewall só com 80/443 (e SSH restrito); acessos criados e registrados em `docs/auditoria/matriz-acessos.md` (nominais, MFA onde houver).
2. Mesma versão (tag) que a de produção. Não migrar e atualizar na mesma janela.
3. Combinar janela com o Dono da loja (o sistema fica fora durante a cópia). Reduzir o TTL do DNS com antecedência **[NÃO VERIFICADO]**.
4. **Requisito de observabilidade (decisão do Pedro em 2026-11-13, [ADR 011](../adr/011-alertas-prometheus-na-vps-nova.md)): a VPS nova sobe com Prometheus + Alertmanager, junto com a stack.** Antes da janela real: (a) dimensionar RAM/CPU para app **mais** observabilidade; (b) `METRICS_TOKEN` configurado e o scrape de `/metrics` funcionando (token novo ⇒ matriz de acessos); (c) as regras de `ops/prometheus/alertas.yml` carregadas e estendidas para disponibilidade, saturação (CPU/memória do host e dos contêineres) e banco (exporter de Postgres: confirmar a ferramenta e a versão na documentação oficial antes de adotar); (d) canal do Alertmanager definido pelo Pedro e **testado com um alerta forçado**; (e) um monitor externo de disponibilidade (cobre "a VPS ou o Prometheus caíram"); (f) o alerta do backup (healthchecks.io) continua. Atualizar os inventários de acessos, rotinas e interfaces.
5. **Requisito de desempenho:** a VPS atual **não** cumpre o RNF-02 (medido em 2026-11-13: busca p95 474 ms, limite 300; venda p95 447 ms, limite 500; `api` e `db` saturaram 1 CPU cada). Na VPS nova, dimensionar CPU para o limite da `api` e do `db` acima de 1 CPU e **re-medir** com o k6 `carga` (50 usuários) contra um tenant de teste, que depois é removido.

## 2. Ensaio obrigatório (tier B) — antes da janela real
Na VPS nova, restaurar um backup **real recente** em um banco de teste e rodar o smoke (4 fluxos do `deploy.md §3`). Medir o tempo de dump + cópia + restore e anotar acima. Sem ensaio, não há migração.

## 3. Backup (também usado pelo deploy e pelo rollback)
```bash
# Na VPS de origem, com a api parada para um corte consistente (ou aceitar o instantâneo do pg_dump):
docker compose exec -T db pg_dump -U ailow -d ailow -Fc > ailow-AAAAMMDD-HHMM.dump
sha256sum ailow-*.dump > ailow-AAAAMMDD-HHMM.sha256
```
O arquivo `.dump` contém **dados pessoais de clientes (LGPD)**: guardar criptografado, fora do repositório, com acesso restrito e prazo de retenção definido **[NÃO VERIFICADO — S14: retenção e local do backup]**. Backup só vale se for **restaurado ao menos uma vez com evidência** (piso do tier A): o ensaio do §2 é essa evidência.

## 4. Janela de migração
1. Avisar a loja. `docker compose stop api` na origem (o `db` continua).
2. Backup (§3) e conferir o checksum. Copiar para a VPS nova por canal cifrado (`scp`/`rsync` por SSH) e conferir o checksum de lá.
3. VPS nova: criar o arquivo de ambiente (mesmo `AUTH_PEPPER`; senhas novas), `git checkout vX.Y.Z`, subir só o banco: `docker compose up -d db`.
4. Restaurar no banco vazio criado pelo Compose:
   ```bash
   docker compose exec -T db pg_restore -U ailow -d ailow --no-owner --exit-on-error < ailow-AAAAMMDD-HHMM.dump
   ```
   O papel `ailow_app` é criado por migração (`20261110120000_empresas-e-rls-base`) e papéis pertencem ao cluster: um `pg_dump` de um só banco não os carrega. Depois do restore, conferir `\du` e `\dp` (o `GRANT` e o RLS forçado) e, se faltar, rodar o `migrate` antes e restaurar só os dados **[NÃO VERIFICADO — ensaiar na S14]**.
5. `docker compose up -d --build` (o `migrate` confirma que o schema está na versão certa e não aplica nada novo) e `curl -fsS …/health`.
6. Smoke (`deploy.md §3`) **na VPS nova, por IP/hosts local**, antes de mexer no DNS.
7. Virar o DNS/proxy para a VPS nova. Observar 15 min (gatilho do README). A origem continua **parada, intacta**.

## 5. Reversão da migração
Antes de virar o DNS: basta `docker compose start api` na origem. Depois de virar: voltar o DNS para a origem **só se a VPS nova ainda não recebeu vendas**; se recebeu, a origem está defasada — não voltar sem um novo dump da VPS nova (decisão do Pedro).

## 6. Depois
- Manter a origem parada e o dump por um prazo combinado (ex.: 7 dias), depois **destruir ambos** com registro (LGPD: dado de cliente não fica solto).
- Revogar acessos e chaves da VPS antiga; atualizar `matriz-acessos.md` e `inventario-interfaces.md` (novo endereço do `/metrics`, DNS).
- Release/CHANGELOG: nota da migração, tempo medido, resultado do smoke; lição se algo falhou.

## Não verificado (depende da S14)
Tudo em VPS; o conteúdo do dump quanto a papéis/GRANT/RLS; onde ficam os arquivos enviados; retenção e local do backup; TTL/DNS; tempo medido; contato de escalonamento.
