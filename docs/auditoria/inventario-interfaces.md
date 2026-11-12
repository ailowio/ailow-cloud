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
