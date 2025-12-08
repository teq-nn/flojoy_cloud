# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed by Turbo and Bun.
- Apps: `apps/server` (Bun + Elysia API), `apps/web` (Vite + React UI).
- Packages: `packages/shared` (shared code), `packages/tsconfig`, `packages/eslint-config`, `packages/python` (Poetry package with tests).
- Docs & examples: `docs/`, `examples/`. Environment templates: `.env.example` in root and per app.
- Key prod doc: `docs/DEPLOY_PROD.md` (single-host compose + Nginx/NPM proxy).

## Build, Test, and Development Commands
- Install (JS + Python): `just install` (runs `bun install` and Poetry install).
- Develop (all): `bun dev` or `just dev` (Turbo spawns app dev servers).
- Build (all): `bun run build` (Turbo builds workspaces).
- Lint: `bun run lint` (ESLint via Turbo). Format: `just format` (Prettier + Ruff).
- App-specific:
  - Server: `cd apps/server && bun run dev | bun run build | bun test`.
  - Web: `cd apps/web && bun run dev | bun run build`.
  - Python: `cd packages/python && poetry run pytest`.
- Postgres (local): `docker compose -f docker-compose.dev.yml up` or `just postgres`.

## Coding Style & Naming Conventions
- TypeScript/JS: Prettier (Tailwind plugin) + ESLint via `@cloud/eslint-config/*`. Indent 2 spaces.
- Python: Ruff for format/lint (`just packages/python/format`, `lint`).
- Naming: camelCase variables, PascalCase React components (`src/components/MyWidget.tsx`), kebab-case folders/files where applicable (`src/routes/user-settings.ts`).

## Testing Guidelines
- Server: Bun test runner (`bun test`) with files like `*.test.ts`/`*.spec.ts`.
- Python: Pytest in `packages/python/tests` (pattern `*_test.py`). Run with `poetry run pytest`.
- No strict coverage gate defined; include meaningful unit tests for new code.

## Commit & Pull Request Guidelines
- Conventional Commits enforced by Commitlint (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `ci:`).
- Before pushing: run `bun run lint` and `just format` (and tests where relevant).
- PRs: include a clear description, link related issues, and add screenshots/GIFs for UI changes. Note any env vars or migration steps.

## Security & Configuration Tips
- Copy `.env.example` to `.env` in root, `apps/server`, and `apps/web`. Never commit secrets.
- Local config: `docs/LOCAL_SETUP.md`; LAN/split-host: `docs/DEPLOY_LOCAL_NETWORK.md`; prod single-host: `docs/DEPLOY_PROD.md`.
- Prod compose (`docker-compose.prod.yml`): web served by internal Nginx, proxies `/api` and `/auth` to server; host port 5173 -> web:80. Use `apps/web/.env` `VITE_SERVER_URL=/api` and `apps/server/.env` `WEB_URI=<public-host>` (no scheme).
- If fronted by Nginx Proxy Manager/NGINX, forward `<public-host>` to `http://127.0.0.1:5173`; avoid custom locations. To prevent header-size 502s, add location-safe buffer overrides (e.g., `proxy_buffer_size 128k; proxy_buffers 16 256k; proxy_busy_buffers_size 256k; proxy_temp_file_write_size 256k; proxy_read_timeout 300s;`).
