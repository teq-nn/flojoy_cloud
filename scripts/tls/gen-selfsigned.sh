#!/usr/bin/env bash
set -euo pipefail

# Generate a self-signed certificate with Subject Alternative Name (SAN)
# Usage: scripts/tls/gen-selfsigned.sh <hostname-or-ip> [days]
# Output: nginx/certs/fullchain.pem and nginx/certs/privkey.pem

HOST=${1:-}
DAYS=${2:-365}

if [[ -z "${HOST}" ]]; then
  echo "Usage: $0 <hostname-or-ip> [days]" >&2
  exit 1
fi

mkdir -p nginx/certs

TMP_CONF=$(mktemp)
cat >"${TMP_CONF}" <<EOF
[ req ]
default_bits        = 4096
prompt              = no
default_md          = sha256
distinguished_name  = dn
req_extensions      = req_ext

[ dn ]
CN = ${HOST}
O  = Flojoy Cloud Dev
OU = Local Development

[ req_ext ]
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = ${HOST}
IP.1  = ${HOST}
EOF

OPENSSL_CONF=$(mktemp)
cat >"${OPENSSL_CONF}" <<EOF
[ v3_ca ]
subjectAltName = @alt_names
basicConstraints = CA:false
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[ alt_names ]
DNS.1 = ${HOST}
IP.1  = ${HOST}
EOF

KEY=nginx/certs/privkey.pem
CRT=nginx/certs/fullchain.pem

echo "Generating key: ${KEY}"
openssl genrsa -out "${KEY}" 4096 >/dev/null 2>&1

echo "Generating cert: ${CRT} (CN=${HOST}, ${DAYS} days)"
openssl req -x509 -new -nodes -key "${KEY}" -sha256 -days "${DAYS}" -out "${CRT}" -config "${TMP_CONF}" >/dev/null 2>&1

echo "Verifying certificate SANs:"
openssl x509 -in "${CRT}" -noout -text | grep -A1 "Subject Alternative Name" || true

rm -f "${TMP_CONF}" "${OPENSSL_CONF}"

echo "\nDone. Copy mounted by docker-compose.web.tls.yml at /etc/nginx/certs."
echo "If using Microsoft Entra, set WEB_URI=https://${HOST} and ENTRA_REDIRECT_URI=https://${HOST}/auth/entra/callback."

