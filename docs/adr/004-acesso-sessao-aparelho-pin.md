# ADR 004: Acesso — sessão no servidor, aparelho vinculado, PIN e TOTP do Admin

- **Status:** aceito em 2026-11-12 pelo Pedro (código na main desde a S04 / PR #5; a numeração 003 segue reservada para a S08)
- **Data:** 2026-11-11 (aceite: 2026-11-12)
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** SEC-04, SEC-07, SEC-16, SEC-17, AUD-02/03/04/06/10/11, TEST-17

## Contexto

O produto é usado no celular, no balcão da loja (RF-ACE-02…08): o Dono entra com e-mail e senha uma vez; depois cada pessoa abre a própria sessão com PIN de 4 dígitos no aparelho vinculado da empresa. Um PIN de 4 dígitos tem só 10.000 combinações, então o desenho precisa limitar tentativas e proteger o hash contra vazamento do banco. O Admin da plataforma cria empresas e redefine senhas: é a conta mais poderosa e exige 2º fator (RF-ACE-07).

## Decisão

- **Sessão no servidor** (tabela `sessoes`), identificada por cookie opaco (256 bits aleatórios, só o SHA-256 vai ao banco), `httpOnly`, `Secure` (configurável só para dev), `SameSite=Strict`, cookie de sessão (sem validade própria). Expira por **inatividade configurável por empresa** (`empresas.inatividade_minutos`, padrão 5) e por **validade absoluta de 12 h**; pode ser revogada a qualquer momento (sair, derrubar, desativar, redefinir senha).
- **Aparelho vinculado** (tabela `aparelhos`): cookie `aparelho` de 365 dias criado no login do Dono. Só ele autoriza listar "Quem está usando?" e digitar PIN. Um aparelho tem **uma sessão ativa por vez**: abrir sessão de outra pessoa encerra a anterior.
- **Empresa só vem do banco.** O cookie leva `<empresa_id>.<segredo>`; o prefixo apenas diz onde procurar (a RLS exige a empresa). Quem vale é o segredo; prefixo errado ⇒ nenhuma linha ⇒ 401. Corpo, query e cabeçalhos com `empresa_id` são ignorados. Toda rota de negócio usa `withEmpresa()` (ADR 002).
- **Hashes:** argon2id (`argon2` 0.45.2) com 19 MiB, 2 passes, 1 thread (mínimo recomendado pelo OWASP Password Storage Cheat Sheet, conferido nesta sessão) **mais um pepper** (`AUTH_PEPPER`, ≥ 32 caracteres, fora do banco) no parâmetro `secret`. O pepper existe por causa do PIN: sem ele, quem vazasse só o banco quebraria um PIN offline em segundos.
- **PIN:** 5 erros seguidos bloqueiam o usuário (RN-09); só o Dono desbloqueia. A linha do usuário fica travada (`FOR UPDATE`) durante a conferência, então tentativas simultâneas não passam do limite. Entrar com a senha libera um **Dono** bloqueado por PIN (a senha é fator mais forte).
- **Login por e-mail antes de saber a empresa:** tabela de plataforma `diretorio_login` (e-mail único → empresa, usuário), lida só pelo dono do schema via `buscar_login()`; gravada na criação do usuário por `registrar_login()` (`SECURITY DEFINER`, só aceita a empresa da própria transação). Sem `GRANT` ao papel de runtime.
- **Admin da plataforma:** tabelas `admins`/`admin_sessoes` sem `GRANT` ao `ailow_app`; login com senha + TOTP (RFC 6238, `otpauth` 9.6.0), anti-replay atômico (cada passo vale uma vez), sessão de 15 min de inatividade / 8 h. A conta é criada por CLI (`admin:criar`, senha por variável de ambiente), já com TOTP.
- **Perfis:** `exigirPerfil('dono')` é o ponto único que barra o Vendedor; Financeiro, Compras, Configurações e custo reutilizarão.
- **Trilha de auditoria** `eventos_acesso` (só-acréscimo: o papel de runtime não tem UPDATE/DELETE): login, falha, PIN, bloqueio, desbloqueio, sessões derrubadas, PIN/senha alterados, usuário criado/desativado, empresa criada. Sem senha, PIN nem IP.

## Alternativas consideradas

1. **JWT sem estado** — descartada: não dá para derrubar sessão de funcionário desligado (RF-ACE-08) nem expirar por inatividade sem estado no servidor.
2. **Supabase Auth / serviço de identidade externo** — descartada em ADR 001 (stack); o PIN por aparelho também não é um fluxo padrão desses serviços.
3. **PIN sem pepper** — descartada pelo motivo acima.
4. **Bloqueio de PIN por aparelho em vez de por usuário** — descartada: quem tem o aparelho em mãos tentaria 5 PINs por aparelho; bloquear o usuário é o que a RN-09 pede. Custo aceito: quem tem o aparelho pode bloquear colegas (negação de serviço local); o Dono desbloqueia.
5. **Tabela de login com leitura aberta ao papel de runtime** — descartada: vazaria o mapa e-mail → empresa entre empresas.

## Consequências

- **Positivas:** revogação imediata; hash de PIN inútil sem o pepper; isolamento provado com 2 empresas × 2 perfis (`autorizacao.test.ts`); trilha para auditoria.
- **Custos:** uma transação por requisição autenticada (validação + renovação da sessão); argon2 consome 19 MiB por hash (container com 256 MB comporta poucos hashes simultâneos — medir no k6, S13).
- **Ameaças consideradas (insumo do threat model da S13):**

| Ameaça | Controle | Lacuna |
|---|---|---|
| Adivinhar PIN | bloqueio em 5 + argon2id + pepper | — |
| Roubo de cookie de sessão | httpOnly, Secure, SameSite=Strict, expiração e revogação | sem vínculo do cookie a IP/dispositivo |
| CSRF | SameSite=Strict + corpo só JSON (form recebe 415) | sem token CSRF dedicado |
| Força bruta de senha do Dono/Admin | argon2id (custo por tentativa) | **sem limite de tentativas nem rate limit** → S13 |
| Enumeração de e-mail | mesma resposta e mesmo custo de hash para e-mail inexistente | tempo de rede/DB ainda pode diferir |
| Vazamento do banco | hashes com pepper; token só como SHA-256 | segredo TOTP do Admin **em texto** na coluna (inacessível ao papel de runtime) → cifrar com chave de ambiente antes do deploy |
| Aparelho perdido | Dono derruba sessões e desativa usuários | **não há revogação do aparelho em si**; o cookie do aparelho só deixa ver nomes e tentar PIN |
| Injeção de SQL / `RESET ROLE` | SQL parametrizado, SAST | API ainda conecta como dono do schema (ADR 002) → S14 |

- **Como saberemos que deu certo:** suíte da S04 verde no CI; mutações dos controles reprovadas (registradas no Diário); ver `docs/auditoria/matriz-acessos.md`.
- **Revisão em:** S13 (rate limit, cifra do TOTP, revogação de aparelho) e S14 (papel de login dedicado).
