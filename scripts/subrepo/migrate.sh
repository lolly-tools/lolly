#!/usr/bin/env bash
# scripts/subrepo/migrate.sh
#
# ONE-TIME split of the lolly monorepo into github.com/lolly-tools/* subrepos,
# wired back as git submodules. See config.sh for the repo map and
# plans/linked-juggling-sky.md for the strategy.
#
# MODES
#   (default)        Dry run — print every action, change nothing.
#   --extract-only   Non-destructive: extract+stage each subrepo from HEAD into
#                    $STAGE_ROOT and print `git ls-files` to inspect. No GitHub,
#                    no monorepo changes.
#   --run            Full migration. Captures the CURRENT WORKING TREE (including
#                    uncommitted WIP) as the source, creates+pushes the repos,
#                    converts paths to submodules while PRESERVING all in-path
#                    gitignored files (.env, .browsers, dist, …), then snaps the
#                    parent to a single clean-history commit. Does NOT push.
#
# OPTIONS
#   --only <path>    Restrict to one monorepo path (repeatable). Default: all.
#   --no-snap        Skip the clean-history snap (just stage the parent commit).
#   --yes            Skip the interactive confirmation.

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

MODE="dry"; ASSUME_YES=0; DO_SNAP=1; ONLY=()
while [ $# -gt 0 ]; do
  case "$1" in
    --run) MODE="run" ;;
    --extract-only) MODE="extract" ;;
    --only) shift; ONLY+=("$1") ;;
    --no-snap) DO_SNAP=0 ;;
    --yes|-y) ASSUME_YES=1 ;;
    -h|--help) sed -n '2,32p' "$0"; exit 0 ;;
    *) err "unknown arg: $1"; exit 2 ;;
  esac; shift
done

cd "$REPO_ROOT"
PREMIGRATE="$REPO_ROOT/.subrepo-premigrate"
HEAVY_DIRS=(node_modules .browsers)   # regenerable — moved (instant), never copied

