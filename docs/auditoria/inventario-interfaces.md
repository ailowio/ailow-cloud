# Inventário de interfaces e integrações — Ailow Cloud   (AUD-60..69)

Só interfaces **técnicas** entre sistemas. As rotas da API para o app web (mesma origem, cookie de sessão) estão no OpenAPI (`docs/openapi.json`) e na matriz de acessos.

| ID | Interface | Origem → Destino | Dados trafegados (e classificação) | Método/protocolo | Frequência | Autenticação · escopo da credencial · rotação | Contrato/mapeamento (link) | Dono | Criticidade |
|----|-----------|------------------|------------------------------------|------------------|-----------|-----------------------------------------------|----------------------------|------|-------------|
| I-01 | `GET /metrics` (métricas RED) | Prometheus (ainda não existe; S14) → API | contadores e histogramas por método, rota **template** e classe de status. **Sem PII, sem empresa, sem usuário, sem URL** (teste `apps/api/test/metricas.test.ts`) — operacional | HTTP GET, texto Prometheus | a cada scrape (15–60 s) | Bearer `METRICS_TOKEN` (16+ caracteres, aleatório, fora do repositório). **Ausente = a rota nem existe (404).** Rotação: trocar a variável e reiniciar a API; prazo a definir na S14 | `apps/api/src/metricas.ts`; fora do OpenAPI (`hide`); alertas em `ops/prometheus/alertas.yml` | Pedro | Média |

## Controles de integridade por interface (AUD-62/63/65/66/67)
| ID | Completude/exatidão | Idempotência | Validação na entrada | Tratamento de erro | Conciliação | Log |
|----|---------------------|--------------|----------------------|--------------------|-------------|-----|
| I-01 | somente leitura; contadores são monotônicos (zeram no reinício, o `rate()` do Prometheus trata) | GET, sem efeito | token comparado em tempo constante (hash SHA-256 + `timingSafeEqual`); 401 sem resposta de detalhe | 401 sem token/token errado; o próprio `/metrics` não é contado | n/a | scrape visível no log de requisições da API (sem corpo) |

## Fornecedor / terceiro (AUD-68)
Nenhum nesta interface (Prometheus e Grafana serão auto-hospedados na VPS, S14; ainda não existem).

## Ferramentas que falam com a API só em teste (não são interfaces de produção)
- **k6** (`scripts/carga.sh`, `ops/k6/carga.js`): roda contra um ambiente **efêmero** (banco e API subidos pelo próprio script, segredos aleatórios descartados no fim). Nunca aponta para produção. No CI: job `carga-smoke` em todo PR; carga completa e estresse só por `workflow_dispatch` (manual). **Nada agendado.**
- **Schemathesis** (`scripts/contrato.sh`): idem, ambiente efêmero.

## Interfaces de deploy e backup (S14b; só existem em produção na S14c)
| ID | Interface | Origem → Destino | Dados (classificação) | Protocolo | Frequência | Autenticação · escopo · rotação | Contrato | Dono | Criticidade |
|----|-----------|------------------|-----------------------|-----------|-----------|----------------------------------|----------|------|-------------|
| I-02 | Proxy do web para a API | nginx do `web` → `api` (rede `ailow_internal`) | todo o tráfego do app, **pessoal e financeiro** | HTTP interno | contínuo | rede overlay `internal` (sem rota externa); cookie de sessão atravessa. `/metrics` **não** é repassado (404 no nginx) | `ops/web/nginx.conf`; lista de prefixos idêntica à do Vite, travada por `apps/api/test/proxy-web.test.ts` | Pedro | Alta |
| I-03 | Borda HTTPS | internet → Traefik → `web` (rede do proxy) | idem | HTTPS (TLS no Traefik; HSTS 1 ano) | contínuo | certificado Let's Encrypt (R-03); só o `web` entra na rede do Traefik | labels em `ops/stack/ailow.yaml` | Pedro | Alta |
| I-04 | Imagens de contêiner | GitHub Actions → GHCR → host (pull) | binários da aplicação, **sem dados e sem segredos** | HTTPS (registro OCI) | por versão (tag) | push: `GITHUB_TOKEN` efêmero só em tag; pull: credencial de leitura (matriz de acessos) | `.github/workflows/publicar.yml`; scan Trivy antes do push | Pedro | Alta |
| I-05 | Backup para o Drive | host → Google Drive (rclone) | **dump completo do banco, pessoal e financeiro, cifrado antes de sair** | HTTPS (API do Drive) via rclone `crypt` | diário | token OAuth `drive.file` + senha do `crypt` (matriz de acessos) | `ops/backup/backup.sh` | Pedro | Alta |

Controles de integridade: I-02/I-03 sem estado próprio (proxy puro; erro da API passa como está). I-04: a tag só publica se apontar para commit da `main` e as duas imagens passarem no Trivy (CRITICAL/HIGH corrigíveis). I-05: o script recusa remoto sem `crypt`, recusa dump sem tabela com dados, confere o tamanho no remoto e só então aplica a retenção; conciliação = o ensaio de restauração (`backup.md §4`). **Fornecedores/terceiros (AUD-68):** Google (Drive e OAuth), GitHub (Actions, GHCR) e Let's Encrypt: nenhum recebe dado em claro; o Drive só vê dado cifrado.
