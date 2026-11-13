# ADR 011 — Roteador no front (react-router) para o Voltar do celular

- **Status:** proposto em 2026-11-13 (sessão S01). Aguarda decisão do Pedro.
- **Decisor:** Pedro. **Tier:** B (o app); a mudança foi escopada como A. **Regras:** UXM-01, UXM-02, UXM-03 (`harness/practices/ux-mobile.md`), ARQ-*, TEST-*.
- **Origem:** decisão de produto (UXM-03): o Voltar do Android nunca sai do app, retrocede um passo (modal → tela → módulo → início).

## Contexto

- O front não tinha roteador: `App.tsx` guardava a tela num `useState` e os módulos tinham estados internos (`passo`, `vista`). O histórico do navegador tinha **uma única entrada**, então o Voltar do sistema saía do app.
- O público tem pouca afinidade com tecnologia: sair do app sem querer, ou perder a venda em andamento, é falha grave.
- O app é PWA servido por nginx com `try_files … /index.html` (ops/web/nginx.conf), então rotas de caminho (`/vendas`) funcionam em produção; o service worker só guarda a página `/`.

## Decisão proposta

Adotar **react-router 8.5.1 em modo biblioteca** (`BrowserRouter`, `Routes`, `Route`, `useNavigate`), de forma incremental:

1. A tela atual vira rota: `/entrar`, `/definir-pin`, `/quem-usa`, `/pin` (sem sessão); `/` e `/<módulo>/*` (com sessão). O estado do `App` guarda só dados (usuário, lista de pessoas, alvo do PIN).
2. A permissão por módulo continua em `acesso/modulos.ts` (`modulosPara`): só os módulos do perfil viram rota; o resto cai em `/`.
3. Vendas usa sub-rotas (`/vendas`, `/vendas/fechar`, `/vendas/comprovante`, `/vendas/relatorio`); finalizar a venda **substitui** o fechamento no histórico (o Voltar não reabre venda fechada).
4. **Modal ligado ao histórico** (`componentes/navegacao.tsx`): abrir empurra uma entrada com `state.modal`; o Voltar fecha o modal e mantém a tela.
5. **Trava na raiz** (`TravaVoltar`): no 1º toque o app cria uma entrada de reserva; se o Voltar pousar na entrada 0, o app avança de novo. A reserva é criada depois de um gesto porque o Chrome ignora entradas criadas sem interação.
6. A seta da Moldura (substitui o botão "Início") chama o mesmo passo para trás (`useVoltar`).

## Alternativas consideradas

- **TanStack Router:** tipagem de rotas e parâmetros mais forte; contra: mais conceitos (árvore de rotas gerada/tipada), mais peso para um app com ~8 rotas, e a equipe não o conhece. Boa opção se as rotas crescerem em parâmetros.
- **`history` própria (`pushState` + `popstate` manuais):** zero dependência e controle total do trap; contra: reimplementar casamento de rotas, `replace`, estado por entrada e testes; é código que já existe pronto e testado. Risco de bugs sutis de histórico.
- **Manter `useState` e só simular o Voltar com `pushState`:** mudança mínima, mas a URL não reflete a tela (sem link direto, sem recarregar na mesma tela) e o estado fica em dois lugares. Descartada.

## Contrapontos e riscos

- **Dependência nova** (`react-router`, 8.5.1, peer `react >= 19.2.7`; o projeto usa 19.3.1). Verificado: `BrowserRouter` exportado de `react-router`.
- A trava depende de `history.state.idx`, detalhe do `BrowserRouter` do react-router (existe na 8.5.1; a atualização maior deve rodar o E2E de navegação).
- O Chrome pode pular entradas sem gesto do usuário: sem nenhum toque na tela, o 1º Voltar ainda pode sair. Não medido em aparelho Android real.
- Abrir um endereço interno direto (`/vendas`) deixa a seta sem passo anterior: ela usa um destino de reserva (`/`).
- Sub-telas internas de módulos (`vista`, `secao`: ex. "Novo produto", seções de Configurações) **ainda não são rotas**; o Voltar do sistema nelas volta ao início. Migrar módulo a módulo.
- O service worker guarda só `/`: abrir `/vendas` sem rede não carrega (antes só existia `/`). A decidir junto com a estratégia offline.

## Consequências

- URL reflete a tela; recarregar mantém a tela; link direto funciona.
- Evidência: `apps/web/e2e/navegacao.e2e.ts` (360×640): Voltar em Início → Vendas → Relatório, Voltar extra na raiz, modal fechado no Voltar, seta da Moldura, sem rolagem de página, `overscroll-behavior: none`.
