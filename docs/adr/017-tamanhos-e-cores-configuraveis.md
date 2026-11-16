# ADR 017 — Tamanhos e cores configuráveis por empresa

- **Status:** **aceito** em 2026-11-16 pelo Pedro ("pode fazer o ADR mais migração", item 6 da rodada de UX).
- **Decisor:** Pedro. **Tier:** B. **Regras:** ARQ-*, ADR 002 (RLS), AUD-10, TEST-*, UXM-10, L-0014/L-0020.

## Contexto

O assistente "Novo produto" (S10) oferecia tamanhos e cores de listas fixas no código do app (grades da pesquisa P1 e oito cores sugeridas). A engrenagem do assistente só configurava categorias. Cada loja usa grades e cores próprias; digitar a mesma cor nova a cada produto é retrabalho.

## Decisão

Tabela `opcoes_grade` por empresa (migração `20261119150000_opcoes-grade.sql`): `tipo` (`tamanho` | `cor`), `nome`, `amostra` (`#rrggbb`, só cor), `ativa`, `seq` (ordem de cadastro). RLS ligada e forçada, política `isolamento_empresa`, GRANT de SELECT/INSERT e UPDATE só em `nome`, `amostra`, `ativa`; **sem DELETE** (desativar tira da escolha; os SKUs guardam o texto e não mudam).

- Regras de texto **iguais às do SKU**: tamanho com 1 a 3 letras ou números (CHECK no banco e `tamanhoSchema`); cor pelo `corSchema`. Repetição: índice único sem diferenciar maiúsculas + conferência na API com a chave do SKU (`chaveCor`: sem acento nem espaço extra).
- **Semente na primeira leitura**, não na migração: `empresas` tem RLS forçada e não conferi com que papel as migrações rodam em produção (um `INSERT … SELECT FROM empresas` poderia semear zero linhas sem erro). A API grava os padrão (`TAMANHOS_PADRAO`, `CORES_PADRAO` em `packages/shared`) dentro do `withEmpresa`, só para o tipo que não tem nenhuma linha, com `ON CONFLICT DO NOTHING` (leituras simultâneas não duplicam; desativar tudo não faz a semente voltar).
- API (OpenAPI 0.15.0, só Dono): `GET /opcoes-grade`, `POST /opcoes-grade`, `PUT /opcoes-grade/{id}`. Prefixo incluído no proxy do Vite e no nginx.
- Web: a engrenagem ganha abas Categorias, Tamanhos e Cores e aparece também nos passos "Quais tamanhos?" e "Quais cores?"; fechar recarrega as opções sem perder o que já foi marcado. Os grupos de chips (Letras, Sutiã, Único, Outros) continuam como organização da tela.

## Alternativas descartadas

- **Manter listas fixas** (custo zero): cada loja continuaria digitando as próprias cores.
- **Semente na migração:** depende do papel que roda a migração enxergar `empresas` com RLS forçada; risco de semear nada em silêncio.
- **Colunas de "grupo" e "ordem" editáveis:** mais flexível, mas mais tela para pouca vantagem agora; os grupos ficam derivados das grades conhecidas e o resto vai para "Outros".
- **A lista crescer sozinha com o que é digitado no produto:** fica para depois (tocaria a transação do cadastro de produto).

## Consequências

- Evidência: `apps/api/test/opcoes-grade.test.ts` (20 testes: semente, regras, 409, 2 empresas × 2 perfis, sem DELETE; mutação na chave de cor reprova) e `apps/web/e2e/opcoes-grade.e2e.ts` (cria tamanho e cor, desativa cor, confere pela API).
- Down da migração descarta só a configuração; nenhum produto depende dela.
