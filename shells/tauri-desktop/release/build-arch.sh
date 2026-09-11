#!/usr/bin/env bash
#
# Build the Arch package and refresh the hosted pacman repo.
#
# The PKGBUILD repacks the PUBLISHED .deb from lolli.li, so the .deb must be
# uploaded BEFORE this runs - makepkg downloads it and checks it against the
# sha256sums line. That is a feature: it verifies the artifact users actually
# receive, not a local copy of it.
#
# Bump PKGBUILD's pkgver + sha256sums first:
#   sha256sum <the .deb>
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

IMAGE="${LOLLY_ARCH_IMAGE:-archlinux:base-devel}"
WORK="$CACHE/arch"
rm -rf "$WORK"; mkdir -p "$WORK/repo"
cp "$DESKTOP/linux/arch/PKGBUILD" "$DESKTOP/linux/arch/.SRCINFO" "$WORK/"

grep -q "pkgver=$VERSION" "$WORK/PKGBUILD" \
  || die "PKGBUILD pkgver is not $VERSION - bump it and its sha256sums first"

step "makepkg (downloads and verifies the published .deb)"
"${DOCKER_RUN[@]}" -u 0:0 -v "$WORK:/work" "$IMAGE" bash -c '
  set -euo pipefail
  useradd -m builder 2>/dev/null || true
  rm -rf /home/builder/pkg && mkdir -p /home/builder/pkg
  cp /work/PKGBUILD /work/.SRCINFO /home/builder/pkg/
  chown -R builder:builder /home/builder/pkg
  su builder -c "cd /home/builder/pkg && makepkg --noconfirm --nodeps"
  su builder -c "cd /home/builder/pkg && makepkg --printsrcinfo > .SRCINFO"
  cp /home/builder/pkg/*.pkg.tar.zst /home/builder/pkg/.SRCINFO /work/
'
# AUR rejects a push whose .SRCINFO is stale, so keep the generated one.
cp "$WORK/.SRCINFO" "$DESKTOP/linux/arch/.SRCINFO"

pkg="$(basename "$(find "$WORK" -maxdepth 1 -name '*.pkg.tar.zst' | head -1)")"
cp "$WORK/$pkg" "$WORK/repo/"

step "repo-add"
"${DOCKER_RUN[@]}" -v "$WORK:/work" "$IMAGE" bash -c '
  set -euo pipefail
  cd /work/repo
  repo-add lolly.db.tar.gz *.pkg.tar.zst
  # repo-add leaves lolly.db a SYMLINK to lolly.db.tar.gz. Buckets do not do
  # symlinks, so each name has to become a real copy of its target.
  for n in db files; do rm -f "lolly.$n"; cp -f "lolly.$n.tar.gz" "lolly.$n"; done
  ls -lL
'
mkdir -p "$OUT/arch/x86_64" && cp "$WORK/repo/"* "$OUT/arch/x86_64/"
step "Wrote $OUT/arch/x86_64/ ($pkg + db)"
