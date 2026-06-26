# iOS Build

How to build and run the Lolly mobile shell (`shells/tauri-mobile`, identifier
`tools.lolly.app.mobile`) on iOS. iOS is a Tauri 2 mobile target: the same
web-shell source and the same `bridge-overrides/` (filesystem `state.js`, mobile
`capabilities-provided.js`) as the desktop shell, wrapped in a generated Xcode
project.

For the cross-platform overview (CLI, desktop, Android), see
`docs/build-guide.md`. This doc is the iOS-specific deep dive.

---

## Status on this dev machine

**iOS builds cannot run on the current machine yet.** This is a tooling gap, not
a code problem — the desktop `.app`/`.dmg` build works because it only needs
Command Line Tools.

Verified state (2026-06):

| Requirement | Needed for iOS | Present here |
|---|---|---|
| Full **Xcode** (`xcodebuild`) | yes | No — only Command Line Tools (`xcode-select -p` -> `/Library/Developer/CommandLineTools`) |
| iOS **Simulator** (`simctl`) | yes | No — `xcrun simctl` needs full Xcode |
| **CocoaPods** (`pod`) | yes | Yes — installed (`pod` 1.16.2, via Homebrew) |
| iOS **Rust targets** | yes | Yes — `aarch64-apple-ios`, `aarch64-apple-ios-sim`, `x86_64-apple-ios` installed |
| Mobile `node_modules` + Tauri CLI | yes | Yes — installed (`@tauri-apps/cli`, `plugin-fs`, `plugin-http`) |
| `src-tauri/gen/apple/` (init output) | yes | No — iOS project not initialized |

`tauri ios init`, `npm run dev:ios`, and `npm run build:ios` all require full
Xcode (plus CocoaPods), so each fails here until the prerequisites below are met.
The Rust targets, JS dependencies, and CocoaPods are already in place; the
remaining blockers are full Xcode and the one-time project init.

---

## Prerequisites

1. **Xcode** (full app, from the App Store — not just Command Line Tools). Then
   point the toolchain at it and accept the license:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

   Launch Xcode once so it installs the iOS platform and Simulator components.

2. **CocoaPods** (Tauri generates a Podfile and runs `pod install` during init).
   Already installed on this machine (`pod` 1.16.2 via Homebrew); the command is
   idempotent on a fresh checkout, and does not require Xcode:

   ```bash
   brew install cocoapods   # Homebrew is already present at /opt/homebrew/bin/brew
   ```

