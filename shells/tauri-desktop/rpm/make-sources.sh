#!/usr/bin/env bash
#
# Produce every source artifact lolly-desktop.spec needs, ready to `osc add`.
#
# OBS builds are OFFLINE, and this app cannot be built offline from a plain git
# checkout for three separate reasons (see the spec header for the long version):
#
#   * the frontend is the web shell, built by Vite against the whole umbrella repo
#     and embedded into the Rust binary at compile time  -> we prebuild dist/
#   * ~600 cargo crates                                  -> we `cargo vendor`
#   * ort-sys downloads ONNX Runtime from its build.rs   -> we ship that tarball
#
# So the OBS package is fed prebuilt tarballs rather than a git service. Run this on
# a machine that CAN build (network + node 24 + rust >= 1.88), then commit the output.
#
# Usage:
#   ./make-sources.sh [--out DIR] [--skip-frontend]
#
#   --skip-frontend   reuse an existing ../dist instead of rebuilding it. Only safe
#                     if that dist was built from the current tree by this shell's
#                     `pnpm run build:frontend:release` - a stale dist is silently embedded
#                     into the binary and is invisible in the finished RPM.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
desktop="$(cd "$here/.." && pwd)"          # shells/tauri-desktop
repo="$(cd "$desktop/../.." && pwd)"       # umbrella repo root

out="$here/out"
skip_frontend=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out) out="$2"; shift 2 ;;
    --skip-frontend) skip_frontend=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v cargo >/dev/null || die "cargo not found (need rust >= 1.88)"
command -v node  >/dev/null || die "node not found (need node 24 - see .nvmrc)"
command -v tar   >/dev/null || die "tar not found"
command -v zstd  >/dev/null || die "zstd not found"

version="$(node -p "require('$desktop/src-tauri/tauri.conf.json').version")"
[ -n "$version" ] || die "could not read version from tauri.conf.json"
name="lolly-desktop"
stage="$out/$name-$version"

step "Building $name $version sources into $out"
rm -rf "$out"
mkdir -p "$stage"

# --------------------------------------------------------------------------
# 0. Which brand is this? Ask the resolver, and ask BEFORE building the frontend -
#    the build bakes the brand into dist/, so a check afterwards is a check on an
#    artifact that already exists. There is no .lolly-profile state file any more
#    (the subrepo collapse removed the view builder that wrote it), so reading one
#    would report 'unknown' for every checkout, including one pointed at the private
#    pack with LOLLY_PROFILE=suse.
# --------------------------------------------------------------------------
active_profile="$(cd "$repo" && node scripts/profile.ts 2>/dev/null | sed -n 's/^profile[[:space:]]*//p' || true)"
echo "    content profile: ${active_profile:-<unresolved>}"
case "$active_profile" in
  lolly-start) ;;  # the public blank brand - the only thing we may publish
  suse) die "refusing to package the private SUSE profile; build with LOLLY_PROFILE=lolly-start" ;;
  *) die "could not resolve a publishable profile (got '${active_profile:-}'); build with LOLLY_PROFILE=lolly-start" ;;
esac

# --------------------------------------------------------------------------
# 1. Frontend. Vite is rooted at shells/web and writes a real tools/ + catalog/
#    tree into dist/ from the profile above (materializeInto), so that profile
#    decides what ships. Public builds must be on a public profile - brands/suse
#    is a private pack and must never be baked into a published RPM.
# --------------------------------------------------------------------------
if [ "$skip_frontend" -eq 0 ]; then
  step "Building signed frontend (LOLLY_EMBED_CATALOG=profile pnpm run build:frontend:release)"
  # profile, not the shells' 'neutral' default: profile embeds catalog/previews/, the
  # per-tool gallery thumbnails. Neutral deliberately omits them (plans/131 WP-A), and
  # the visible cost is a gallery where every tile renders itself on first load. Safe
  # here because the guard above has already established the profile is lolly-start,
  # the public blank brand.
  #
  # Rebuild the previews first if the tool set changed, or you embed stale art:
  #   pnpm run build:ort && pnpm run previews
  # (build:ort is not optional - previews drives a web build that hard-fails without it.)
  ( cd "$desktop" && LOLLY_EMBED_CATALOG=profile pnpm run build:frontend:release )
else
  step "Reusing existing dist/ (--skip-frontend)"
fi
[ -d "$desktop/dist" ] || die "no dist/ - drop --skip-frontend"

# --------------------------------------------------------------------------
# 2. Cargo vendor tree.
# --------------------------------------------------------------------------
step "Vendoring cargo dependencies"
rm -rf "$desktop/src-tauri/vendor"
( cd "$desktop/src-tauri" && cargo vendor --versioned-dirs --locked vendor >"$out/cargo_config" )
# `cargo vendor` prints the config it wants on stdout; the spec installs it verbatim
# to src-tauri/.cargo/config.toml, where its relative `directory = "vendor"` resolves
# to src-tauri/vendor. See the %prep note in the spec before changing either path.
grep -q 'directory = "vendor"' "$out/cargo_config" \
  || die "cargo_config does not point at 'vendor' - the spec's %prep assumes it does"

