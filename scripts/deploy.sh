#!/usr/bin/env bash
# Safe deploy: builds from main, pushes compiled output to deploy branch.
# Enforces source committed → build → deploy atomically.
# Never touches .git, never deletes outside .next/standalone and .next/static.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
abort() { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── 1. Must be on main ────────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[[ "$BRANCH" == "main" ]] || abort "Must be on main branch (currently on $BRANCH)"
info "On branch: main"

# ── 2. No uncommitted changes ─────────────────────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  abort "Uncommitted changes on main. Commit or stash before deploying.
$(git status --short)"
fi
info "Working tree clean"

# ── 3. Pull latest main ───────────────────────────────────────────────────────
info "Pulling latest main..."
git pull origin main

# ── 4. Build ──────────────────────────────────────────────────────────────────
info "Building..."
node_modules/.bin/next build
BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || cat .next/standalone/.next/BUILD_ID 2>/dev/null || echo "unknown")
info "Build complete (id: $BUILD_ID)"

# ── 5. Stage artifacts in /tmp (never touch project root with --delete) ───────
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT

cp -r .next/standalone/. "$STAGING/"
cp -r .next/static "$STAGING/.next/static"
[[ -d public ]] && cp -r public "$STAGING/public"
info "Artifacts staged at $STAGING"

# ── 6. Switch to deploy branch ───────────────────────────────────────────────
MAIN_SHA=$(git rev-parse --short HEAD)
git checkout deploy
git pull origin deploy

# ── 7. Sync ONLY the artifact subdirs — never the project root ───────────────
# Explicitly target .next/standalone and .next/static so .git is never at risk.
rsync -a --checksum --delete "$STAGING/.next/standalone/" .next/standalone/
rsync -a --checksum --delete "$STAGING/.next/static/"     .next/static/
[[ -d "$STAGING/public" ]] && rsync -a --checksum --delete "$STAGING/public/" public/
cp "$STAGING/server.js"   server.js
cp "$STAGING/package.json" package.json
info "Deploy branch updated"

# ── 8. Commit and push ────────────────────────────────────────────────────────
git add -f .next/standalone/ .next/static/ server.js package.json
[[ -d public ]] && git add public/

if git diff --cached --quiet; then
  warn "No changes to deploy (build output identical to last deploy)"
  git checkout main
  exit 0
fi

git commit -m "deploy: build from main@$MAIN_SHA"
git push origin deploy
info "Pushed to origin/deploy"

# ── 9. Return to main ─────────────────────────────────────────────────────────
git checkout main
info "Back on main"
echo -e "\n${GREEN}Deploy complete.${NC} Trigger redeploy in Terminal AI to go live."
