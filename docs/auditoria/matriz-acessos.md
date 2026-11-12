# Matriz de acessos — Ailow Cloud   (AUD-01/03/06/09)

- **Dono do sistema:** Pedro · **Dono dos dados:** cada empresa cliente (a plataforma é operadora) · **Classificação dos dados:** pessoais (nome, e-mail, clientes finais S09+) e financeiros (S06+) · **Última atualização:** 2026-11-11 (S11)
- Estado: **construído na S04, ainda sem produção.** Inventários de rotinas e interfaces nascem na S14 (deploy). Itens "a decidir" dependem do Pedro.

## 1. Perfis (papéis) e o que cada um pode fazer
| Perfil | Descrição / função | Dados e telas acessíveis | Pode alterar? | Privilegiado? | Justificativa (menor privilégio) |
|---|---|---|---|---|---|
| `vendedor` | quem atende no balcão | só a própria sessão (`/acesso/eu`); **consulta de produtos** (`GET /produtos`, S07); **Clientes** ativos (`GET/POST /clientes`, `PUT`, aviso LGPD, S09/S09b); **Vendas** (`POST /vendas`, comprovante, cancelar a própria, relatório do próprio dia, `GET /skus/por-codigo`, S10); **Pessoas** (bater o próprio ponto e ver só o próprio espelho; pedir o de outro dá 403; **nunca** adicionar, editar ou excluir ponto, S12); **nunca** Financeiro, Compras, Configurações, custo, fornecedor, estoque mínimo, inativar/excluir cliente, relatório do mês nem cancelar venda de outro (RN-10) | não gere usuários | não | precisa vender, não administrar |
| `dono` | proprietário da empresa | todos os dados **da própria empresa**; gestão de usuários; Configurações; **Financeiro** (S06); **Produtos** (S07); **Clientes** (editar, inativar/reativar, excluir, lista de inativos — S09/S09b); **Vendas** (qualquer venda da empresa, relatório do dia e do mês, cancelar a de outro — S10); **Compras** (fornecedores, pedidos, enviar, receber atômico, relatório — S11); **Pessoas** (bater o próprio ponto; espelho de todos, por mês; **adicionar, editar e excluir ponto** de qualquer usuário da empresa, com motivo — S12, ADR 008) | sim, na própria empresa | sim (dentro da empresa) | decide quem usa o sistema |
| `admin` (plataforma) | operador da plataforma | criar empresa + Dono; redefinir senha do Dono. **Não** acessa dados de negócio por estas rotas | sim | **sim** | suporte do produto; exige senha + TOTP |
| `ailow_app` (papel de banco) | runtime da API para dados de negócio | tabelas de negócio via RLS (ADR 002); `eventos_acesso` só leitura/inserção; `lancamentos` só `SELECT`/`INSERT` + `UPDATE` das colunas da baixa, **sem `DELETE`** (RN-06, ADR 005); `clientes` com `SELECT`/`INSERT`/`UPDATE` (nome, celular, aviso, ativo) e **`DELETE`** (exclusão a pedido, ADR 007); `venda_sequencia`, `vendas`, `itens_venda`, `pagamentos_venda` com `SELECT`/`INSERT` e, em `vendas`, `UPDATE` só de status, motivo, autor, instante do cancelamento e `cliente_id` (o SET NULL da exclusão do cliente); `fornecedores`, `pedido_compra_sequencia`, `pedidos_compra`, `itens_pedido_compra`, `parcelas_pedido_compra` com `SELECT`/`INSERT` (e `UPDATE`/`DELETE` estreitos em fornecedor/pedido/itens — S11); `pontos` com `SELECT`/`INSERT` e `UPDATE` só de `registrado_em`, `ajustado`, `removido_em`, `removido_por` (exclusão lógica; nunca `tipo`, `usuario_id` nem `DELETE`) e `pontos_ajustes` só `SELECT`/`INSERT` (log imutável de quem ajustou, quando e por quê — S12, ADR 008); **sem `DELETE`** em pedidos/parcelas; **sem acesso** a `admins`, `admin_sessoes`, `diretorio_login` | conforme GRANT | não | ver ADR 002/004/005/007 |

