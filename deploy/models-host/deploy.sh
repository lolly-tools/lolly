#!/usr/bin/env bash
# Optional Vercel model host for a separately configured instance. Production
# Lolly models use verified releases on UpCloud, not this adapter.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
[ "${LOLLY_MODELS_VERCEL:-}" = "1" ] || {
  echo "Vercel model deployment is opt-in for another instance; set LOLLY_MODELS_VERCEL=1 and explicit domain/project/org IDs" >&2
  exit 1
}
node "$repo/scripts/lib/deployment-policy.ts" \
  "${LOLLY_MODELS_DOMAIN:-}" "${VERCEL_PROJECT_ID:-}" "${VERCEL_ORG_ID:-}"
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
