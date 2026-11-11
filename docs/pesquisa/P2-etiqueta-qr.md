# P2 — Etiqueta com QR code (insumo do ADR 003)

> Sessão S01 · 2026-11-10 · Escopo (D21): **o sistema só gera o PDF**; impressora, driver e bobina ficam com o Pedro.
> Regra L-0005: fontes citadas; números sem fonte normativa estão marcados como **[a validar em teste]**.

## 1. O que as fontes dizem

| Tema | Achado | Fonte |
|---|---|---|
| Correção de erro | 4 níveis: **L 7% · M 15% · Q 25% · H 30%**; mais correção = código mais denso (mais módulos) | [Uniqode](https://docs.uniqode.com/en/articles/7219782-what-is-the-recommended-error-correction-level-for-printing-a-qr-code), [QRCodeCreator](https://qrcodecreator.com/qr-code-error-correction) |
| Nível padrão | **M** é o padrão comum para impresso; Q/H quando há logo, impressão muito pequena ou desgaste | [cutt.ly](https://cutt.ly/resources/blog/qr-code-best-practices-2026), [inventivehq](https://inventivehq.com/blog/what-are-qr-code-error-correction-levels-and-which-should-i-use) |
| Zona de silêncio | **4 módulos** de margem branca em todos os lados; cortada para 1–2 módulos, o iPhone falhou na leitura | [dev.to](https://dev.to/lizely/designing-qr-codes-that-survive-real-world-scanning-a-debugging-playbook-1f9l), [toolkitpropp](https://toolkitpropp.netlify.app/blog/qr-codes-what-specs-dont-tell-you) |
| Tamanho mínimo | **Não há mínimo normativo em mm**; depende do tamanho do módulo, da distância de leitura e do material → **testar no material real**. Referências práticas: 20–25 mm em cartão de visita | [toolkitpropp](https://toolkitpropp.netlify.app/blog/qr-code-size-error-correction-scan-rate), [cutt.ly](https://cutt.ly/resources/blog/qr-code-best-practices-2026) |

## 2. Proposta

| Item | Proposta | Por quê |
|---|---|---|
| **Conteúdo do QR** | Só o **código do SKU**, ex.: `0042-46-CHO` (formato da P1) | Curto → QR pequeno e fácil de ler. Uma URL aumentaria o código e exporia a rota. Uma URL pública de produto fica para o catálogo (v2). |
| **Modo / versão** | Alfanumérico (maiúsculas, dígitos, hífen); deve caber na **versão 1 (21×21 módulos)** com nível M **[a validar em teste com a biblioteca na S08]** | Menor código possível |
| **Correção de erro** | **M** | Padrão para impresso, sem logo; etiqueta lisa |
| **Zona de silêncio** | 4 módulos, sempre | Fontes acima |
| **Tamanho do QR** | ≥ **15 mm** de lado **[a validar em teste]**. Com 21 + 8 módulos ≈ 0,5 mm por módulo | Leitura pela câmera do celular a ~10–20 cm |
| **Tamanho da etiqueta** | Padrão **40 × 25 mm** (configurável em Configurações: 50 × 30, 30 × 20) **[confirmar com a bobina do Pedro]** | Cabe o QR + 3 linhas de texto |
| **Texto legível** | Linha 1: nome curto do modelo · Linha 2: **tamanho + cor** (fonte maior) · Linha 3: **preço** · e o código do SKU abaixo do QR | O vendedor confere sem escanear; o código serve para digitação se a câmera falhar |
| **PDF** | **Uma etiqueta por página**, página = tamanho exato da etiqueta, QR **vetorial**, margens 0, "imprimir em 100%" (sem ajustar à página) | É o formato que drivers de impressora térmica tratam como "1 página = 1 etiqueta" **[a validar na impressora do Pedro]** |
| **Lote** | Tela "Etiquetas": escolher SKUs e quantidades (padrão = estoque atual) → 1 PDF com todas | O Marcos etiqueta a reposição inteira de uma vez |

## 3. Alternativas descartadas (vão para o ADR 003)

- **ZPL/TSPL** (linguagem nativa da impressora): mais precisa, mas amarra a um fabricante e precisa de envio direto à impressora. O PDF funciona com qualquer driver.
- **EAN/Code128 de barras**: D5 decidiu QR próprio; barras precisam de mais largura na etiqueta.
- **URL no QR**: maior e expõe rota; fica para o catálogo (v2).

## 4. Para validar na S08

1. Gerar `0042-46-CHO` e conferir a versão/nível que a biblioteca escolhe.
2. Imprimir 3 tamanhos (12, 15, 18 mm) na térmica do Pedro e ler com iPhone e Android a 15 cm.
3. Fixar o menor tamanho com 100% de leitura em 10 tentativas → registrar no ADR 003.
