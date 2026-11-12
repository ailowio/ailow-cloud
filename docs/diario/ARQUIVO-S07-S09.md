# Diário arquivado — S07 em diante (entradas intactas, movidas de ATUAL.md)

> Ler só sob demanda (Grep). Entradas mais antigas: `ARQUIVO-S00-S06.md`.

### S07 — Produtos — 2026-11-11 — Claude Sonnet 5.5
Gate declarado: feature + mudança de banco + UI + dinheiro/estoque, **tier B**; regras TEST-01..08/12/17, CODE-*, SEC-03/07, OPS-11, ARQ (ADR), AUD-02/09/10, MC. Decisão estrutural ⇒ **ADR 006 (proposto)**. Critérios: RF-PRO-01…05/07 e RN-03/RN-05 com teste; saldo 0 não baixa; concorrência no limite; custo ausente para o Vendedor (2 empresas × 2 perfis); mutação ≥ 8 defeitos; navegador 360×640 nos 2 temas; `verify` e CI verdes.
Estado real ao abrir: `git rev-parse --show-toplevel` = `D:/apps/ailow-cloud`, `main` limpa em `507a8b2`, portas 54329/3000/5173 livres; **PR #12 (handoff) ainda aberto**, então a branch `feature/s07-produtos` saiu da `main` (o PR #12 só retoca este plano: pode haver conflito trivial em `docs/plano-execucao.md` na hora de mergear).
Feito (branch `feature/s07-produtos`):
- **Banco:** migração reversível `20261112180000_produtos`: `produtos`, `skus` e `movimentos_estoque` (RLS forçada, política `isolamento_empresa`, GRANT explícito, chaves compostas por empresa). Movimentos só-acréscimo (`SELECT`/`INSERT`), com autor, motivo, quantidade com sinal, `saldo_apos`, `seq` (ordem de gravação) e o id da venda nos tipos `venda`/`estorno_venda` (índice único: a mesma venda não baixa nem estorna o mesmo SKU duas vezes, RN-08). `CHECK (estoque >= 0)` (RN-03). Chave estrangeira composta com coluna gerada `'produto'`: **o banco recusa categoria financeira** num produto, e `ON DELETE RESTRICT` impede apagar categoria em uso (só desativa). Subir, descer e subir testado (`migracao.test.ts`).
- **Interface pública de estoque** (`src/produtos/estoque.ts`, `registrarMovimento`): `UPDATE ... AND estoque + $q >= 0` com a linha travada, na transação do chamador; teste de fronteira (só `src/produtos/` cita as tabelas). O estoque inicial do cadastro usa a mesma função.
- **API (OpenAPI 0.6.0):** `GET/POST /produtos` (cadastro com SKUs, código `PPPP-TT-CCC`, estoque inicial e mínimo por SKU; busca por nome sem acento/caixa, código e preço: "89,90" exato, "89" a faixa de R$ 89,00 a R$ 89,99), `POST /skus/{id}/estoque` (entrada/ajuste, só Dono), `GET /skus/{id}/movimentos`, `GET /estoque/alertas`. Numeração sem buraco por `pg_advisory_xact_lock` por empresa. **Vendedor:** custo, fornecedor e mínimo não são nem selecionados e a chave some da resposta; criar, ajustar, histórico e alertas dão 403. Criar e ajustar gravam `eventos_acesso`.
- **Shared:** contrato de Produtos e regras puras sem dependência (`produtos-calculos.ts`: preço sugerido em centavos, código de SKU/cor, ordem de tamanhos, faixa de preço), expostas ao navegador por `@ailow/shared/puro` para o web não levar o Zod (conferido: 0 marcas do Zod no bundle).
- **Web:** módulo Produtos (lista/busca com debounce, cartão por produto com variações, aba "Abaixo do mínimo"), assistente "Novo produto" em 6 passos (categoria → nome e porte → atributos [pulado se a categoria não tem] → tamanhos e cores [grades da P1 + tamanho/cor digitados] → custo, preço com sugestão do markup e fornecedor → estoque inicial e mínimo por SKU, com "aplicar a todos"), folha do SKU (código, **QR gerado no aparelho com `uqr` 0.1.3**, entrada/ajuste com motivo e histórico com autor) e **aviso vermelho na tela inicial do Dono** (3 primeiros itens + selo no bloco Produtos). Produtos deixou de ser "em breve" (`modulos.ts` + teste).
Números (antes -> depois): testes API 386 -> 530, web 128 -> 195, shared 59 -> 136; migrações 5 -> 6; rotas 29 -> 34; OpenAPI 0.5.0 -> 0.6.0; bundle de produção 526 kB -> 599 kB (Mantine + telas novas; sem Zod; code-split fica para a S13).
Evidência do "pronto quando":
- `npm run verify` exit 0 (1 aviso antigo de lint em `main.tsx`; 530 + 195 + 136 testes; build).
- **RN-03:** saldo 0 não baixa (nada gravado); baixar mais que o saldo recusa; baixar exatamente o saldo zera; **concorrência no limite** com a 1ª transação aberta e a 2ª comprovadamente bloqueada (400 ms) e depois recusada, e 5 baixas simultâneas com saldo 3 = exatamente 3 passam; pela API, 2 baixas simultâneas = 200 e 409; `UPDATE` para saldo negativo é recusado pelo banco.
- **RF-PRO-07:** o texto cru da resposta do Vendedor não contém `custo`, `fornecedor` nem `estoque_minimo`; `GET /estoque/alertas` e o histórico dão 403 a ele; 2 empresas × 2 perfis em `produtos.test.ts` e isolamento nas 3 tabelas em `rls-produtos.test.ts` (70 casos).
- **Mutação (L-0006), 17 defeitos plantados por script (`split/join`, sem regex), todos pegos** e os arquivos restaurados (`git status` limpo depois): baixa sem a condição `>= 0`; códigos de erro trocados; `saldo_apos` errado; custo/fornecedor selecionados ao Vendedor; mínimo selecionado ao Vendedor; alerta com `<=`; criar produto sem `exigirPerfil`; histórico aberto ao Vendedor; numeração sem a trava; categoria financeira aceita; busca sem tratar acento; banco sem o `CHECK` de saldo; `GRANT UPDATE` em movimentos; política de `skus` com `USING (true)`; preço sugerido sem arredondar; Produtos "em breve"; sinal de menos como hífen. Nenhum sobreviveu na 1ª rodada.
- **Navegador (Playwright, Chromium 360×640, escuro e claro):** lista, busca por código, os 6 passos do assistente, cadastro de um produto de 24 variações, folha do SKU (ajuste negativo bloqueado quando passa do saldo; "Vai ficar com 0"; histórico com autor), aba "Abaixo do mínimo", tela inicial com o aviso e a visão do Vendedor. Medido em cada tela: 0 rolagem horizontal, 0 texto cortado, 0 elementos fora da tela, 0 alvos < 48 px; nome de produto de 53 caracteres quebra em linhas (D23). **2 defeitos só achados no navegador e corrigidos:** o rótulo "Continuar" era cortado (padding do botão; o último passo agora empilha os botões) e o `Switch` dos atributos tinha alvo de 30 px (linha de 48 px). Contraste do botão do aviso conferido (branco sobre `#c92a2a`, ≈ 6:1; antes ficava abaixo de 4,5:1).
- **QR:** o SVG renderizado na folha foi decodificado por um leitor **independente** (`jsqr`, instalado só fora do repositório) e devolveu exatamente `0001-40-CHO`; e `0042-46-CHO` cabe na versão 1 (21×21) com correção M (teste `qr.test.ts`): resolve o "a validar" da P2 para esse código. **Não** foi lido com câmera de celular nem impresso (S08).
Decisões e limites (propostas por mim; o Pedro confirma ao mergear — também no ADR 006):
- Aviso = estoque **estritamente abaixo** do mínimo (`<`); mínimo 0 = sem aviso. (O selo "Baixo" do DS passou de `<=` para `<` para casar com o aviso.)
- Preço sugerido arredondado ao centavo (metade para cima): o PRD diz "sem arredondamento", impossível em centavos (RN-01). A API guarda o preço digitado.
- Fornecedor = texto livre no v1; tabela na S11. Produto **imutável** nesta versão (sem editar preço, nome, grade nem desativar): preço errado exige produto novo até uma migração de edição (pendência abaixo).
- Limites: 144 variações e 12 cores por produto, 9.999 produtos por empresa (4 dígitos do código), 200 produtos na lista.
- Vendedor também não vê fornecedor nem estoque mínimo (além do custo), por ser decisão de compra.
Pendências / riscos honestos:
- **CI do PR #14:** 6/6 verdes (verify, compose, imagem, seguranca-sast, seguranca-sca, seguranca-segredos; run 43112617551). O Compose não foi rodado localmente (só no CI).
- Sem **edição de produto**, sem acrescentar tamanho/cor depois, sem desativar produto: o produto vai precisar de uma sessão de edição (preço é urgente na prática).
- Para a S10 falta uma função de consulta (buscar SKU por código e preço, na transação da venda): deixei de fora por ser YAGNI até lá.
- Saldo e movimentos são consistentes pela interface (o runtime ainda pode atualizar `estoque` direto); trigger avaliado e adiado (ADR 006, alternativa 2).
- Testado só no Chromium; não em Safari/iOS nem com câmera real. Texto de 13–14 px segue como no DS.
- Perguntas do Marcos da P1 (Q1–Q5: as "3 medidas" do sutiã, Plus por letra ou G1/G2, preço por tamanho, cores, atacado) continuam abertas e podem mexer no modelo.
- O dev local (`.dev-data/`) ganhou categorias e 1 produto de teste (`Tomara que caia Essência…`, nº 0001); apague a pasta para recomeçar. Servidores de dev parados por PID/`pg_ctl` e portas conferidas livres (L-0012).
Aprendizado: **L-0014** (testes com ordem/busca dependentes de uuid/hex aleatório, achados antes do merge; lição ativa 11) e recorrência da L-0011; o guarda do proxy (L-0009) e o contrato OpenAPI funcionaram como desenhados. Falhas minhas no caminho, todas corrigidas antes do commit: expectativa de código de erro do banco errada no teste (`23001`, não `23503`); teste que procurava o código de B na A (o código é único por empresa); conversão centavos→texto improvisada (virou função com teste); um lote de testes de rótulos foi escrito junto com a implementação, **sem observar o vermelho separadamente**. `node harness/scripts/check-harness.mjs` -> Harness OK (14 lições).
Verificação: `npm run verify` exit 0; mutação 17/17; Playwright 360×640 nos 2 temas; decodificação do QR; `check-harness`.

