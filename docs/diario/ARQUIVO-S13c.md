# Arquivo do diário — S13c

> Entrada movida intacta de ATUAL.md na S14c (poda).

### S13c — E2E no CI e runbooks — 2026-11-12 — Claude Sonnet 5.5
Gate: teste/CI + docs de entrega, **tier B**; TEST-*, CI-*, OPS-04/05/06/08/11, SEC-01/04, AUD-90, L-0006/0012/0017. Branch `feature/s13c-e2e-ci-runbooks` (de `main` em 408b956, PR #24 mergeado), **sem commit** (aguarda pedido).
Feito: `scripts/e2e.sh` (stack efêmera comum: Postgres em contêiner, migrações, empresa descartável, API e web construídos, `vite preview` com proxy; segredos gerados a cada execução) + job `e2e` no `ci.yml`. 4 fluxos em Chromium 360×640: nova venda (≤ 8 toques), receber compra, ponto, cancelar venda; cada um confere o efeito pela API (saldo, conta a pagar do pedido, estado do ponto). `apoio.ts` cria categoria/produto/cliente por teste (nomes únicos, L-0008). `docs/runbooks/` (deploy, rollback, migrar VPS): escritos, **nada ensaiado**; o que depende da VPS está marcado NÃO VERIFICADO.
Números: E2E no CI 0 -> 4 fluxos; local `E2E_CANARIO=1 bash scripts/e2e.sh`: 4/4 verdes (venda: 5 toques) em 2 execuções.
Decisões: `E2E_LIMITE_TOQUES` só pode apertar (`Math.min(8, …)`); o canário refaz a venda com limite 1 e exige falha (L-0006/L-0017). Job `e2e` ainda **não** obrigatório (S14).
Pendências: CI verde do job `e2e` no PR (nunca rodou no GitHub; `playwright install --with-deps chromium-headless-shell` não testado lá) e então marcar ✅ o item 2 do checklist §10; gatilho numérico de reversão e tempos dos runbooks (S14).
Verificação: `verify` exit 0 (API 766, web 250, shared 237); `check-harness` ok; ci.yml parseia (10 jobs).

