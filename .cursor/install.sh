#!/usr/bin/env bash
# Cursor Cloud update/install script — harness locked to dependency refresh only.
# Allowed: npm install / venv + pip install when manifest files exist.
# Forbidden: service start, build, migration, deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
  npm ci
elif [[ -f package.json ]]; then
  npm install
fi

if [[ -f requirements.txt ]]; then
  if [[ ! -d .venv ]]; then
    python3 -m venv .venv
  fi
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip
  pip install -r requirements.txt
fi

echo "Cloud install complete (dependency refresh only)."
