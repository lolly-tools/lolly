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

See [`ios-build.md`](ios-build.md) for the full iOS walkthrough — prerequisites, one-time init, the simulator dev loop, code signing, and camera permissions.

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
