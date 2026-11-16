import { lerAmbienteDev, recusarEmProducao, urlBanco } from './dev-ambiente.js';

// `npm run dev:api`: sobe a API apontando para o banco de `dev:db`.
// COOKIE_SECURE=false só aqui: em desenvolvimento o app roda em http://localhost (sem HTTPS).
// Em produção o padrão continua `true` (ver config.ts) e este script se recusa a rodar.
recusarEmProducao();
const ambiente = lerAmbienteDev();
process.env.DATABASE_URL ??= urlBanco(ambiente);
process.env.AUTH_PEPPER ??= ambiente.pepper;
process.env.TOTP_CHAVE ??= ambiente.totpChave;
process.env.COOKIE_SECURE ??= 'false';
// Só em dev (este script recusa produção): a suíte E2E loga a cada teste do mesmo IP e estoura os 10/min do SEC-07.
// Mesma variável e mesmo valor do ambiente efêmero (scripts/lib/ambiente-efemero.sh); LOGIN_RATE_MAX=10 restaura o padrão.
process.env.LOGIN_RATE_MAX ??= '100000';

// Import dinâmico: as variáveis acima precisam existir antes de a configuração ser lida.
await import('../src/main.js');
