# Adoção do harness no Ailow Cloud (tier B)

*Rev. 2026-11-12. Como as práticas de `D:\apps\harness` aparecem neste repositório, com o arquivo ou comando que prova cada uma, e o que ainda falta. O que não conferi está marcado.*

## O que o repositório faz
| Prática (regra) | Evidência |
|-----------------|-----------|
| Protocolo, gate e tier declarados (PROTOCOLO §1/§3) | `CLAUDE.md` (tier B, stack, comando `npm run verify`); `docs/plano-execucao.md` (Contrato de toda sessão, sessões S01…S14 com "pronto quando" e "não fazer") |
| `verify` único (CI-01) | `npm run verify` = build do shared + Biome + Spectral + tipos + testes + build (766 + 250 + 237 testes em 2026-11-12) |
| Test-first e teste que falha antes (TEST-06..08) | Diário em `docs/diario/`: cada sessão registra o vermelho; na S13b2 o teste de ordem das instruções falhou antes da mudança |
| Isolamento multi-tenant por RLS (SEC-04, ADR 002) | RLS forçada em toda tabela; `withEmpresa()` em `apps/api/src/db.ts`; testes com 2 empresas × 2 perfis |
| ADR para decisão estrutural (ARQ-08/09) | `docs/adr/001…009`; alternativas e contraponto em cada um; a escolha é do Pedro (ADR 009 teve portão) |
| Contrato de API verificado (DOC-03/05, TEST-20) | `docs/openapi.json` gerado; Spectral no `verify`; Schemathesis em `scripts/contrato.sh` e job `contrato` |
| Migração reversível (OPS-11) | `-- Up/-- Down` em todas; `apps/api/test/migracao.test.ts` sobe e desce tudo |
| Config só por ambiente, falha cedo (ENV-04/05) | `apps/api/src/config.ts` (Zod, cita o nome da variável); `.env.example` só com nomes; `.env` ignorado |
| Observabilidade e SLO (OBS-*) | logs JSON com `request_id`; `GET /metrics` (RED); alertas de burn rate com `promtool` (`scripts/alertas.sh`) |
| Carga com threshold que reprova (PERF-*, L-0006/L-0017) | `scripts/carga.sh`; os limites do RNF-01/02 nunca foram relaxados; ADR 009 mostra antes e depois |
| Segurança no pipeline (SEC-05/10/14) | jobs `seguranca-segredos`, `seguranca-sast`, `seguranca-sca`, `imagem` em `.github/workflows/ci.yml` (resultado do último run: não verificado) |
| Auditoria (AUD) | `docs/auditoria/matriz-acessos.md` e `inventario-interfaces.md`; `METRICS_TOKEN` registrado como acesso novo |
| Melhoria contínua (MC) | lições no registro do harness; as ativas entram em toda sessão (`licoes-ativas.md`) |
| Threat model e arquitetura (SEC-02, ARQ-12) | `docs/seguranca/threat-model.md`; `docs/arquitetura/c4.md` |
| IA comenta, humano aprova (IA-*) | commit, push e PR só com pedido explícito do Pedro; merge e aprovação são dele |

## O que ainda não está de acordo com o tier B
| Lacuna | Regra | Quando |
|--------|-------|--------|
| `main` protegida, checks obrigatórios, aprovação por pessoa ≠ autor (exceção EX-01) | CI-08, AUD-22 | S14 |
| Rate limit em login/PIN; segredo TOTP do Admin em texto | SEC-07/17 | antes do go-live (threat model) |
| Gate de cobertura não-regressiva: não encontrei configuração de `coverage` | TEST-14, CI-04 | a decidir (S14) |
| E2E dos fluxos críticos no CI (hoje só `venda-toques`, local) | TEST-13 | S13c (pendente) |
| Runbooks de deploy, rollback e migração de VPS | OPS-*, DOC-* | S14 (dependem da VPS) |
| Backup restaurado com evidência (EX-02) | AUD-43 | antes de dados reais |
