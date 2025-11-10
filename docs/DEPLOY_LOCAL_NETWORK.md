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
    - If using Microsoft Entra from other devices, Entra requires HTTPS for non-localhost:
      - Use a hostname and TLS (see below) and set `WEB_URI=https://<HOSTNAME>`.
      - Set `ENTRA_REDIRECT_URI=https://<HOSTNAME>/auth/entra/callback`.

- Bring up server + db:

  docker compose -f docker-compose.server.yml up -d --pull=always

- The API is available on `http://<SERVER_HOST_IP>:3000`.

2) Web Host Setup

On the machine that will serve the web app:

- Create web env file:
  - Copy `apps/web/.env.example` to `apps/web/.env`.
  - Set `VITE_SERVER_URL=http://<SERVER_HOST_IP>:3000` (use the server machine's IP so other devices don't call their own `localhost`).

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

HTTPS & Entra (Microsoft Login)
- For non-localhost Entra redirects, configure HTTPS for the web host:
  - Terminate TLS in nginx on the web host (`apps/web/nginx.conf`): listen on 443 with your certificate.
  - Proxy the API and Entra callbacks through nginx to the server container:
    - `location /api { proxy_pass http://flojoy_server:3000; }`
    - `location /auth/entra/ { proxy_pass http://flojoy_server:3000; }`
  - Set envs:
    - Web: `VITE_SERVER_URL=/api`
    - Server: `WEB_URI=https://<HOSTNAME>`, `ENTRA_REDIRECT_URI=https://<HOSTNAME>/auth/entra/callback`
  - Register the exact `https://<HOSTNAME>/auth/entra/callback` in Entra App registrations.

Same-Host, Single Compose, and Optional Proxy
- If both web and server run on the same machine and you want users to access the web via `http://<HOST_IP>`:
  - Server CORS `WEB_URI` must equal `http://<HOST_IP>`.
  - Web `VITE_SERVER_URL` must point to `http://<HOST_IP>:3000` unless you proxy.
- To avoid rebuilding when the host IP changes, configure nginx to proxy API calls:
  - Set `VITE_SERVER_URL=/api` in `apps/web/.env` and add to `apps/web/nginx.conf`:
    - `location /api { proxy_pass http://flojoy_server:3000; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }`
  - Start both stacks in one network:
    - `docker compose -f docker-compose.server.yml -f docker-compose.web.yml up --build -d`
  - Now the UI uses same-origin `/api` and no CORS configuration is required.

HTTPS with Nginx
- Use the TLS-ready config and compose override when serving over HTTPS:
  - `apps/web/nginx.tls.conf` (listens on 80 → 443 redirect, and 443 with TLS)
  - `docker-compose.web.tls.yml` (mounts certs from `nginx/certs/` and exposes 443)
- Steps:
  1) Place `fullchain.pem` and `privkey.pem` in `nginx/certs/`.
  2) Set web `VITE_SERVER_URL=/api` and server `WEB_URI=https://<HOSTNAME>`.
  3) Start both services together: `docker compose -f docker-compose.server.yml -f docker-compose.web.tls.yml up --build -d`
  4) Register exact HTTPS callback URIs with identity providers (e.g., Entra: `https://<HOSTNAME>/auth/entra/callback`).

Troubleshooting
- Ports not reachable from other machines: Ensure host firewalls allow 80 and 3000. Use the host IP (e.g., `192.168.1.x`) not `localhost`.
- CORS errors: Double-check `WEB_URI` and `VITE_SERVER_URL`. They must be full URLs and correct for your LAN.
- Missing env var errors: Verify `apps/server/.env` has `JWT_SECRET` and others filled.
