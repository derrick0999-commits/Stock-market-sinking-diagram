#!/usr/bin/env bash
# Cursor Cloud update/install script — harness locked to dependency refresh only.
# Allowed: npm install / venv + pip install when manifest files exist.
# Forbidden: service start, build, migration, deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ensure_python_venv() {
  if python3 -c "import ensurepip" >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v sudo >/dev/null 2>&1; then
    echo "python3-venv missing and sudo unavailable" >&2
    return 1
  fi
  # Minimal bootstrap so venv+pip refresh can run on a bare base image.
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-venv python3-pip
}

if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
  npm ci
elif [[ -f package.json ]]; then
  npm install
fi

if [[ -f requirements.txt ]]; then
  ensure_python_venv
  if [[ ! -d .venv ]]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt
fi

echo "Cloud install complete (dependency refresh only)."
