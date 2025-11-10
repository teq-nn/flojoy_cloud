#!/usr/bin/env bash
set -euo pipefail

# Generate a locally-trusted certificate using mkcert
# Prereqs: mkcert installed on your machine (https://github.com/FiloSottile/mkcert)
# Usage: scripts/tls/gen-mkcert.sh <hostname-or-ip>
# Output: nginx/certs/fullchain.pem and nginx/certs/privkey.pem

HOST=${1:-}
if [[ -z "${HOST}" ]]; then
  echo "Usage: $0 <hostname-or-ip>" >&2
  exit 1
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Install from https://github.com/FiloSottile/mkcert and re-run." >&2
  exit 1
fi

echo "Ensuring local root CA is installed (may prompt for password)"
mkcert -install

mkdir -p nginx/certs

TMP_DIR=$(mktemp -d)
pushd "${TMP_DIR}" >/dev/null

echo "Generating mkcert cert for ${HOST}"
mkcert "${HOST}"

# mkcert outputs <HOST>-key.pem and <HOST>.pem
KEY_SRC=( *-key.pem )
CRT_SRC=( *.pem )

cp "${KEY_SRC[0]}" "${OLDPWD}/nginx/certs/privkey.pem"
cp "${CRT_SRC[0]}" "${OLDPWD}/nginx/certs/fullchain.pem"

popd >/dev/null
rm -rf "${TMP_DIR}"

echo "\nDone. Certs written to nginx/certs/."
echo "NOTE: Other devices will only trust this cert if their trust store includes the mkcert root CA as well."
echo "For a publicly trusted cert for all devices, use Let's Encrypt with a real domain."

