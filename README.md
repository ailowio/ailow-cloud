# Ailow Cloud

ERP mobile multi-tenant para lojistas pequenos: vender pelo celular com QR code, estoque e financeiro integrados, botões grandes para quem não é da tecnologia. Primeiro cliente e caso de uso: Marcant Moda Íntima (`acervo/marcant/`).

**Tier do harness:** B · **Projeto Final (curso):** nível A · **Estado:** fundação em construção (sessão S03 de 14).

## Como rodar (front-end / catálogo do Design System)

```bash
npm install
npm run dev -w apps/web     # http://localhost:5173
npm run verify              # tipos + testes + build
```

Requisitos: Node 22+. A API, o Postgres e o Docker Compose entram na S03 (ver `docs/plano-execucao.md`).

## Documentação

| Doc | Onde |
|---|---|
| PRD | `docs/prd/PRD-ailow-cloud-v1.md` |
| Plano de execução e diário | `docs/plano-execucao.md` |
| Design System | `docs/design-system/README.md` |
| Pesquisas (produto, etiqueta QR, Instagram) | `docs/pesquisa/` |
| Discovery do cliente piloto | `acervo/marcant/discovery/` (brutos com PII ficam fora do git) |

Regras de engenharia: harness em `D:\apps\harness\PROTOCOLO.md` (repositório pessoal do autor).
