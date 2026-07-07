#!/usr/bin/env bash
# scripts/subrepo/verify.sh
#
# Post-split verification — proves build + run still work with the submodule
# layout. Run after migrate.sh --run (before you push the parent). Read-only
# except for regenerating build outputs and node_modules.
#
# USAGE
#   scripts/subrepo/verify.sh            # in-place checks
#   scripts/subrepo/verify.sh --clone    # also do a fresh --recurse-submodules
#                                         clone + install + catalog build (slow)

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"
cd "$REPO_ROOT"
DO_CLONE=0; [ "${1:-}" = "--clone" ] && DO_CLONE=1
fail=0; step() { say "• $*"; }

step "submodule count"
n="$(git submodule status 2>/dev/null | wc -l | tr -d ' ')"
[ "$n" = "10" ] && ok "$n submodules" || { warn "$n submodules (expected 10)"; }

step "submodule init"
git submodule update --init --recursive && ok "initialised" || { err "init failed"; fail=1; }

step "npm install (workspaces link)"
npm install >/dev/null 2>&1 && ok "installed" || { err "npm install failed"; fail=1; }

step "catalog build + validate"
if npm run build:catalog >/dev/null 2>&1 && npm run validate:catalog; then ok "catalog OK"; else err "catalog build/validate failed"; fail=1; fi

step "typecheck"
npm run typecheck >/dev/null 2>&1 && ok "typecheck passed" || { err "typecheck failed"; fail=1; }

step "web build"
npm run build:web >/dev/null 2>&1 && ok "build:web succeeded" || { err "build:web failed"; fail=1; }

step "CLI render"
out="$STAGE_ROOT/verify-qr.svg"; mkdir -p "$STAGE_ROOT"
if npm run --silent cli -- qr-code --url=https://suse.com --output="$out" >/dev/null 2>&1 && [ -s "$out" ]; then
  ok "CLI rendered $out"; else err "CLI render failed"; fail=1; fi

step "tauri desktop resolves ../web"
if [ -e "shells/tauri-desktop/vite.config.js" ] && [ -d "shells/web" ]; then ok "shells/web present beside tauri-desktop"; else warn "tauri ../web coupling not satisfied"; fi

step "music: present locally + ignored in catalog submodule"
if [ -d "catalog/$MUSIC_REL" ]; then
  if git -C catalog check-ignore "$MUSIC_REL" >/dev/null 2>&1; then ok "music present + gitignored in catalog submodule"
  else warn "music present but NOT ignored in catalog submodule — check catalog/.gitignore"; fi
else warn "catalog/$MUSIC_REL missing locally (deploys won't have audio beds)"; fi

if [ "$DO_CLONE" = 1 ]; then
  step "fresh --recurse-submodules clone build"
  cl="$STAGE_ROOT/verify-clone"; rm -rf "$cl"
  if git clone --recurse-submodules "file://$REPO_ROOT" "$cl" >/dev/null 2>&1 \
     && ( cd "$cl" && npm install >/dev/null 2>&1 && npm run build:catalog >/dev/null 2>&1 ); then
    ok "fresh clone builds"; else err "fresh clone build failed"; fail=1; fi
fi

echo
[ "$fail" = 0 ] && say "VERIFY: all green ✓" || { say "VERIFY: failures above ✗"; exit 1; }
