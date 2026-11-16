# Runbook: backup e restauração (banco → Google Drive cifrado)

- **Serviço:** Ailow Cloud (Postgres da stack `ailow`) · **Dono:** Pedro · **Última revisão:** 2026-11-13 · **Ensaiado no Drive/VPS:** 2026-11-13 (backup real e restore-ensaio a partir do Drive, com banco de teste)
- Regras: ADR 010 item 7, SEC-01/04, ENV-12, OPS-*, AUD-43/44/90. Scripts: `ops/backup/backup.sh`, `ops/backup/restore-ensaio.sh`.

## 0. O que é verificado e o que não é
| Item | Estado | Evidência |
|---|---|---|
| `backup.sh` contra o Postgres de uma stack Swarm real (local, descartável) → remoto rclone `crypt` | **verificado local** (2026-11-12) | dump de 118 392 bytes, 26 tabelas com dados, nada sobra em disco local; no armazenamento cru, nomes e conteúdo ilegíveis (cabeçalho `RCLONE\0\0`) |
| Recusa de remoto que não seja `crypt` | **verificado local** | exit 3 com remoto `local` |
| `restore-ensaio.sh`: checksum, restore em Postgres limpo, RLS forçada e GRANTs | **verificado local** | 3 execuções seguidas: restore em 1–2 s, 26 tabelas, 14 migrações, 0 tabelas sem RLS/GRANT; canário (GRANT indevido a `diretorio_login`) reprovou com exit 5; dump adulterado reprovou no checksum (exit 3) |
| Envio ao **Google Drive** de verdade (crypt, escopo `drive.file`, app publicado) | **verificado na VPS** (2026-11-13) | backup real: 16,5 s (dump+envio), 124 405 bytes, 26 tabelas; gravar, ler e apagar pelo `crypt` OK; no Drive os nomes são texto aleatório. **Renovação do token, cota e expiração: não observadas** (precisa de dias de uso) |
| Restore **a partir do Drive**, na VPS | **verificado** (2026-11-13) | download+decifra 2,8 s, restore 1 s, total 10,5 s (inclui baixar a imagem do Postgres); checksum OK, 26 tabelas, 14 migrações, 0 sem RLS, 0 sem GRANT |
| Tempo de dump/restore **com dados reais** | **NÃO VERIFICADO** | o banco só tem dados de teste (≈124 KB): os segundos acima são o **piso do procedimento, não o RTO**. Medir de novo quando houver dados da loja |
| Agendamento (timer) | **verificado** (2026-11-13) | `ailow-backup.timer` ativo, próxima rodada 03:02 BRT; execução pelo systemd com sucesso (2º dump no Drive) |
| Alerta de falha | **verificado na VPS** (2026-11-13) | `OnFailure` + healthchecks.io testados (falha proposital e sucesso real); recebimento do e-mail pelo Pedro não conferido por mim (§3) |

## 1. Desenho
1. `pg_dump -Fc` do banco `ailow` pelo contêiner `ailow_db` → arquivo `0600` em `BACKUP_DIR`, apagado ao sair (sucesso ou erro).
2. O dump só é enviado se o `pg_restore -l` listar tabelas com dados (dump vazio/truncado não vira "backup").
3. Envio com `rclone copyto` para um remoto **`crypt`** (o script recusa qualquer outro tipo), em `diarios/`; aos domingos (UTC) também em `semanais/`. O tamanho no remoto é conferido.
4. Retenção só **depois** de confirmar o envio novo: `diarios/` 7 dias, `semanais/` 28 dias (proposta do plano: 7 diários + 4 semanais; o Pedro ajusta).
5. Conteúdo: tudo está no banco, inclusive a **logo da empresa** (`bytea`); não há arquivos enviados em disco. Fora do dump, por desenho: `AUTH_PEPPER`, `TOTP_CHAVE`, a senha do Postgres e a chave do `crypt` (ver §2.4).

## 2. Configurar o Drive (uma vez, pelo Pedro — acesso novo, ver `docs/auditoria/matriz-acessos.md`)
Fatos conferidos na documentação oficial em 2026-11-12 (rclone.org/drive e developers.google.com/identity/protocols/oauth2):
- Em projeto OAuth externo com status **"Testing"**, o refresh token **expira em 7 dias** ("any grants will expire after a week", rclone). Backup que para de funcionar na semana seguinte é o pior caso: **publique o app** (uso pessoal com menos de 100 usuários pode ficar sem verificação, segundo a rclone).
- O `client_id` compartilhado da rclone **vai parar de funcionar em 2026**: crie o seu próprio no Google Cloud.
- Escopo **`drive.file`**: a rclone só vê o que ela mesma criou. É o mínimo para backup (menor privilégio); o escopo `drive` dá acesso a todos os arquivos do Drive.
- O token também deixa de valer se ficar 6 meses sem uso (backup diário mantém em uso) e há limite de 100 tokens por conta e client.

