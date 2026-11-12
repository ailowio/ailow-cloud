import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// A API roda em outra porta, mas o navegador só fala com a origem do app: o proxy deixa tudo na MESMA
// origem, o que faz o cookie de sessão (httpOnly, SameSite=Strict) funcionar sem CORS e sem token no JS.
// Em produção o proxy HTTPS faz o mesmo papel (S14). API_URL permite apontar para outra porta/host local.
// Depois do prefixo vale "/", "?" (query string: /categorias?tipo=...) ou o fim da URL; o Vite casa com a URL inteira.
const alvo = process.env.API_URL ?? 'http://127.0.0.1:3000';
const proxy = {
  '^/(acesso|usuarios|empresa|categorias|financeiro|produtos|skus|estoque|etiquetas|clientes|admin|health|openapi\\.json)(/|\\?|$)': { target: alvo, changeOrigin: false },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy },
  preview: { proxy },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
