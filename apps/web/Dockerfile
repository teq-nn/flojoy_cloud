# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Copy root manifests for monorepo workspaces and package manifests used by web
COPY bun.lock package.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install all workspace deps at the monorepo root
RUN bun install

# Build-time env for Vite
ARG VITE_SERVER_URL=/api
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

# Copy the sources needed for building the web app
COPY packages/shared ./packages/shared
COPY packages/tsconfig ./packages/tsconfig
COPY packages/eslint-config ./packages/eslint-config
COPY apps/server /app/apps/server
COPY apps/web /app/apps/web

# Build web
WORKDIR /app/apps/web
RUN bun run build

# ---------- serve ----------
FROM nginx:alpine AS serve
# Default Nginx config will be mounted via compose (nginx/nginx.conf)
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
