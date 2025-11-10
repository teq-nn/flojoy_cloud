# TLS Certificates for Nginx (HTTPS)

This guide shows 3 ways to provide `fullchain.pem` and `privkey.pem` for `apps/web/nginx.tls.conf`:

1) Quick Self-Signed (untrusted by default, fine for testing)
2) Locally Trusted with mkcert (trusted on machines where mkcert root is installed)
3) Publicly Trusted with Let's Encrypt (recommended for real domains)

All methods output to `nginx/certs/` so `docker-compose.web.tls.yml` can mount them into the container.

## 1) Quick Self-Signed

- Generates an HTTPS cert that browsers will warn about (untrusted), but works for Entra (requires HTTPS, not necessarily public trust).
- Command:

```
scripts/tls/gen-selfsigned.sh <HOSTNAME_OR_IP>
```

- Example:

```
scripts/tls/gen-selfsigned.sh 192.168.1.50
```

Outputs:
- `nginx/certs/fullchain.pem`
- `nginx/certs/privkey.pem`

## 2) Locally Trusted (mkcert)

mkcert issues locally-trusted certs by installing a local CA into your OS/browser trust store.

Steps:
1. Install mkcert: https://github.com/FiloSottile/mkcert
2. Run (may prompt to install the local CA):

```
scripts/tls/gen-mkcert.sh <HOSTNAME_OR_IP>
```

Notes:
- Other devices will only trust the cert if their trust stores include the same mkcert root CA. Install mkcert and run `mkcert -install` on each client, or use a real domain with Let's Encrypt.

## 3) Publicly Trusted (Let's Encrypt)

For a publicly reachable domain, use Let's Encrypt for a trusted certificate.

High-level options:
- Use Certbot on the host to obtain a cert and place `fullchain.pem` and `privkey.pem` under `nginx/certs/`.
- Use DNS-01 validation if your host isn't publicly reachable on port 80.

Example (certbot standalone on the host):

```
sudo certbot certonly --standalone -d your.domain.tld
# Then copy/renew into project as:
sudo cp /etc/letsencrypt/live/your.domain.tld/fullchain.pem nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/your.domain.tld/privkey.pem nginx/certs/privkey.pem
```

Automated renewals:
- Prefer running certbot on the host with its own renewal timer, and hook a reload for the nginx container.

## Using the Certs

Once `nginx/certs/` has the two files, start with TLS:

```
docker compose -f docker-compose.server.yml -f docker-compose.web.tls.yml up --build -d
```

Set envs for HTTPS and Entra:
- `apps/web/.env`: `VITE_SERVER_URL=/api`
- `apps/server/.env`: `WEB_URI=https://<HOSTNAME>` and `ENTRA_REDIRECT_URI=https://<HOSTNAME>/auth/entra/callback`

Visit `https://<HOSTNAME>`.