### Limpeza de pend�ncias (p�s-plano; paralelo � S07 no Claude Code) � 2026-11-12 � Composer
Gate: feature logo + bugfix PIN + tooling + docs, **tier B**. Branch `chore/limpeza-pendencias-pos-s07` (worktree; S07 ainda WIP fora desta branch).
Feito:
- **ADR 004 aceito** (c�digo j� na main desde S04).
- **RF-CFG-02 logo via UI:** migra��o `logo_bytes`/`logo_mime` (PNG/JPEG/WebP = 512 KiB, sem SVG); `PUT/DELETE/GET /empresa/logo`; Configura��es > Empresa envia/troca/remove; OpenAPI 0.5.1; `@fastify/multipart`.
- **L-0011:** asser��o SEC-16 parseia JSON do log (n�o substring solta em `time`/UUID).
- **`npm run dev:parar`** (L-0012 a��o 3).
- **Adiados com dono:** reescrita acervo (Pedro); proxy HTTPS ? S14; Safari/iOS ? s� Chromium por ora; texto 13�14 px aceito; nested virt aceito.
Verifica��o: `npm run verify` (ver PR).

### S08 ? Etiquetas QR ? 2026-11-11 ? Claude Opus 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, CODE-*, SEC-03, ARQ (ADR 003), CI-01, MC. Decis�o do Pedro na sess�o: **bobina 33 � 22 mm em 3 colunas** (n�o 40 � 25), PDF **na API com pdfkit**.
Feito (branch `feature/s08-etiquetas`): `POST /etiquetas` (s� Dono) devolve PDF com **uma fileira de 3 por p�gina**; QR vetorial s� com o c�digo (vers�o 1, corre��o M, zona de 4 m�dulos, m�dulo 0,5 mm = 4 pontos a 203 dpi); texto: nome, tamanho em destaque, cor, pre�o, c�digo; **sem custo nem fornecedor**. At� 999 por PDF; SKU de outra empresa, inexistente ou de produto inativo = 404. Tela "Etiquetas" em Produtos: busca, quantidade por SKU, "Usar o estoque", resumo de fileiras/em branco, download com o dia de S�o Paulo. ADR 003 **proposto**.
N�meros: testes API 535 -> 571, web 195 -> 215, shared 136 -> 151; OpenAPI 0.6.0 -> 0.7.0; bundle web +7,5 kB.
Evid�ncia: `verify` exit 0; PDF lido por leitor independente (`pdfjs-dist`); PDF **baixado pelo navegador** rasterizado a 203 dpi: **71/71 QRs decodificados** (`jsqr`, fora do repo); muta��o **15/15** pegas; Playwright 360�640 nos 2 temas: 0 rolagem, 0 alvo < 48 px, 0 texto cortado (3 cortes achados s� no navegador e corrigidos: L-0015). Pedro testou o PDF: "gerou r�pido e funcionou".
Pend�ncias: **(1) impress�o f�sica (�nica):** comprar a bobina, informar o modelo da impressora, imprimir, calibrar (espa�o entre colunas 2 mm e margem 1 mm s�o estimativas; papel 105 � 22 mm; tamanho real 100%) e fotografar a leitura pela c�mera, que � o "pronto quando" da S08. (2) Zod j� vaza no bundle web da `main` (5 marcas, antes desta sess�o). (3) PIN do Dono de dev redefinido para 2468 s� no banco local (documentar no seed). (4) Prefixo `etiquetas` no proxy HTTPS da S14.
Aprendizado: L-0015 (r�tulo cortado em 360 px, recorr�ncia 2; li��o ativa 12; E2E na S13). Falhas corrigidas (detalhe no PR): op��o inexistente do pdfjs 6, nome de arquivo s� por caixa, data em UTC, heredoc (li��o 1). `check-harness` OK.



