#!/usr/bin/env bash
# scripts/subrepo/snap-history.sh
#
# Squash the PARENT monorepo to a single clean-history commit to keep the repo
# small (drops the old music blobs + preview churn from history). Preserves
# EVERY working-tree file, including gitignored ones (/plans, scratch, .env*,
# node_modules, .browsers, dist, …) — checkout --orphan never touches the tree.
#
# Creates a safety backup branch first. Does NOT push — you force-push the
# parent yourself (history was rewritten, so a normal push is rejected):
#     git push --force origin main        (or however you push the parent)
#
# USAGE
#   scripts/subrepo/snap-history.sh                 # squash, keep backup branch
#   scripts/subrepo/snap-history.sh -m "message"
#   scripts/subrepo/snap-history.sh --dry-run

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"
cd "$REPO_ROOT"

MSG="lolly monorepo — clean history (lolly-tools submodule split)"; DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message) shift; MSG="$1" ;;
    --dry-run) DRY=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) err "unknown arg: $1"; exit 2 ;;
  esac; shift
done

ORIG_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HEAD_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo 'root')"
BACKUP="backup/pre-snap-$HEAD_SHORT"
COMMITS="$(git rev-list --count HEAD 2>/dev/null || echo '?')"

say "Snap parent history to a single commit"
info "branch:  $ORIG_BRANCH   (currently $COMMITS commit(s), HEAD $HEAD_SHORT)"
info "backup:  $BACKUP  (safety net — delete + gc later to reclaim space)"
info "message: $MSG"

if [ "$DRY" = 1 ]; then
  warn "dry run — would:"
  info "git branch -f $BACKUP"
  info "git checkout --orphan _clean_history && git add -A && git commit -m \"$MSG\""
  info "git branch -M $ORIG_BRANCH   (replaces the old branch; backup keeps old history)"
  info "working-tree files (incl. gitignored) are left untouched"
  exit 0
fi

# Never squash a dirty-but-uncaptured state by accident — but a normal split run
# has staged submodule pointers; git add -A below captures everything.
git branch -f "$BACKUP"
ok "backed up old history → $BACKUP"

git checkout -q --orphan _clean_history
git add -A
git commit -qm "$MSG"
git branch -qM "$ORIG_BRANCH"
NEW_SHORT="$(git rev-parse --short HEAD)"
ok "history is now 1 commit ($NEW_SHORT) on $ORIG_BRANCH"
echo
say "Next (yours):"
info "verify:      scripts/subrepo/status.sh   &&   scripts/subrepo/verify.sh"
info "force-push:  git push --force <however you push>   (history was rewritten)"
info "reclaim space once happy:"
info "  git branch -D $BACKUP && git reflog expire --all --expire=now && git gc --prune=now"
