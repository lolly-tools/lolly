#!/usr/bin/env bash
#
# Lolly workstation setup - macOS + openSUSE.
#
# Gets a fresh clone to a running state: system prerequisites (git, Node), workspace
# deps, and a content profile. The shells, services, docs and the community tool pack
# are all in this repository; the private SUSE brand pack is the one submodule, and
# --suse mounts it. Safe to re-run (idempotent). See INSTALL.md for the manual path
# and troubleshooting.
#
#   ./setup.sh                     # public setup - community tools + the blank lolly-start brand
#   ./setup.sh --suse              # also mount the PRIVATE SUSE brand pack (needs repo access)
#   ./setup.sh --profile lolly-start   # set this checkout's default content profile
#   ./setup.sh --skip-node         # don't touch Node (you manage it, e.g. via nvm)
#   ./setup.sh --help
#
# Written for bash 3.2 (macOS ships it) - no bash-4 features.
set -euo pipefail

# ── config ──────────────────────────────────────────────────────────────────────
# Node must run TypeScript sources directly (the repo's scripts are `node foo.ts`),
# which needs unflagged type-stripping: Node 22.18+ (22 LTS) or 24+. `.nvmrc` pins 22.
NODE_MIN_MAJOR=22
NODE_MIN_MINOR_ON_22=18
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WITH_SUSE=0
FORCE_PROFILE=""
SKIP_NODE=0

# ── pretty output ─────────────────────────────────────────────────────────────────
if [ -t 1 ]; then B="\033[1m"; G="\033[32m"; Y="\033[33m"; R="\033[31m"; C="\033[36m"; X="\033[0m"; else B=""; G=""; Y=""; R=""; C=""; X=""; fi
step() { printf "${B}${C}==>${X} ${B}%s${X}\n" "$*"; }
ok()   { printf "  ${G}✓${X} %s\n" "$*"; }
warn() { printf "  ${Y}!${X} %s\n" "$*"; }
die()  { printf "${R}✗ %s${X}\n" "$*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

usage() { awk 'NR>=3 && /^# Written for bash/{exit} NR>=3{sub(/^# ?/,"");print}' "$0"; exit 0; }

# ── args ──────────────────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --suse) WITH_SUSE=1 ;;
    --profile) shift; FORCE_PROFILE="${1:-}"; [ -n "$FORCE_PROFILE" ] || die "--profile needs a name (suse | lolly-start)" ;;
    --profile=*) FORCE_PROFILE="${1#*=}" ;;
    --skip-node) SKIP_NODE=1 ;;
    -h|--help) usage ;;
    *) die "unknown option: $1 (try --help)" ;;
  esac
  shift
done

cd "$REPO_ROOT"
[ -f package.json ] && [ -f profiles.json ] || die "run this from the lolly repo root (no package.json/profiles.json here)"

# ── 0. detect OS + package manager ────────────────────────────────────────────────
step "Detecting platform"
OS="$(uname -s)"
PKG=""; SUDO=""
case "$OS" in
  Darwin)
    OSNAME="macOS"
    have brew && PKG="brew" || warn "Homebrew not found - install from https://brew.sh if a prerequisite is missing"
    ;;
  Linux)
    OSNAME="Linux"
    if [ -r /etc/os-release ] && grep -qiE 'suse' /etc/os-release; then
      OSNAME="openSUSE"
      have zypper && PKG="zypper" || warn "zypper not found on this SUSE box"
      [ "$(id -u)" -eq 0 ] || SUDO="sudo"
    else
      warn "Not openSUSE - this script only auto-installs prerequisites on macOS and openSUSE."
      warn "It will still run pnpm install; install git/Node yourself first."
    fi
    ;;
  *) die "unsupported OS: $OS (macOS or openSUSE)" ;;
esac
ok "$OSNAME${PKG:+ (package manager: $PKG)}"

# pkg_install <brew-formula> <zypper-package...> - best-effort, only when PKG is known.
pkg_install() {
  local brew_pkg="$1"; shift
  case "$PKG" in
    brew)   brew list --formula "$brew_pkg" >/dev/null 2>&1 || brew install "$brew_pkg" ;;
    zypper) $SUDO zypper --non-interactive install --no-recommends "$@" ;;
    *) return 1 ;;
  esac
}

# ── 1. git ────────────────────────────────────────────────────────────────────────
step "Checking git"
if have git; then
  ok "git $(git --version | awk '{print $3}')"
