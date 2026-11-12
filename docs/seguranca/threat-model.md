# Threat model (1 página): Ailow Cloud API + web — rev. 2026-11-12

*(Tier B. Revisar quando a arquitetura, a superfície de ataque ou os dados mudarem. Fontes: ADR 002, 004, 005, 007, 008; `docs/auditoria/`; código na `main`. O que não foi conferido está marcado "não verificado".)*

## 1. O que estamos construindo?
ERP mobile multi-tenant para lojas pequenas: o Dono e os Vendedores usam o celular no balcão (PWA React) e falam com uma API Fastify; o Postgres guarda tudo, isolado por empresa com RLS. Diagramas: `docs/arquitetura/c4.md`.

**Ativos:** dados pessoais de clientes finais (nome, celular; LGPD, ADR 007), dinheiro (vendas, lançamentos, compras), ponto dos funcionários (ADR 008), hashes de senha/PIN, `AUTH_PEPPER`, `METRICS_TOKEN`, segredo TOTP do Admin.
**Fronteiras de confiança:** navegador ↔ API (cookie de sessão) · API ↔ Postgres (papel `ailow_app` com RLS forçada) · plataforma (Admin, tabelas sem GRANT ao runtime) ↔ empresas · `/metrics` (Bearer) ↔ rede interna.

## 2. O que pode dar errado?
| # | Ameaça | Categoria | Prob. | Impacto |
|---|--------|-----------|-------|---------|
| 1 | Usuário da empresa B lê ou altera dado da empresa A (ID trocado, `WHERE` esquecido) | Controle de acesso quebrado | M | A |
| 2 | Adivinhar PIN de 4 dígitos | Autenticação | M | A |
| 3 | Força bruta da senha do Dono/Admin (sem limite de tentativas) | Autenticação | M | A |
| 4 | Roubo do cookie de sessão | Sequestro de sessão | B | A |
| 5 | Vazamento do banco (hashes, TOTP do Admin em texto) | Exposição de dados | B | A |
| 6 | Vendedor acessa custo, Financeiro, Compras ou ajuste de ponto | Escalada de privilégio | M | M |
| 7 | Logs ou métricas vazam PII/segredo | Exposição de dados | B | A |
| 8 | Dependência ou imagem com CVE | Componente vulnerável | A | M |
| 9 | Segredo vaza do repositório (público) ou do CI | Segredos | M | A |
| 10 | Duas vendas simultâneas da última peça / número de venda repetido | Integridade / concorrência | M | M |
| 11 | `/metrics` exposto à internet | Exposição de informação | M | B |
| 12 | Aparelho vinculado perdido (cookie de 365 dias) | Acesso físico | M | M |

## 3. O que vamos fazer a respeito?
| # | Mitigação (situação real) | Regra | Evidência |
|---|---------------------------|-------|-----------|
| 1 | RLS **forçada** em toda tabela de negócio, `withEmpresa()` como único acesso, `empresa_id` só da sessão, nunca do corpo | SEC-04 | `apps/api/test/autorizacao.test.ts` e testes de isolamento por módulo (2 empresas × 2 perfis) |
| 2 | Bloqueio em 5 erros, argon2id + pepper, só o Dono desbloqueia | SEC-07 | testes da S04 (ADR 004) |
| 3 | argon2id encarece cada tentativa + **rate limit por IP** em `/acesso/entrar` e `/admin/login` (10/min por padrão; 429 `muitas_tentativas` com `Retry-After`; `TRUST_PROXY` por IP/CIDR para ler o IP real atrás do proxy). Contador em memória: vale para 1 instância da API. **Limite:** só por IP, não por e-mail (por e-mail permitiria a um atacante travar o Dono de propósito) | SEC-07 | `apps/api/test/rate-limit.test.ts` (6 casos, 2 reprovados de propósito com a mutação); S14 |
| 4 | Cookie opaco `httpOnly`, `Secure`, `SameSite=Strict`; só o SHA-256 vai ao banco; expira por inatividade e em 12 h; revogável | SEC-07 | testes da S04 |
| 5 | Hashes com pepper fora do banco; **segredo TOTP do Admin cifrado em repouso** (AES-256-GCM, chave `TOTP_CHAVE` no ambiente, formato versionado `v1.`, texto em claro é recusado) | SEC-17 | `src/acesso/cifra-totp.test.ts` (7), `test/criar-admin.test.ts`, `test/admin.test.ts`; S14 |
| 6 | `exigirPerfil('dono')` como ponto único; custo nunca na resposta do Vendedor | SEC-04 | testes de autorização por perfil; `venda` sem `custo` (vendas.test.ts) |
| 7 | `authorization` e `cookie` redigidos no log; rótulos de métrica só com rota template | SEC-16 | `apps/api/test/metricas.test.ts` |
| 8 | SCA, scan de imagem e secret scan no CI | SEC-10 | jobs `seguranca-*` e `imagem` (nomes no CLAUDE.md; resultado do último run não verificado aqui) |
| 9 | `.env` fora do git, `.env.example` só com nomes; repositório público | ENV-*, SEC-05 | `git check-ignore`; secret scan do CI |
| 10 | `FOR UPDATE` nos SKUs em ordem fixa; número da venda por `venda_sequencia` na transação; `UNIQUE (empresa, numero)` | TEST-12 | testes de concorrência em `vendas.test.ts` (ADR 009) |
| 11 | Rota só existe com `METRICS_TOKEN`; proxy da S14 não deve expô-la fora da rede interna | SEC-04 | `metricas.test.ts`; **pendente S14** |
| 12 | O cookie do aparelho só lista nomes e deixa tentar PIN; o Dono derruba sessões e desativa usuários | SEC-07 | ADR 004. **ABERTO: revogar o aparelho em si** |

## 4. Como saberemos que fizemos um bom trabalho?
Testes que **falham** sem a mitigação (isolamento entre 2 empresas, 403 ao Vendedor, bloqueio no 5º PIN) · Schemathesis sem falhas (`scripts/contrato.sh`) · alertas de burn rate (`ops/prometheus/alertas.yml`) · trilha `eventos_acesso` só-acréscimo.

## Riscos aceitos / em aberto (com dono e data de revisão)
| Risco | Decisão | Dono | Revisar |
|-------|---------|------|---------|
| Rate limit só por IP e em memória (#3) | Fechado para o go-live com 1 instância (S14). Antes de rodar 2+ instâncias da API: store compartilhado (Redis) ou limite no proxy; o PIN já tem bloqueio por usuário (5 erros) | Pedro | ao escalar a API (ADR 010) |
| Chave `TOTP_CHAVE` perdida ou trocada sem recifrar (#5) | Perdida = Admins refazem o TOTP (`admin:criar`); a chave viaja junto com o `AUTH_PEPPER` na migração. Rotação ainda sem procedimento (formato `v1.` já permite) | Pedro | 3 meses após o go-live |
| Revogação do aparelho (#12) | Aberto, aceito no MVP | Pedro | 3 meses após o go-live |
| Sem `helmet`/cabeçalhos de segurança e sem CORS configurado na API | Não verificado se o proxy da S14 cobre; confirmar | Pedro | S14 |
| EX-01…EX-04 | Exceções do PRD §11 | Pedro | datas no PRD |
