# Shared settings for the Linux release scripts. Source, do not execute.
set -euo pipefail

release_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP="$(cd "$release_dir/.." && pwd)"          # shells/tauri-desktop
REPO="$(cd "$DESKTOP/../.." && pwd)"              # umbrella repo root

CACHE="${LOLLY_BUILD_CACHE:-$HOME/.cache/lolly-release}"
OUT="${LOLLY_RELEASE_OUT:-$CACHE/artifacts}"
mkdir -p "$CACHE" "$OUT"

VERSION="$(node -p "require('$DESKTOP/src-tauri/tauri.conf.json').version")"
[ -n "$VERSION" ] || { echo "could not read version from tauri.conf.json" >&2; exit 1; }

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
die()  { echo "error: $*" >&2; exit 1; }

# SELinux (Fedora and friends) blocks a container reading a plain bind mount.
# label=disable is correct here and :z/:Z is NOT - relabelling $HOME would
# rewrite the labels of the entire home tree.
DOCKER_RUN=(docker run --rm --security-opt label=disable
            -u "$(id -u):$(id -g)" -e HOME="$HOME" -v "$HOME:$HOME")

# The active content profile decides what gets baked into the binary.
# brands/suse is a PRIVATE pack and must never reach a published artifact.
assert_public_profile() {
  local profile
  profile="$(cat "$REPO/.lolly-profile" 2>/dev/null || echo unknown)"
  [ "$profile" != "suse" ] || die "active profile is 'suse' (private pack) - run 'pnpm run profile:start'"
  echo "active content profile: $profile"
}
