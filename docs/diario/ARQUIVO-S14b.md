# Diário arquivado — S14b

### S14b — Deploy portável, local (sem VPS) — 2026-11-12 — Claude Sonnet 5.5
Gate: infra/CI/segurança, **tier B**; OPS-*, ENV-*, SEC-01/04/12, AUD-*, L-0001/0005/0006/0019. Branch `feature/s14b-deploy-portavel` (de `main` em db171df, PR #26 mergeado). **Nada tocou a VPS.** Retomada após queda do PC (sessão anterior parou no meio do reinício do Docker).
Feito: imagem do web (nginx sem root), `ops/stack/ailow.yaml` (Swarm, secrets, rede `internal`), Traefik de host novo, `backup.sh` + `restore-ensaio.sh` (rclone `crypt`), `scripts/stack-local.sh` + job `stack`, `publicar.yml` (GHCR em tag), Trivy no web, runbooks (backup novo; deploy/rollback em Swarm), inventários (rotinas novo; interfaces e acessos), ADR 010 atualizado, teste nginx = Vite.
Achados: Swarm ignora `tmpfs:` (usar volume `type: tmpfs`) e `security_opt` (removido); `diretorio_login` é exceção deliberada (ADR 004) que o ensaio de restore não conhecia; logo mora no banco; token do Drive em "Testing" expira em 7 dias (doc oficial).
Números: API 781 -> 783 (testes do nginx), web 250, shared 237. Restore local: 1–2 s, 26 tabelas, 14 migrações (banco de dev, **não é RTO**). Canários: nginx sem `pontos`, rede sem `internal`, GRANT indevido em `diretorio_login`, dump adulterado: todos reprovaram.
Decisões pendentes (Pedro): proteger `main` e checks obrigatórios (humano, EX-01); roteiro do vídeo e pacote do curso **não feitos**; DNS `cloud.ailow.com.br` ainda sem resposta (8.8.8.8, 2026-11-12).
Lições: L-0019 rec. 2 (espera por TCP), L-0005 rec. 2 (SHA de action de memória), L-0002 rec. 4 (`node -e` com escapes).
Verificação: `verify` exit 0; `check-harness` ok; `stack-local.sh` 2x ok.
