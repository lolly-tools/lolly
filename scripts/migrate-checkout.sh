#!/usr/bin/env bash
# Move an old checkout (the submodule layout, before 2026-09-11) onto the folded
# repository, in place, without losing gitignored downloads or unpushed work.
#
# Before the fold, ten directories were git submodules with their own repos
# (community, docs, services/mcp, services/ca, shells/web, shells/cli, shells/tui,
# shells/tauri-desktop, shells/tauri-mobile, shells/chrome-extension). Since the
# fold they are plain directories of this repository, and only brands/suse is a
# submodule. A plain `git pull` on an old checkout stops with "directory not empty"
# because the old submodule working trees sit where the new directories go.
#
#   scripts/migrate-checkout.sh          # dry run: prints what it would do
#   scripts/migrate-checkout.sh --yes    # do it
#
# What it does, in order:
#   1. refuses if the parent has uncommitted tracked changes (park them first);
#   2. for each old submodule, exports any commits you made locally that are not on
#      its origin/main as patches under .migrate-patches/<path>/ (apply them later
#      with `git am --directory=<path> .migrate-patches/<path>/*.patch`), and
#      refuses if a submodule has uncommitted changes (commit or discard them first);
#   3. stops any process whose working directory is inside a submodule (a dev
#      server keeps the directory busy; the deinit then fails half way);
#   4. parks the gitignored heavy directories that live inside submodules so they
#      survive the removal: shells/web/public/models, shells/web/dist,
#      shells/web/public/info, services/mcp/.browsers;
#   5. deinitialises the ten submodules and clears their directories;
#   6. fast-forwards main to origin/main (or checks out main first);
#   7. removes the retired repo-root views (tools/, catalog/, .lolly-view.json);
#   8. restores the parked directories, runs pnpm install, prints the resolved
#      content profile.
#
# brands/suse is untouched: it stays a submodule, mounted or not, exactly as before.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
YES=0
[ "${1:-}" = "--yes" ] && YES=1

OLD_SUBMODULES=(community docs services/mcp services/ca shells/web shells/cli shells/tui shells/tauri-desktop shells/tauri-mobile shells/chrome-extension)
PARK=(shells/web/public/models shells/web/dist shells/web/public/info services/mcp/.browsers)
PATCHES="$ROOT/.migrate-patches"
PARKDIR="$ROOT/.migrate-park"

say() { printf '%s\n' "$*"; }
do_or_show() { if [ "$YES" = 1 ]; then "$@"; else say "  would run: $*"; fi; }

# Already folded? A gitlink (mode 160000) at one of the old paths, or an old
# submodule working tree still on disk, means there is work to do.
gitlinks="$(git ls-files --stage | awk '$1 == "160000" { print $4 }')"
old_present=0
for p in "${OLD_SUBMODULES[@]}"; do
  if printf '%s\n' "$gitlinks" | grep -qx "$p" || [ -f "$p/.git" ]; then old_present=1; fi
done
if [ "$old_present" = 0 ]; then
  say "This checkout already has the folded layout. Nothing to do."
  exit 0
fi

say "== 1. parent tree must be clean"
if [ -n "$(git status --porcelain --ignore-submodules=all)" ]; then
  say "The parent has uncommitted changes. Commit or park them, then rerun:"; git status --short --ignore-submodules=all | head; exit 1
fi
say "  clean."

say "== 2. local work inside the old submodules"
mkdir -p "$PATCHES"
for p in "${OLD_SUBMODULES[@]}"; do
  [ -f "$p/.git" ] || [ -d "$p/.git" ] || { say "  $p: not checked out, skip"; continue; }
  if [ -n "$(git -C "$p" status --porcelain)" ]; then
    say "  $p has UNCOMMITTED changes; commit them (git -C $p commit) or discard them, then rerun."; exit 1
  fi
  git -C "$p" fetch -q origin main 2>/dev/null || true
  n=$(git -C "$p" rev-list --count origin/main..HEAD 2>/dev/null || echo 0)
  if [ "$n" != "0" ]; then
    say "  $p: $n local commit(s) not on origin/main -> exporting patches to .migrate-patches/$p/"
    do_or_show mkdir -p "$PATCHES/$p"
    do_or_show git -C "$p" format-patch -q -o "$PATCHES/$p" origin/main..HEAD
  else
    say "  $p: nothing local."
  fi
done

say "== 3. processes holding a submodule directory"
for p in "${OLD_SUBMODULES[@]}"; do
  pids=$(lsof +D "$ROOT/$p" -t 2>/dev/null | sort -u | head -20 || true)
  [ -z "$pids" ] && continue
  say "  $p is held open by process(es): $(echo $pids | tr '\n' ' ') (a dev server or preview, most likely)"
  do_or_show kill $pids
done

say "== 4. park the gitignored heavy directories"
mkdir -p "$PARKDIR"
for d in "${PARK[@]}"; do
  [ -e "$d" ] || continue
  say "  $d ($(du -sh "$d" 2>/dev/null | cut -f1))"
  do_or_show mkdir -p "$PARKDIR/$(dirname "$d")"
  do_or_show mv "$d" "$PARKDIR/$d"
done

say "== 5. deinitialise the old submodules"
for p in "${OLD_SUBMODULES[@]}"; do
  do_or_show git submodule deinit -f -q "$p"
  do_or_show rm -rf "$p"
done
say "  (.git/modules/* are left in place; delete them yourself when you no longer want the old history offline)"

say "== 6. move main onto the folded tree"
do_or_show git fetch origin main
do_or_show git checkout -q main
do_or_show git merge --ff-only origin/main

say "== 7. remove the retired views"
for v in tools catalog .lolly-view.json; do [ -e "$v" ] && do_or_show rm -rf "$v"; done

say "== 8. restore, install, resolve"
for d in "${PARK[@]}"; do
  [ -e "$PARKDIR/$d" ] || continue
  do_or_show mkdir -p "$(dirname "$d")"
  do_or_show mv "$PARKDIR/$d" "$d"
done
[ "$YES" = 1 ] && rmdir "$PARKDIR" 2>/dev/null || true
do_or_show pnpm install --frozen-lockfile
do_or_show pnpm run --silent profile

if [ "$YES" = 1 ]; then
  say ""
  say "Done. brands/suse is still a submodule (git submodule update --init --checkout brands/suse to mount it)."
  if [ -n "$(ls -A "$PATCHES" 2>/dev/null)" ]; then
    say "Local commits were exported under .migrate-patches/. Re-apply each set with:"
    say "  git am --directory=<path> .migrate-patches/<path>/*.patch"
  else
    rmdir "$PATCHES" 2>/dev/null || true
  fi
  say "If you had loldev on your PATH: pnpm run gate, pnpm run ship and pnpm run profile replaced it."
else
  say ""
  say "Dry run only. Rerun with --yes to apply."
fi
