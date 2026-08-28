#!/usr/bin/env bash
# Assemble the models tree (hardlinks - no byte copies) and deploy the static
# model host. Run from anywhere; paths are repo-relative to this script.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
src="$repo/shells/web/public/models"
[ -d "$src" ] || { echo "no models at $src" >&2; exit 1; }
rm -rf "$here/models"
mkdir -p "$here/models"
# Hardlink every model dir, skipping the .candidates staging dirs.
(cd "$src" && find . -type d -name .candidates -prune -o -type f -print) | while read -r f; do
  rel="${f#./}"
  mkdir -p "$here/models/$(dirname "$rel")"
  ln "$src/$rel" "$here/models/$rel"
done
du -sh "$here/models"
cd "$here"
npx vercel deploy --prod --archive=tgz --yes
