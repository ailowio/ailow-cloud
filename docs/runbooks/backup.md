# Runbook: backup e restauração (banco → Google Drive cifrado)

- **Serviço:** Ailow Cloud (Postgres da stack `ailow`) · **Dono:** Pedro · **Última revisão:** 2026-11-12 · **Ensaiado no Drive/VPS:** nunca **[NÃO VERIFICADO — S14c]**
- Regras: ADR 010 item 7, SEC-01/04, ENV-12, OPS-*, AUD-43/44/90. Scripts: `ops/backup/backup.sh`, `ops/backup/restore-ensaio.sh`.

## 0. O que é verificado e o que não é
| Item | Estado | Evidência |
|---|---|---|
| `backup.sh` contra o Postgres de uma stack Swarm real (local, descartável) → remoto rclone `crypt` | **verificado local** (2026-11-12) | dump de 118 392 bytes, 26 tabelas com dados, nada sobra em disco local; no armazenamento cru, nomes e conteúdo ilegíveis (cabeçalho `RCLONE\0\0`) |
| Recusa de remoto que não seja `crypt` | **verificado local** | exit 3 com remoto `local` |
| `restore-ensaio.sh`: checksum, restore em Postgres limpo, RLS forçada e GRANTs | **verificado local** | 3 execuções seguidas: restore em 1–2 s, 26 tabelas, 14 migrações, 0 tabelas sem RLS/GRANT; canário (GRANT indevido a `diretorio_login`) reprovou com exit 5; dump adulterado reprovou no checksum (exit 3) |
| Envio ao **Google Drive** de verdade, token OAuth, cota, renovação | **NÃO VERIFICADO** | só testado com remoto `crypt` sobre disco local; o Drive entra na S14c |
| Tempo de dump/restore **com dados reais** e **na VPS** | **NÃO VERIFICADO** | os 1–2 s acima são de um banco quase vazio (dev), não são o RTO |
| Agendamento (timer/cron) e alerta de falha | **NÃO VERIFICADO** | ver §3 |

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
5. O arquivo `rclone.conf` fica na VPS com permissão `0600`, dono do usuário que roda o backup. Ele contém o token do Drive e as senhas do crypt: é um **segredo**, nunca no repositório.

## 3. Agendar (VPS) **[NÃO VERIFICADO — S14c]**
Sugestão: `systemd timer` diário às 03:00 chamando
`RCLONE_REMOTE=ailowcrypt:backups RCLONE_CONFIG=/etc/ailow/rclone.conf bash /opt/ailow/ops/backup/backup.sh`.
Falha = exit ≠ 0 e linha em stderr; o `systemd` registra no `journal`. **Alerta ativo** (e-mail/WhatsApp ao Pedro quando o timer falha) ainda não existe: sem ele, o primeiro sinal de backup quebrado é o dia em que se precisa dele. Definir na S14c; até lá, conferir `rclone ls ailowcrypt:backups/diarios` toda segunda-feira.

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
