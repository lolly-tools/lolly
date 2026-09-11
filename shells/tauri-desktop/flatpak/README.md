# Lolly - Flatpak packaging

Builds the Tauri desktop app as a Linux [Flatpak](https://flatpak.org/). **This cannot
be built on macOS** - Flatpak is Linux-only and Tauri does not cross-compile. Use the
CI workflow (`.github/workflows/flatpak.yml`, runs on `v*` tags) or a Linux machine.

## How it works

Rather than compile Lolly inside the offline flatpak-builder sandbox (which would need
every cargo crate and npm package vendored as a source), we build a **`.deb` first** -
where the network and the webkit2gtk toolchain are available - and the manifest just
unpacks that prebuilt binary into `/app`.

```
tauri build --bundles deb  ──►  Lolly_x.y.z_amd64.deb  ──►  flatpak-builder  ──►  Lolly.flatpak
   (network + webkit deps)          (staged as lolly.deb)      (offline unpack)
```

## Files

| File | Role |
|---|---|
| `tools.lolly.Desktop.yml` | flatpak-builder manifest (app id = the Tauri `identifier`) |
| `tools.lolly.Desktop.desktop` | desktop entry (exported to the host menu) |
| `tools.lolly.Desktop.metainfo.xml` | AppStream metadata (id must match the app id) |
| `icon-{32,128,256}.png` | hicolor icons, copied from `../src-tauri/icons/` |
| `lolly.deb` | **not committed** - the built package, staged here before building |
| `shared-modules/` | vendored copy of Flathub's shared module definitions; supplies libayatana-appindicator |
| `flathub/` | the from-source manifest prepared for a Flathub submission (see the note below) |

The app id `tools.lolly.Desktop`, the runtime (`org.gnome.Platform//50`, which provides
the `webkit2gtk-4.1` Tauri needs), and the binary name (`lolly-desktop`, the Cargo
package name) all have to stay in agreement. If you set `mainBinaryName` in
`tauri.conf.json`, update `command:` and the `install` path in the manifest to match.

## Build it locally (on Linux)

```bash
# 0) system deps (Ubuntu 24.04+): libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev
#    libayatana-appindicator3-dev libsoup-3.0-dev build-essential

# 1) build the .deb
cd shells/tauri-desktop
pnpm install --frozen-lockfile && pnpm run build:frontend && pnpm run tauri build --bundles deb

# 2) stage it next to the manifest
cp src-tauri/target/release/bundle/deb/*.deb flatpak/lolly.deb

# 3) build + install the Flatpak
cd flatpak
flatpak install -y flathub org.gnome.Platform//50 org.gnome.Sdk//50
flatpak-builder --user --install --force-clean build-dir tools.lolly.Desktop.yml

# 4) run it
flatpak run tools.lolly.Desktop

# (optional) export a shippable single-file bundle
flatpak-builder --user --force-clean --repo=repo build-dir tools.lolly.Desktop.yml
flatpak build-bundle repo Lolly.flatpak tools.lolly.Desktop
```

## Run it before you call it built

The runtime does **not** ship `libayatana-appindicator3`, which the tray dlopens
lazily. Every bundle built before 2026-08-30 unpacked, linted, installed and then
died on launch, and none of the automated signals noticed - they were all checking
that files existed. `shared-modules/libayatana-appindicator` now builds it into
`/app`, and it is vendored in the tree, so any checkout has it.

The general lesson is worth keeping: a Flatpak that builds is not a Flatpak that
runs. `flatpak run tools.lolly.Desktop` and confirm a WebKit process settles above
~300 MB resident - a blank window sits near 40 MB.

## Flathub

Not a distribution channel for this app. Flathub's generative AI policy bars
applications containing AI-assisted code as well as AI-opened submissions, and
`tools.lolly.Desktop` would additionally fail their rule against app IDs ending in
generic terms like `.desktop`. `flathub/` is kept because it is a working
from-source, fully offline manifest, which is useful in its own right. Note it drops
the two `--own-name` finish-args to satisfy their linter, which disables the GNOME
Shell search provider and D-Bus activation - the bundle built from the manifest in
this directory keeps both.

## First-run things to verify

Because this can't be smoke-tested on macOS, watch these on the first CI/Linux run:

- **Runtime has webkit2gtk-4.1.** If the window is blank or the app won't start, the
  GNOME runtime version and the `WEBKIT_DISABLE_DMABUF_RENDERER=1` finish-arg are the
  first knobs - try bumping the runtime (and the CI container tag) together.
- **`.deb` data member is gzip.** The manifest uses `tar -xzf data.tar.gz`. Tauri's
  bundler gzips it; if a future version switches to xz/zst, adjust the flag.
- **AppStream compose passes.** If `appstreamcli compose` errors, the metainfo is the
  cause - a missing screenshot is only a warning, but a bad id/launchable is fatal.
