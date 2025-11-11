#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "This helper must be run as root on the Proxmox host." >&2
  exit 1
fi

if ! command -v pct >/dev/null 2>&1; then
  echo "The 'pct' command is not available. Run this on a Proxmox VE node." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SETUP_SCRIPT="${SCRIPT_DIR}/setup.sh"

if [[ ! -f "${SETUP_SCRIPT}" ]]; then
  echo "Unable to find setup.sh next to this helper script." >&2
  exit 1
fi

CTID=${CTID:-9050}
HOSTNAME=${HOSTNAME:-flojoy-web}
TEMPLATE_STORAGE=${TEMPLATE_STORAGE:-local}
ROOTFS_STORAGE=${ROOTFS_STORAGE:-local-lvm}
ROOTFS_SIZE=${ROOTFS_SIZE:-8G}
BRIDGE=${BRIDGE:-vmbr0}
IP_ADDRESS=${IP_ADDRESS:-dhcp}
GATEWAY=${GATEWAY:-}
CPUS=${CPUS:-2}
MEMORY=${MEMORY:-2048}
TEMPLATE_IMAGE=${TEMPLATE_IMAGE:-debian-12-standard_12.2-1_amd64.tar.zst}

echo "Using CTID=${CTID} with hostname '${HOSTNAME}'."

if ! pct config "${CTID}" >/dev/null 2>&1; then
  echo "Downloading Debian template '${TEMPLATE_IMAGE}' to storage '${TEMPLATE_STORAGE}' (skipped if already present)..."
  pveam download "${TEMPLATE_STORAGE}" "${TEMPLATE_IMAGE}" >/dev/null

  NET_CONFIG="name=eth0,bridge=${BRIDGE}"
  if [[ "${IP_ADDRESS}" == "dhcp" ]]; then
    NET_CONFIG+="\,ip=dhcp"
  else
    NET_CONFIG+="\,ip=${IP_ADDRESS}"
  fi
  if [[ -n "${GATEWAY}" ]]; then
    NET_CONFIG+="\,gw=${GATEWAY}"
  fi

  TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_IMAGE}"
  echo "Creating new container ${CTID} from ${TEMPLATE_REF}..."
  pct create "${CTID}" "${TEMPLATE_REF}" \
    --hostname "${HOSTNAME}" \
    --cores "${CPUS}" \
    --memory "${MEMORY}" \
    --features nesting=1,keyctl=1 \
    --net0 "${NET_CONFIG}" \
    --rootfs "${ROOTFS_STORAGE}:${ROOTFS_SIZE}" \
    --ostype debian \
    --onboot 1 \
    --unprivileged 0
else
  echo "Container ${CTID} already exists; skipping creation."
fi

if pct status "${CTID}" | grep -q running; then
  echo "Container ${CTID} is already running."
else
  echo "Starting container ${CTID}..."
  pct start "${CTID}"
fi

echo "Pushing setup script into the container..."
pct push "${CTID}" "${SETUP_SCRIPT}" /root/flojoy-setup.sh --perms 0755 >/dev/null

declare -a ENV_ARGS
for var in APP_USER APP_DIR REPO_URL REPO_REF VITE_SERVER_URL WEB_BUILD_DIR WEB_DIST_DIR BUN_INSTALL_DIR; do
  if [[ -n "${!var:-}" ]]; then
    ENV_ARGS+=(--env "${var}=${!var}")
  fi
done

echo "Running setup script inside the container..."
pct exec "${CTID}" "${ENV_ARGS[@]}" -- bash -lc "/root/flojoy-setup.sh"

echo "Flojoy Cloud web frontend should now be available on the container at http://<container-ip>/."
