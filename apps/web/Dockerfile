# ---------- build ----------
FROM oven/bun:1 AS build
WORKDIR /app

# Copy root locks if needed for workspaces, then the web package
COPY bun.lockb package.json turbo.json ./
COPY apps/web/package.json apps/web/bun.lockb ./apps/web/

WORKDIR /app/apps/web
RUN bun install --frozen-lockfile

# Build-time env for Vite
ARG VITE_SERVER_URL=/api
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

# Copy the rest of the web app source
COPY apps/web /app/apps/web
RUN bun run build

# ---------- serve ----------
FROM nginx:alpine AS serve
# Default Nginx config will be mounted via compose (nginx/nginx.conf)
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
