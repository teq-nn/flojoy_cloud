# ---------- deps & build ----------
FROM oven/bun:1 AS base
WORKDIR /app

# Copy root and workspace package manifests for dependency resolution
COPY package.json turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install workspace deps at the monorepo root so workspace:* links resolve
RUN bun install

# Now bring in the actual sources needed to build the server
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Build the server
WORKDIR /app/apps/server
RUN bun run build

# ---------- runtime ----------
FROM oven/bun:1 AS runtime
WORKDIR /app

# Bring the full /app from build stage to preserve workspace links and sources
COPY --from=base /app /app

WORKDIR /app/apps/server
EXPOSE 3000
CMD ["bun","run","start"]