Enforcement: `exigirSessao` + `exigirPerfil('dono')` (`apps/api/src/acesso/guardas.ts`; também nas rotas de Configurações, `apps/api/src/configuracoes/rotas.ts`, , do Financeiro, `apps/api/src/financeiro/rotas.ts`, e de Produtos, `apps/api/src/produtos/rotas.ts`, onde só a listagem é aberta ao Vendedor e o custo nem é selecionado para ele), RLS por `empresa_id`; provado em `apps/api/test/produtos.test.ts` e `rls-produtos.test.ts` (2 empresas × 2 perfis, custo ausente para o Vendedor, movimentos imutáveis, criar e ajustar auditados em `eventos_acesso`), `apps/api/test/autorizacao.test.ts` (2 empresas × 2 perfis), `rls-acesso.test.ts`, `configuracoes.test.ts`, `rls-financeiro.test.ts` e `financeiro.test.ts` (Vendedor 403 sem efeito colateral, outra empresa isolada, criar/baixar/estornar auditados em `eventos_acesso`, lançamento imutável no banco). Credenciais do ambiente de desenvolvimento (`npm run dev:seed`) valem só no banco local de dev (`.dev-data/`, ignorado pelo git) e não são acessos reais.

## 2. Quem tem qual perfil
| Pessoa | Função | Perfil(is) | Concedido em | Solicitado por | Aprovado por (dono) | MFA? | Próxima revisão |
|---|---|---|---|---|---|---|---|
| (nenhuma conta real criada nesta sessão) | — | — | — | — | — | Admin: TOTP obrigatório por construção | definir na S14 |

Joiner/leaver (AUD-04): o Dono cria o Vendedor (`usuario_criado`), desativa o desligado (`usuario_desativado`, derruba as sessões) — ambos na trilha `eventos_acesso`. Prazo de remoção: imediato, executado pelo Dono. **Revisão periódica de acessos (AUD-05): a definir (sugestão: trimestral, relatório de `GET /usuarios`).**

## 3. Contas privilegiadas e de serviço (AUD-06/09)
| Conta / credencial | Tipo | Dono | Escopo | Criada em | Rotação (prazo/última) | Onde é guardada |
|---|---|---|---|---|---|---|
| Conta Admin da plataforma | admin (senha argon2id + TOTP) | Pedro | rotas `/admin/*` | sob demanda, via `npm run admin:criar` (CLI, fora da API) | a definir na S14 | senha: gerenciador de senhas do Pedro; TOTP: app autenticador; hash e segredo TOTP no Postgres |
| `AUTH_PEPPER` | segredo de aplicação | Pedro | hashes de senha/PIN | S04 | trocar invalida todas as senhas e PINs (exige redefinição geral) — **procedimento a escrever (S13/S14)** | arquivo de ambiente local gitignored; na VPS, a definir (S14) |
| Conexão da API ao Postgres | usuário dono do schema (superusuário na imagem) | Pedro | todo o banco | S03 | — | `DATABASE_URL` no ambiente. **Risco aceito até a S14** (ADR 002): criar papel de login dedicado |
| `TOTP_CHAVE` | segredo de aplicação (AES-256 que cifra o segredo TOTP do Admin) | Pedro | decifrar o TOTP dos Admins; sozinha não dá acesso a nada sem o banco | S14 (obrigatória) | a definir: perdida = Admins refazem o TOTP; formato `v1.` permite rotação | arquivo de ambiente local gitignored; na VPS, no arquivo de ambiente (S14). **Nunca no banco nem no Drive de backup** |
| `METRICS_TOKEN` | segredo de aplicação (Bearer de `GET /metrics`) | Pedro | ler métricas RED (sem PII); nenhuma escrita | S13b (opcional: ausente = rota 404) | a definir na S14 (trocar a variável e reiniciar a API) | arquivo de ambiente local gitignored; na VPS, a definir (S14) |
| Cookies `sessao`, `aparelho`, `admin_sessao` | credenciais de usuário final | o titular | uma pessoa/aparelho | por login | sessão: 12 h absolutas + inatividade; aparelho: 365 dias; Admin: 15 min de inatividade / 8 h | navegador (httpOnly); servidor guarda só o SHA-256 |

## 4. Regras
- Conta nominal; sem compartilhamento: Dono e Admin têm e-mail próprio; Vendedor tem nome e PIN próprios.
- Concessão de acesso privilegiado (Admin) só com pedido explícito do Pedro; o agente de IA não cria contas.
- Acesso de emergência ao banco: fora do escopo da S04 (a definir na S14).
- Lacunas conhecidas (ADR 004): sem revogação de aparelho. Fechadas na S14: limite de tentativas de senha (por IP) e cifra do segredo TOTP em repouso.
