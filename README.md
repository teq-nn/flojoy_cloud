# Flojoy Cloud

_Open-source system-of-record for hardware validation_

## What’s Inside
- Apps: `apps/server` (Bun + Elysia API) and `apps/web` (Vite + React UI).
- Packages: shared utilities, tsconfig, ESLint config, Python SDK (`packages/python`).
- Dev tooling: Turbo, Bun, Docker Compose.

## Quick Start (Local Dev)
1) Install Bun 1.x and Docker. Optional: `just` and Poetry (for Python SDK).
2) Install deps: `bun install` (or `just install`).
3) Environment:
   - `apps/server/.env` → set `DATABASE_URL`, `JWT_SECRET`, `WEB_URI=localhost:5173`, `PORT=3000`, auth secrets as needed.
   - `apps/web/.env` → `VITE_SERVER_URL=http://localhost:3000` (dev server URL).
4) Run:
   - API: `cd apps/server && bun run dev`
   - Web: `cd apps/web && bun run dev -- --host`
   - Or use the dev compose: `docker compose -f docker-compose.dev.yml up -d` (spins up Postgres + dev servers).

## Quick Start (Production via Docker)
1) Env files:
   - `apps/web/.env`: `VITE_SERVER_URL=/api`
   - `apps/server/.env`: set DB + secrets, `WEB_URI=<public-host>`, `ENTRA_REDIRECT_URI=https://<public-host>/auth/entra/callback`, `PORT=3000`, `NODE_ENV=production`.
2) Build & run:
   - `docker compose -f docker-compose.prod.yml up --build -d`
   - Web container listens on host port 5173 and proxies `/api` + `/auth` to the server.
3) Reverse proxy (e.g., Nginx Proxy Manager):
   - Point `https://<public-host>` to `http://127.0.0.1:5173`.
   - Advanced Nginx snippet (location-safe) to avoid header-size 502s:
     ```
     proxy_buffer_size          128k;
     proxy_buffers              16 256k;
     proxy_busy_buffers_size    256k;
     proxy_temp_file_write_size 256k;
     proxy_read_timeout         300s;
     ```
4) Health checks:
   - `curl -i http://localhost:5173/` (SPA)
   - `curl -i http://localhost:5173/api/health` (API via internal nginx)

## Docs
- Local setup and OAuth details: `docs/LOCAL_SETUP.md`
- Split-host / LAN deploy: `docs/DEPLOY_LOCAL_NETWORK.md`
- Production (single-host) with compose + NPM proxy: `docs/DEPLOY_PROD.md`
- TLS certificates (mkcert, self-signed, Let’s Encrypt): `docs/TLS_CERTS.md`
- Glossary: `docs/cloud-glossary.md`

## Screenshots

Visualize test runs per station

![image](https://github.com/flojoy-ai/cloud/assets/1865834/13b3f86b-0ba8-47e9-bcd5-952e8389a36b)

Register part numbers and define your product's part hierarchy

![image](https://github.com/flojoy-ai/cloud/assets/1865834/eac01599-b01c-4f81-95e9-994c054b9c43)
