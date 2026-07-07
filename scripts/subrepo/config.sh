#!/usr/bin/env bash
# scripts/subrepo/config.sh
#
# Single source of truth for the lolly monorepo → github.com/lolly-tools split.
# SOURCED by migrate.sh, sync.sh, status.sh — not executed directly.
#
# See plans/linked-juggling-sky.md for the full strategy. Submodule mount paths
# stay exactly where the dirs live today; repo names use the `lolly-` prefix.

set -euo pipefail

ORG="lolly-tools"
# HTTPS host — public submodules clone anonymously, so Vercel's git-build / CI /
# keyless clones can fetch them. (SSH .gitmodules URLs broke the Vercel git-build:
# no SSH key in the build env.) Andy's existing local submodule push-remotes stay
# SSH; a fresh clone fetches over HTTPS and pushes via gh/HTTPS auth.
GIT_HOST="https://github.com"

# Resolve repo root from this file's location (scripts/subrepo/config.sh).
SUBREPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SUBREPO_DIR/../.." && pwd)"

# Where extraction stages subrepos before pushing. Override with SUBREPO_STAGE.
STAGE_ROOT="${SUBREPO_STAGE:-${TMPDIR:-/tmp}/lolly-subrepo-stage}"

# path-in-monorepo | repo-name-under-lolly-tools
# Order is cosmetic (each unit is independent), but catalog is handled specially
# (music excluded) wherever it appears.
SUBREPO_MAP=(
  "tools|lolly-suse-tools"
  "catalog|lolly-suse-catalog"
  "docs|lolly-docs"
  "services/mcp|lolly-mcp-server"
  "services/ca|lolly-ca"
  "shells/web|lolly-web"
  "shells/cli|lolly-cli"
  "shells/tui|lolly-tui"
  "shells/tauri-desktop|lolly-desktop"
  "shells/tauri-mobile|lolly-mobile"
  "shells/chrome-extension|lolly-chrome-extension"
)

# Paths that are MPL-2.0 → copy the root LICENSE into the extracted repo.
# tools/ and catalog/ instead carry their own NOTICE.md (proprietary / mixed),
# which travels automatically via `git archive`.
MPL_PATHS=(
  "docs"
  "services/mcp" "services/ca"
  "shells/web" "shells/cli" "shells/tui"
  "shells/tauri-desktop" "shells/tauri-mobile" "shells/chrome-extension"
)

# The one path whose licensed music must NEVER be pushed (PremiumBeat/Shutterstock).
MUSIC_REL="assets/suse/music"   # relative to the catalog subrepo root

# Extra .gitignore lines per path, appended to any .gitignore carried in the
# archive. The ca rules are SECURITY-CRITICAL: services/ca has no local
# .gitignore today and relies on the ROOT one to keep the root private key out.
gitignore_extra() {
  case "$1" in
    catalog)      printf '%s\n' '.DS_Store' 'node_modules/' ;;  # music INCLUDED (public, time-boxed to 2026-08-29 removal — Andy's call)
    services/ca)  printf '%s\n' '.DS_Store' 'node_modules/' '*.pem' 'lolly-root-key.pem' '.env' ;;
    services/mcp) printf '%s\n' '.DS_Store' 'node_modules/' '.browsers/' ;;
    # Shells relied on the ROOT .gitignore for build-output rules — replicate the
    # relevant ones here so the standalone subrepo never commits dist/vercel/etc.
    shells/web)   printf '%s\n' '.DS_Store' 'node_modules/' 'dist/' '.vercel' 'coverage' \
                    'public/_testlogos/' 'public/info/*.html' 'public/info/logos/' 'public/info/og/' \
                    'public/t/' 'public/view/' ;;
    shells/tauri-desktop|shells/tauri-mobile)
                  printf '%s\n' '.DS_Store' 'node_modules/' 'dist/' '.vercel' 'src-tauri/target/' 'src-tauri/gen/' ;;
    *)            printf '%s\n' '.DS_Store' 'node_modules/' 'dist/' ;;
  esac
}

# --- helpers ---------------------------------------------------------------

# All monorepo paths, in map order.
subrepo_paths() { local e; for e in "${SUBREPO_MAP[@]}"; do echo "${e%%|*}"; done; }

# repo name for a monorepo path (empty + non-zero exit if unknown).
repo_for_path() {
  local p="$1" e
  for e in "${SUBREPO_MAP[@]}"; do [ "${e%%|*}" = "$p" ] && { echo "${e##*|}"; return 0; }; done
  return 1
}

is_mpl_path() { local p="$1" m; for m in "${MPL_PATHS[@]}"; do [ "$m" = "$p" ] && return 0; done; return 1; }

subrepo_url() { echo "${GIT_HOST}/${ORG}/$(repo_for_path "$1").git"; }

