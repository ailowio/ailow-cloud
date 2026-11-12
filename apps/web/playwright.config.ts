import { defineConfig } from '@playwright/test';

// E2E em navegador real, no celular da loja (360×640, RNF-05). Não sobe nada sozinho: precisa do ambiente
// de desenvolvimento no ar (`npm run dev:db`, `dev:api`, `dev:web`) com a empresa de exemplo (`dev:seed`).
// Outro endereço: E2E_BASE_URL. Arquivos `*.e2e.ts` para o Vitest (`*.test.ts`) nunca os pegar.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 360, height: 640 },
    locale: 'pt-BR',
  },
});
