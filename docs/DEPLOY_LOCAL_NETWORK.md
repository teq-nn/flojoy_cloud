Deploy on Local Network (Two Hosts)

This guide splits the stack across two machines on the same LAN:

- Server host: API server + Postgres (exposes 3000, 5432)
- Web host: Static SPA served by nginx (exposes 80)

Prerequisites
- Both hosts have Docker and Docker Compose installed.
- Clone this repository on both hosts so compose can mount the workspace.
- Copy `.env.example` to `.env` where applicable and fill secrets.

1) Server Host Setup

On the machine that will run the API and DB:

- Create server env file:
  - Copy `apps/server/.env.example` to `apps/server/.env`.
  - Set at minimum:
    - `JWT_SECRET=...` (required)
    - `DATABASE_URL=postgresql://user:password@db:5432/flojoy-cloud` (or keep default)
    - `WEB_URI=http://<WEB_HOST_IP>` (must match the browser origin exactly, e.g. `http://192.168.1.20`)

- Bring up server + db:

  docker compose -f docker-compose.server.yml up -d --pull=always

- The API is available on `http://<SERVER_HOST_IP>:3000`.

2) Web Host Setup

On the machine that will serve the web app:

- Create web env file:
  - Copy `apps/web/.env.example` to `apps/web/.env`.
  - Set `VITE_SERVER_URL=http://<SERVER_HOST_IP>:3000`.

- Build and serve the web app:

  docker compose -f docker-compose.web.yml up --build -d

- The UI is available at `http://<WEB_HOST_IP>`.

Notes & Tips
- CORS: The server enforces CORS using `WEB_URI`. Ensure it equals the web origin the browser uses (e.g., `http://192.168.1.20`).
- Cookies/Auth: Cross-origin cookies may require `SameSite=None; Secure`. If login flows fail in browsers over plain HTTP, consider using HTTPS on both hosts or align origins (serve web and API under the same host with different ports) and adjust cookie settings if needed.
- Data persistence: Postgres uses a named volume `pgdata` in `docker-compose.server.yml`.
- Rebuild web when changing `VITE_SERVER_URL`: Any change requires rebuilding the SPA (the build embeds the value).
- Alternative: You can run the server without the DB container by pointing `DATABASE_URL` to an external Postgres.

Version Compatibility & Build Behavior
- The web compose installs dependencies at the repository root to dedupe workspace dependencies (notably `elysia`). Ensure you run compose from the repo root, not a subfolder.
- Dependency versions known to work with this codebase:
  - `elysia`: 1.0.10
  - `@elysiajs/eden`: 1.0.8
  - `@tanstack/react-router`: 1.26.18
  - `@tanstack/router-devtools`: 1.26.18
  - `@tanstack/router-vite-plugin`: 1.25.0
- If you hit TypeScript errors like “Please install Elysia before using Eden”, ensure the versions above are pinned. Mixing Eden >=1.4.x with Elysia 1.0.x will fail type checks.
- Husky may warn "git command not found" during container builds. This is harmless; set `HUSKY=0` to silence.

Troubleshooting
- Ports not reachable from other machines: Ensure host firewalls allow 80 and 3000. Use the host IP (e.g., `192.168.1.x`) not `localhost`.
- CORS errors: Double-check `WEB_URI` and `VITE_SERVER_URL`. They must be full URLs and correct for your LAN.
- Missing env var errors: Verify `apps/server/.env` has `JWT_SECRET` and others filled.
