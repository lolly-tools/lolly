# iOS Build

How to build and run the Lolly mobile shell (`shells/tauri-mobile`, identifier
`tools.lolly.mobile`) on iOS. iOS is a Tauri 2 mobile target: the same
web-shell source and the same `bridge-overrides/` (filesystem `state.ts`, mobile
`capabilities-provided.ts`) as the desktop shell, wrapped in an Xcode project
that is committed to the repository.

For the cross-platform overview (CLI, desktop, Android), see
`docs/build-guide.md`. This doc is the iOS-specific detail.

---

## Prerequisites

1. **Xcode** (full app, from the App Store - not just Command Line Tools). Then
   point the toolchain at it and accept the license:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

   Launch Xcode once so it installs the iOS platform and Simulator components.

2. **CocoaPods**. The command does not require Xcode:

   ```bash
   brew install cocoapods
   ```

3. **iOS Rust targets** (device + both simulator archs):

   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   ```

4. **Shell dependencies** (the mobile shell has its own `node_modules` and Tauri
   CLI):

   ```bash
   cd shells/tauri-mobile
   pnpm install
   ```

For an actual device (not just the Simulator) and for any signed build, you also
need an Apple Developer account and its **Team ID** (a 10-character string from
the Apple Developer portal / Xcode account settings).

---

## The Xcode project

The Xcode project is in the repository, at
`shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj`, so there is
nothing to generate. Do not run `tauri ios init` on a checkout: the committed project
carries settings such as the usage strings below and the privacy manifest
(`lolly-mobile_iOS/PrivacyInfo.xcprivacy`), and a regenerated project may not
keep them.

Notes:

- Icons are committed under `src-tauri/icons/` (including the `ios/` set) and
  in the project's `Assets.xcassets`. To regenerate the whole set from a source
  PNG: `npx @tauri-apps/cli icon path/to/icon-1024.png`.
- `src-tauri/tauri.conf.json` sets `productName: "Lolly"`,
  `identifier: "tools.lolly.mobile"` and
  `bundle.iOS.minimumSystemVersion: "26.0"`, the same deployment target as the
  Xcode project. The app needs iOS or iPadOS 26.0 or later, because the web
  shell needs WebGPU from startup and WKWebView offers WebGPU from iOS 26.
- The configured Apple Team ID is public build metadata. Set the approved team
  in `bundle.iOS.developmentTeam` or through `APPLE_DEVELOPMENT_TEAM`, which
  overrides the configured team; keep certificates, passwords and API private
  keys outside the source tree.

### Permissions (Info.plist)

iOS grants the camera, the microphone and similar features only to an app whose
`Info.plist` carries a usage-description string for each. Without the string,
iOS denies access and may terminate the app. The committed project already
carries these. Their source is the `info.properties` block of
`src-tauri/gen/apple/project.yml`, from which xcodegen writes
`lolly-mobile_iOS/Info.plist`:

- `NSCameraUsageDescription`, for the photo, filter and recording tools
- `NSMicrophoneUsageDescription`, for the voice and video recording tools
- `NSPhotoLibraryAddUsageDescription`, for saving exports to the photo library
- `NSLocalNetworkUsageDescription`, used only by development builds to load the
  interface from the local dev server

A change that gives a tool a new permission adds its usage string to
`project.yml` in the same commit. A key edited into `Info.plist` directly does
not survive the next regeneration. `bundle.iOS.infoPlist` points at the tracked
`src-tauri/Info.ios.plist`, which Tauri merges in; that file holds the scene
manifest and the `lolly:` URL scheme.

---

## Dev loop (Simulator)

```bash
cd shells/tauri-mobile
pnpm run dev:ios            # -> tauri ios dev
```

`tauri.conf.json` sets `beforeDevCommand: "pnpm run dev:frontend"`, so the Vite
dev server starts automatically on **port 5174** (the configured `devUrl`); hot
reload works the same as the web and desktop shells.

- Target a specific simulator: `pnpm run dev:ios "iPhone 15 Pro"`.
- Open the project in Xcode instead of running headless:
  `pnpm run dev:ios --open`.
- The state bridge uses `bridge-overrides/state.ts` (filesystem via
  `tauri-plugin-fs`, `<AppData>/saved-state/*.json` under the identifier
  `tools.lolly.mobile`), not IndexedDB. iOS sandboxing forbids absolute
  paths - keep all writes under AppData; never add absolute-path fs scopes.

### Feature subset on iOS

The mobile shell provides the capabilities `network`, `clipboard`, `wasm`,
`compose`, `camera`, `microphone` and `filesystem`. It is defined as the web
shell's set *spread* plus `filesystem` (via `tauri-plugin-fs`) and minus
`screen`, so a capability added on the web side reaches mobile by default - see
`bridge-overrides/capabilities-provided.ts`.

Three capabilities are absent, and tools declaring them are greyed out in the
gallery rather than failing at the tap:

- `screen` - deliberately subtracted. Display capture is `getDisplayMedia`,
  which no mobile WebView implements (absent on iOS entirely; Android's WebView
  carries no picker).
- `capture` - page capture on desktop is native headless Chrome; mobile ships no
  such implementation, so it inherits the web stub, which throws.
- `ffmpeg` - sidecar transcoding needs `tauri-plugin-shell`, which the mobile
  shell does not bundle.

Camera and microphone are Lolly-gated *and* OS-gated: the capability flag lets
the tool load, and the WebView's `getUserMedia` still prompts for the OS
permission (hence the Info.plist usage strings above). This matches Android.

---

## Release build + signing

```bash
cd shells/tauri-mobile
pnpm run build:ios          # -> vite build, then tauri ios build
```

Output is an `.ipa` under `src-tauri/gen/apple/build/`. The `vite build` step
bundles `tools/` and `catalog/` into `dist/` first (see `vite.config.js`);
`frontendDist` (`../dist`) points at it.

### Code signing via environment variables

Local code signing can use environment variables. The Team ID is public build
metadata; private keys and certificate passwords belong in local credential
storage or the protected release environment.

| Env var | Purpose |
|---|---|
| `APPLE_DEVELOPMENT_TEAM` | Apple Developer **Team ID** (10 chars). Required - Tauri writes it as `DEVELOPMENT_TEAM` so a signing identity is selected non-interactively. |
| `APPLE_API_ISSUER` | App Store Connect API **issuer ID** (UUID), for CI / non-interactive signing + upload. |
| `APPLE_API_KEY` | App Store Connect API **key ID**. |
| `APPLE_API_KEY_PATH` | Path to the `.p8` API private key file. |

```bash
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX          # your Team ID - placeholder, fill in locally / in CI secrets
pnpm run build:ios --export-method app-store-connect
```

`--export-method` selects how the `.ipa` is packaged: `app-store-connect`,
`release-testing` or `debugging` with the pinned Tauri CLI. Interactively you can instead open the
project (`pnpm run dev:ios --open`) and set the team under **Signing &
Capabilities**; the env-var path is what CI uses.

Device builds, IPA export, TestFlight and App Store distribution additionally
require a provisioning profile whose App ID matches `tools.lolly.mobile`. A
free Apple ID gives 7-day on-device provisioning; the paid Apple Developer
Program is needed for TestFlight / App Store.

### Protected App Store workflow

`.github/workflows/ios-release.yml` separates compilation from release signing.
The compiler job installs dependencies, verifies the independently signed frontend
and runs `tauri ios build --target aarch64 --no-sign --archive-only --ci`. It has
no native signing environment, distribution certificate or App Store API key.
The pinned [Tauri CLI implementation](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.1/crates/tauri-cli/src/mobile/ios/build.rs)
archives without code signing and stops before IPA export for these flags.

The protected `release-native-signing` job downloads the completed archive by its
immutable artifact ID. Before receiving credentials, it verifies the checkout,
frontend signature, workflow run and attempt, receipt digest, complete archive
files and executable permissions, app identity and compiler Xcode version.
The archive receipt is bound to the job output and GitHub artifact; the frontend
has its separate catalog-key signature. These checks preserve the provenance of
the compiler output. They do not establish that compiled native code is benign.

Signing uses an explicit App Store provisioning profile rather than automatic
provisioning. The job checks its team, exact App ID, validity, distribution
certificate and permitted entitlements. The current policy supports one app,
frameworks and dynamic libraries with the app's existing empty custom entitlement
set. Additional executable targets or capabilities require a reviewed policy
change. It signs the finished code and runs `xcodebuild -exportArchive` with fixed
manual export options; no dependency installation, project build, Rust build
script or repository JavaScript runs after private key access. See Apple's
[entitlement guidance](https://developer.apple.com/library/archive/technotes/tn2415/_index.html)
for the relationship between the profile and the app signature.

Configure these credentials in the protected environment before using the job:

| Secret | Purpose |
|---|---|
| `IOS_DIST_CERT_P12` | Base64 distribution identity, including its private key. |
| `IOS_DIST_CERT_PASSWORD` | Password for that identity. |
| `IOS_APP_STORE_PROFILE` | Base64 approved App Store provisioning profile for the configured app and team. |
| `ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID` | App Store API credentials, used only for optional upload of the finished IPA. |

Missing or unsuitable profile configuration stops the job. Signing uses a
throwaway keychain and removes the imported identity and installed profile copies
before the signed IPA is uploaded as a workflow artifact. The optional App Store
upload uses a temporary API-key directory that is removed after the upload.
No API-key path is persisted through `GITHUB_ENV`.

Graceful SIGINT and SIGTERM interruption stops the active Apple subprocess and
runs credential cleanup. SIGKILL, runner loss or another interruption that
prevents the process from running cleanup relies on destruction of the disposable
hosted `macos-15` runner. This workflow must not be moved to a persistent runner
without a separately qualified credential cleanup and custody policy.

A release operator must qualify this path with the approved profile and identity,
the hosted released Xcode image, an exported IPA and App Store validation. Archive
and profile fixtures exercise admission and cleanup without live credentials;
they do not qualify a packaged native app or App Store acceptance. Existing native
runtime and release gates also remain in force. Move or retire old signing secret
locations only after this workflow is in use; changing the workflow does not
change GitHub environment settings or move credentials.

---

## Where this differs from Android

iOS and Android share the mobile shell, the bridge overrides and the feature
subset. The differences are toolchain-only: iOS requires macOS + full Xcode +
CocoaPods and signs with an Apple Team ID / App Store Connect key; Android
requires the Android SDK + NDK and signs with a Java keystore
(`ANDROID_KEY_STORE*` - see `docs/build-guide.md`).
