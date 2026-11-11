# Contexto de build = raiz do repositório (monorepo com workspaces):
#   docker build -f apps/api/Dockerfile .
# Comentários sempre em linha própria (L-0001): o Docker não aceita comentário na mesma linha da instrução.

# ---- build: instala tudo, compila shared e api ----
FROM node:22.23.4-alpine3.24 AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --ignore-scripts: nenhum script de terceiros roda no build (o embedded-postgres de dev não é usado aqui).
RUN npm ci --ignore-scripts --workspace=@ailow/api --workspace=@ailow/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @ailow/shared && npm run build -w @ailow/api

# ---- runtime: só dependências de produção, usuário não-root ----
FROM node:22.23.4-alpine3.24 AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --ignore-scripts --workspace=@ailow/api --workspace=@ailow/shared \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/migrations apps/api/migrations
# Usuário "node" (uid 1000) já existe na imagem oficial. USER vem depois de instalar/copiar (ENV-06).
USER node
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
