#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "This script must be run as root (inside the LXC container)." >&2
  exit 1
fi

APP_USER=${APP_USER:-flojoy}
APP_DIR=${APP_DIR:-/opt/flojoy-cloud}
REPO_URL=${REPO_URL:-https://github.com/teq-nn/flojoy_cloud.git}
REPO_REF=${REPO_REF:-main}
VITE_SERVER_URL=${VITE_SERVER_URL:-http://localhost:3000}
WEB_BUILD_DIR=${WEB_BUILD_DIR:-apps/web}
WEB_DIST_DIR=${WEB_DIST_DIR:-/var/www/flojoy-web}

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx rsync

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${APP_USER}"
fi

BUN_INSTALL_DIR=${BUN_INSTALL_DIR:-/opt/bun}
if [[ ! -x "${BUN_INSTALL_DIR}/bin/bun" ]]; then
  mkdir -p "${BUN_INSTALL_DIR}"
  curl -fsSL https://bun.sh/install | BUN_INSTALL="${BUN_INSTALL_DIR}" bash
fi

if [[ ! -e /usr/local/bin/bun ]]; then
  ln -sf "${BUN_INSTALL_DIR}/bin/bun" /usr/local/bin/bun
fi
BUN_BIN="${BUN_INSTALL_DIR}/bin/bun"

if [[ ! -d "${APP_DIR}" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

git fetch --all --tags
if git rev-parse --verify --quiet "${REPO_REF}"; then
  git checkout "${REPO_REF}"
elif git rev-parse --verify --quiet "origin/${REPO_REF}"; then
  git checkout -B "${REPO_REF}" "origin/${REPO_REF}"
else
  echo "Unable to find ref '${REPO_REF}'." >&2
  exit 1
fi

if git rev-parse --verify --quiet "origin/${REPO_REF}"; then
  git pull --ff-only origin "${REPO_REF}"
fi

chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

runuser -u "${APP_USER}" -- mkdir -p "${APP_DIR}/${WEB_BUILD_DIR}"

WEB_ENV_FILE="${APP_DIR}/${WEB_BUILD_DIR}/.env.production"
cat > "${WEB_ENV_FILE}" <<EOW
VITE_SERVER_URL=${VITE_SERVER_URL}
EOW
chown "${APP_USER}:${APP_USER}" "${WEB_ENV_FILE}"

runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}' && '${BUN_BIN}' install"
runuser -u "${APP_USER}" -- bash -lc "cd '${APP_DIR}/${WEB_BUILD_DIR}' && '${BUN_BIN}' run build"

install -d -o "${APP_USER}" -g "${APP_USER}" "${WEB_DIST_DIR}"
rsync -a --delete --chown="${APP_USER}:${APP_USER}" "${APP_DIR}/${WEB_BUILD_DIR}/dist/" "${WEB_DIST_DIR}/"

NGINX_SITE=/etc/nginx/sites-available/flojoy-web
cat > "${NGINX_SITE}" <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;
    root /var/www/flojoy-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
}
NGINX

ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/flojoy-web
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Flojoy Cloud web frontend is deployed to ${WEB_DIST_DIR} and served via nginx."
