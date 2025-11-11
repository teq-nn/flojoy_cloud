# Proxmox LXC Deployment

This guide describes how to deploy the Flojoy Cloud web frontend inside a Proxmox LXC container so that the Vite-built site is served directly from the container's IP address (port 80).

## 1. Create the container

1. Download the latest Debian 12 template in the Proxmox UI.
2. Create a **privileged** container using that template.
3. Enable the following features on the "Features" tab:
   - `nesting=1` (required for `systemd` units that manage nginx)
   - `keyctl=1` (allows `bun` to use modern TLS backends)
4. Allocate resources according to your needs (2 vCPU / 2 GiB RAM is a good starting point).
5. Attach the container to a bridged network so it receives an IP on your LAN.
6. Start the container and open a shell (either via the Proxmox console or SSH).

## 2. One-command setup from the Proxmox host

To run the helper the same way as community Proxmox scripts, execute it directly via `curl`. The script provisions (or reuses) an LXC container, installs curl inside the guest, and streams the in-container setup script from GitHub for execution.

```bash
# Run on the Proxmox VE host (as root)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/teq-nn/flojoy_cloud/main/scripts/proxmox/provision-host.sh)"
```

You can override defaults by exporting environment variables before the command. For example, to pick a different CTID, storage target, and backend URL:

```bash
export CTID=1234
export ROOTFS_STORAGE=local-lvm
export VITE_SERVER_URL="http://<backend-host>:3000"

bash -c "$(curl -fsSL https://raw.githubusercontent.com/teq-nn/flojoy_cloud/main/scripts/proxmox/provision-host.sh)"
```

When testing changes from an unmerged branch or fork, set `HELPER_REPO` and `HELPER_REF` so the helper and the in-container setup script are fetched from your desired location:

```bash
export HELPER_REPO="https://raw.githubusercontent.com/<user>/<repo>"
export HELPER_REF="my-feature-branch"
bash -c "$(curl -fsSL ${HELPER_REPO}/${HELPER_REF}/scripts/proxmox/provision-host.sh)"
```

Key environment variables for the host helper:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CTID` | `9050` | Numerical container ID to create/use |
| `HOSTNAME` | `flojoy-web` | Hostname assigned to the container |
| `TEMPLATE_STORAGE` | `local` | Storage where Debian templates live (for `pveam download`) |
| `ROOTFS_STORAGE` | `local-lvm` | Storage used for the container rootfs |
| `ROOTFS_SIZE` | `8G` | Disk size for the root filesystem |
| `BRIDGE` | `vmbr0` | Bridge device used for networking |
| `IP_ADDRESS` | `dhcp` | Either `dhcp` or a static CIDR (e.g. `192.168.1.50/24`) |
| `GATEWAY` | *(empty)* | Gateway IP when using a static address |
| `CPUS` | `2` | vCPU allocation |
| `MEMORY` | `2048` | Memory allocation in MiB |
| `TEMPLATE_IMAGE` | `debian-12-standard_12.2-1_amd64.tar.zst` | Debian template fetched via `pveam` |
| `HELPER_REPO` | `https://raw.githubusercontent.com/teq-nn/flojoy_cloud` | Base URL used to download scripts |
| `HELPER_REF` | `main` | Branch, tag, or commit for the helper and setup script |
| `SETUP_URL` | `<HELPER_REPO>/<HELPER_REF>/scripts/proxmox/setup.sh` | Direct override for the setup script location |

Any `APP_*`, `REPO_*`, `VITE_*`, or `WEB_*` variables you export are forwarded into the container when the setup script runs.

## 3. Manual bootstrap inside an existing container

If you prefer to manage the container yourself, open a shell in the LXC guest and run the bootstrap script directly. It installs Bun, nginx, clones the repo, builds the frontend, and configures nginx to serve the compiled assets.

```bash
apt-get update && apt-get install -y git
mkdir -p /opt && cd /opt
# Clone the repository on the branch that includes the Proxmox tooling
git clone https://github.com/teq-nn/flojoy_cloud.git
cd flojoy_cloud
# Checkout the desired ref (e.g. this feature branch) and run the setup script
# REPO_REF defaults to "main", override if you need another branch or tag
REPO_REF=feat/proxmox-lxc VITE_SERVER_URL="http://<server-ip>:3000" bash scripts/proxmox/setup.sh
```

Environment variables accepted by the in-container script:

| Variable | Default | Description |
| --- | --- | --- |
| `APP_USER` | `flojoy` | System user that owns the checkout and runs the build |
| `APP_DIR` | `/opt/flojoy-cloud` | Target path for the repository clone |
| `REPO_URL` | `https://github.com/teq-nn/flojoy_cloud.git` | Git remote used for cloning |
| `REPO_REF` | `main` | Branch, tag, or commit to check out before building |
| `VITE_SERVER_URL` | `http://localhost:3000` | Backend URL baked into the frontend build |
| `WEB_DIST_DIR` | `/var/www/flojoy-web` | Destination served by nginx |

The script can be re-run to apply updates; it performs a fast-forward pull when the selected ref tracks a remote branch.

## 4. Accessing the UI

After the script completes, nginx serves the static frontend over HTTP on port `80`. Reach the app with `http://<container-ip>/`. No extra port forwarding is required—the container IP/port from Proxmox is all you need.

If you update the backend hostname later, re-run the script with a new `VITE_SERVER_URL` so that the compiled assets embed the new API endpoint.

## 5. Maintenance tips

- To deploy an updated version, rerun `scripts/proxmox/setup.sh` (optionally pointing `REPO_REF` to a tag/branch with your changes).
- Logs live in `/var/log/nginx/access.log` and `/var/log/nginx/error.log`.
- The build artifacts served by nginx are stored in `/var/www/flojoy-web`.
- Use `systemctl status nginx` to verify that nginx is active and restart it when updating certificates or configuration.
