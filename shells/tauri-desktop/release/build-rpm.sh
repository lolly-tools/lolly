#!/usr/bin/env bash
#
# Build an openSUSE RPM in a container. Usage:
#   release/build-rpm.sh tumbleweed
#   release/build-rpm.sh leap16
#
# rpm/make-sources.sh must have run first - the spec is fed PREBUILT tarballs
# (dist/, a cargo vendor tree, the ONNX Runtime archive) because OBS builds
# offline and this tree cannot be built that way from a plain checkout.
#
# Do NOT point the build at /tmp on a machine where that is tmpfs: a cargo
# target dir for this package is several GB of resident memory, and it surfaces
# first as rustc dying with SIGKILL and no diagnostic.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

target="${1:-tumbleweed}"
case "$target" in
  tumbleweed) base="opensuse/tumbleweed"; image="lolly-rpm-tumbleweed"; dist="" ;;
  leap16)     base="opensuse/leap:16.0";  image="lolly-rpm-leap16";     dist=".leap16" ;;
  *) die "unknown target '$target' (expected: tumbleweed | leap16)" ;;
esac

SRC="$DESKTOP/rpm/out"
[ -f "$SRC/lolly-desktop-${VERSION}.tar.zst" ] \
  || die "no sources for $VERSION - run rpm/make-sources.sh [--skip-frontend] first"

if ! docker image inspect "$image" >/dev/null 2>&1; then
  step "Building $image"
  docker build -t "$image" --build-arg "BASE=$base" \
    -f "$release_dir/containers/Dockerfile.rpm" "$release_dir/containers"
fi

TOP="$CACHE/rpmbuild-$target"
step "rpmbuild $target (dist='${dist:-<none>}')"
"${DOCKER_RUN[@]}" -e TOP="$TOP" -e SRC="$SRC" -e DIST="$dist" "$image" bash -c '
  set -euo pipefail
  rm -rf "$TOP"; mkdir -p "$TOP"/{SOURCES,SPECS,BUILD,BUILDROOT,RPMS,SRPMS}
  cp "$SRC"/*.tar.zst "$SRC"/*.tgz "$SRC"/cargo_config "$TOP/SOURCES/"
  cp "$SRC"/lolly-desktop.spec "$TOP/SPECS/"
  args=(-bb --define "_topdir $TOP")
  [ -n "$DIST" ] && args+=(--define "dist $DIST")
  rpmbuild "${args[@]}" "$TOP/SPECS/lolly-desktop.spec"
'

rpm_path="$(find "$TOP/RPMS" -name '*.rpm' | head -1)"
[ -n "$rpm_path" ] || die "rpmbuild produced no RPM"
cp "$rpm_path" "$OUT/"
dst="$OUT/$(basename "$rpm_path")"

rpm -qpR "$dst" 2>/dev/null | grep -q libayatana-appindicator3 \
  || die "$(basename "$dst") does not require libayatana-appindicator3 - it can install onto a system where it crashes"
rpm -qpR "$dst" 2>/dev/null | grep -qi onnxruntime \
  && die "links a SHARED libonnxruntime; expected static"
step "Wrote $dst"
