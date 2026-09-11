#!/usr/bin/env bash
#
# Build the Flatpak bundle from the already-built .deb.
#
# The manifest does not build from source (flatpak-builder runs offline); it
# unpacks the .deb and adds the ayatana-appindicator stack from shared-modules.
# That stack is not optional: the tray dlopens libayatana-appindicator3 lazily,
# no org.gnome.Platform ships it, and every bundle built without it installed
# cleanly, passed lint, and then died the instant it launched.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

deb="${1:-$OUT/lolly-desktop-${VERSION}_amd64.deb}"
[ -f "$deb" ] || die "no .deb at $deb - run release/build-deb.sh first"
[ -e "$DESKTOP/flatpak/shared-modules/libayatana-appindicator/libayatana-appindicator-gtk3.json" ] \
  || die "flatpak/shared-modules is empty - run: git submodule update --init --recursive"

cd "$DESKTOP/flatpak"
cp "$deb" lolly.deb

step "flatpak-builder"
rm -rf build-dir repo .flatpak-builder/build
flatpak-builder --user --disable-rofiles-fuse --force-clean \
  --repo=repo build-dir tools.lolly.Desktop.yml

# Verify the stack is actually IN the tree before bundling, not after shipping.
for lib in libayatana-appindicator3.so.1 libayatana-indicator3.so.7 libdbusmenu-glib.so.4; do
  [ -e "build-dir/files/lib/$lib" ] || die "$lib missing from the build - this bundle would die on launch"
done
echo "ayatana-appindicator stack: bundled"

bundle="$OUT/lolly-desktop-${VERSION}.flatpak"
flatpak build-bundle repo "$bundle" tools.lolly.Desktop \
  --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo
step "Wrote $bundle"
echo "Now RUN it - see release/verify-flatpak.sh. 'It built' is exactly what was"
echo "true of the two bundles that shipped broken."
