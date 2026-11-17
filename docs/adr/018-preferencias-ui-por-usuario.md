# ADR 018 — Preferências de UI por usuário (ordem dos módulos)

- **Status:** **aceito** em 2026-11-16 (plano UX Ailow Cloud, item 5).
- **Decisor:** Pedro. **Tier:** B. **Regras:** ARQ-08/09, ADR 002 (RLS), AUD-20/90, TEST-*, RF-VEN-01, RN-10.

## Contexto

A grade da tela inicial (`modulos.ts`) tinha ordem fixa (Vendas primeiro). O vendedor/dono precisa reorganizar os módulos e manter a ordem entre aparelhos da mesma conta.

## Decisão

Tabela `preferencias_ui` por empresa + usuário:

- `chave` text (primeira chave: `modulos_ordem`)
- `valor` jsonb (array de ids de módulo)
- `UNIQUE (empresa_id, usuario_id, chave)`
- RLS `ENABLE` + `FORCE` + `isolamento_empresa` + GRANT SELECT/INSERT/UPDATE (sem DELETE: sobrescreve via UPSERT)
- Acesso só via `withEmpresa()`; `usuario_id` vem da sessão, nunca do corpo

API: `GET /preferencias-ui`, `PUT /preferencias-ui` (Zod em `@ailow/shared`). Prefixo no proxy Vite e nginx.

Web: `@dnd-kit` na home; merge da preferência com `modulosPara(perfil)` (ignora ids inválidos/outro perfil; módulos novos no fim). Sem preferência → ordem de `TODOS` (Vendas primeiro, RF-VEN-01).

## Alternativas descartadas

- **Só `localStorage`:** não sincroniza entre aparelhos; frágil em PWA.
- **Coluna em `usuarios`:** mistura identidade com UI; menos extensível para novas chaves.
- **Ordem só no tenant (empresa):** o pedido é por perfil/usuário.

## Consequências

- Evidência: migração + testes de isolamento 2 empresas; unit `ordenarModulos`; OpenAPI/proxy atualizados.
- Down descarta só preferências; módulos voltam à ordem padrão do código.
