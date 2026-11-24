# Contexto de build = raiz do repositório (monorepo com workspaces):
#   docker build -f apps/web/Dockerfile .
# Comentários sempre em linha própria (L-0001): o Docker não aceita comentário na mesma linha da instrução.

# ---- build: compila o shared e o web (Vite) ----
FROM node:22.23.4-alpine3.24 AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --ignore-scripts: nenhum script de terceiros roda no build.
RUN npm ci --ignore-scripts --workspace=@ailow/web --workspace=@ailow/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
# Tag SemVer (ex.: v1.1.0) entra no rodapé do app; no CI sem ARG fica "dev".
ARG VERSION=dev
ENV VITE_APP_VERSION=$VERSION
RUN npm run build -w @ailow/shared && npm run build -w @ailow/web

# ---- runtime: nginx sem root, só arquivos estáticos + proxy da API ----
# Esta imagem escuta na 8080 (não precisa de privilégio). Nada de Node, npm ou código-fonte aqui.
# 2026-11-24: mainline 1.31.7 em vez da stable 1.30.6 (CVE-2026-113425/121810/123007/123633/118899/123634, corrigidas no
# nginx 1.30.7, que ainda não tem imagem publicada). Voltar para a stable quando sair 1.30.7+ e for mais conservador.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine3.24 AS runtime
# Patches de segurança do Alpine publicados depois da imagem base (gate SEC-12: o Trivy barra CRITICAL/HIGH com correção).
# Custo: o build deixa de ser bit-a-bit reprodutível no tempo (pega o pacote corrigido do dia); aceito, a versão fica
# registrada pelo digest da imagem publicada. Root só neste passo; volta ao usuário nginx (uid 101) logo depois.
USER root
RUN apk upgrade --no-cache
USER 101
COPY ops/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
