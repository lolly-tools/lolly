# Build Guide

How to build Lolly for each distribution target: standalone CLI binary, desktop app (macOS / Windows / Linux), and mobile apps (iOS / Android).

---

## Prerequisites (all targets)

- **Node.js 20+** and **npm 10+**
- Repo checked out, dependencies installed:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
npm install
```

---

## CLI

### Development use (no build needed)

The CLI shell runs directly from the repo with Node.js:

```bash
# List available tools
npm run cli

# Show inputs for a tool
npm run cli -- qr-code

# Run a tool and write output
npm run cli -- qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg

# Explicit format
npm run cli -- quotes --quote="Open source wins." --name="Andy" --export=png --output=./quote.png
```

The CLI supports **SVG, EMF, HTML, and the text/data formats** (JSON, CSV, ICS, VCF) natively — these are hydrated by the engine with no browser engine needed (SVG/EMF only for tools with an `<svg>`-based template, since the lean CLI has no layout engine). Raster/PDF/ZIP and video formats (PNG, JPG, PDF, ZIP, GIF, WebM, MP4, …) require a real WebView renderer, so use the desktop app or the Tauri-bundled CLI for those.

### Standalone binary

To distribute the CLI without requiring Node.js installed:

**1. Bundle to a single CJS file:**

```bash
cd shells/cli
npx esbuild bin/brand-tool.js \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=dist/brand-tool.cjs
```

**2. Package with `@yao-pkg/pkg` (includes a Node runtime):**

```bash
npx @yao-pkg/pkg dist/brand-tool.cjs \
  --targets node20-macos-arm64,node20-macos-x64,node20-linux-x64,node20-win-x64 \
  --output dist/brand-tool
```

Output binaries land in `shells/cli/dist/` — one per platform target.

> The `tools/` and `catalog/` directories must ship alongside the binary. The CLI resolves them relative to the binary location, so the expected layout is:
> ```
> brand-tool          ← binary
> tools/              ← tool definitions
> catalog/            ← asset + tool catalogs
> ```

---

## Desktop app (macOS / Windows / Linux)

### Prerequisites

**Rust toolchain:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

**Tauri CLI (Node package — installed per-shell):**

```bash
cd shells/tauri-desktop
npm install
```

**Platform build tools:**

| Platform | Required |
|---|---|
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Windows | Microsoft C++ Build Tools or Visual Studio with C++ workload |
| Linux | `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` |

Full list: https://tauri.app/start/prerequisites/

### Icons

Tauri requires icon files at `src-tauri/icons/`. Generate them from a 1024×1024 source PNG (the build will fail with a missing-file error if this step is skipped):

```bash
cd shells/tauri-desktop
npx @tauri-apps/cli icon path/to/icon-1024.png
```

This writes all required sizes and formats (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, etc.) to `src-tauri/icons/`.

> Placeholder icons committed to the repo are solid-green squares — replace them with production artwork before releasing.

### Development

```bash
cd shells/tauri-desktop
npm run dev
# or from repo root:
npm run dev:desktop
```

Tauri opens a native window. The Vite dev server runs in the background; hot reload works. The state bridge uses the filesystem override (`bridge-overrides/state.js`) — saved states go to `$APPDATA/Lolly/saved-state/`.

### Production build

```bash
cd shells/tauri-desktop
npm run build
# or from repo root:
npm run build:desktop
```

This runs `vite build` (producing `dist/`) then `tauri build`. Output:

| Platform | Artifact | Location |
|---|---|---|
| macOS | `.app` + `.dmg` | `src-tauri/target/release/bundle/macos/` |
| Windows | `.msi` + `.exe` NSIS installer | `src-tauri/target/release/bundle/` |
| Linux | `.deb` + `.AppImage` | `src-tauri/target/release/bundle/` |

### Cross-compilation

Tauri does not support cross-compilation out of the box. Build each platform on its native OS, or use a CI matrix (GitHub Actions `macos-latest` / `windows-latest` / `ubuntu-latest`).

---

## Mobile apps (iOS / Android)

### Prerequisites

**In addition to the Rust toolchain and Tauri CLI above:**

#### Android

1. Install [Android Studio](https://developer.android.com/studio)
2. In SDK Manager, install:
   - Android SDK Platform (API 33 or higher)
   - NDK (Side by side) — version 26+
   - Android SDK Command-line Tools
3. Set environment variables:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS
export NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | tail -1)
```

