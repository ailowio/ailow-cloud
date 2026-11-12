# Inventário de rotinas computacionais — Ailow Cloud   (AUD-40..44)

> Rotina = tudo que roda sem alguém apertar o botão. **Estado: desenhadas na S14b; nenhuma está agendada em produção ainda (a VPS entra na S14c).**

| ID | Rotina | Finalidade | Dono | Onde roda (ferramenta) | Agenda | Entradas → Saídas | Criticidade | Quem pode alterar/agendar | Como sei que rodou (log) | Alerta em falha? | Reprocessável? | Runbook |
|----|--------|-----------|------|------------------------|--------|-------------------|-------------|---------------------------|--------------------------|------------------|----------------|---------|
| R-01 | Backup diário do banco | recuperação (RPO ≤ 24 h) | Pedro | VPS, `ops/backup/backup.sh` por `systemd timer` **[a criar, S14c]** | 03:00 diário | Postgres `ailow` → dump cifrado (rclone `crypt`) no Google Drive | Alta | Pedro (acesso SSH da VPS) | linha JSON `evento":"backup"` no `journal`; arquivo novo em `diarios/` | **não** (a definir na S14c; até lá, conferência manual semanal) | sim (rodar de novo; nome tem data e hora) | [`backup.md`](../runbooks/backup.md) |
| R-02 | Retenção do backup | não acumular dado pessoal sem prazo (LGPD) | Pedro | mesmo script, no fim do backup | junto com R-01 | apaga `diarios/` > 7 dias e `semanais/` > 28 dias | Média | Pedro | mesmo log | idem R-01 | sim (idempotente) | [`backup.md`](../runbooks/backup.md) |
| R-03 | Renovação do certificado HTTPS | HTTPS válido | Pedro | Traefik (ACME HTTP-01), automático | ~60 dias após emissão | Let's Encrypt → `acme.json` | Alta | Pedro (config do Traefik do host) | log JSON do Traefik **[não verificado: depende da VPS]** | **não** (a definir) | sim | `deploy.md` |
| R-04 | Publicação de imagens | entregar a versão por tag | Pedro | GitHub Actions, `.github/workflows/publicar.yml` | **só em tag `vX.Y.Z`** (criada por humano) | commit da tag → imagens `api` e `web` no GHCR | Alta | quem pode criar tag no repositório (Pedro) | run do workflow + digest no resumo | sim (o próprio GitHub notifica run falho) | sim (re-rodar o workflow) | `deploy.md` |

## Backups e continuidade (AUD-43/44)
| Sistema | Escopo | Frequência | Retenção | Cifrado? | Local (separado?) | **Último teste de restauração (data + evidência)** | RPO | RTO |
|---------|--------|-----------|----------|----------|-------------------|-----------------------------------------------------|-----|-----|
| Ailow Cloud | banco `ailow` inteiro (inclui logo da empresa; **não** inclui `AUTH_PEPPER`, `TOTP_CHAVE`, senhas) | diário | 7 diários + 4 semanais | **sim**, antes de sair (rclone `crypt`; chave fora da VPS e do Drive) | Google Drive do Pedro (fora da VPS) | **2026-11-12, local, banco de dev quase vazio:** 3 restaurações seguidas OK (1–2 s, 26 tabelas, 14 migrações, RLS e GRANT conferidos), canário reprovou como devia. **Ainda NÃO feito a partir do Drive real nem na VPS (S14c)** | 24 h | **não medido** com dados reais |

## Revisão
- Revisado por: Pedro · em: **pendente (primeira revisão na S14c)**.
- Rotinas sem alerta: R-01, R-02, R-03 ⇒ issue com prazo na S14c (alerta de falha do timer).