else
  warn "git missing - installing"
  pkg_install git git || die "could not install git - install it manually and re-run"
  ok "git installed"
fi

# ── 2. Node ───────────────────────────────────────────────────────────────────────
node_major() { node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1; }
node_minor() { node -v 2>/dev/null | sed 's/^v//' | cut -d. -f2; }
node_ok() {
  have node || return 1
  local maj min; maj="$(node_major)"; min="$(node_minor)"
  [ "$maj" -gt "$NODE_MIN_MAJOR" ] && return 0
  [ "$maj" -eq "$NODE_MIN_MAJOR" ] && [ "$min" -ge "$NODE_MIN_MINOR_ON_22" ] && return 0
  return 1
}

if [ "$SKIP_NODE" -eq 1 ]; then
  step "Node (skipped - --skip-node)"
  node_ok || warn "current node ($(node -v 2>/dev/null || echo none)) may be too old - need >=22.18 or >=24"
else
  step "Checking Node (need >=22.18 for TypeScript sources; .nvmrc pins 22)"
  if node_ok; then
    ok "node $(node -v)"
  else
    if have node; then warn "node $(node -v) is too old - upgrading"; else warn "node missing - installing"; fi
    pkg_install node@22 nodejs22 npm22 || warn "could not install Node via $PKG"
    # Homebrew's node@22 is keg-only - expose it for this session.
    if [ "$PKG" = "brew" ] && ! node_ok; then
      P22="$(brew --prefix node@22 2>/dev/null || true)"
      [ -n "$P22" ] && export PATH="$P22/bin:$PATH"
    fi
    if node_ok; then
      ok "node $(node -v)"
    else
      die "Node is still too old ($(node -v 2>/dev/null || echo none)). Easiest fix - nvm honours .nvmrc:
       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
       # reopen the shell, then:  nvm install   (reads .nvmrc → 22)
     Then re-run ./setup.sh --skip-node"
    fi
  fi
fi
# npm is used only to bootstrap the project's pinned package manager.
have pnpm || { have npm && npm install --global pnpm@11.1.2; } || die "Install pnpm 11.1.2 and re-run ./setup.sh"

# ── 3. the private SUSE brand pack (opt-in) ──────────────────────────────────────
# Everything else - the shells, the services, docs and the community tool pack - is
# in this repository, so a plain clone already has every pnpm workspace on disk.
# brands/suse is the one submodule left, `update = none` (private), so it is only
# fetched when asked for.
if [ "$WITH_SUSE" -eq 1 ]; then
  step "Mounting the private SUSE brand pack"
  if git submodule update --init --checkout brands/suse; then
    ok "brands/suse mounted"
  else
    warn "could not fetch brands/suse - need access to github.com/lolly-tools/suse-lolly."
    warn "Skipping; you'll land on the blank lolly-start brand (everything still builds)."
    WITH_SUSE=0
  fi
fi

# ── 4. dependencies ───────────────────────────────────────────────────────────────
step "Installing workspace dependencies (pnpm install)"
pnpm install
ok "dependencies installed"

# ── 5. content profile ───────────────────────────────────────────────────────────
# Nothing is switched globally any more: there is no tools/ or catalog/ view to
# build, so a profile is resolved per process from profiles.json plus LOLLY_PROFILE
# (packages/node-shell/src/content-roots.ts). --profile writes the sticky local
# choice this checkout defaults to; every profile stays available with
# LOLLY_PROFILE=<name> on the command that wants it.
if [ -n "$FORCE_PROFILE" ]; then
  step "Default content profile for this checkout: $FORCE_PROFILE"
  printf '%s\n' "$FORCE_PROFILE" > .lolly-profile
  ok "wrote .lolly-profile → $FORCE_PROFILE"
fi

# ── 6. done ───────────────────────────────────────────────────────────────────────
echo
step "Setup complete"
node scripts/profile.ts 2>/dev/null || true
cat <<EOF

${B}Next steps${X}
  pnpm run dev:web                 # run the web shell (http://localhost:5173)
  pnpm run cli qr-code --url=https://suse.com --output=./qr.svg
  pnpm test                        # the engine + shell test suites
  pnpm run profile                 # which brand am I looking at, and from where

Docs: README.md · CONTRIBUTING.md · INSTALL.md · docs/authoring-tools.md
EOF
