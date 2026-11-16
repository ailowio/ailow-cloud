# Roteiro do vídeo de apresentação — Ailow Cloud (Projeto Final)

> Rascunho para o Pedro gravar (ele narra; este roteiro sugere a ordem, as telas e o texto falado). **Duração alvo: 10 min** (faixa aceitável 8–12). Cada capítulo tem o tempo, o que mostrar na tela e uma fala curta: falar com as próprias palavras, o texto é apoio.
> **Não gravar sem conferir a lista "O que NÃO mostrar"** (fim do arquivo). Gravar no tenant de demonstração, nunca com dados reais de cliente.

## Antes de gravar (checklist rápido)

- [ ] Celular (ou Chrome em 360×640, modo dispositivo) logado no **tenant de demonstração** em `https://cloud.ailow.com.br`; nada de dados reais de cliente.
- [ ] Abas do navegador prontas: repositório no GitHub, `docs/arquitetura/c4.md`, um run verde do Actions, um PR (ex.: #35), `docs/openapi.json` num visualizador (ou `/openapi.json`), `docs/runbooks/deploy.md`.
- [ ] Notificações do sistema desligadas; terminal sem histórico com segredos; gerenciador de senhas fechado.
- [ ] Uma peça e um cliente de teste já cadastrados (para a venda sair em segundos).

## Capítulos

| # | Tempo | Capítulo | Tela | Fala (apoio) |
|---|-------|----------|------|--------------|
| 1 | 0:00–0:45 | **Problema e cliente** | README (topo) | "O Ailow Cloud é um ERP para o celular de uma loja de moda íntima. Quem usa tem pouca afinidade com tecnologia: vender precisa ser rápido no balcão, e o dono precisa ver caixa, estoque e ponto sem planilha." |
| 2 | 0:45–2:15 | **Arquitetura** | `docs/arquitetura/c4.md` (contexto → contêineres → mapa de contextos) | "É um monólito modular: um back-end Fastify com módulos de acesso, produtos, vendas, compras, financeiro, clientes e pessoas, cada um com fronteira e interface pública. Multi-empresa com isolamento no próprio Postgres por RLS. O front é um PWA React pensado para 360 pixels." Citar o ADR 002 (RLS) e o 005 (financeiro como interface pública). |
| 3 | 2:15–5:00 | **Demo no celular** | App em 360×640 | (a) **PIN**: "Quem está usando?" → PIN. (b) **Venda em até 8 toques**: buscar/escanear a peça → Fechar → Pix → Finalizar → comprovante. "O E2E mede os toques; o limite é 8, a venda sai em 5." (c) **Produtos**: novo produto em passos, engrenagem com tamanhos e cores da loja. (d) **Financeiro**: nova receita, contas a receber/pagar, relatório. (e) Voltar do Android recua um passo e nunca sai do app. |
| 4 | 5:00–7:00 | **Qualidade** | GitHub Actions (run verde) → `.github/workflows/ci.yml` → um PR | "Todo PR roda: lint, tipos, testes de unidade e integração com Postgres real, contrato da API com Schemathesis sobre o OpenAPI, smoke de carga com k6, E2E no navegador em 360 por 640, varredura de segredos, SAST, dependências e imagem. A `main` é protegida: só entra por PR com checks verdes." Mostrar o canário: "o E2E da venda roda de novo com limite de 1 toque e TEM de reprovar, para provar que o teste mede de verdade." |
| 5 | 7:00–8:30 | **Deploy e operação** | `docs/runbooks/deploy.md`, `ops/stack/ailow.yaml`, workflow `Deploy` | "Deploy só por pipeline, com aprovação manual: a tag vira imagem no GHCR, o servidor recebe um comando forçado por SSH e o script faz backup antes, espera três health checks e reverte sozinho se falhar. Backup diário cifrado com restauração ensaiada." Citar ADR 010 (VPS portável) e 012 (pipeline). |
| 6 | 8:30–9:30 | **Decisões (ADRs)** | `docs/adr/` | "Cada decisão estrutural tem ADR com alternativas descartadas: numeração da venda sob carga (009), roteador para o Voltar (013), receita manual (015), paginação por cursor e índice de trigramas (016), tamanhos e cores configuráveis (017)." |
| 7 | 9:30–10:00 | **O que ficou de fora e uso de IA** | `docs/prd-checklist-10.md` | "Fica de fora: emissão fiscal e recebíveis de cartão. Em aberto, com número: a busca na VPS ainda passa do p95 de 300 ms em parte das rodadas. Usei IA como par de programação dentro de um protocolo: teste antes do código, PR revisado por mim e decisões registradas em ADR. Eu respondo por cada linha." |

## O que NÃO mostrar

- Arquivos `.env` (qualquer um), `.dev-data/`, o painel de secrets do GitHub, Environment `producao`, chaves SSH, saída de `docker secret`, tokens.
- A pasta `acervo/` (material do cliente, só local) e qualquer nome, celular ou dado real de cliente ou funcionário.
- O terminal da VPS e logs de produção (podem ter IP, e-mail ou identificadores).
- O e-mail pessoal ou outras contas logadas no navegador.

## Depois de gravar

- [ ] Assistir uma vez procurando dado sensível em segundo plano (barra de abas, notificações).
- [ ] Subir onde o Moodle pedir (link não listado ou arquivo) e anotar o link em `docs/entrega/checklist-pacote.md`.
