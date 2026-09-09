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

# Cheap guards against the failure modes that have actually shipped.
[ -s "$DESKTOP/dist/precache.json" ] || die "dist/precache.json missing - offline model list would read 'Not offered by this server'"
ls "$DESKTOP"/dist/info/*.html >/dev/null 2>&1 || die "dist/info/*.html missing - every in-app #/docs route would 404"

step "Compiling and bundling the .deb in $IMAGE"
"${DOCKER_RUN[@]}" -e CARGO_TARGET_DIR -w "$DESKTOP" "$IMAGE" bash -c '
  set -euo pipefail
  export PATH="$HOME/.cargo/bin:$(echo "$HOME"/.nvm/versions/node/v*/bin | tr " " :):$PATH"
  node -v && cargo -V
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