### S09 — Clientes — 2026-11-13 — Claude Sonnet 5.5
Gate: feature API + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, MC. Branch `feature/s09-clientes` (S08 já mergeada, PR #16).
Feito: tabela `clientes` (RLS, celular único por empresa, sem `DELETE`); `GET/POST /clientes`, ficha, `POST …/aviso-lgpd` (Dono e Vendedor) e `POST …/anonimizar` (só Dono); busca por nome (sem acento) ou celular; telas Clientes, Novo cliente e Ficha com botão WhatsApp, aviso com data e apagar com confirmação; módulo "Clientes" ativo na grade. ADR 007 **proposto**; OpenAPI 0.8.0.
Números: testes API 571 -> 634, web 215 -> 231, shared 151 -> 191; migrações +1 (`20261113120000_clientes`).
Decisões a confirmar (Pedro): (1) "excluir" = **anonimizar** (sem `DELETE`, a venda mantém o vínculo); (2) sem editar cliente (fora de RF-CLI-01…04); (3) **histórico de compras vazio até a S10** (não há vendas); (4) o log passa a descartar a query string (a busca leva nome/celular na URL).
Verificação: `verify` exit 0; mutação 5/5 (a 1ª rodada pegou 4/5: o teste de "lista sem anonimizados" era frouxo e foi reforçado); Playwright 360×640 nos 2 temas: 11 telas, 0 rolagem lateral, 0 alvo < 48 px, 0 texto cortado (1 falso positivo: trilho do Switch).
Aprendizado: **L-0016** (teste avançou o relógio compartilhado em minutos e derrubou as sessões; comentário no helper). O guard barrou um comando meu com ".env" e não foi contornado. `check-harness` OK.
Pendências: prefixo `clientes` no proxy HTTPS da S14 (o do Vite já tem, por teste de guarda); impressão física das etiquetas (S08, Pedro).

### S09b — Clientes editar/inativar/excluir — 2026-11-12 — Composer
Gate: feature + migração + UI, **tier B**; TEST-01..08/17, SEC-01/04, AUD-10, OPS-11, ARQ (ADR 007), MC. Branch `feature/s09b-clientes-editar-excluir` (S09 já mergeada, PR #17). Continuação da sessão Claude Code interrompida por usage limit.
Feito: migração `20261113180000_clientes-inativar-excluir` (`ativo` no lugar de `anonimizado_em`; `DELETE` ao runtime); `PUT /clientes/{id}`, `POST …/inativar|reativar`, `DELETE /clientes/{id}`; lista com aba de inativos (só Dono); formulário compartilhado cadastro/edição; ADR 007 **aceito** (decisão do Pedro); OpenAPI 0.9.0; matriz de acessos atualizada.
Números: testes API 634 -> 662, web 231 -> 235, shared 191 -> 200.
Decisões (Pedro): excluir = apagar do banco ou inativar; edição obrigatória; histórico aguarda S10; log sem nome/celular.
Verificação: `verify` exit 0 (API 662, web 235, shared 200); mutação das regras novas (sessão Claude: 8/8); Playwright 360×640 nos 2 temas: 14 telas (lista, inativos, novo, ficha, editar, ficha-inativo, confirmar-excluir × 2 temas), 0 rolagem, 0 alvo < 48 px, 0 texto cortado.
Pendências: impressão física S08 (Pedro); S10 Vendas.
