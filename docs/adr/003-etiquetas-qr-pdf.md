# ADR 003: Etiquetas com QR em PDF gerado na API (bobina 33 × 22 mm, 3 colunas)

- **Status:** proposto (o Pedro decide ao mergear o PR da S08)
- **Data:** 2026-11-11
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** ARQ (decisão estrutural com alternativas), TEST-01..08/17, SEC-03, CI-01; produto: RF-PRO-06, RF-PRO-07, RN-01; pesquisa P2 (etiqueta + QR)

## Contexto

O Dono precisa imprimir, no computador, as etiquetas das peças com um QR que o celular lê na venda (S10) e um texto legível (RF-PRO-06). A P2 propôs um PDF de **uma etiqueta por página, 40 × 25 mm**. Na S08 o Pedro definiu o material real: **etiqueta 33 × 22 mm em bobina de 3 colunas**, na largura exata da entrada da impressora térmica (USB e Bluetooth; modelo ainda não informado). A bobina será comprada; nenhuma etiqueta foi impressa ainda. A S07 já gera o QR de cada SKU na tela com `uqr` 0.1.3 (só o código curto, versão 1, correção M).

## Decisão

1. **O PDF é gerado na API** (`POST /etiquetas`, só Dono), com **`pdfkit` 0.20.2** (MIT). O corpo traz `{ itens: [{ sku_id, quantidade }] }` (1 a 999 etiquetas por PDF, SKU sem repetição; contrato em `@ailow/shared`). A resposta é `application/pdf` com `content-disposition: attachment` e `cache-control: private, no-store`. SKU inexistente, de outra empresa (a RLS esconde) ou de produto inativo derruba o pedido inteiro com 404, sem PDF parcial.
2. **Uma página = uma fileira da bobina** (3 etiquetas lado a lado), porque o driver de uma térmica trata etiqueta multicoluna como uma "página" da largura total. A última fileira pode sair com colunas em branco (a tela mostra quantas). Geometria inicial, **a calibrar na 1ª impressão**: etiqueta 33 × 22 mm, 2 mm entre colunas, 1 mm de margem lateral (página 105 × 22 mm), folga interna de 0,5 mm. Os números ficam num único objeto (`GEOMETRIA_PADRAO` em `apps/api/src/produtos/etiquetas.ts`).
3. **QR vetorial**, só com o código do SKU (P2), **correção M**, **zona de silêncio de 4 módulos inteira dentro da etiqueta**, módulo de **0,5 mm** (= 4 pontos de uma térmica de 203 dpi; o QR fica com 10,5 mm e 14,5 mm com a zona). O maior código possível (`PPPP-TTT-CCC`) cabe na versão 1 (21 × 21). Reaproveita `uqr` 0.1.3 (a mesma da tela, agora também na API).
4. **Texto legível** (Helvetica, fonte padrão do PDF, sem embutir arquivo): à direita do QR o **nome** (até 2 linhas), o **tamanho em destaque** (10 pt), a **cor** e, embaixo, o **preço** (até 11 pt); o código do SKU vai embaixo do QR. O texto quebra por palavra, depois diminui a fonte (mínimos de 5 a 6 pt) e só no corpo mínimo parte palavra ou corta com reticências. **Nada de custo nem fornecedor**: a consulta nem seleciona essas colunas e o tipo `DadosEtiqueta` não tem o campo (RF-PRO-07).
5. **Tela "Etiquetas"** no módulo Produtos (só Dono): busca, quantidade por SKU (−/+ e digitação, teto 999), "Usar o estoque" por produto, resumo "N etiquetas · F fileiras (B em branco)" e "Gerar PDF" baixando `etiquetas-AAAA-MM-DD.pdf`. A orientação de impressão é **tamanho real (100%)**, sem "ajustar à página".

## Alternativas consideradas

1. **PDF no navegador com `pdf-lib`.** Funcionaria offline e sem rota nova. Descartada: `pdf-lib` está sem versão nova desde 2022, o bundle do web cresceria e os testes ficariam no jsdom; a API já tem os dados e a autorização.
2. **Impressão por HTML/CSS (`@page size: 105mm 22mm`) e "Imprimir" do navegador.** Zero dependência. Descartada: escala e margens variam por navegador e driver; não há arquivo para guardar ou reimprimir; difícil de testar.
3. **Linguagem nativa da impressora (ZPL/TSPL/EPL) enviada direto.** Mais precisa e mais rápida. Descartada no v1: amarra a um fabricante (o modelo do Pedro nem está definido) e exige envio direto à impressora (USB/rede); o PDF funciona com qualquer driver. Reavaliar se a calibração do PDF for instável.
4. **Uma etiqueta por página (P2 original).** Descartada para esta bobina: com 3 colunas, o driver avança a fileira inteira a cada página e 2 de cada 3 etiquetas sairiam em branco.
5. **Biblioteca `qrcode` (node-qrcode) na API.** Válida, mais usada; `uqr` já está no projeto, é zero-dependência e foi medida na S07. Trocar não muda o contrato.
6. **Fonte embutida (TTF) para acentos e ajuste fino.** Desnecessária: a Helvetica padrão do PDF cobre o português (WinAnsi), conferido com "Sutiã", "Açaí", "Bordô" e "…".

## Consequências

- **+1 dependência de produção na API** (`pdfkit`, com `fontkit`, `linebreak`, `png-js`, `fflate`, `@noble/*`); `pdfjs-dist` 6.4.299 entra só como dependência de **teste** (leitor independente do PDF). `npm audit` sem achado novo (os 3 moderados são os antigos do `node-pg-migrate`).
- CPU no servidor: o teto de 999 etiquetas por PDF (333 páginas) limita o custo de uma requisição.
- Rota nova com prefixo novo: `etiquetas` entrou no proxy do Vite (o teste L-0009 acusou) e precisa entrar no proxy HTTPS da S14.
- O nome longo é cortado **na etiqueta** (33 mm não cabem 80 caracteres); a regra D23 (nome nunca truncado) vale para as telas. O QR e o código identificam a peça.

## Limites e o que falta validar (fora do código)

- **Ainda não impresso nem lido pela câmera de um celular.** Validado só em software: o PDF baixado pelo navegador foi rasterizado a 203 dpi e **todos os QRs foram decodificados** por um leitor independente (`jsqr`), e o texto foi lido pelo `pdfjs-dist`. O "pronto quando" da S08 (foto da etiqueta impressa e lida pela câmera) fica pendente até a bobina chegar.
- **Calibrar na 1ª impressão:** espaço entre colunas, margem lateral e o tamanho de papel no driver (largura da fileira × 22 mm). Se o QR de 10,5 mm falhar na câmera a 10–15 cm, subir o módulo para 0,625 mm (5 pontos) e reconferir o texto.
- Modelo da impressora não informado; impressão por Bluetooth no celular não foi considerada (o fluxo é no computador).
