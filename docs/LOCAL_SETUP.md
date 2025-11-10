# Local Development Setup

## Prerequisites
- Bun 1.x installed (`curl -fsSL https://bun.sh/install | bash`)
- Docker (for local Postgres via `docker-compose.dev.yml`)
- Optional: `just` (`cargo install just`) and Poetry (`pipx install poetry`) for Python SDK

## Install Dependencies
- From repo root: `bun install`
- Optional full bootstrap: `just install` (installs Bun deps and Python deps)

## Environment Configuration
- Server env: create `apps/server/.env` with:
  - `DATABASE_URL=postgres://user:password@localhost:5432/flojoy-cloud`
  - `JWT_SECRET=<long-random-string>`
  - `WEB_URI=localhost:5173`
  - `PORT=3000`
  - Optional OAuth: values from the sections below
    - `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Web env: create `apps/web/.env` with:
  - `VITE_SERVER_URL=http://localhost:3000`

## Microsoft Entra ID (Microsoft Login)
1. Microsoft Entra admin center → App registrations → New registration.
2. Platform: Web. Redirect URI: `http://localhost:3000/auth/entra/callback`.
3. Copy IDs to `apps/server/.env`:
   - Directory (tenant) ID → `ENTRA_TENANT_ID`
   - Application (client) ID → `ENTRA_CLIENT_ID`
4. Certificates & secrets → New client secret → copy Value → `ENTRA_CLIENT_SECRET`.
5. Permissions: Microsoft Graph delegated `openid`, `profile`, `email` (consent if required).
6. Ensure `ENTRA_REDIRECT_URI=http://localhost:3000/auth/entra/callback` in `.env`.

### Entra over HTTPS (non-localhost)
- Entra requires an HTTPS redirect URI for non-localhost hosts. For access from other devices or production:
  - Choose a hostname (e.g., `cloud.local` or a real domain) and serve the site over HTTPS.
  - Set in `apps/server/.env`:
    - `WEB_URI=https://<HOSTNAME>`
    - `ENTRA_REDIRECT_URI=https://<HOSTNAME>/auth/entra/callback`
  - Recommended: proxy the API through nginx on the same HTTPS origin to avoid CORS:
    - `apps/web/.env` → `VITE_SERVER_URL=https://<HOSTNAME>/api`
    - In `apps/web/nginx.conf`, add:
      - `location /api { proxy_pass http://flojoy_server:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`
      - `location /auth/entra/ { proxy_pass http://flojoy_server:3000; proxy_set_header Host $host; }`
  - Terminate TLS in nginx (self-signed for LAN via mkcert or a real cert for public). Expose port 443 and point Entra to `https://<HOSTNAME>/auth/entra/callback`.

## Google OAuth (Google Login)
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID.
2. Application type: Web application.
3. Authorized redirect URI: `http://localhost:3000/auth/google/callback`.
4. Copy Client ID/Secret to `apps/server/.env`:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
5. Set `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`.

## Database
- Start Postgres: `just postgres` (uses `docker-compose.dev.yml`)
- Apply migrations: `cd apps/server && bun run migrate:to-latest`

## Run Apps
- Backend (dev): `cd apps/server && bun run dev` (serves on `http://localhost:3000`)
- Frontend (dev): `cd apps/web && bun run dev` (serves on `http://localhost:5173`)
- Or run both via Turbo from root: `bun run dev`

## Notes
- CORS uses `WEB_URI`; if you change the web port/host, update and restart the server.
- For localhost, secure cookies are disabled automatically in dev so OAuth callbacks work over HTTP.

## Version Compatibility
- Eden/Elysia:
  - `elysia`: 1.0.10
  - `@elysiajs/eden`: 1.0.8
  - Using newer Eden versions (>=1.4.x) with Elysia 1.0.x causes a TypeScript error like: “Please install Elysia before using Eden”. If you see this, pin Eden to 1.0.8 or upgrade Elysia across the repo.
- TanStack Router:
  - `@tanstack/react-router`: 1.26.18
  - `@tanstack/router-devtools`: 1.26.18
  - `@tanstack/router-vite-plugin`: 1.25.0
  - Newer 1.13x versions change context/params inference and will break type checks in this codebase.

## Docker Notes
- The web compose file installs dependencies at the monorepo root to dedupe workspace deps. Run from the repo root when using compose.
- Husky warning during install ("git command not found") is harmless inside containers. To silence: set `HUSKY=0` in the environment for the build step.

## Access From Other Devices (LAN)
- When you want to access the UI from another device on your network:
  - Set `apps/web/.env` → `VITE_SERVER_URL=http://<HOST_IP>:3000`
  - Set `apps/server/.env` → `WEB_URI=http://<HOST_IP>`
  - Rebuild the web SPA (value is embedded at build time):
    - `docker compose -f docker-compose.web.yml up --build -d --force-recreate`
  - Restart the server (to pick up `WEB_URI`):
    - `docker compose -f docker-compose.server.yml up -d --force-recreate`
  - Then open `http://<HOST_IP>` from other devices.

### Optional: Avoid Rebuilds via Proxy
- You can avoid IP-specific rebuilds by letting nginx proxy to the API:
  - Set `apps/web/.env` → `VITE_SERVER_URL=http://<HOST_IP>/api` (or `https://<HOSTNAME>/api` with TLS)
  - In `apps/web/nginx.conf`, add a proxy location (example):
    - `location /api { proxy_pass http://flojoy_server:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`
  - Start both stacks in one network: `docker compose -f docker-compose.server.yml -f docker-compose.web.yml up --build -d`
  - Now the browser uses same-origin `/api` (no CORS), and nginx forwards to the server.

## HTTPS with Nginx (TLS)
- Use the provided TLS config and compose file to serve HTTPS on 443 and proxy API/auth to the server:
  - Config: `apps/web/nginx.tls.conf`
  - Compose: `docker-compose.web.tls.yml`
  - Certificate guide & scripts: `docs/TLS_CERTS.md`, `scripts/tls/gen-selfsigned.sh`, `scripts/tls/gen-mkcert.sh`
- Steps:
  1) Generate or obtain certs and place them in `nginx/certs/` as `fullchain.pem` and `privkey.pem`.
     - See `docs/TLS_CERTS.md` for mkcert, self-signed, or Let's Encrypt options.
  2) Set envs:
     - `apps/web/.env`: `VITE_SERVER_URL=https://<HOSTNAME>/api`
     - `apps/server/.env`: `WEB_URI=https://<HOSTNAME>` and update OAuth redirects accordingly (e.g., Entra/Google).
  3) Start both together so nginx can proxy to the server container:
     - `docker compose -f docker-compose.server.yml -f docker-compose.web.tls.yml up --build -d`
  4) Visit `https://<HOSTNAME>`.
