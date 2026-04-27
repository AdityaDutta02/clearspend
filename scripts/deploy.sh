#!/usr/bin/env bash
# Deploy script: merges committed main source into deploy branch.
# Terminal AI rebuilds via Docker (COPY . . && npm run build), so source must be correct.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

# Verify on main with clean working tree
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Must be on main branch (currently on $BRANCH)." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

# Pull latest main
git pull --ff-only origin main

CURRENT_SHA=$(git rev-parse --short HEAD)

# Merge main into deploy (source files, not artifacts)
git checkout deploy
git pull --ff-only origin deploy 2>/dev/null || true
git merge main --no-edit -m "deploy: sync source from main@${CURRENT_SHA}"
git push origin deploy

git checkout main
echo "Deploy branch updated from main@${CURRENT_SHA}."
echo "Trigger redeploy in Terminal AI dashboard — Docker will rebuild from source."
