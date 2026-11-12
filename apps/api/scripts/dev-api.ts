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

// Import dinâmico: as variáveis acima precisam existir antes de a configuração ser lida.
await import('../src/main.js');
