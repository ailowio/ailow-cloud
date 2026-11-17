# Desempenho — Ailow Cloud (Projeto Final)

Números medidos (não inventados). Como rodar: `bash scripts/carga.sh smoke|carga|estresse` (k6 em contêiner). Smoke também roda em todo PR (`carga-smoke`). Detalhe operacional: [`runbooks/dimensionamento-minimo.md`](runbooks/dimensionamento-minimo.md) e item 7 de [`prd-checklist-10.md`](prd-checklist-10.md).

## Metas (PRD)

| Requisito | Meta |
|---|---|
| RNF-01 — finalizar venda (p95, 50 VUs) | ≤ 500 ms |
| RNF-02 — buscar produto (p95, 50 VUs) | ≤ 300 ms |
| Erro sob carga | < 1 % |

## Local (S13b2, ambiente efêmero, sem rede de produção)

| Cenário | Venda p95 | Busca p95 | Erro |
|---|---|---|---|
| `carga` (2 rodadas) | 309 / 333 ms ✅ | 246 / 268 ms ✅ | 0 % |

Antes da otimização da numeração da venda (ADR 009): venda p95 ~1807 ms. Depois: ~309–333 ms. Thresholds **não** foram relaxados; canário `P95_VENDA_MS=1` reprova de propósito.

## Produção (`https://cloud.ailow.com.br`, tag `v1.0.1`, 2026-11-13)

k6 rodou do **PC do Pedro pela internet** (RTT ≈ 61 ms) — o p95 inclui rede; medição “na VPS” ainda é o próximo passo para o RNF-02.

| Config | Venda p95 | Busca p95 | Erro |
|---|---|---|---|
| 1,0 CPU (api/db) | 352 ms ✅ | 427 ms ❌ | 0 % |
| 1,5 CPU (medição pontual) | 366 ms ✅ | 529 ms ❌ | 0 % |

- SQL da busca ampla: **0,23 ms** (`EXPLAIN`) — o custo não está no SELECT.
- Gargalo da busca em produção: **ainda em aberto** (hipótese: espera no pool; não concluído).
- RNF-01 em produção: **aprovado**. RNF-02: **reprovado** nessas medições (honesto).

## Estresse

`bash scripts/carga.sh estresse` mostra onde quebra (limites de pool / serialização). Usado para validar a ADR 009, não como meta de go-live.

## Como o professor confere

1. Abrir um run verde do CI e o job `carga-smoke`.
2. No repo: `ops/k6/`, `scripts/carga.sh`.
3. Este arquivo + [`dimensionamento-minimo.md`](runbooks/dimensionamento-minimo.md).