4. Add Android Rust targets:

```bash
rustup target add \
  aarch64-linux-android \
  armv7-linux-androideabi \
  i686-linux-android \
  x86_64-linux-android
```

#### iOS (macOS only)

1. Install Xcode from the App Store (the full app, not just the Command Line Tools)
2. Accept the license: `sudo xcodebuild -license accept`
3. Install CocoaPods — `tauri ios init` generates a Podfile and runs `pod install`: `brew install cocoapods`
4. Add iOS Rust targets:

```bash
rustup target add \
  aarch64-apple-ios \
  aarch64-apple-ios-sim \
  x86_64-apple-ios
```

See `docs/ios-build.md` in the repository for the full iOS walkthrough — prerequisites, one-time init, the simulator dev loop, code signing, and camera permissions.

### First-time platform init

Run once to generate the native project files (`gen/android/` or `gen/apple/`):

```bash
cd shells/tauri-mobile
npm install

# Android
npm run tauri android init

# iOS
npm run tauri ios init
```

The `gen/` directory contains the generated Gradle / Xcode projects. It is gitignored — regenerate it with the init command on a fresh checkout.

### Icons (mobile)

```bash
cd shells/tauri-mobile
npx @tauri-apps/cli icon path/to/icon-1024.png
```

### Development

**Android** (emulator or connected device with USB debugging enabled):

```bash
cd shells/tauri-mobile
npm run dev:android
# or from repo root:
npm run dev:android
```

**iOS** (macOS only — requires Simulator or provisioned device):

```bash
cd shells/tauri-mobile
npm run dev:ios
# or from repo root:
npm run dev:ios
```

### Production build

```bash
# Android — outputs APK + AAB
npm run build:android
# or: npm run build:android from repo root

# iOS — outputs .ipa
npm run build:ios
# or: npm run build:ios from repo root
```

**Android signing** — set these env vars before building for release:

```bash
export ANDROID_KEY_STORE=/path/to/keystore.jks
export ANDROID_KEY_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
```

**iOS signing** — configure your Development Team in Xcode:

```bash
cd gen/apple
open Lolly.xcodeproj
```

Set the team in the project's Signing & Capabilities tab, then build from CLI or Xcode.

---

## Open Build Service (OBS)