# Human-readable GitHub description per path. Pattern: "lolly.sh: <name> - submodule".
repo_description() {
  case "$1" in
    tools)                    echo "lolly.sh: SUSE Tool Definitions - submodule" ;;
    catalog)                  echo "lolly.sh: SUSE Brand Catalog - submodule" ;;
    docs)                     echo "lolly.sh: Documentation - submodule" ;;
    services/mcp)             echo "lolly.sh: MCP Server - submodule" ;;
    services/ca)              echo "lolly.sh: Certificate Authority - submodule" ;;
    shells/web)               echo "lolly.sh: Shell: Web Interface - submodule" ;;
    shells/cli)               echo "lolly.sh: Shell: CLI - submodule" ;;
    shells/tui)               echo "lolly.sh: Shell: Terminal UI - submodule" ;;
    shells/tauri-desktop)     echo "lolly.sh: Shell: Desktop (Tauri) - submodule" ;;
    shells/tauri-mobile)      echo "lolly.sh: Shell: Mobile (Tauri) - submodule" ;;
    shells/chrome-extension)  echo "lolly.sh: Shell: Chrome Extension - submodule" ;;
    *)                        echo "lolly.sh: submodule" ;;
  esac
}

# tar --strip-components depth = number of path segments (tools=1, shells/web=2).
path_depth() { local p="$1"; echo $(( $(tr -cd '/' <<<"$p" | wc -c) + 1 )); }

# --- Pretty logging --------------------------------------------------------
# 256-colour palette. Degrades to plain text when stdout isn't a TTY or when
# NO_COLOR is set (https://no-color.org). Sourced by every subrepo script, so a
# piped `loldev status > file` stays clean while an interactive run is candy.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  c_reset=$'\033[0m';        c_bold=$'\033[1m';         c_dim=$'\033[2m';          c_ital=$'\033[3m'
  c_grn=$'\033[38;5;42m';    c_teal=$'\033[38;5;44m';   c_cyan=$'\033[38;5;51m'
  c_yel=$'\033[38;5;220m';   c_orange=$'\033[38;5;214m';c_red=$'\033[38;5;203m'
  c_pink=$'\033[38;5;211m';  c_purple=$'\033[38;5;177m';c_blue=$'\033[38;5;75m'
  c_gray=$'\033[38;5;245m';  c_white=$'\033[38;5;231m'
else
  c_reset=''; c_bold=''; c_dim=''; c_ital=''
  c_grn=''; c_teal=''; c_cyan=''; c_yel=''; c_orange=''; c_red=''
  c_pink=''; c_purple=''; c_blue=''; c_gray=''; c_white=''
fi

# Repeat a (possibly multibyte) string $2 times — BSD/macOS `tr` can't do it, so
# we build the string ourselves. Used for the full-width decorative rules.
_repeat() { local s="$1" n="${2:-0}" out=''; while [ "$n" -gt 0 ]; do out+="$s"; n=$((n-1)); done; printf '%s' "$out"; }

# Width for decorative rules: terminal columns, capped, with a sane fallback.
_rule_w() {
  local w="${COLUMNS:-}"
  case "$w" in ''|*[!0-9]*) w=$(tput cols 2>/dev/null || echo 60) ;; esac
  case "$w" in ''|*[!0-9]*) w=60 ;; esac
  [ "$w" -gt 64 ] && w=64
  printf '%s' "$w"
}

# A thin full-width divider.
rule() { printf "${c_dim}${c_teal}%s${c_reset}\n" "$(_repeat '─' "$(_rule_w)")"; }

# banner EMOJI TITLE [SUBTITLE] — the spaced header block for a top-level command.
banner() {
  echo
  printf "  %s  ${c_bold}${c_grn}%s${c_reset}\n" "$1" "$2"
  [ -n "${3:-}" ] && printf "     ${c_gray}${c_ital}%s${c_reset}\n" "$3"
  rule
}

# phase EMOJI TITLE — a section divider with breathing room above it.
phase() { printf "\n${c_bold}${c_purple}%s  %s${c_reset}\n" "$1" "$2"; }

# step TEXT — an in-progress action line (trailing ellipsis).
step() { printf "  ${c_teal}▸${c_reset} ${c_dim}%s…${c_reset}\n" "$*"; }

say()  { printf "${c_bold}${c_teal}▸ %s${c_reset}\n" "$*"; }
info() { printf "  ${c_gray}%s${c_reset}\n" "$*"; }
ok()   { printf "  ${c_grn}✓${c_reset} %s\n" "$*"; }
warn() { printf "  ${c_yel}▲${c_reset} ${c_yel}%s${c_reset}\n" "$*"; }
err()  { printf "  ${c_red}✗${c_reset} ${c_red}%s${c_reset}\n" "$*" >&2; }
