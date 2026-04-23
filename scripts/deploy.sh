#!/usr/bin/env bash
# Deploy script: builds from main, syncs artifacts to deploy branch.
# Never touches the project root with rsync. Safe to re-run.
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

# Build
echo "Building..."
node_modules/.bin/next build

# Stage artifacts in a temp dir (never rsync to project root)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

rsync -a --checksum .next/standalone/ "$TMP/standalone/"
rsync -a --checksum .next/static/     "$TMP/static/"
cp package.json "$TMP/"

CURRENT_SHA=$(git rev-parse --short HEAD)

# Switch to deploy branch and apply artifacts
git checkout deploy
git pull --ff-only origin deploy 2>/dev/null || true

# Sync ONLY the artifact subdirs — never the project root
rsync -a --checksum --delete "$TMP/standalone/" .next/standalone/
rsync -a --checksum --delete "$TMP/static/"     .next/static/
cp "$TMP/package.json" package.json

git add -f .next/standalone/ .next/static/ package.json
git commit -m "deploy: build from main@${CURRENT_SHA}"
git push origin deploy

git checkout main
echo "Deploy complete. Trigger redeploy in Terminal AI dashboard."
