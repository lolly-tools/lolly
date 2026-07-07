#!/usr/bin/env bash
# scripts/subrepo/sync.sh
#
# DAY-TO-DAY workflow after the split. Rebuilds generated catalog artifacts,
# then commits + pushes every changed submodule to its own lolly-tools repo and
# stages the matching pointer bump in the parent. Run this from ~/Build/lolly
# after editing tools / catalog / a shell / a service.
#
# USAGE
#   scripts/subrepo/sync.sh -m "message" [options] [paths...]
#
# OPTIONS
#   -m, --message <msg>  Commit message for the submodule commits (required to push).
#   --previews           Also run `npm run previews` (heavy — Playwright/Chromium).
#   --no-build           Skip the catalog rebuild (build:catalog + validate:catalog).
#   --push-parent        Also commit + push the parent pointer bump. Default: only
#                        STAGE it (you push the parent yourself).
#   --dry-run            Show what would happen; change nothing.
#   paths...             Restrict to these submodule paths. Default: every dirty one.
#
# Editing a tool typically touches TWO submodules: the manifest (tools/) and the
# regenerated index/preview-bundle (catalog/). The catalog rebuild below makes
# that automatic; both get committed + pushed, then the parent points at both.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

MSG=""; RUN_PREVIEWS=0; DO_BUILD=1; PUSH_PARENT=0; DRY=0; ONLY=()
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message) shift; MSG="$1" ;;
    --previews) RUN_PREVIEWS=1 ;;
    --no-build) DO_BUILD=0 ;;
    --push-parent) PUSH_PARENT=1 ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    -*) err "unknown arg: $1"; exit 2 ;;
    *) ONLY+=("$1") ;;
  esac; shift
done

cd "$REPO_ROOT"
[ -f .gitmodules ] || { err "no .gitmodules — run migrate.sh first (this is post-split tooling)."; exit 1; }

run() { if [ "$DRY" = 1 ]; then info "would: $*"; else eval "$*"; fi; }

# --- 1. rebuild generated catalog artifacts --------------------------------
if [ "$DO_BUILD" = 1 ]; then
  say "Build"
  run "npm run build:catalog"
  run "npm run validate:catalog"
  if [ "$RUN_PREVIEWS" = 1 ]; then
    warn "running previews (Playwright — slow)"; run "npm run previews"
  else
    info "skipping previews (pass --previews to regenerate look thumbnails)"
  fi
  echo
fi

# --- 2. figure out which submodules changed --------------------------------
declare -a CHANGED
if [ ${#ONLY[@]} -gt 0 ]; then
  CHANGED=("${ONLY[@]}")
else
  while read -r p; do
    [ -d "$p/.git" ] || [ -f "$p/.git" ] || continue
    [ -n "$(git -C "$p" status --porcelain)" ] && CHANGED+=("$p")
  done < <(subrepo_paths)
fi

if [ ${#CHANGED[@]} -eq 0 ]; then ok "no submodules have changes — nothing to sync."; exit 0; fi

say "Changed submodules"; for p in "${CHANGED[@]}"; do info "$p → $ORG/$(repo_for_path "$p" || echo '??')"; done; echo

# --- 3. commit + push each changed submodule, then stage the parent pointer -
if [ -z "$MSG" ] && [ "$DRY" != 1 ]; then err "commit message required (-m \"...\") to push submodules."; exit 2; fi

for p in "${CHANGED[@]}"; do
  say "$p"
  repo_for_path "$p" >/dev/null || { warn "not a mapped submodule — skipping"; continue; }
  if [ -n "$(git -C "$p" status --porcelain)" ]; then
    run "git -C '$p' add -A"
    run "git -C '$p' commit -m \"$MSG\""
    run "git -C '$p' push"
    ok "pushed $p"
  else
    info "submodule clean; committing pointer only"
  fi
  run "git add '$p'"   # stage the gitlink bump in the parent
done
echo

# --- 4. parent pointer commit ----------------------------------------------
run "git add .gitmodules 2>/dev/null || true"
if [ "$PUSH_PARENT" = 1 ]; then
  say "Parent"
  run "git commit -m \"Bump submodules: $MSG\""
  run "git push"
  ok "parent committed + pushed"
else
  say "Parent pointer STAGED (not committed)"
  info "review:  git diff --cached --stat"
  info "then:    git commit -m 'Bump submodules: $MSG'  &&  push your usual way"
fi
