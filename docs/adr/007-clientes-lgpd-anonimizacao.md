# ADR 007: Clientes — celular único por empresa e "excluir" como anonimização

- **Status:** proposto (o Pedro decide ao mergear o PR da S09)
- **Data:** 2026-11-13
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** TEST-12/17, SEC-01/03/04, AUD-10, OPS-11; produto: RF-CLI-01…04, RN-07, RN-10, D8, D18

## Contexto

Toda venda terá cliente (nome + celular válido, RN-07/D8), e o número é a base de campanhas. O PRD pede que o celular seja **único por empresa** (RF-CLI-01), que se registre a **data do aviso de finalidade** e que o Dono possa **excluir/anonimizar** a pedido do cliente, **mantendo as vendas** sem os dados pessoais (RF-CLI-04). O repositório é público e o app é multi-tenant (tier B): dado pessoal não pode vazar entre empresas nem para logs.

## Decisão

1. **Tabela `clientes`** mínima (D18): `nome`, `celular`, `aviso_lgpd_em`, `anonimizado_em`, `criado_por`, `criado_em`; RLS forçada com `empresa_id` (ADR 002) e chave composta para o autor.
2. **Celular só com dígitos** (DDD + 9 + 8 dígitos; sem fixo). A regra mora em `@ailow/shared` (uma só fonte para API e web: aceita máscara e `+55`, recusa o resto) e o banco repete o formato com `CHECK`. `UNIQUE (empresa_id, celular)`; o 409 diz `celular_ja_cadastrado`.
3. **"Excluir" = anonimizar, nunca `DELETE`.** O runtime não tem `DELETE` nem `TRUNCATE` em `clientes`: a anonimização troca o nome por "Cliente anonimizado", **zera o celular** e grava `anonimizado_em`. A linha continua para que as vendas da S10 apontem para ela (RF-CLI-04). Um `CHECK` garante que ativo tem celular e anonimizado não tem; como `NULL` não colide em `UNIQUE`, o número **fica livre** para um novo cadastro.
4. **Aviso de finalidade (LGPD).** `aviso_lgpd_em` é gravado no cadastro (se a pessoa marcou "já avisei") ou depois, pela ficha. Registrar de novo **mantém a data do primeiro aviso** (evidência, AUD-90). Dono e Vendedor registram; só o Dono anonimiza (RN-10).
5. **Privilégios por coluna.** O runtime só atualiza `nome`, `celular`, `aviso_lgpd_em` e `anonimizado_em`; quem criou e quando nunca se reescrevem. Esta versão **não edita** nome nem celular (fora do RF-CLI-01…04); a anonimização é o único `UPDATE` que mexe neles.
6. **Auditoria sem dado pessoal.** Os eventos `cliente_criado`, `cliente_aviso_lgpd` e `cliente_anonimizado` guardam autor e id do cliente, nunca nome ou celular (AUD-10).
7. **Log sem dado pessoal.** A busca leva nome ou celular na query string; o serializador de requisições do log **descarta a query string** (`app.ts`), com teste.
8. **Histórico de compras.** A tabela de vendas nasce na S10. Esta sessão entrega a ficha com a seção "Compras" vazia e o texto de espera; a S10 acrescenta a consulta (RF-CLI-02 fecha lá).

## Alternativas consideradas

1. **`DELETE` físico do cliente.** Descartada: a venda precisa manter o vínculo (RF-CLI-04) e `ON DELETE SET NULL` perderia a informação "foi o mesmo cliente"; a anonimização apaga o dado pessoal e preserva a relação.
2. **Apagar o nome mas guardar o celular em hash.** Descartada: o hash de um celular (10 mil milhões de possibilidades) é reversível por força bruta; continuaria sendo dado pessoal.
3. **Índice único parcial (`WHERE anonimizado_em IS NULL`).** Equivalente, mas o `UNIQUE` simples já aceita vários `NULL` e é mais simples de ler.
4. **Busca por `POST` para o texto não ir na URL.** Descartada: foge da convenção REST e o problema (log) se resolve num ponto só, no serializador.
5. **Editar nome e celular já agora.** Adiada (YAGNI, karpathy): não consta de RF-CLI-01…04; entra com a necessidade real, com a sua própria migração de `GRANT`.
6. **Celular fixo permitido.** Descartada (D8): o canal é o WhatsApp.

## Consequências

- Vendas (S10) usam `clientes.id` e leem nome/celular só pela ficha; depois de anonimizado, o relatório mostra "Cliente anonimizado".
- Quem anonimiza não consegue desfazer: a tela pede confirmação em dois passos e o backend responde 409 numa segunda tentativa.
- **Limite aceito:** celulares "inventados" para fechar venda rápido passam pela validação de formato; a detecção de repetidos/suspeitos é do relatório de Vendas (RF-VEN-09).
- Backups anteriores à anonimização ainda guardam o dado pessoal até expirarem (política de retenção de backup na S14).
