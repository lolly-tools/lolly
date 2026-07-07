#!/usr/bin/env bash
# scripts/subrepo/status.sh
#
# Overview of the parent monorepo + every lolly-tools submodule: branch, dirty
# state, and ahead/behind vs its own origin. Read-only.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"
cd "$REPO_ROOT"

say "Parent  ($REPO_ROOT)"
info "HEAD $(git rev-parse --short HEAD)  branch $(git rev-parse --abbrev-ref HEAD)"
pdirty="$(git status --porcelain | wc -l | tr -d ' ')"
[ "$pdirty" = 0 ] && ok "clean" || warn "$pdirty uncommitted change(s) (incl. submodule pointer bumps)"
echo

if [ ! -f .gitmodules ]; then
  warn "no .gitmodules yet — not split. Run scripts/subrepo/migrate.sh."
  exit 0
fi

printf "  %-24s %-24s %-8s %-8s %s\n" "PATH" "REPO" "BRANCH" "STATE" "vs ORIGIN"
printf "  %-24s %-24s %-8s %-8s %s\n" "----" "----" "------" "-----" "---------"
while read -r p; do
  repo="$(repo_for_path "$p" || echo '??')"
  if [ ! -e "$p/.git" ]; then printf "  %-24s %-24s ${c_yel}%s${c_reset}\n" "$p" "$repo" "MISSING (submodule not init'd)"; continue; fi
  br="$(git -C "$p" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  dirty="$(git -C "$p" status --porcelain | wc -l | tr -d ' ')"
  state=$([ "$dirty" = 0 ] && echo clean || echo "dirty:$dirty")
  rel="-"
  if git -C "$p" rev-parse '@{u}' >/dev/null 2>&1; then
    ahead="$(git -C "$p" rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
    behind="$(git -C "$p" rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)"
    rel="+$ahead/-$behind"
  else rel="no upstream"; fi
  color=$([ "$dirty" = 0 ] && echo "$c_grn" || echo "$c_yel")
  printf "  %-24s %-24s %-8s ${color}%-8s${c_reset} %s\n" "$p" "$repo" "$br" "$state" "$rel"
done < <(subrepo_paths)
