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
#
# Ask the resolver, not the .lolly-profile file: nothing writes that file since the
# subrepo collapse removed the view builder and its postinstall, so a checkout that
# selects the private pack with LOLLY_PROFILE=suse used to read back as 'unknown' and
# sail past this guard. An unresolvable profile is fatal for the same reason - a guard
# that cannot see the answer must not pass.
assert_public_profile() {
  local profile
  # `|| true`: the resolver exits non-zero when no profile is mounted, and under
  # `set -e` that would kill the script before the message below is printed.
  profile="$(cd "$REPO" && node scripts/profile.ts 2>/dev/null | sed -n 's/^profile[[:space:]]*//p' || true)"
  [ -n "$profile" ] || die "could not resolve the content profile - run 'pnpm run profile' in $REPO to see why"
  [ "$profile" != "suse" ] || die "content profile is 'suse' (private pack) - build with LOLLY_PROFILE=lolly-start"
  echo "active content profile: $profile"
}
