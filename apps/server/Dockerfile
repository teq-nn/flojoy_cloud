# ---------- deps & build ----------
FROM oven/bun:1 AS base
WORKDIR /app

# Copy only the server package and repo lockfiles to speed up caching.
# If you have a root package.json/bun.lockb that matters for workspace resolution,
# bring them in as well.
COPY bun.lockb package.json turbo.json ./
COPY apps/server/package.json apps/server/bun.lockb ./apps/server/
# If you rely on workspaces, also copy the relevant packages; otherwise, copy the server app later.
# Install only server deps
WORKDIR /app/apps/server
RUN bun install --frozen-lockfile

# ---------- runtime ----------
FROM oven/bun:1 AS runtime
WORKDIR /app

# Copy installed deps and app source
COPY --from=base /app/apps/server/node_modules /app/apps/server/node_modules
COPY apps/server /app/apps/server

WORKDIR /app/apps/server

# Optional: if your server exposes a health endpoint at /health, keep it.
EXPOSE 3000

# Run migrations before start; fail fast on error
# Adjust the script names if they differ.
CMD bun run migrate:to-latest && bun run start
