# P1 — Modelagem de produto (moda íntima)

> Sessão S01 · 2026-11-10 · Status: **proposta — aguarda validação do Pedro (🚦) e conferência com o Marcos**
> Regra L-0005: afirmações marcadas com a fonte; o que é inferência está marcado como **[inferência]**.

## 1. O que as fontes dizem sobre o tamanho de sutiã

- **O número do sutiã vem do tórax** (contorno logo abaixo dos seios); **a taça (A, B, C, D) vem do busto** (parte mais cheia), pela diferença busto − tórax. [Labra](https://labra.com.br/dicas-para-comprar-sutia-do-tamanho-certo/), [Omni Calculator](https://www.omnicalculator.com/pt/dia-a-dia/tamanho-de-sutia)
- **A numeração não é padronizada entre marcas**; cada uma tem a sua tabela. Exemplos encontrados: 44 = tórax 78–82 cm, 46 = 83–90 cm, 48 = 91–98 cm. [Melhor Envio](https://melhorenvio.com.br/blog/ecommerce-e-marketplace/tabela-de-medidas/), [Nuvemshop](https://www.nuvemshop.com.br/blog/tabela-de-medidas/)
- **Consequência para o sistema [inferência]:** o Ailow Cloud **não deve converter medidas**. Ele guarda o **tamanho como está na etiqueta do fornecedor** (ex.: "46"). A orientação de medida é conhecimento do vendedor; o Marcos vende consultoria justamente por isso.

## 2. O que a loja mostrou (discovery)

| Evidência | O que diz |
|---|---|
| Etiqueta Pretty Paty: "TAM 52 · SOUTIEN TQC PLUS SIZE · COR CHOCOLATE" (F03) | Sutiã com **tamanho numérico**, sem taça; o "plus" faz parte do nome/modelo |
| Etiqueta Fina Paixão: "SUTIA ESSENCIA · COR CHOCOLATE · 46" (F12) | Tamanho numérico; cor por nome |
| Etiqueta Anita: "Tam.: M" (F13) · Brilhante: "TAM G" (F15) | Calcinha, conjunto e camisola com **tamanho por letra** |
| Marcos: "P, M, G e GG Slim; P, M, G e GG Plus" [R1 35:57] | Por letra, o porte multiplica a grade |
| Marcos: "Slim eu tenho 3 [modelos de tomara que caia], Plus eu tenho 1" [R1 40:34], com preços diferentes | **Slim e Plus são modelos diferentes**, não só tamanhos |
| Pedro sobre o sutiã: "tem 3 medidas, em cima, no meio e embaixo" [R2 14:12] | **Ambíguo**: pode ser busto/tórax/taça ou alças/corpo/cós. **Pergunta ao Marcos (Q1).** |

## 3. Modelo proposto

```
Categoria (Sutiã, Calcinha, Baby doll, Modelador, Cinta, Conjunto, …)
  └─ define: tipo de grade padrão + atributos que fazem sentido (liga/desliga)
Produto  = o "modelo" (ex.: "Tomara que caia Essência")
  campos: nome, categoria, porte (Slim | Plus), fornecedor, ref. do fornecedor (texto, opcional),
          atributos (bojo, aro, renda, compressão, alça removível…), custo, preço
  └─ SKU = Produto × Tamanho × Cor   ← a unidade vendável, que tem estoque, mínimo, QR e etiqueta
```

**Decisões de modelagem (propostas):**

1. **Porte é do produto, não do SKU.** Slim e Plus têm modelos, marcas e preços diferentes [R1 40:08–40:34]. Um "Tomara que caia" Slim e um Plus são **2 produtos**. O relatório agrupa por porte.
2. **Grade de tamanhos = lista ordenada escolhida por produto** (com padrão por categoria):
   - `LETRAS`: P · M · G · GG
   - `NUMERICA_SUTIA`: 40 · 42 · 44 · 46 · 48 · 50 · 52 · 54 · 56 (o Dono marca só os que tem)
   - `UNICO`: U (acessórios)
   - O Dono pode criar uma grade nova em Configurações (ex.: G1 · G2 · G3, se algum fornecedor usar).
3. **Taça (A/B/C…) fica fora agora**: nenhuma etiqueta fotografada traz taça. Se aparecer, vira valor da grade (ex.: "44B"), sem mudar o modelo.
4. **Cor** = texto curto escolhido de uma lista que cresce com o uso (Preto, Nude, Chocolate, Vermelho…).
5. **Preço e custo ficam no produto** (todos os SKUs com o mesmo preço). Se um tamanho Plus custar mais, vira outro produto (regra 1). **[inferência; validar Q3]**
6. **Estoque mínimo por SKU** (PRD RF-PRO-05).

## 4. Código do SKU (vai no QR e na etiqueta)

Formato proposto: **`PPPP-TT-CCC`**

| Parte | Significado | Exemplo |
|---|---|---|
| `PPPP` | nº do produto na empresa, sequencial, 4 dígitos (o Marcos pediu ref. de ~4 dígitos [R1 01:09:35]) | `0042` |
| `TT` | tamanho (1–3 caracteres) | `46`, `GG`, `U` |
| `CCC` | 3 letras da cor | `CHO`, `PRE`, `NUD` |

Exemplo: **`0042-46-CHO`**. Só usa maiúsculas, dígitos e hífen → cabe no **modo alfanumérico** do QR, que gera o menor código possível (ver P2). É único **por empresa** (o leitor sempre opera dentro da empresa logada).

## 5. Fluxo de cadastro por toques (insumo para S07)

Categoria → Porte → Atributos (liga/desliga) → Nome do modelo → Fornecedor → Tamanhos (marca na grade) → Cores (marca/cria) → Custo → Preço (sugerido pelo markup, editável) → Quantidade e mínimo **por SKU** numa tabela tamanho × cor → Salvar → "Imprimir etiquetas?".

## 6. Perguntas para o Marcos

| # | Pergunta |
|---|---|
| Q1 | "O sutiã tem 3 medidas": quais são? Elas aparecem na etiqueta ou só no atendimento? |
| Q2 | Plus por letra é P/M/G/GG Plus mesmo, ou G1/G2/G3/EXG? |
| Q3 | Um mesmo modelo tem preço diferente por tamanho? |
| Q4 | Quais cores mais aparecem (para a lista inicial)? |
| Q5 | Atacado ainda existe? O Instagram tem um destaque "ATACADO" (P3). Se sim, há preço de atacado por produto. |

## 7. Planilha-modelo

`docs/pesquisa/planilha-20-pecas-carro-chefe.csv`: uma linha por **SKU** (produto × tamanho × cor), para o Marcos preencher no caderno ou no Excel e para o cadastro de teste da S07.
