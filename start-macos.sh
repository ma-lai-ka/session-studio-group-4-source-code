#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is missing. Follow docs/SETUP.md or paste the professor prompt into local Codex."
  exit 1
fi
exec node scripts/start-local.mjs