# --------------------------------------------------------------------------
# 3. ONNX Runtime, taken from the VENDORED ort-sys's own dist table so the URL and
#    hash can never drift from the pinned crate. Feature set is "none": the crate
#    enables no cuda/webgpu/training feature (see src-tauri/Cargo.toml).
# --------------------------------------------------------------------------
step "Fetching ONNX Runtime prebuilts"
dist_txt="$(echo "$desktop"/src-tauri/vendor/ort-sys-*/dist.txt)"
[ -f "$dist_txt" ] || die "vendored ort-sys dist.txt not found at $dist_txt"

for target in x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu; do
  line="$(awk -F'\t' -v t="$target" '$1=="none" && $2==t {print; exit}' "$dist_txt")"
  [ -n "$line" ] || die "no 'none' dist entry for $target in $dist_txt"
  url="$(printf '%s' "$line" | cut -f3)"
  want="$(printf '%s' "$line" | cut -f4 | tr 'A-F' 'a-f')"
  dest="$out/onnxruntime-$target.tgz"

  echo "    $target"
  curl -fsSL -o "$dest" "$url" || die "download failed: $url"
  got="$(sha256sum "$dest" | cut -d' ' -f1)"
  [ "$got" = "$want" ] || die "sha256 mismatch for $target: got $got want $want"
  # The spec asserts this layout; catch a repackaged upstream here rather than in OBS.
  tar tzf "$dest" | grep -q '^onnxruntime/lib/libonnxruntime\.a$' \
    || die "$target tarball no longer contains onnxruntime/lib/libonnxruntime.a"
done

# --------------------------------------------------------------------------
# 4. Stage the source tree. Deliberately excludes vendor/ (shipped separately as
#    Source1) and target/ (build output).
# --------------------------------------------------------------------------
step "Staging source tree"
mkdir -p "$stage/src-tauri" "$stage/packaging"

tar -C "$desktop" -cf - \
    --exclude=./src-tauri/vendor \
    --exclude=./src-tauri/target \
    ./src-tauri | tar -C "$stage" -xf -

# dist/ must be a SIBLING of src-tauri/: tauri.conf.json's frontendDist is "../dist",
# resolved relative to src-tauri, and tauri-build embeds it via generate_context!().
cp -a "$desktop/dist" "$stage/dist"

cp -a "$desktop/LICENSE" "$stage/LICENSE"
cp -a "$desktop/README.md" "$stage/README.md"

# linux/ - the freedesktop INTEGRATION layer (MIME type, thumbnailer, GNOME Shell
# search provider, D-Bus activation, KDE service menu). The spec's %install reads
# these from linux/ directly, so omitting them fails the build at %install with
# "install: cannot stat 'linux/mime/tools.lolly.Desktop.xml'" - long after the
# ~600-crate compile has finished, which is an expensive way to find out.
cp -a "$desktop/linux" "$stage/linux"

# Freedesktop metadata. Single source of truth is flatpak/ - the .desktop, the
# metainfo and the icons are app metadata, not Flatpak-specific, and both packagings
# install the identical files. Keep them there so the two cannot drift.
cp -a "$desktop/flatpak/tools.lolly.Desktop.desktop"    "$stage/packaging/"
cp -a "$desktop/flatpak/tools.lolly.Desktop.metainfo.xml" "$stage/packaging/"
for s in 32 64 128 256 512; do
  cp -a "$desktop/flatpak/icon-$s.png" "$stage/packaging/"
done

# --------------------------------------------------------------------------
# 5. Tar it all up. zstd: OBS handles .tar.zst and it is far faster than xz on a
#    tree this size (dist/ alone is ~170 MB).
# --------------------------------------------------------------------------
step "Creating tarballs"
tar -C "$out" --zstd -cf "$out/$name-$version.tar.zst" "$name-$version"
rm -rf "$stage"

tar -C "$desktop/src-tauri" --zstd -cf "$out/vendor.tar.zst" vendor

cp "$here/lolly-desktop.spec" "$out/lolly-desktop.spec"

step "Done"
ls -lh "$out"
cat <<EOF

Next:
  cd <your osc checkout of home:<user>/lolly-desktop>
  cp $out/* .
  osc addremove && osc commit -m "lolly-desktop $version"

Repositories to enable in the OBS project (Tumbleweed, Leap 16). The
dependency tree needs Rust >= 1.88; if a target's default 'rust' is older, add
devel:languages:rust as a repository path and switch the spec's BuildRequires to
the versioned cargo1.88/rust1.88 packages.
EOF