Passos:
1. No Google Cloud: projeto, tela de consentimento (publicada), credencial OAuth "aplicativo para computador" → `client_id` e `client_secret` (guardar no gerenciador de senhas, fora do repositório).
2. No host de backup: `rclone config` → remoto `gdrive` (tipo `drive`, escopo `drive.file`, seu `client_id`).
3. `rclone config` → remoto `ailowcrypt` (tipo `crypt`, `remote = gdrive:ailow-cloud-backups`, `filename_encryption = standard`, duas senhas geradas por `rclone config`).
4. **Guardar a senha do `crypt` e o sal fora da VPS e fora do Drive** (gerenciador de senhas + cópia impressa/cofre). Perdeu = backup ilegível para sempre.
5. **Como foi feito na S14c (2026-11-12):** a VPS não tem navegador, então os passos 2 e 3 rodaram no PC do Pedro (`rclone config create gdrive drive ... scope=drive.file`, depois `rclone config create ailowcrypt crypt ... --obscure` com senhas aleatórias; o OAuth abre o navegador local) e o `rclone.conf` resultante foi enviado por `scp` para `/etc/ailow/rclone.conf` (dir `0700`, arquivo `0600`, root). **Atenção:** a credencial OAuth tem de ser do tipo "aplicativo para computador"; uma credencial "Web" dá `redirect_uri_mismatch` (a rclone recebe o retorno em `http://127.0.0.1:53682/`). A cópia do `rclone.conf` vai para o gerenciador de senhas.
6. O arquivo `rclone.conf` fica na VPS com permissão `0600`, dono do usuário que roda o backup. Ele contém o token do Drive e as senhas do crypt: é um **segredo**, nunca no repositório.

## 3. Agendar (VPS) — instalado em 2026-11-13
Arquivos versionados em `ops/backup/systemd/` (`ailow-backup.service`, `ailow-backup.timer`, `ailow-backup-alerta.service`) e `ops/backup/alerta.sh`. Instalação (como root): copiar as três unidades para `/etc/systemd/system/`, `alerta.sh` para `/opt/ailow/ops/backup/`, `systemctl daemon-reload` e `systemctl enable --now ailow-backup.timer`. Roda todo dia às **06:00 UTC (03:00 em Brasília)**, até 5 min de atraso aleatório, `Persistent=true` (se a VPS estava desligada, roda ao ligar). Conferir: `systemctl list-timers ailow-backup.timer` e `journalctl -u ailow-backup.service -n 50`.

**Alerta de falha:** o serviço tem `OnFailure=ailow-backup-alerta.service`, que sempre grava `crit` no journal e, **se existir `/etc/ailow/alerta.env`** (0600, fora do repositório) com `ALERTA_URL=`, faz POST da mensagem; com `ALERTA_PING_OK_URL=` faz um ping a cada sucesso (serviço tipo healthchecks.io avisa quando o ping **deixa** de chegar, o que cobre "o timer nem rodou"). Testado com falha proposital: `systemd-run --unit=ailow-teste-falha -p OnFailure=ailow-backup-alerta.service --wait /bin/false` grava o alerta no journal. **Canal configurado em 2026-11-13: healthchecks.io** (`/etc/ailow/alerta.env` com as duas variáveis apontando para o mesmo check; a URL é segredo e não está neste repositório). Testado na VPS: sucesso pelo systemd (ping chegou, resposta `OK`) e falha pela unidade `ailow-backup-alerta.service` (POST em `/fail`). **Não verificado por mim:** se o e-mail/push chegou ao Pedro e qual a tolerância de atraso configurada no check (sugestão: período de 1 dia e margem de 2 h). A conferência manual semanal (`rclone lsl ailowcrypt:backups/diarios`, com `RCLONE_CONFIG=/etc/ailow/rclone.conf`) continua como rede de segurança.

## 4. Restaurar
**Ensaio (obrigatório antes de depender do backup; repetir a cada trimestre):**
```bash
rclone copy ailowcrypt:backups/diarios /tmp/restaurar            # baixa e decifra
bash ops/backup/restore-ensaio.sh /tmp/restaurar/ailow-AAAAMMDD-HHMMSS.dump /tmp/restaurar/ailow-AAAAMMDD-HHMMSS.dump.sha256
```
Saída esperada: `OK: dump restaurado e consistente …` e a linha `restore_segundos=… tabelas=… sem_rls=0 sem_grant=0`. Anote data, tempo e resultado em `docs/auditoria/inventario-rotinas.md` (coluna "último teste de restauração"). O ensaio roda num Postgres descartável e **não toca a produção**. Apague `/tmp/restaurar` depois (dado pessoal, LGPD).

**Restauração real (banco perdido):** siga `migrar-vps.md §4` (banco novo, `pg_restore --no-owner`), lembrando: o `pg_dump` de um banco **não leva papéis**; crie `ailow_app NOLOGIN NOBYPASSRLS` antes do restore (o `restore-ensaio.sh` faz exatamente isso, e foi assim que o restore foi verificado). Depois: `ailow_app` sem acesso a `diretorio_login` (ADR 004) e RLS forçada nas demais.

## 5. Limites conhecidos
- RPO máximo = 24 h (backup diário); vendas do dia da falha podem se perder. Se isso for inaceitável para a loja, aumentar a frequência (custo: espaço no Drive).
- Conta pessoal do Drive tem cota compartilhada com os outros usos do Pedro: acompanhar o espaço.
- O Drive é um destino de conveniência (ADR 010): trocar por R2/B2 é mudar o remoto de baixo do `crypt`, sem mudar o script.