[Open Build Service](https://openbuildservice.org) is SUSE's source-to-package build system. It compiles a single source definition into native packages for many distributions at once, in clean and reproducible network-isolated chroots, and publishes them through signed, hosted repositories. One Lolly package definition on OBS can target the whole Linux matrix below from the same source.

### What OBS can build for Lolly

| Format | Distributions | Lolly artifact packaged |
|---|---|---|
| RPM | openSUSE Leap / Tumbleweed, SLE / SLES, Fedora, RHEL / CentOS / Alma / Rocky, Mageia, openEuler | CLI binary and/or Tauri desktop app |
| DEB | Debian, Ubuntu, Raspbian | CLI binary and/or Tauri desktop app |
| Arch | Arch Linux (`PKGBUILD`) | CLI binary / desktop app |
| Flatpak | distro-agnostic sandboxed desktop app | Tauri desktop app |
| AppImage | distro-agnostic portable app | reuses Tauri's `.AppImage` output |
| Container images | OCI / Docker (built via Kiwi or a `Dockerfile`) | CLI as a container image |
| Appliance / disk images | ISO, VM, and cloud images (built via Kiwi) | full preloaded image |

The local Tauri build already emits a `.deb` and an `.AppImage` (see the Desktop table above). OBS does not replace that — its value is **fan-out across the rest of the matrix** (every RPM- and deb-based distro, Arch, Flatpak, containers, appliances) plus **signed, hosted repositories** that users can add and update from like any other system package.

### How it fits Lolly's artifacts

OBS packages one of the two Linux artifacts this guide already produces:

- **The standalone CLI binary** — the esbuild + `@yao-pkg/pkg` output from the CLI section above. The `tools/` and `catalog/` directories must ship alongside the binary (the CLI resolves them relative to its own location), so that layout carries straight into the package's `%files` (RPM) or `debian/install` (deb) list.
- **The Tauri desktop app** — the `tauri build` output, packaged as RPM / DEB / Flatpak / AppImage for desktop delivery.

### Build-environment constraints

> **No network at build time.** OBS builds inside clean, network-isolated chroots, so every build input must be present up front. For a Node + Vite + Rust/Tauri app this is the main porting effort: vendor the npm and Cargo dependencies (an offline npm cache / `cargo vendor`) or supply them through OBS source services, and declare the toolchain as `BuildRequires` — e.g. `nodejs>=20`, `npm`, `rust`, `cargo`, plus the desktop build's GTK/WebKit `-devel` packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` and equivalents).

### Illustrative project layout

The snippets below are **illustrative starting points, not a production-tested recipe** — they show the shape of an OBS package for Lolly.

A `_service` file fetches and versions the source from git at build time:

```ini
<services>
  <service name="obs_scm" mode="manual">
    <param name="scm">git</param>
    <param name="url">https://github.com/lolly-tools/lolly.git</param>
    <param name="revision">v1.0.0</param>
    <param name="versionformat">@PARENT_TAG@</param>
  </service>
  <service name="set_version" mode="buildtime"/>
  <service name="tar" mode="buildtime"/>
</services>
```

A trimmed RPM `.spec` declares the toolchain, builds the artifact, and installs it with the required `tools/` + `catalog/` layout:

```spec
Name:           lolly
Version:        1.0.0
Release:        0
Summary:        Lolly — template-driven creative asset generator
License:        MPL-2.0
URL:            https://lolly.tools
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  nodejs >= 20
BuildRequires:  npm
BuildRequires:  rust
BuildRequires:  cargo

%build
npm ci --offline
# CLI binary: bundle with esbuild, then wrap with @yao-pkg/pkg (see CLI » Standalone binary above).
# For the desktop app instead, run `npm run build:desktop`.
npx esbuild shells/cli/bin/brand-tool.js --bundle --platform=node \
  --target=node20 --format=cjs --outfile=shells/cli/dist/brand-tool.cjs
npx @yao-pkg/pkg shells/cli/dist/brand-tool.cjs \
  --targets node20-linux-x64 --output shells/cli/dist/brand-tool

%install
install -Dm0755 shells/cli/dist/brand-tool %{buildroot}%{_bindir}/lolly
cp -a tools   %{buildroot}%{_datadir}/lolly/tools
cp -a catalog %{buildroot}%{_datadir}/lolly/catalog

%files
%license LICENSE
%{_bindir}/lolly
%{_datadir}/lolly/
```

A matching `debian/` directory (`control`, `rules`, `install`) produces the `.deb` from the same OBS package, and OBS's per-repository configuration maps that single package onto every distribution target you enable.

A Flatpak manifest wraps the Tauri desktop bundle:

```yaml
app-id: org.lolly.Lolly
runtime: org.gnome.Platform
runtime-version: '46'
sdk: org.gnome.Sdk
command: lolly
modules:
  - name: lolly
    buildsystem: simple
    build-commands:
      - npm ci --offline && npm run build:desktop
      - install -Dm0755 src-tauri/target/release/lolly /app/bin/lolly
    sources:
      - type: archive
        path: lolly-1.0.0.tar.gz
```

For readers wiring this up for real, see the [OBS documentation](https://openbuildservice.org/help/) and the [openSUSE packaging guidelines](https://en.opensuse.org/openSUSE:Packaging_guidelines).

---

## How the Tauri shells relate to the web shell

Both Tauri shells share the web shell's source (`shells/web/src/`). They build it with a Vite alias that swaps `bridge/state.js` for a Tauri filesystem implementation at build time. Everything else — the engine, tools, templates, export logic — is identical to the web build. One render path, three delivery targets.

```
shells/web/src/         ← canonical source
    └── bridge/
        └── state.js    ← IndexedDB (web build)

shells/tauri-desktop/
shells/tauri-mobile/
    └── bridge-overrides/
        └── state.js    ← filesystem via tauri-plugin-fs (Tauri builds)
```

The Tauri-built frontend lands in `shells/tauri-{desktop,mobile}/dist/`, which `tauri.conf.json` references as `frontendDist`. The web shell's own `dist/` is unaffected.
