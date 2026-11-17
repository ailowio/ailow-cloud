# Pacote de entrega do Moodle — checklist

> **Nada aqui é enviado sem pedido explícito do Pedro.** Estado em 2026-11-16. ✅ pronto e conferido · 🟡 depende de passo do Pedro · ⬜ falta.
> Prazo e campos da tarefa: o aulão 07 falou em "até dia 16 de novembro"; **o enunciado do Moodle não está espelhado aqui: confirmar no Moodle** o prazo real e se pede link, arquivo (.zip) ou os dois.

## Links do pacote

| Item | Valor | Situação |
|---|---|---|
| Repositório (público) | <https://github.com/ailowio/ailow-cloud> | ✅ público (conferido com `gh repo view`) |
| App no ar | <https://cloud.ailow.com.br> | ✅ no ar com a `v1.0.1`; 🟡 a versão com a rodada de UX só entra depois do merge dos PRs #34/#35 e de um deploy autorizado |
| Vídeo | _colar aqui o link depois de gravar_ | ⬜ roteiro pronto em [`roteiro-video.md`](roteiro-video.md); gravação e upload: Pedro |
| Texto-guia | [`docs/entrega/texto-guia.md`](texto-guia.md) | ✅ |
| Desempenho (slide do curso) | [`docs/desempenho.md`](../desempenho.md) | ✅ |
| Uso de IA (slide do curso) | [`docs/ia.md`](../ia.md) | ✅ |
| Tag / release | `v1.0.1` existe; próxima (`v1.1.0`, rodada de UX) | 🟡 tag e CHANGELOG da versão nova só com autorização (depois do merge) |

## Antes de enviar

- [ ] Confirmar no Moodle: prazo, campos (link? .zip?), se o professor precisa de acesso extra (o repo é público; acesso ao app: usar uma conta de demonstração, nunca a do cliente).
- [ ] Merge dos PRs #34 e #35 (revisão humana) e deploy autorizado, se o vídeo for mostrar a versão nova em produção.
- [ ] Conta de demonstração para o professor (e-mail + senha do Dono de um tenant de teste) **entregue por canal privado do Moodle, nunca no repositório**.
- [ ] Gravar o vídeo pelo roteiro; conferir a lista "O que NÃO mostrar".
- [ ] Colar o link do vídeo na tabela acima e em `docs/prd-checklist-10.md` item 9.
- [ ] Se o Moodle pedir arquivo: `git archive --format=zip -o ailow-cloud.zip <tag>` (sai só o que está versionado, sem `.env` nem `acervo/`).
- [ ] Envio: **só com pedido explícito do Pedro.**

## Evidência por critério

O mapa "critério → arquivo → como conferir" está no [texto-guia](texto-guia.md); o estado honesto de cada critério do PRD §10 está em [`docs/prd-checklist-10.md`](../prd-checklist-10.md) (itens 8 e 9 são os do curso).
