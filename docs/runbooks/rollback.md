# Runbook: rollback (voltar para a versão anterior)

- **Serviço:** Ailow Cloud · **Dono:** Pedro · **Última revisão:** 2026-11-12 · **Ensaiado:** nunca **[NÃO VERIFICADO — S14]** · tempo medido: __ min
- Regras: OPS-05/06/11, AUD-24. Princípio: **voltar o código primeiro (barato, seguro); mexer no banco só se for inevitável.**

## 1. Sintoma (quando usar)
Gatilho do deploy: `GET /health` ≠ 200 em 3 checagens seguidas, 5xx > 1 % nas rotas de venda, fluxo do smoke falhando, ou perda/corrupção de dados suspeita (esta última vai direto para §4).

## 2. Confirmar
- `docker compose ps` e `curl -fsS http://127.0.0.1:3000/health`.
- `docker compose logs --since 15m api` (procure `request_id` do erro) e `docker compose logs migrate` (a migração falhou? aplicou parcialmente?).
- O que mudou: a tag implantada (`git describe --tags`) e se a versão trouxe migração (`apps/api/migrations/` entre as duas tags).

## 3. Mitigar (em ordem — do mais barato ao mais invasivo)

### 3.1 Versão **sem migração nova**, ou migração compatível com a anterior (caso normal — OPS-11)
```bash
git fetch --tags && git checkout vANTERIOR     # a tag anterior registrada no release
docker compose up -d --build                   # `migrate` não tem nada novo a aplicar
curl -fsS http://127.0.0.1:3000/health
```
O banco fica como está: a versão anterior tem de funcionar com o schema novo (é o que a regra expand → migrate → contract garante; a migração `20261117120000_vendas-fk-adiavel`, por exemplo, só torna FKs adiáveis — pela leitura, a versão antiga continua válida; não ensaiado). Se a versão a ser abandonada fez o **"contract"** (removeu coluna/tabela que a anterior usa), este caminho **não vale**: ir para 3.2.

### 3.2 Migração incompatível com a versão anterior
1. Parar a escrita: `docker compose stop api` (o app fica fora; avisar a loja).
2. **Antes de qualquer coisa**, tirar um backup do estado atual (para não perder as vendas feitas depois do deploy): ver [`migrar-vps.md` §3](migrar-vps.md).
3. Desfazer a migração: todas as migrações têm `-- Down Migration`. Com a imagem **da versão nova** (a que conhece a migração):
   ```bash
   docker compose run --rm migrate node ../../node_modules/node-pg-migrate/bin/node-pg-migrate.js \
     -m migrations --migrations-table pgmigrations down 1
   ```
   `down` perde o que a migração criou (colunas/tabelas novas e seus dados). Só com o backup do passo 2 em mãos.
4. Subir a versão anterior: `git checkout vANTERIOR && docker compose up -d --build`; conferir `/health` e o smoke.
5. Se o `down` falhar ou o banco ficar inconsistente: **restaurar o backup do §3 do deploy** (pré-deploy) — perde as vendas posteriores a ele; decisão do Pedro com o Dono da loja.

### 3.3 Tag anterior não construída / registro de imagens
Hoje a imagem é construída na própria VPS a partir da tag (sem registro). Se a S14 adotar registro de imagens, o rollback passa a ser "apontar o compose para o digest anterior" — atualizar este runbook.

## 4. Suspeita de perda ou exposição de dados
Parar a `api` (`docker compose stop api`), **não** apagar nada, preservar logs e o volume, e seguir `harness/checklists/incidente.md`. Não rodar `down -v`.

## 5. Depois
Postmortem sem culpa (`harness/templates/postmortem.md`), com ações, dono e prazo; lição no registro (MC); registrar no release: versão revertida, motivo, duração da indisponibilidade, **tempo medido: __ min** (alimenta o MTTR, OPS-01).

## Não verificado (depende da S14)
Todo o procedimento em VPS; o `down` de cada migração contra dados reais; backup/restore reais; tempo de rollback; existência de registro de imagens.
