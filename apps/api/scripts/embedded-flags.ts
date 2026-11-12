// Flags do `initdb` do Postgres EMBUTIDO (testes locais e `dev:db`). Sem elas o cluster nasce na codificação do Windows
// (WIN1252): emoji e outros caracteres fora dela davam 500, só aqui e nunca no Postgres do Docker (UTF-8).
// ICU pt-BR dá UTF-8, `lower()` correto com acento (a unicidade usa lower(btrim(nome))) e ordenação em português.
// Só vale para cluster NOVO; um `.dev-data/pg` antigo continua em WIN1252 até ser recriado (S13a).
export const INITDB_FLAGS = ['--encoding=UTF8', '--locale-provider=icu', '--icu-locale=pt-BR', '--locale=C'];