3. **iOS Rust targets** (device + both simulator archs) — already installed here;
   the command is idempotent on a fresh checkout:

   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   ```

4. **Shell dependencies** (the mobile shell has its own `node_modules` and Tauri
   CLI) — already installed here:

   ```bash
   cd shells/tauri-mobile
   npm install
   ```

For an actual device (not just the Simulator) and for any signed build, you also
need an Apple Developer account and its **Team ID** (a 10-character string from
the Apple Developer portal / Xcode account settings).

---

## One-time project init

Generates the native Xcode project under
`shells/tauri-mobile/src-tauri/gen/apple/`. This directory is gitignored
(`**/src-tauri/gen/`), so it is regenerated per checkout — it is not committed.

```bash
cd shells/tauri-mobile
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX   # your 10-char Team ID; pre-fills the project's signing team
npm run tauri ios init
```

Notes:

- Icons are already committed under `src-tauri/icons/` (including the `ios/`
  set); init wires them into the project's `Assets.xcassets`. To regenerate the
  whole set from a source PNG: `npx @tauri-apps/cli icon path/to/icon-1024.png`.
- Init reads `src-tauri/tauri.conf.json` (`productName: "Lolly"`,
  `identifier: "tools.lolly.app.mobile"`, `bundle.iOS.minimumSystemVersion: "14.3"`).
- `tauri.conf.json` deliberately does **not** hardcode
  `bundle.iOS.developmentTeam`; pass the team via the `APPLE_DEVELOPMENT_TEAM`
  env var so no credential is committed.

### Permissions (Info.plist)

`tauri ios init` generates `src-tauri/gen/apple/<app>_iOS/Info.plist`. Any tool
that uses the camera via the WebView's `getUserMedia` requires a usage-description
string, or iOS denies access (and may terminate the app). Add, after init:

```xml
<key>NSCameraUsageDescription</key>
<string>Lolly uses the camera for tools that scan or capture images on-device.</string>
```

Add `NSPhotoLibraryUsageDescription` / `NSMicrophoneUsageDescription` only if a
tool actually touches those. The `gen/apple` tree is gitignored, so to persist
these edits across checkouts either re-apply them after each init or point
`bundle.iOS.infoPlist` at a tracked Info.plist fragment that Tauri merges in.

WKWebView `getUserMedia` is only available on **iOS 14.3+**, which is why
`bundle.iOS.minimumSystemVersion` is pinned to `14.3` rather than the Tauri
default of `13.0`.

---

## Dev loop (Simulator)

```bash
cd shells/tauri-mobile
npm run dev:ios            # -> tauri ios dev
```

`tauri.conf.json` sets `beforeDevCommand: "npm run dev:frontend"`, so the Vite
dev server starts automatically on **port 5174** (the configured `devUrl`); hot
reload works the same as the web and desktop shells.

- Target a specific simulator: `npm run dev:ios -- "iPhone 15 Pro"`.
- Open the project in Xcode instead of running headless:
  `npm run dev:ios -- --open`.
- The state bridge uses `bridge-overrides/state.js` (filesystem via
  `tauri-plugin-fs`, `$APPDATA/Lolly/saved-state/*.json`), not IndexedDB. iOS
  sandboxing forbids absolute paths — keep all writes under AppData; never add
  absolute-path fs scopes.

### Feature subset on iOS

The mobile shell provides the capabilities `network`, `clipboard`, `wasm`,
`compose`, and `filesystem` (the last via `tauri-plugin-fs`; see
`bridge-overrides/capabilities-provided.js`). Tools that require `ffmpeg`
(sidecar transcoding) or `capture` (native headless-Chrome page capture,
desktop-only) are filtered out of the gallery — there is no `tauri-plugin-shell`
and no capture path on mobile. Camera input works through the WebView's
`getUserMedia` (an OS-permission-gated API, independent of Lolly's capability
gating). This matches Android.

---

## Release build + signing

```bash
cd shells/tauri-mobile
npm run build:ios          # -> vite build, then tauri ios build
```

Output is an `.ipa` under `src-tauri/gen/apple/build/`. The `vite build` step
bundles `tools/` and `catalog/` into `dist/` first (see `vite.config.js`);
`frontendDist` (`../dist`) points at it.

### Code signing via environment variables

Apple code signing is configured through env vars so no credentials are committed
to the repo. **Do not hardcode a Team ID or key into `tauri.conf.json` or the
Xcode project.**

| Env var | Purpose |
|---|---|
| `APPLE_DEVELOPMENT_TEAM` | Apple Developer **Team ID** (10 chars). Required — Tauri writes it as `DEVELOPMENT_TEAM` so a signing identity is selected non-interactively. |
| `APPLE_API_ISSUER` | App Store Connect API **issuer ID** (UUID), for CI / non-interactive signing + upload. |
| `APPLE_API_KEY` | App Store Connect API **key ID**. |
| `APPLE_API_KEY_PATH` | Path to the `.p8` API private key file. |

```bash
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX          # your Team ID — placeholder, fill in locally / in CI secrets
npm run build:ios -- --export-method app-store-connect
```

`--export-method` selects how the `.ipa` is packaged: `app-store-connect`,
`ad-hoc`, `enterprise`, or `debugging`. Interactively you can instead open the
project (`npm run dev:ios -- --open`) and set the team under **Signing &
Capabilities**; the env-var path is what CI uses.

Device builds, IPA export, TestFlight, and App Store distribution additionally
require a provisioning profile whose App ID matches `tools.lolly.app.mobile`. A
free Apple ID gives 7-day on-device provisioning; the paid Apple Developer
Program is needed for TestFlight / App Store.

---

## Where this differs from Android

iOS and Android share the mobile shell, the bridge overrides, and the feature
subset. The differences are toolchain-only: iOS requires macOS + full Xcode +
CocoaPods and signs with an Apple Team ID / App Store Connect key; Android
requires the Android SDK + NDK and signs with a Java keystore
(`ANDROID_KEY_STORE*` — see `docs/build-guide.md`).
