#!/bin/sh
# SPDX-License-Identifier: MPL-2.0
set -eu

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Quick Look extensions skipped (macOS only)"
  exit 0
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DESKTOP_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
SOURCE_DIR="$DESKTOP_DIR/macos/quicklook"
BUILD_DIR="$SOURCE_DIR/build"
APP_VERSION=$(node -p "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')).version" \
  "$DESKTOP_DIR/package.json")
BUILD_VERSION=$(printf '%s' "$APP_VERSION" | tr -cd '0-9')
if [ -z "$BUILD_VERSION" ]; then BUILD_VERSION=1; fi

mkdir -p "$BUILD_DIR/LollyThumbnail.appex/Contents/MacOS"
mkdir -p "$BUILD_DIR/LollyPreview.appex/Contents/MacOS"
cp "$SOURCE_DIR/Thumbnail-Info.plist" "$BUILD_DIR/LollyThumbnail.appex/Contents/Info.plist"
cp "$SOURCE_DIR/Preview-Info.plist" "$BUILD_DIR/LollyPreview.appex/Contents/Info.plist"

for plist in \
  "$BUILD_DIR/LollyThumbnail.appex/Contents/Info.plist" \
  "$BUILD_DIR/LollyPreview.appex/Contents/Info.plist"
do
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $APP_VERSION" "$plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_VERSION" "$plist"
done

COMMON_FLAGS="-fobjc-arc -fmodules -fapplication-extension -Wall -Wextra -Werror -arch arm64 -arch x86_64"

# shellcheck disable=SC2086
xcrun clang $COMMON_FLAGS \
  -mmacosx-version-min=10.15 \
  -framework AppKit -framework Foundation -framework QuickLookThumbnailing -lz \
  -Wl,-e,_NSExtensionMain \
  "$SOURCE_DIR/LollyArchiveThumbnail.m" "$SOURCE_DIR/ThumbnailProvider.m" \
  -o "$BUILD_DIR/LollyThumbnail.appex/Contents/MacOS/LollyThumbnail"

# shellcheck disable=SC2086
xcrun clang $COMMON_FLAGS -mmacosx-version-min=12.0 \
  -framework AppKit -framework Foundation -framework QuickLookUI \
  -framework UniformTypeIdentifiers -lz -Wl,-e,_NSExtensionMain \
  "$SOURCE_DIR/LollyArchiveThumbnail.m" "$SOURCE_DIR/PreviewProvider.m" \
  -o "$BUILD_DIR/LollyPreview.appex/Contents/MacOS/LollyPreview"

SIGNING_IDENTITY=${APPLE_SIGNING_IDENTITY:--}
codesign --force --sign "$SIGNING_IDENTITY" --options runtime \
  --entitlements "$SOURCE_DIR/QuickLook.entitlements" \
  "$BUILD_DIR/LollyThumbnail.appex" >/dev/null
codesign --force --sign "$SIGNING_IDENTITY" --options runtime \
  --entitlements "$SOURCE_DIR/QuickLook.entitlements" \
  "$BUILD_DIR/LollyPreview.appex" >/dev/null

if [ "${1:-}" = "--probe" ]; then
  if [ "$#" -ne 2 ]; then
    echo "usage: $0 --probe sample.lolly" >&2
    exit 64
  fi
  xcrun clang -fobjc-arc -fmodules -Wall -Wextra -Werror \
    -framework Foundation -lz \
    "$SOURCE_DIR/LollyArchiveThumbnail.m" "$SOURCE_DIR/ArchiveProbe.m" \
    -o "$BUILD_DIR/lolly-quicklook-probe"
  "$BUILD_DIR/lolly-quicklook-probe" "$2"
fi

echo "Built universal Lolly Quick Look thumbnail and preview extensions"
