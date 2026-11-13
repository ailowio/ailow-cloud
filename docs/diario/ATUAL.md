# Diário ativo (as 3 últimas entradas)

> Regras (skill `execucao-em-sessoes`): entrada nova ≤ 2 KB; ao passar de 3 entradas ou ~8 KB, mover as mais antigas, **sem editar**, para `ARQUIVO-*.md`. Detalhe técnico longo (mutações, medições) vai para a descrição do PR.
> Arquivo: `docs/diario/ARQUIVO-S00-S06.md` (S00 a S06b e Prep ambiente Windows) `ARQUIVO-S07-S09.md` e `ARQUIVO-S10-S12.md` (S10 em diante); ler só sob demanda.

Template:
```text
### SNN — <título> — <AAAA-MM-DD> — <LLM>
Feito: 3–6 linhas.
Números (antes -> depois): ...
Decisões: ...
Pendências para a próxima: ...
Verificação: 1–3 linhas + link do PR/CI.
```

### S14b — Deploy portável, local (sem VPS) — 2026-11-12 — Claude Sonnet 5.5
Gate: infra/CI/segurança, **tier B**; OPS-*, ENV-*, SEC-01/04/12, AUD-*, L-0001/0005/0006/0019. Branch `feature/s14b-deploy-portavel` (de `main` em db171df, PR #26 mergeado). **Nada tocou a VPS.** Retomada após queda do PC (sessão anterior parou no meio do reinício do Docker).
Feito: imagem do web (nginx sem root), `ops/stack/ailow.yaml` (Swarm, secrets, rede `internal`), Traefik de host novo, `backup.sh` + `restore-ensaio.sh` (rclone `crypt`), `scripts/stack-local.sh` + job `stack`, `publicar.yml` (GHCR em tag), Trivy no web, runbooks (backup novo; deploy/rollback em Swarm), inventários (rotinas novo; interfaces e acessos), ADR 010 atualizado, teste nginx = Vite.
Achados: Swarm ignora `tmpfs:` (usar volume `type: tmpfs`) e `security_opt` (removido); `diretorio_login` é exceção deliberada (ADR 004) que o ensaio de restore não conhecia; logo mora no banco; token do Drive em "Testing" expira em 7 dias (doc oficial).
Números: API 781 -> 783 (testes do nginx), web 250, shared 237. Restore local: 1–2 s, 26 tabelas, 14 migrações (banco de dev, **não é RTO**). Canários: nginx sem `pontos`, rede sem `internal`, GRANT indevido em `diretorio_login`, dump adulterado: todos reprovaram.
Decisões pendentes (Pedro): proteger `main` e checks obrigatórios (humano, EX-01); roteiro do vídeo e pacote do curso **não feitos**; DNS `cloud.ailow.com.br` ainda sem resposta (8.8.8.8, 2026-11-12).
Lições: L-0019 rec. 2 (espera por TCP), L-0005 rec. 2 (SHA de action de memória), L-0002 rec. 4 (`node -e` com escapes).
Verificação: `verify` exit 0; `check-harness` ok; `stack-local.sh` 2x ok.

### S14c — VPS, DNS e entrega — 2026-11-13 — Claude Sonnet 5.5
Gate: infra/deploy, **tier B**; OPS-*, ENV-*, SEC-*, AUD-24/90 (pilares 1–4), L-0003/0005/0006/0013/0019. Com o Pedro presente; diário privado fora do repo com cada comando na VPS.
Feito: DNS ok; 3 Swarm secrets; tag `v0.1.0` → `publicar.yml` verde (1ª vez); stack `ailow` no Swarm do host; Admin + empresa "Teste Smoke"; Drive cifrado, backup real, restore do Drive, timer diário com `OnFailure` + healthchecks.io; PR #28 (docs, inventários, runbooks); tag e release **`v1.0.0`** com digests; deploy da v1.0.0, rollback real por tag e volta.
Números: `/health` 200, `/metrics` 404 da internet, HSTS 1 ano, certificado LE até 2027-02-10; E2E 4/4 (venda 5 toques, limite 8) em v0.1.0 e v1.0.0; k6 1 VU p95 busca 209 ms (≤300), venda 170 ms (≤500), erro 0 %; deploy v1.0.0 86 s (8/61 ≠ 200); rollback por tag 73 s, volta 78 s; backup 16,5 s; restore do Drive 10,5 s (banco de teste, **não é RTO**); RAM: db 53, api 44, web 6 MiB.
Decisões: pacotes GHCR públicos (sem token novo); chave SSH de deploy **não** criada (sem pipeline de deploy); `rclone.conf` copiado do PC do Pedro (OAuth precisa de credencial "computador", L-0021).
RNF-01/02 em produção (k6 `carga`, 50 usuários, 2026-11-13): erro 0 %; **venda p95 447 ms (≤500) passou; busca p95 474 ms (≤300) REPROVOU** (api e db a ~100 % de 1 CPU; host a 5,85 de carga; local dava 246–268 ms). Critério não alterado. Dados de teste removidos (produção: 0 empresas, 1 Admin).
Pendências: **pipeline de deploy** (OPS-04/AUD-24; exceção EX-02 até 2026-11-20); decisão sobre RNF-02 (CPU, busca ou VPS nova); alertas de app/banco = Prometheus na VPS nova (ADR 011, requisito em `migrar-vps.md`); `down` de migração; renovação do certificado e do token do Drive; roteiro do vídeo e pacote do curso (Pedro, outro harness).
Verificação: PR #28 com 11/11 checks; smoke e E2E acima; `check-harness` ok (L-0021 registrada).

### S14e — RNF-02 em produção e fechamento da S14 — 2026-11-13 — Claude Opus 5.5 / Sonnet 5.5
Gate: infra/deploy, **tier B**; OPS-04/05, AUD-24/27/96, SEC-*; L-0003/0005/0006/0017/0021. Cada mudança na VPS no diário privado.
Feito: 3 rodadas k6 (50 usuários) em produção com a `v1.0.1`; medição pontual com 1,5 CPU (Pedro autorizou o teto de 2 CPUs do Ailow no host de 4) e volta a 1,0 (carga do host passou de 4); `EXPLAIN` da busca ampla; PR final de docs (EX-02 do deploy encerrada, runbooks, `dimensionamento-minimo.md` para o Moodle).
Números: busca p95 474 -> 427 (1,0 CPU) / 529 (1,5 CPU) ms, meta 300 ❌; venda 447 -> 352 / 366 ms ✅; CPU de pico ~1,3 com teto 1,5 = hipótese de CPU **refutada**; SQL da busca ampla 0,23 ms.
Decisões: Pedro escolheu **otimizar a busca ampla em sessão própria** (perfilar o handler HTTP, não o SQL; OpenAPI MINOR). Critério do RNF-02 intacto.
Falhas: 2 runs do `Deploy` falharam ao reimplantar a mesma tag (corrida de DNS do `db` + espera que nunca converge; exit 21 enganoso); o Swarm reverteu a `api` sozinho. Lição registrada; correção do `deploy.sh` com teste fica em PR própria.
Pendências: (1) **tenant de teste foi apagado** antes de o Pedro pedir para mantê-lo; recriar com `criar-tenant-teste.ps1` (corrigido) e repopular; **só apagar quando o Pedro terminar os aprimoramentos de UX/UI**; produção hoje 0 empresas, 1 Admin, 14 migrações; (2) corrigir `deploy.sh`; (3) otimizar a busca; (4) vídeo, pacote do curso e etiquetas (S08), com o Pedro.
Verificação: k6 `rodada1/2b` (exit 99, só o limiar da busca); `/health` 200; `check-harness` e checks da PR final: ver PR.
