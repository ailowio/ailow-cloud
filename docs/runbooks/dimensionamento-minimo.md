# Configuração mínima de infraestrutura do Ailow Cloud (dimensionamento medido)

- **Serviço:** Ailow Cloud v1.0.1 · **Dono:** Pedro · **Medido em:** 2026-11-13 · **Uso:** texto-guia do pacote do curso (Moodle) e requisito da VPS própria (`migrar-vps.md`).
- **Honestidade primeiro:** abaixo estão só valores **medidos** ou **configurados** e testados. O que ninguém mediu está em "Não verificado". Não existe aqui um "mínimo comprovado para passar o RNF-02" (ele reprovou em produção; ver §3).

## 1. Configuração que está em produção (e funcionou)
Um host único, **compartilhado** com outros serviços (a Copel), com o Ailow limitado por serviço:

| Item | Valor |
|---|---|
| Host | 4 vCPU, 15,6 GB de RAM, sem swap, disco de 194 GB (173 GB livres no dia 2026-11-12), Ubuntu 20.04, Docker 28.1.1 (Swarm de nó único) |
| Orquestração | Docker Swarm, stack `ailow` (`ops/stack/ailow.yaml`); HTTPS pelo Traefik do host (Let's Encrypt) |
| `db` (Postgres 18.6) | limite **1,0 CPU** e **512 MB** |
| `api` (Node 22, Fastify) | limite **1,0 CPU** e **256 MB** |
| `web` (nginx, gzip) | limite **0,5 CPU** e **64 MB** |
| Teto somado | **2,5 CPU** e **832 MB** de RAM |
| Segredos | 3 Swarm secrets (`ailow_postgres_password`, `ailow_auth_pepper`, `ailow_totp_chave`) |
| Backup | diário (timer systemd) cifrado para o Google Drive, alerta no healthchecks.io |

Os limites são **tetos** (`deploy.resources.limits`), sem reserva; variáveis `DB_CPUS`, `API_CPUS`, `WEB_CPUS`, `DB_MEM`, `API_MEM`, `WEB_MEM` no `ailow.env`.

## 2. Consumo medido
- **Em repouso (2026-11-12/13):** RAM `api` 44–48 MiB, `db` 53 MiB, `web` 6 MiB (≈ 110 MiB no total); CPU < 1 % por serviço; carga do host 0,3–0,9.
- **Sob 50 usuários simultâneos (k6, ~110 s, ~5 900 vendas + ~5 900 buscas, erro 0 %):** `api` ≈ 80–108 % e `db` ≈ 105–118 % de **1 CPU** cada (presos no teto de 1,0), `web` ≈ 10–18 %. Somados, **~2,2 CPU** reais. Carga do host (4 núcleos) chegou a **4,8–5,85**, dividida com os outros serviços do host.
- **Com teto de 1,5 CPU** (medição pontual): `api` ≤ ~104 % e `db` ≤ ~131 %. Ou seja, o consumo **não** subiu até o teto novo: mais CPU não destrava a busca.

## 3. Desempenho obtido (50 usuários, do PC do Pedro, RTT ≈ 61 ms até a VPS)
| Requisito | Meta | `v1.0.0` | `v1.0.1` (1,0 CPU) | `v1.0.1` (1,5 CPU) |
|---|---|---|---|---|
| RNF-01: finalizar venda p95 | ≤ 500 ms | 447 ✅ | 352 ✅ | 366 ✅ |
| RNF-02: buscar produto p95 | ≤ 300 ms | 474 ❌ | 427 ❌ | 529 ❌ |
| Erro | < 1 % | 0 % | 0 % | 0 % |

A venda passa com folga na configuração acima. A busca **não** passa, e o gargalo **não é CPU** nem o SQL (a consulta da busca ampla executa em 0,23 ms): nem o tamanho da resposta (a busca por 1 modelo é tão lenta quanto a ampla). Dentro da API a requisição passa ~250 ms esperando com o event loop folgado; a hipótese é fila no pool de 10 conexões do Postgres (`DB_POOL_MAX`), **ainda não medida**. Próximo passo: medir a espera do pool e testar `DB_POOL_MAX` maior só na `api`. Em ambiente local (S13b2, sem rede e sem host compartilhado) a busca dava 246–268 ms.

## 4. Mínimo recomendado para quem for reproduzir
Como ponto de partida **prático** (derivado do que rodou, não de um teste de mínimo):
- **2 vCPU dedicados e 2 GB de RAM** para o Ailow (3 serviços ≈ 110 MiB em repouso e ~2,2 CPU sob 50 usuários; 2 GB deixa folga para o Docker, o cache do Postgres e o backup).
- **Disco:** 10 GB de partida (imagens + banco + dumps locais); o banco de teste com 5 900 vendas e 864 SKUs é pequeno, mas o crescimento real **não foi medido**.
- **Rede:** HTTPS na 443 com certificado válido, DNS A para o domínio; RTT baixo ajuda o RNF-02 (≈ 61 ms de RTT já consome ~20 % da meta de 300 ms).
- **Sem host compartilhado**, se for medir RNF-02: a carga do host chegou a 5,85 em 4 núcleos com a Copel na mesma máquina, o que contamina a medição.

## 5. Não verificado
- O **mínimo real** de CPU/RAM para passar RNF-01/02 (nunca houve teste "subindo de baixo para cima"; a busca reprova em todas as configurações testadas).
- RAM **sob carga** (só em repouso) e crescimento do banco e dos dumps com dados reais.
- Comportamento com mais de 50 usuários simultâneos em produção (o estresse local está na ADR 009).
- Histórico de picos de CPU dos outros serviços do host: a VPS não tem `sar`/Prometheus; só há snapshots (serviços da Copel somando < 9 % de CPU em 2026-11-12/13). Monitoramento previsto na VPS nova (ADR 011).
- Renovação automática do certificado e restauração com dados reais (ver `deploy.md` e `backup.md`).
