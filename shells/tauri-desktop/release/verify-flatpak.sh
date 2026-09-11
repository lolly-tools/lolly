#!/usr/bin/env bash
#
# Install and LAUNCH the bundle, and prove it renders.
#
# Every automated check passes on a bundle whose window never paints: it
# installs, it lints, the process starts, WebKit spawns. The one signal that
# separates a working build from a dead one is resident memory - a live render
# sits in the hundreds of MB, a blank window near 40 MB.
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

bundle="${1:-$OUT/lolly-desktop-${VERSION}.flatpak}"
[ -f "$bundle" ] || die "no bundle at $bundle"

step "Installing $bundle"
flatpak install --user --noninteractive --reinstall "$bundle"

step "Launching (25s)"
flatpak run tools.lolly.Desktop >"$CACHE/flatpak-run.log" 2>&1 &
sleep 25

# Match on argv, NOT on comm. Linux caps comm at 15 chars (TASK_COMM_LEN), so ps
# reports "WebKitWebProces" and a /WebKitWebProcess/ pattern NEVER matches - this
# check then reads 0 MB and fails every bundle, including ones that render
# perfectly. A false negative on the one gate that exists to catch a dead bundle
# is worse than no gate, because it trains you to ignore it. The [W] bracket keeps
# the awk process itself from matching.
rss_kb="$(ps -eo rss,args --no-headers | awk '/[W]ebKitWebProcess/ {if ($1>m) m=$1} END {print m+0}')"
rss_mb=$(( rss_kb / 1024 ))
echo "WebKitWebProcess resident: ${rss_mb} MB"

flatpak kill tools.lolly.Desktop 2>/dev/null || true
sleep 2
# NB: match the flatpak app id, never a bare 'lolly-desktop' pattern - that also
# matches 'rpmbuild ... lolly-desktop.spec' and will kill a concurrent build.
pkill -f 'tools\.lolly\.Desktop' 2>/dev/null || true

[ "$rss_mb" -ge 150 ] || die "only ${rss_mb} MB resident - the window is not rendering"
step "Renders. (log: $CACHE/flatpak-run.log)"
