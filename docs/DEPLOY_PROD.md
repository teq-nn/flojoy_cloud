# Production Deployment (Single Host)

This is the current, single-compose setup for running the API and web app together on one machine. The web container serves the built SPA via Nginx and proxies `/api` and `/auth` to the server container.

## Prerequisites
- Docker + Docker Compose installed on the host.
- DNS record pointing your public host (e.g., `flojoy.teqsas.de`) to this machine.
- Secrets configured in env files (see below).

## Environment
- `apps/web/.env`
  - `VITE_SERVER_URL=/api` (root-relative so internal Nginx proxies to the server container)
- `apps/server/.env`
  - Required: `DATABASE_URL`, `JWT_SECRET`, `PORT=3000`, `NODE_ENV=production`
  - CORS / cookie origin: `WEB_URI=<public-host>` (no scheme, e.g., `flojoy.teqsas.de`)
  - OAuth: `ENTRA_REDIRECT_URI=https://<public-host>/auth/entra/callback` (and tenant/client IDs + secret)
  - Any other secrets from `.env.example`

## Build & Run
From the repo root:
```
docker compose -f docker-compose.prod.yml up --build -d
```
- The server listens internally on 3000.
- The web container listens on port 80 and is published to host port **5173** (`5173:80`).
- Internal Nginx (inside `web`) proxies `/api` and `/auth` to `server:3000`.

## Reverse Proxy (Nginx Proxy Manager or plain Nginx)
- Forward `https://<public-host>` → `http://127.0.0.1:5173` (HTTP upstream).
- No extra custom locations are needed; `/api` and `/auth` are already handled inside the web container.
- To avoid “upstream sent too big header” on large cookies/headers, add this location-safe snippet in the proxy host’s Advanced config:
  ```
  proxy_buffer_size          128k;
  proxy_buffers              16 256k;
  proxy_busy_buffers_size    256k;
  proxy_temp_file_write_size 256k;
  proxy_read_timeout         300s;
  ```

## Health Checks
- `curl -i http://localhost:5173/`               # SPA via internal Nginx
- `curl -i http://localhost:5173/api/health`     # API via internal Nginx

## TLS
- Terminate TLS at your reverse proxy (NPM/Traefik/nginx) or use the provided TLS configs:
  - See `docs/TLS_CERTS.md` for mkcert/self-signed/Let’s Encrypt.
  - TLS-ready compose: `docker-compose.web.tls.yml` (used with `docker-compose.server.yml`).
- When serving HTTPS:
  - `apps/web/.env`: `VITE_SERVER_URL=https://<public-host>/api`
  - `apps/server/.env`: `WEB_URI=<public-host>` and update OAuth callbacks to `https://<public-host>/auth/entra/callback`.

## Troubleshooting
- 502 from proxy: ensure the stack is up and reachable on `localhost:5173`; verify proxy uses HTTP upstream.
- 502 “too big header” from `flojoy_web_prod`: bump buffers inside the repo Nginx config (`nginx/nginx.conf`) and rebuild `web`.
- CORS/auth issues: `WEB_URI` must match the browser origin; rebuild web if `VITE_SERVER_URL` changes.
