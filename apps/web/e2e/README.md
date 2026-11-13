# E2E (Playwright, 360×640)

Rodar: `npm run e2e -w @ailow/web` com `dev:db`, `dev:api` e `dev:web` no ar, ou `bash scripts/e2e.sh` (stack efêmera, Docker). Um arquivo: `npm run e2e -w @ailow/web -- paginacao-360`.

## Limite de login (SEC-07) e a suíte inteira numa rodada
- A API limita as rotas de senha a 10 por minuto por IP; cada teste faz login, então a suíte passava disso e exigia pausas de 65 s.
- Escolha: subir a API de teste com `LOGIN_RATE_MAX=100000` (variável que já existe em `apps/api/src/config.ts`). Em `scripts/e2e.sh` isso já vem de `scripts/lib/ambiente-efemero.sh` (CI); em `npm run dev:api` (`apps/api/scripts/dev-api.ts`, que recusa produção) passou a ser o padrão, sobrescrevível (`LOGIN_RATE_MAX=10` restaura o limite real).
- Produção não muda: o padrão de 10/min vale sempre que a variável está vazia, e `apps/api/test/rate-limit.test.ts` continua provando o limite real.
- Alternativas descartadas: reutilizar sessão com `storageState`/fixture global (reduz logins, mas a maioria dos testes cria usuários e troca de perfil, então ainda dependeria do limite e esconderia o fluxo de login que alguns testes exercitam); elevar o limite por `NODE_ENV=test` (cria um caminho de código que afrouxa a segurança só por causa de uma variável de ambiente comum).
- Testes que procuram o produto que criaram usam `GET /produtos?q=<nome ou sufixo único>`: a lista sem filtro é truncada em 200 itens num banco cheio.
