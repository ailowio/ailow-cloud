# ADR 007: Clientes — celular único, edição, inativar e excluir

- **Status:** aceito (Pedro, 2026-11-12: editar sim; excluir = apagar do banco ou inativar; histórico aguarda S10; log sem nome/celular)
- **Data:** 2026-11-13 (S09); revisado 2026-11-12 (S09b)
- **Decisores:** Pedro (dono do produto); proposta redigida com apoio de IA
- **Tier do app:** B
- **Regras do harness relacionadas:** TEST-12/17, SEC-01/03/04, AUD-10, OPS-11; produto: RF-CLI-01…05, RN-07, RN-10, D8, D18

## Contexto

Toda venda terá cliente (nome + celular válido, RN-07/D8), e o número é a base de campanhas. O PRD pede celular **único por empresa** (RF-CLI-01), **data do aviso de finalidade** e forma de **excluir/anonimizar** a pedido (RF-CLI-04). Na S09 o desenho foi "excluir = anonimizar sem `DELETE`"; o Pedro corrigiu: **excluir tira do banco ou inativa**, e **tem que dar para editar**. O repositório é público e o app é multi-tenant (tier B): dado pessoal não vaza entre empresas nem para logs.

## Decisão

1. **Tabela `clientes`** mínima (D18): `nome`, `celular` (NOT NULL), `aviso_lgpd_em`, `ativo`, `criado_por`, `criado_em`; RLS forçada com `empresa_id` (ADR 002) e chave composta para o autor. A coluna `anonimizado_em` da S09 foi removida na migração `20261113180000_clientes-inativar-excluir` (OPS-11: migração já aplicada não se edita).
2. **Celular só com dígitos** (DDD + 9 + 8 dígitos; sem fixo). A regra mora em `@ailow/shared` e o banco repete o formato com `CHECK`. `UNIQUE (empresa_id, celular)`; o 409 diz `celular_ja_cadastrado`.
3. **"Excluir" = `DELETE` real** (só Dono, irreversível, a pedido do cliente). O runtime tem `DELETE` em `clientes`. Na S10 a venda apontará para o cliente com `ON DELETE SET NULL` (linha some, a venda permanece sem dado pessoal). Alternativa leve: **inativar** (`ativo = false`): some da busca padrão, o número **continua reservado**, dá para reativar.
4. **Editar nome e celular** (`PUT /clientes/{id}`, Dono e Vendedor). Sem mudança real não grava nem audita. Celular segue único por empresa.
5. **Aviso de finalidade (LGPD).** `aviso_lgpd_em` no cadastro ou na ficha; repetir **mantém a data do primeiro aviso** (evidência, AUD-90). Dono e Vendedor registram; só o Dono inativa, reativa, exclui e lista inativos (RN-10).
6. **Privilégios por coluna.** O runtime atualiza `nome`, `celular`, `aviso_lgpd_em` e `ativo`; quem criou e quando nunca se reescrevem. Há `DELETE` (exclusão) e não há mais `anonimizado_em`.
7. **Auditoria sem dado pessoal.** Eventos `cliente_criado`, `cliente_editado`, `cliente_aviso_lgpd`, `cliente_inativado`, `cliente_reativado`, `cliente_excluido` guardam autor e id, nunca nome ou celular (AUD-10).
8. **Log sem dado pessoal.** A busca leva nome/celular na query string; o serializador de requisições **descarta a query string** (`app.ts`), com teste.
9. **Histórico de compras.** A tabela de vendas nasce na S10. A ficha entrega a seção "Compras" vazia; a S10 acrescenta a consulta (RF-CLI-02 fecha lá).

## Alternativas consideradas

1. **"Excluir" = anonimizar, sem `DELETE`.** Adotada na S09; **revogada pelo Pedro** na S09b: exclusão deve apagar a linha (ou inativar). A anonimização liberava o número via `NULL` no `UNIQUE`, mas não atendia "excluir é excluir".
2. **Apagar o nome mas guardar o celular em hash.** Descartada: hash de celular é reversível por força bruta.
3. **Só inativar, sem `DELETE`.** Descartada: o pedido do cliente de apagar o dado exige remoção; inativar serve para tirar da lista sem liberar o número.
4. **Busca por `POST` para o texto não ir na URL.** Descartada: o log resolve no serializador.
5. **Celular fixo permitido.** Descartada (D8): o canal é o WhatsApp.

## Consequências

- Vendas (S10) usam `clientes.id` com `ON DELETE SET NULL`; inativo ainda existe e pode ser reativado.
- Exclusão pede confirmação na UI; segunda exclusão do mesmo id dá 404.
- Inativar reserva o número: cadastro com o mesmo celular de um inativo dá `409 celular_ja_cadastrado` (a mensagem aponta o Dono).
- Backups anteriores à exclusão ainda podem guardar o dado até expirarem (retenção na S14).
- O evento `cliente_anonimizado` deixa de existir; quem já leu a S09 deve olhar esta revisão.
