#!/usr/bin/env bash
# SPDX-License-Identifier: MPL-2.0
#
# make-sources.sh - stage the sources lolly-web.spec needs into ./out/.
#
# The web app is a prebuilt static site (see the header of lolly-web.spec for
# why it cannot be built inside OBS). This script produces:
#
#   out/lolly-web-<version>.tar.zst   Source0: html/ (the release dist) + LICENSE
#                                     + README.md, under a lolly-web-<version>/ top dir
#   out/lolly-web.nginx.conf          Source1: copied from here for convenience
#   out/lolly-web-security-headers.conf  Source2: same
#   out/lolly-web.spec                the spec, copied for convenience
#
# Then, from out/:  rpmbuild -bb --define "_sourcedir $PWD" lolly-web.spec
# or drop the four files into an OBS package.
#
# Usage:
#   ./make-sources.sh                 # use an existing shells/web/dist
#   ./make-sources.sh --build         # run the signed release build first
#   ./make-sources.sh --version 1.0.7 # override the version (default: from the spec)
#
# --build runs scripts/build-release-web.ts, which REQUIRES the catalog signing
# material in the environment:
#   LOLLY_CATALOG_SIGNING_KEY   and   VITE_CATALOG_PUBLIC_KEY_JWK
# Without --build the script uses whatever shells/web/dist already holds, and
# fails loudly if that dist is unsigned or missing its catalog.
#
# PROFILE: a PUBLIC package must be built on the neutral `lolly-start` profile -
# the SUSE tools and assets must never reach a public RPM. Run `npm run
# profile:start` before building. This script warns if the active profile is
# something else.

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
WEB="$REPO/shells/web"
DIST="$WEB/dist"
OUT="$HERE/out"

BUILD=0
VERSION=""
while [ $# -gt 0 ]; do
    case "$1" in
        --build) BUILD=1 ;;
        --version) shift; VERSION="${1:-}" ;;
        --version=*) VERSION="${1#*=}" ;;
        -h|--help) sed -n '3,40p' "$0"; exit 0 ;;
        *) echo "unknown argument: $1" >&2; exit 2 ;;
    esac
    shift
done

# Default the version to whatever the spec declares, so the tarball name and the
# spec never drift.
if [ -z "$VERSION" ]; then
    VERSION="$(sed -n 's/^Version:[[:space:]]*//p' "$HERE/lolly-web.spec" | head -n1)"
fi
[ -n "$VERSION" ] || { echo "could not determine version" >&2; exit 1; }

# Profile sanity: public RPM => neutral profile.
if [ -f "$REPO/.lolly-profile" ]; then
    PROFILE="$(tr -d '[:space:]' < "$REPO/.lolly-profile")"
    if [ "$PROFILE" != "lolly-start" ]; then
        echo "WARNING: active profile is '$PROFILE', not 'lolly-start'." >&2
        echo "         A public RPM must not ship SUSE (or any brand) tools/assets." >&2
        echo "         Run 'npm run profile:start' first unless this is deliberate." >&2
    fi
fi

if [ "$BUILD" -eq 1 ]; then
    echo "==> building signed release web dist (needs LOLLY_CATALOG_SIGNING_KEY + VITE_CATALOG_PUBLIC_KEY_JWK)"
    ( cd "$REPO" && npm run build:web:release )
fi

# Validate the dist before we tar it - the same invariants %check re-asserts, but
# caught here where the fix (rebuild / switch profile) is obvious.
[ -d "$DIST" ] || { echo "ERROR: $DIST does not exist. Build it, or pass --build." >&2; exit 1; }
for f in index.html sw.js manifest.webmanifest catalog/tools/index.json catalog/tools/index.sig.json; do
    [ -e "$DIST/$f" ] || { echo "ERROR: $DIST/$f missing - not a signed release dist." >&2; exit 1; }
done

mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
TOP="lolly-web-$VERSION"
mkdir -p "$STAGE/$TOP"

echo "==> staging dist"
# dereference: catalog/ and tools/ inside dist are already real files (the vite
# closeBundle copies them with dereference), but pass -L anyway so a stray symlink
# can never leave a dangling entry in the tarball. Drop macOS cruft.
cp -aL "$DIST" "$STAGE/$TOP/html"
find "$STAGE/$TOP/html" -name '.DS_Store' -delete

# License + a short readme travel in the tarball so %license / %doc resolve.
cp "$REPO/LICENSE" "$STAGE/$TOP/LICENSE"
if [ -f "$WEB/README.md" ]; then
    cp "$WEB/README.md" "$STAGE/$TOP/README.md"
else
    cp "$HERE/README.md" "$STAGE/$TOP/README.md"
fi

echo "==> writing out/$TOP.tar.zst"
rm -f "$OUT/$TOP.tar.zst"
tar --zstd -cf "$OUT/$TOP.tar.zst" -C "$STAGE" "$TOP"

# The committed sources + the spec, so out/ is a complete build input on its own.
cp "$HERE/lolly-web.nginx.conf"            "$OUT/"
cp "$HERE/lolly-web-security-headers.conf" "$OUT/"
cp "$HERE/lolly-web.spec"                  "$OUT/"

echo "==> done. out/ contains:"
ls -la "$OUT"
echo
echo "Build the RPM with:"
echo "  rpmbuild -bb --define \"_sourcedir $OUT\" \"$OUT/lolly-web.spec\""
