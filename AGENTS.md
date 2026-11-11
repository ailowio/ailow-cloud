# AGENTS.md

As instruções para agentes de IA deste repositório estão em [`CLAUDE.md`](CLAUDE.md) (fonte única, para não divergir). Leia-o inteiro antes de qualquer alteração.

Resumo mínimo: o app herda o harness (`D:\apps\harness\PROTOCOLO.md`); tier B; `npm run verify` na raiz deve estar verde; test-first; toda tabela de negócio tem `empresa_id` + RLS e é acessada via `withEmpresa()`; nada de segredo no repositório; commit/push/deploy só com pedido explícito; IA comenta em PR, humano aprova.
