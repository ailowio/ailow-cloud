# ADR 010 — Hospedagem inicial em VPS compartilhada, desenhada para migrar

- **Status:** aceito em 2026-11-12 pelo Pedro ("adr confirmado"), com a confirmação dele de que a Marcant aceita ter os dados no mesmo servidor da Copel (a pergunta aberta abaixo está respondida; não há registro escrito da Marcant, é a palavra do Pedro). Direção escolhida: começar na VPS existente, com migração fácil, e Google Drive para backup.
- **Decisor:** Pedro. **Tier:** B. **Regras:** OPS-*, ENV-*, SEC-*, ARQ-*, AUD-* (pilares 1–4). **Lições:** L-0005, L-0012, L-0013.
- **Escopo do texto:** o repositório é público. Este ADR não cita IP, nomes de outros serviços nem credenciais da VPS; os detalhes ficam na pasta de infraestrutura local do Pedro.

## Contexto

- Não há receita ainda: comprar uma VPS nova para o Ailow Cloud agora não faz sentido (Pedro, 2026-11-12). Existe uma VPS com Docker Swarm de nó único, Traefik v2 já dono das portas 80/443 e certificados Let's Encrypt (HTTP-01).
- Levantamento somente leitura em 2026-11-12: 4 CPUs, 15,6 GB de RAM (11,7 GB disponíveis), **sem swap**, 173 GB de disco livres, Ubuntu 20.04 (fora do suporte padrão), `ufw` inativo. O documento de infraestrutura de julho divergia do estado real (serviços novos e removidos): vale como mapa, não como verdade.
- Regra do produto: ser escalável e sem fricção para um segundo cliente (outro tenant). O app já é multi-tenant (`empresa_id` + RLS, ADR 002); o que pode gerar fricção é a hospedagem presa a este host.
- Pegada estimada do Ailow Cloud: ~1 GB (API 256 MB, Postgres ~512 MB, web estático pequeno). **Estimativa, não medida na VPS.**

## Decisão proposta (opção C)

Rodar na VPS existente **como se fosse um host descartável**:

1. **Banco próprio:** Postgres 18 em contêiner e volume só do Ailow; nenhum banco de outro sistema é reutilizado. Migrar = `pg_dump`/`pg_restore` de um único banco.
2. **Rede isolada:** overlay `ailow_internal` para banco e API. Só o contêiner de web entra na rede do Traefik, cujo nome é variável (`PROXY_NETWORK`).
3. **Stack parametrizada:** `ops/stack/ailow.yaml`; o que muda de host para host são só `DOMINIO`, `TAG`, `CERT_RESOLVER` e `PROXY_NETWORK`. Limites de memória e CPU em cada serviço (ENV-*).
4. **Traefik versionado:** `ops/traefik/` com a stack mínima equivalente, para a VPS nova subir o mesmo proxy e os mesmos labels.
5. **Imagens por tag no registro do GitHub (GHCR), publicadas pelo pipeline:** a VPS só puxa; nada compila no host. Rollback = voltar a tag anterior.
6. **Web:** contêiner estático (sem root) que serve o `dist` e repassa as rotas da API; `/metrics` não é roteado para fora. O Prometheus (quando houver) lê pela rede interna.
7. **Backup fora da VPS:** `pg_dump` + arquivos enviados, **cifrados antes de sair** (rclone `crypt`), enviados ao **Google Drive**. A chave de cifra fica fora da VPS e fora do Drive.
8. **Gatilho numérico de migração para VPS dedicada:** o primeiro que ocorrer — segundo cliente pagante; RAM disponível do host < 3 GB por 7 dias; ou qualquer incidente em que o Ailow e outro sistema se afetem. Valor inicial, para o Pedro ajustar.

## Alternativas consideradas

- **A — Instalar direto no host sem contêiner próprio de banco/rede:** mais rápido, mas mistura dados e dificulta a migração. Descartada.
- **B — VPS dedicada já:** melhor isolamento, mas custo sem receita. Fica como destino do gatilho (item 8).
- **Backup em R2 ou B2:** feito para isso, com preço previsível; o Pedro preferiu o Drive por praticidade. Trocar depois é mudar o destino do rclone, sem mudar o resto.

## Consequências e contrapontos

- **Isolamento parcial.** Mesmo com rede e banco próprios, o host é compartilhado: um OOM, um erro de firewall ou o uso do `root` afeta os dois lados, e dados de um cliente ficam no mesmo disco que sistemas de outra empresa. Antes de gravar dados reais da Marcant: o Pedro confirma que isso é aceitável para eles (pergunta aberta).
- **Host envelhecido.** Ubuntu 20.04 sem suporte padrão e `ufw` inativo são riscos do host que o Ailow não resolve; só vale registrar e ter o plano de saída.
- **Drive como backup de servidor:** (a) token OAuth de aplicativo em modo "teste" **expira em 7 dias** na documentação do Google (não verificado hoje: confirmar na doc oficial antes de depender) — publicar o app ou usar outra forma de credencial; (b) conta pessoal tem cota compartilhada; (c) o token que fica na VPS é um **acesso novo** (matriz de acessos, dono Pedro, rotação definida); (d) perder a chave de cifra = backup ilegível, então ela é guardada separadamente e **a restauração é ensaiada**.
- **Migrar de verdade só é "fácil" se for ensaiado.** Aceite desta ADR: restaurar o backup do Drive num Postgres limpo (local) e subir a mesma stack só trocando as quatro variáveis, com tempo medido no runbook.
- **Revisão em:** quando o gatilho do item 8 disparar, ou em 2027-02-12.