TARGETS=(); if [ ${#ONLY[@]} -gt 0 ]; then TARGETS=("${ONLY[@]}"); else while read -r p; do TARGETS+=("$p"); done < <(subrepo_paths); fi

# --- preflight -------------------------------------------------------------
say "Preflight"
command -v gh git rsync >/dev/null 2>&1 || true
for t in gh git rsync; do command -v "$t" >/dev/null || { err "$t not installed"; exit 1; }; done
gh auth status >/dev/null 2>&1 || { err "gh not authenticated (gh auth login)"; exit 1; }
GH_USER="$(gh api user -q .login 2>/dev/null || echo '?')"
ROLE="$(gh api "user/memberships/orgs/$ORG" -q .role 2>/dev/null || echo 'none')"
ok "gh: $GH_USER   $ORG role: $ROLE"
[ "$ROLE" = "admin" ] || [ "$ROLE" = "member" ] || warn "no create rights on $ORG detected"
HEAD_SHORT="$(git rev-parse --short HEAD)"
TRACKED_CHANGES="$(git status --porcelain --untracked-files=no | wc -l | tr -d ' ')"
ok "HEAD $HEAD_SHORT   uncommitted tracked changes: $TRACKED_CHANGES"
[ "$TRACKED_CHANGES" -gt 0 ] && [ "$MODE" != "dry" ] && warn "WIP will be captured as the migration source (that's intended for --run)."
echo

# SRC tree to extract from: current working tree (WIP) for --run, else HEAD.
SRC="HEAD"

# --- per-repo extraction ---------------------------------------------------
stage_one() {
  local path="$1" repo dst depth
  repo="$(repo_for_path "$path")" || { err "no repo mapped: $path"; return 1; }
  dst="$STAGE_ROOT/$repo"; depth="$(path_depth "$path")"
  say "$path  →  $ORG/$repo"

  if [ "$MODE" = "dry" ]; then
    info "git archive <src> -- '$path' | tar -x --strip-components=$depth"
    info "add README + merged .gitignore$(is_mpl_path "$path" && echo ' + LICENSE')"
    info "git init + commit + gh repo create + push"
    return 0
  fi

  rm -rf "$dst"; mkdir -p "$dst"
  git archive "$SRC" -- "$path" | tar -x --strip-components="$depth" -C "$dst"
  # NOTE: catalog music ($MUSIC_REL) is now INCLUDED (Andy's call — public, time-boxed
  # to the 2026-08-29 PremiumBeat removal in catalog/NOTICE.md). To re-exclude, add:
  # [ "$path" = "catalog" ] && rm -rf "$dst/$MUSIC_REL"

  { echo "# $repo"; echo
    echo "Extracted from the [\`lolly\`](https://github.com/$ORG/lolly) monorepo and"
    echo "consumed there as a git submodule at \`$path/\`."; echo
    if is_mpl_path "$path"; then
      echo "Builds **within the monorepo** — depends on sibling workspace packages"
      echo "(\`@lolly/engine\`) / relative paths that only exist in that layout."
    else echo "Tool/catalog **data**, not code. See \`NOTICE.md\` for licensing."; fi
  } > "$dst/README.md"

  local extra; extra="$(gitignore_extra "$path")"
  { [ -f "$dst/.gitignore" ] && cat "$dst/.gitignore"; echo "$extra"; } \
    | awk 'NF && !seen[$0]++' > "$dst/.gitignore.tmp" && mv "$dst/.gitignore.tmp" "$dst/.gitignore"
  is_mpl_path "$path" && cp "$REPO_ROOT/LICENSE" "$dst/LICENSE"

  ( cd "$dst"; git init -q -b main; git add -A
    git -c user.name="${GIT_AUTHOR_NAME:-lolly-split}" -c user.email="${GIT_AUTHOR_EMAIL:-split@lolly.tools}" \
        commit -q -m "Initial extraction from lolly monorepo @ $HEAD_SHORT" )

  if [ "$path" = "services/ca" ] && git -C "$dst" ls-files | grep -qiE '\.pem$|root-key'; then
    err "ABORT: key-like file in $repo staging"; exit 1
  fi
  ok "staged $repo ($(git -C "$dst" ls-files | wc -l | tr -d ' ') files)"
}

push_one() {
  local path="$1" repo url dst; repo="$(repo_for_path "$path")"; url="$(subrepo_url "$path")"; dst="$STAGE_ROOT/$repo"
  if gh repo view "$ORG/$repo" >/dev/null 2>&1; then warn "$ORG/$repo exists — pushing to it"
  else gh repo create "$ORG/$repo" --public -d "$(repo_description "$path")" >/dev/null; ok "created $ORG/$repo"; fi
  git -C "$dst" remote remove origin 2>/dev/null || true
  git -C "$dst" remote add origin "$url"
  git -C "$dst" push -u origin main
  ok "pushed → $url"
}

# Convert a path to a submodule, PRESERVING all in-path gitignored/untracked files.
submodule_one() {
  local path="$1" url bak heavy; url="$(subrepo_url "$path")"; bak="$PREMIGRATE/$path"
  git rm -r --quiet --cached "$path"
  mkdir -p "$(dirname "$bak")"; mv "$path" "$bak"          # instant rename, keeps ALL local content
  git submodule add -q "$url" "$path"                      # fresh clone of pushed (tracked) content
  for heavy in "${HEAVY_DIRS[@]}"; do                      # move big regenerables back (instant, no copy)
    [ -e "$bak/$heavy" ] && [ ! -e "$path/$heavy" ] && mv "$bak/$heavy" "$path/$heavy"
  done
  rsync -a --ignore-existing "$bak"/ "$path"/              # restore every other local-only file
  rm -rf "$bak"
  ok "submodule $path  (local gitignored files preserved)"
}

# ---------------------------------------------------------------------------
case "$MODE" in
  dry)
    say "DRY RUN — nothing changes. Use --extract-only to inspect, --run to migrate."; echo
    for p in "${TARGETS[@]}"; do stage_one "$p"; echo; done
    say "--run would then:"
    info "capture working tree (WIP) → create+push ${#TARGETS[@]} repos → convert to submodules (preserving in-path gitignored files)"
    [ "$DO_SNAP" = 1 ] && info "snap parent to clean single-commit history (backup branch kept)" || info "stage parent commit (no snap)"
    info "leave the parent PUSH to you (force-push after snap)"
    ;;

  extract)
    say "EXTRACT-ONLY — staging to $STAGE_ROOT (from HEAD; no GitHub, no changes)"; echo
    mkdir -p "$STAGE_ROOT"
    for p in "${TARGETS[@]}"; do stage_one "$p"; echo; done
    say "Inspect:  git -C $STAGE_ROOT/<repo> ls-files | less"
    ;;

  run)
    if [ "$ASSUME_YES" != "1" ]; then
      say "This will create/push ${#TARGETS[@]} PUBLIC repos under $ORG, convert paths to submodules,"
      [ "$DO_SNAP" = 1 ] && say "and REWRITE the parent history to a single commit (backup branch kept)."
      printf "Type 'migrate' to proceed: "; read -r ans; [ "$ans" = "migrate" ] || { warn "aborted"; exit 1; }
    fi
    [ -e "$PREMIGRATE" ] && { err "$PREMIGRATE exists — clean it up first"; exit 1; }
    mkdir -p "$STAGE_ROOT"

    say "0/4  Capture working tree as source"
    git add -A; SRC="$(git write-tree)"; ok "source tree $SRC (WIP included)"; echo

    say "1/4  Extract + stage"; echo
    for p in "${TARGETS[@]}"; do stage_one "$p"; done; echo

    say "2/4  Create + push repos"; echo
    for p in "${TARGETS[@]}"; do push_one "$p"; done; echo

    say "3/4  Convert to submodules (preserving in-path gitignored files)"; echo
    for p in "${TARGETS[@]}"; do submodule_one "$p"; done
    rmdir "$PREMIGRATE" 2>/dev/null || rm -rf "$PREMIGRATE"
    if [ -d "catalog/$MUSIC_REL" ]; then ok "catalog music preserved locally"; else warn "catalog music not found locally after restore — check!"; fi
    echo

    if [ "$DO_SNAP" = 1 ]; then
      say "4/4  Snap parent to clean history"; echo
      bash "$SUBREPO_DIR/snap-history.sh" -m "lolly monorepo — clean history (lolly-tools submodule split @ $HEAD_SHORT)"
    else
      say "4/4  Stage parent commit (no snap)"
      git add -A
      ok "staged .gitmodules + gitlinks + tree"
      info "commit + push the parent your way"
    fi
    echo
    say "Done. Verify, then push the parent:"
    info "scripts/subrepo/status.sh   &&   scripts/subrepo/verify.sh"
    info "git push --force <however you push the parent>   (history rewritten)"
    ;;
esac
