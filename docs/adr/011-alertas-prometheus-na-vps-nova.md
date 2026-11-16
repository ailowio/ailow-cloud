# ADR 011 — Alertas de aplicação e banco: Prometheus + Alertmanager na VPS nova

- **Status:** decisão de ferramenta do Pedro em 2026-11-13 ("a ferramenta de alertas será Prometheus na VPS que irei comprar mais na frente"); **texto proposto, aguardando a confirmação dele**. **Decisor:** Pedro. **Tier:** B. **Regras:** OBS-*, OPS-05, AUD-40..44, AUD-60..69, SEC-*. **Lições:** L-0005.
- **Escopo do texto:** o repositório é público; sem IP, URLs de alerta nem credenciais.

## Contexto
- Hoje o Ailow Cloud roda numa VPS compartilhada (ADR 010), onde instalar Prometheus e Alertmanager consumiria RAM e CPU de outros serviços e criaria acessos novos. A API já expõe `GET /metrics` (RED por rota; só existe com `METRICS_TOKEN`) e há regras de alerta testadas com `promtool` em `ops/prometheus/alertas.yml` (S13b), mas **nenhum scraper existe em produção**.
- Hoje só o **backup** tem alerta externo (healthchecks.io, S14c). Queda do app, do banco, 5xx e lentidão **não** alertam ninguém.
- Medição em produção (2026-11-13, 50 usuários): `api` e `db` chegaram a ~100 % de 1 CPU cada e o host a carga 5,85 em 4 núcleos; RNF-02 reprovou (busca p95 474 ms, limite 300). Ou seja, é preciso enxergar saturação **antes** do cliente.

## Decisão
Quando o Ailow Cloud migrar para a VPS própria (`docs/runbooks/migrar-vps.md`), a stack de observabilidade sobe **junto, na mesma VPS**: Prometheus (scrape de `/metrics`, métricas do host e do Postgres) e Alertmanager com as regras de `ops/prometheus/alertas.yml`, estendidas para disponibilidade, saturação e banco. Os alertas de backup continuam no healthchecks.io (cobre "o timer nem rodou", que o Prometheus na mesma máquina não cobre).

## Alternativas consideradas
1. **Monitor externo de disponibilidade apenas** (healthchecks.io/UptimeRobot): barato, enxerga a VPS de fora, mas não vê p95, 5xx intermitente nem saturação.
2. **Prometheus + Alertmanager na própria VPS** (escolhida): enxerga o comportamento interno e o SLO; **cai junto com a VPS** (um alerta de "VPS fora" precisa vir de fora).
3. **Os dois** (recomendação do agente, contraponto à escolha 2 isolada): o monitor externo cobre "a VPS ou o Prometheus morreram"; o Prometheus cobre o resto. Custo: um check gratuito a mais.

## Consequências
- Requisito de dimensionamento da VPS nova: RAM e CPU para a stack do app **mais** Prometheus/Alertmanager/exporters (a medir; hoje api 44 MiB, db 53 MiB, web 6 MiB em repouso), e **CPU suficiente para o RNF-01/02** (ver o ensaio de carga).
- Acessos novos a registrar na matriz (token do `/metrics`, canal do Alertmanager) e interfaces novas no inventário (AUD-60..69).
- Exporter do Postgres, versões e retenção a **verificar na documentação oficial** antes de adotar (não inventar).
- O canal de notificação do Alertmanager (e-mail, push, WhatsApp) é decisão do Pedro, ainda aberta.
- Até a migração: o `/metrics` segue desligado em produção (sem `METRICS_TOKEN`) e os alertas de app/banco permanecem **sem ferramenta**; risco aceito pelo Pedro por ainda não haver clientes reais.
