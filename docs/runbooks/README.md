# Runbooks — Ailow Cloud (S13c)

> Documentos para **revisão** (OPS-04/06/08, tier B). Ainda **não há VPS**: o que depende dela está marcado
> **[NÃO VERIFICADO — S14]**. Nenhum destes procedimentos foi executado em produção; os comandos que dependem só do
> repositório (compose, migração, imagem) estão marcados **[verificado no CI/local]** quando um job ou teste os exerce.
> "Plano de reversão que nunca foi executado é suposição": a S14 tem de **ensaiar** deploy e rollback e anotar os tempos
> aqui (campos `tempo medido: __`).

| Documento | Quando usar |
|---|---|
| [`deploy.md`](deploy.md) | Publicar uma versão (tag) na VPS |
| [`rollback.md`](rollback.md) | Voltar para a versão anterior (app e, se for o caso, banco) |
| [`migrar-vps.md`](migrar-vps.md) | Mudar o sistema para outra VPS (ou recriar a atual) |
| [`backup.md`](backup.md) | Backup cifrado para o Drive, retenção e ensaio de restauração (S14b) |

> **Atualização S14b (2026-11-12):** deploy e rollback agora descrevem a **stack do Swarm** (`ops/stack/ailow.yaml`),
> exercitada por `scripts/stack-local.sh` e pelo job `stack` do CI. O que continua **não verificado** é tudo que depende da
> VPS, do DNS, do certificado e do Drive real (S14c).

## Convenções comuns
- **Segredos** (`POSTGRES_PASSWORD`, `AUTH_PEPPER`, `METRICS_TOKEN`) ficam só no arquivo de ambiente **da VPS**, fora do repositório. Nunca em chat, PR, log ou linha de comando. Conferir só **nomes e tamanho**, nunca valores (SEC-01, L-0003).
- **Quem executa:** o Pedro (humano). O agente de IA não acessa a VPS nem produção (AUD-96); pode preparar comandos e revisar.
- **Evidência (AUD-90):** cada execução deixa registro no PR/release (versão, data, quem, resultado dos checks) e, se mudou acesso, rotina ou interface, atualiza `docs/auditoria/`.
- **Gatilho numérico de reversão (OPS-05):** voltar a versão se, em até 15 min após o deploy, houver `GET /health` ≠ 200 por 3 checagens seguidas, **ou** taxa de 5xx > 1 % nas rotas de venda, **ou** um fluxo crítico do smoke manual falhar. Valores iniciais, a confirmar na S14.
- **SLO de referência:** RNF-01/02 (venda p95 ≤ 500 ms, busca p95 ≤ 300 ms) — medidos na máquina local, **reconferir na VPS**.
