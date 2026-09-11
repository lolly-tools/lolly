#!/usr/bin/env bash
#
# Build the amd64 .deb in a container.
#
# The host is not used for the link step on purpose: a machine without the
# webkit2gtk/GTK -dev packages fails with "rust-lld: unable to find library
# -lgtk-3" and a wall of similar errors, which reads like a code fault and is
# not one. The container owns those headers; node and cargo come from the host.
#
# dist/ is built HERE, on the host, and tauri's beforeBuildCommand is then
# emptied. That is not a shortcut - `tauri build` re-runs beforeBuildCommand
# itself, and unless LOLLY_EMBED_CATALOG survives into that re-run it rebuilds
# dist/ in the default 'neutral' mode and silently drops the tool previews.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

IMAGE="${LOLLY_DEB_IMAGE:-lolly-deb-builder}"
export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$CACHE/cargo-target-deb}"

assert_public_profile

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  step "Building $IMAGE"
  docker build -t "$IMAGE" -f "$release_dir/containers/Dockerfile.deb" "$release_dir/containers"
fi

step "Building signed frontend (profile mode) on the host"
( cd "$DESKTOP" && LOLLY_EMBED_CATALOG=profile pnpm run build:frontend:release )

# tauri.conf.json's beforeBuildCommand is
#   build:frontend:release && build:quicklook && build:cli-sidecar
# and we blank it below, so EVERY part of it has to be run here instead. Miss this
# one and src-tauri/bin/ keeps its 197-byte placeholder: the .deb still builds,
# installs and runs, and `lolly-cli` just prints "this build has no bundled CLI"
# and exits 3. (build:quicklook is macOS-only and irrelevant to the .deb.)
step "Building the CLI sidecar on the host"
( cd "$DESKTOP" && pnpm run build:cli-sidecar )

# Cheap guards against the failure modes that have actually shipped.
sidecar="$DESKTOP/src-tauri/bin/lolly-cli-x86_64-unknown-linux-gnu"
[ -f "$sidecar" ] || die "$sidecar missing - the CLI sidecar did not build"
[ "$(stat -c%s "$sidecar")" -ge 10000000 ] \
  || die "$sidecar is $(stat -c%s "$sidecar") bytes - that is the placeholder stub, not the real CLI"
[ -s "$DESKTOP/dist/precache.json" ] || die "dist/precache.json missing - offline model list would read 'Not offered by this server'"
ls "$DESKTOP"/dist/info/*.html >/dev/null 2>&1 || die "dist/info/*.html missing - every in-app #/docs route would 404"

step "Compiling and bundling the .deb in $IMAGE"
"${DOCKER_RUN[@]}" -e CARGO_TARGET_DIR -w "$DESKTOP" "$IMAGE" bash -c '
  set -euo pipefail
  # Pick the HIGHEST node, not the first one the glob happens to yield. A plain
  # v* glob sorts LEXICOGRAPHICALLY, so a machine carrying an old nvm install puts
  # v10.16.0 ahead of v24.20.0 and the Tauri CLI dies on optional chaining with
  # "SyntaxError: Unexpected token ." - which reads like a corrupt install, not a
  # PATH problem. sort -V orders by version.
  node_bin="$(ls -d "$HOME"/.nvm/versions/node/v*/bin 2>/dev/null | sort -V | tail -1)"
  export PATH="$HOME/.cargo/bin${node_bin:+:$node_bin}:$PATH"
  node -v && cargo -V
  case "$(node -v)" in v2[2-9].*|v[3-9][0-9].*) ;; *) echo "error: need node >= 22, got $(node -v)" >&2; exit 1 ;; esac
  ./node_modules/.bin/tauri build --bundles deb --config "{\"build\":{\"beforeBuildCommand\":\"\"}}"
'

bin="$CARGO_TARGET_DIR/release/lolly-desktop"
size_mb=$(( $(stat -c%s "$bin") / 1024 / 1024 ))
# A build that lost --features tauri/custom-protocol still compiles, links,
# installs and starts - it just cannot load its own UI. Size is the only signal.
[ "$size_mb" -ge 80 ] || die "binary is ${size_mb} MB (<80) - the frontend is NOT embedded"
echo "binary: ${size_mb} MB (frontend embedded)"

src="$CARGO_TARGET_DIR/release/bundle/deb/Lolly_${VERSION}_amd64.deb"
dst="$OUT/lolly-desktop-${VERSION}_amd64.deb"
cp "$src" "$dst"
dpkg-deb -f "$dst" Package Version Architecture Depends
dpkg-deb -f "$dst" Depends | grep -q libayatana-appindicator3-1 \
  || die "Depends is missing libayatana-appindicator3-1 - the tray dlopens it lazily and the app dies on launch"
step "Wrote $dst"
