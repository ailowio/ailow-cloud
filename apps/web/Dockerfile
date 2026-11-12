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
RUN npm run build -w @ailow/shared && npm run build -w @ailow/web

# ---- runtime: nginx sem root, só arquivos estáticos + proxy da API ----
# Esta imagem escuta na 8080 (não precisa de privilégio). Nada de Node, npm ou código-fonte aqui.
FROM nginxinc/nginx-unprivileged:1.29.3-alpine3.22 AS runtime
COPY ops/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
