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
  - `DATABASE_URL=postgres://user:password@0.0.0.0:5432/flojoy-cloud`
  - `JWT_SECRET=<long-random-string>`
  - `WEB_URI=0.0.0.0:5173`
  - `PORT=3000`
  - Optional OAuth: values from the sections below
    - `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_REDIRECT_URI`
    - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Web env: create `apps/web/.env` with:
  - `VITE_SERVER_URL=http://0.0.0.0:3000`

## Microsoft Entra ID (Microsoft Login)
1. Microsoft Entra admin center → App registrations → New registration.
2. Platform: Web. Redirect URI: `http://0.0.0.0:3000/auth/entra/callback`.
3. Copy IDs to `apps/server/.env`:
   - Directory (tenant) ID → `ENTRA_TENANT_ID`
   - Application (client) ID → `ENTRA_CLIENT_ID`
4. Certificates & secrets → New client secret → copy Value → `ENTRA_CLIENT_SECRET`.
5. Permissions: Microsoft Graph delegated `openid`, `profile`, `email` (consent if required).
6. Ensure `ENTRA_REDIRECT_URI=http://0.0.0.0:3000/auth/entra/callback` in `.env`.

## Google OAuth (Google Login)
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID.
2. Application type: Web application.
3. Authorized redirect URI: `http://0.0.0.0:3000/auth/google/callback`.
4. Copy Client ID/Secret to `apps/server/.env`:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
5. Set `GOOGLE_REDIRECT_URI=http://0.0.0.0:3000/auth/google/callback`.

## Database
- Start Postgres: `just postgres` (uses `docker-compose.dev.yml`)
- Apply migrations: `cd apps/server && bun run migrate:to-latest`

## Run Apps
- Backend (dev): `cd apps/server && bun run dev` (serves on `http://0.0.0.0:3000`)
- Frontend (dev): `cd apps/web && bun run dev` (serves on `http://0.0.0.0:5173`)
- Or run both via Turbo from root: `bun run dev`

## Notes
- CORS uses `WEB_URI`; if you change the web port/host, update and restart the server.
- For 0.0.0.0/localhost, secure cookies are disabled automatically in dev so OAuth callbacks work over HTTP.
