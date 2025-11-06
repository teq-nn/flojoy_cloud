#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Warning: DATABASE_URL is not set. Skipping preflight check."
else
  echo "DATABASE_URL detected."
fi

if [[ ! -d "apps/server/dist" ]] || [[ ! -d "apps/web/dist" ]]; then
  echo "Building workspaces before start..."
  bun run build
fi

exec "$@"
