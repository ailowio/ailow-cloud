## O quê e por quê
<!-- 1–3 frases. O PORQUÊ (o código já mostra o quê). Link: Closes #N -->

## Tipo · Tier · SemVer
- Tipo: feat / fix / refactor / perf / docs / test / chore / ci
- Tier do app: B
- Impacto de contrato (OpenAPI): nenhum / MINOR (compatível) / **MAJOR (quebra)**

## Como testar
<!-- Passos ou comando. Ex.: `npm run verify` + cenário manual … -->

## Casos cobertos (edge cases)
- [ ] caminho feliz  - [ ] erro  - [ ] nulo/vazio/zero/negativo  - [ ] limites ±1  - [ ] isolamento entre empresas (2 empresas)  - [ ] outro: …

## Risco e produção
- **O que pode quebrar em produção?**
- **Como saberemos que funciona?** (log/métrica/painel)
- **Rollback:** (flag off / revert / passo a passo)
- Flag: nome · dono · **data de remoção**
- Migração de banco compatível com a versão N e N+1 e com `Down Migration`? ☐ sim ☐ n/a

## Auditoria (AUD)
- Cria/altera/remove **acesso, rotina agendada ou integração**? ☐ não ☐ sim → inventário atualizado: …
- Evidência (PR, CI, aprovação, log): …

## Checklist do autor
- [ ] `npm run verify` verde localmente · [ ] testes novos (vermelho→verde) · [ ] cobertura não caiu
- [ ] sem segredo/PII/debug no diff · [ ] docs vivas atualizadas (README/.env.example/OpenAPI/ADR/runbook/CHANGELOG)
- [ ] mudança pequena e coesa (refator ≠ mudança funcional)
- [ ] consigo explicar cada linha (inclusive o que foi gerado por IA)
- [ ] exceções às regras do harness (se houver): regra · motivo · risco · data de revisão → …

## Para a revisão de IA (se usada — comenta, **não aprova**)
<!-- Quais riscos o revisor deve olhar? O que NÃO mudou? Resumo confere com o diff? -->
