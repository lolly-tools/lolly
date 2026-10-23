# Building for iOS

This page is for a developer who wants Lolly running in the iPhone Simulator, on a test device or as a signed build for TestFlight and the App Store. You need a Mac with the full Xcode app.

The iOS app is the same Lolly as the web and desktop apps. A Tauri 2 shell (`shells/tauri-mobile`, identifier `tools.lolly.mobile`) wraps the web app's code, saves work as files instead of in browser storage, and leaves out what a phone cannot do, such as screen capture. Android uses the same shell; only the toolchain and signing differ (see [Build the mobile apps](/info/build-mobile.html)). The app runs on iOS and iPadOS 26.0 or later.

The Xcode project is already in the repository, with the camera and microphone permission text in place, so there is nothing to generate. Install the prerequisites, then `pnpm run dev:ios` opens Lolly in the Simulator.

## Prerequisites

1. **Xcode**, the full app from the App Store rather than only the Command Line Tools. Point the toolchain at it, accept the licence and launch Xcode once so it installs the iOS platform and Simulator:

   ```bash
   sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

2. **CocoaPods:**

   ```bash
   brew install cocoapods
   ```

3. **The iOS Rust targets**, for devices and both Simulator architectures:

   ```bash
   rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios
   ```

4. **The mobile shell's dependencies.** It is a separate pnpm project with its own Tauri CLI:

   ```bash
   pnpm -C shells/tauri-mobile install
   ```

A real device and any signed build also need an Apple Developer account and its **Team ID**, a 10-character string from the Apple Developer portal or Xcode's account settings.

## Run in the Simulator

```bash
pnpm run dev:ios            # tauri ios dev
```

The Vite dev server starts on its own on port 5174 (`beforeDevCommand` and `devUrl` in `tauri.conf.json`), and hot reload works as it does for the web and desktop apps.

- Pick a simulator by name: `pnpm run dev:ios "iPhone 15 Pro"`.
- Open the project in Xcode instead of running headless: `pnpm run dev:ios --open`.
- Storage goes through `bridge-overrides/state.ts`, which writes `<AppData>/saved-state/*.json` with `tauri-plugin-fs` under the identifier `tools.lolly.mobile`, not IndexedDB. iOS sandboxing forbids absolute paths, so keep every write under AppData and never add an absolute-path filesystem scope.

## What iOS can and cannot do

The mobile shell's capability list is the web app's list plus `filesystem`, minus `screen` (`bridge-overrides/capabilities-provided.ts`). A capability added on the web side therefore reaches mobile by default. A tool that needs a missing capability is greyed out in the gallery instead of failing when tapped.

::: cols
## Available on iOS

- `network`, `clipboard`, `wasm` and `compose`
- `camera` and `microphone`, with the system's permission prompt
- `filesystem`, through `tauri-plugin-fs`

## Not on iOS, and why

- `screen`: display capture is `getDisplayMedia`, which no mobile WebView offers.
- `capture`: page capture on desktop is native headless Chrome. Mobile has no equivalent, so it keeps the web stub, which throws.
- `ffmpeg`: transcoding needs `tauri-plugin-shell`, which the mobile shell does not bundle.
:::

Camera and microphone are gated twice. The capability flag lets the tool load, and the WebView's `getUserMedia` still asks for the operating system's permission, which is why the usage strings below exist. Android behaves the same way.

## The Xcode project and its permissions

The project is `shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj`. Do not run `tauri ios init` on a checkout: the committed project carries settings such as the usage strings and the privacy manifest (`lolly-mobile_iOS/PrivacyInfo.xcprivacy`), and a regenerated project may not keep them.

`src-tauri/tauri.conf.json` sets `productName: "Lolly"`, `identifier: "tools.lolly.mobile"` and `bundle.iOS.minimumSystemVersion: "26.0"`, the same deployment target as the Xcode project. The floor is iOS 26 because the web app needs WebGPU from startup, and WKWebView offers WebGPU from iOS 26.

iOS grants the camera, the microphone and similar features only to an app whose `Info.plist` carries a usage string for each. Without one, iOS denies access and may end the app. The committed project carries four, written into `lolly-mobile_iOS/Info.plist` by xcodegen from the `info.properties` block of `src-tauri/gen/apple/project.yml`:

- `NSCameraUsageDescription`, for the photo, filter and recording tools;
- `NSMicrophoneUsageDescription`, for the voice and video recording tools;
- `NSPhotoLibraryAddUsageDescription`, for saving exports to the photo library;
- `NSLocalNetworkUsageDescription`, used only by development builds to load the interface from the local dev server.

A change that gives a tool a new permission adds its usage string to `project.yml` in the same commit; a key typed into `Info.plist` directly is lost at the next regeneration. `bundle.iOS.infoPlist` points at the tracked `src-tauri/Info.ios.plist`, which Tauri merges in and which holds the scene manifest and the `lolly:` URL scheme.

Icons are committed under `src-tauri/icons/` (including the `ios/` set) and in the project's `Assets.xcassets`. To regenerate them from one source image, run `npx @tauri-apps/cli icon path/to/icon-1024.png` in `shells/tauri-mobile`.

## Signed builds

```bash
pnpm run build:ios          # vite build, then tauri ios build
```

The output is an `.ipa` under `src-tauri/gen/apple/build/`. The `vite build` step writes `dist/` first and embeds the content catalog in it: a neutral seed from the `lolly-start` brand by default, or the selected profile's catalog with `LOLLY_EMBED_CATALOG=profile` (`shells/tauri-shared/vite-embed.mjs`). `tauri.conf.json` reads that folder as `frontendDist` (`../dist`).

The Team ID is public build metadata. Set the approved team in `bundle.iOS.developmentTeam`, or with `APPLE_DEVELOPMENT_TEAM`, which takes precedence. Keep certificates, passwords and API private keys in local credential storage or the protected release environment, never in the source tree.

| Environment variable | Purpose |
|---|---|
| `APPLE_DEVELOPMENT_TEAM` | The Apple Developer **Team ID** (10 characters). Overrides `bundle.iOS.developmentTeam`; Tauri writes it as `DEVELOPMENT_TEAM` so a signing identity is chosen without prompting. |
| `APPLE_API_ISSUER` | The App Store Connect API **issuer ID** (a UUID), for signing and upload without prompts. |
| `APPLE_API_KEY` | The App Store Connect API **key ID**. |
| `APPLE_API_KEY_PATH` | The path to the `.p8` API private key file. |

```bash
export APPLE_DEVELOPMENT_TEAM=XXXXXXXXXX     # your Team ID, filled in locally or from CI secrets
pnpm run build:ios --export-method app-store-connect
```

`--export-method` chooses how the `.ipa` is packaged: `app-store-connect`, `release-testing` or `debugging`. To sign interactively instead, open the project (`pnpm run dev:ios --open`) and set the team under **Signing & Capabilities**.

Device builds, IPA export, TestFlight and App Store distribution also need a provisioning profile whose App ID matches `tools.lolly.mobile`. A free Apple ID gives 7-day provisioning on a device; TestFlight and the App Store need the paid Apple Developer Program.

## The App Store release workflow

`.github/workflows/ios-release.yml` builds a signed IPA on a hosted macOS runner. It keeps compilation and signing in separate jobs, so the project build never runs where the signing key is. Dispatch it with `upload=false` to collect the IPA without sending it to App Store Connect.

::: timeline
- <!--i:code--> **Compile an unsigned archive.** The compiler job installs dependencies, verifies the independently signed frontend and runs `tauri ios build --target aarch64 --no-sign --archive-only --ci`. It has no signing environment, distribution certificate or App Store API key. The pinned [Tauri CLI](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.3/crates/tauri-cli/src/mobile/ios/build.rs) archives without code signing and stops before IPA export for these flags.
- <!--i:checklist--> **Verify before any credential arrives.** The protected `release-native-signing` job downloads the archive by its immutable artifact ID, then checks the checkout, the frontend signature, the workflow run and attempt, the receipt digest, the complete archive files and executable permissions, the app identity and the compiler's Xcode version.
- <!--i:seal--> **Sign in the protected job.** It uses an explicit App Store provisioning profile, checks its team, exact App ID, validity, distribution certificate and permitted entitlements, then signs the finished code.
- <!--i:box--> **Export the IPA** with `xcodebuild -exportArchive` and fixed manual export options. No dependency installation, project build, Rust build script or repository JavaScript runs after the private key is available.
- <!--i:upload--> **Upload, if asked.** The optional App Store upload uses a temporary API-key directory that is removed afterwards.
:::

The archive receipt is bound to the job output and the GitHub artifact; the frontend has its own catalog-key signature. These checks preserve the provenance of the compiler's output. They do not establish that compiled native code is benign.

The signing policy covers one app, its frameworks and dynamic libraries, with the app's existing empty custom entitlement set. Another executable target or capability needs a reviewed policy change. Apple's [entitlement guidance](https://developer.apple.com/library/archive/technotes/tn2415/_index.html) explains how the profile relates to the app signature.

Configure these in the protected environment before using the job:

| Secret | Purpose |
|---|---|
| `IOS_DIST_CERT_P12` | The base64 distribution identity, including its private key. |
| `IOS_DIST_CERT_PASSWORD` | The password for that identity. |
| `IOS_APP_STORE_PROFILE` | The base64 approved App Store provisioning profile for the configured app and team. |
| `ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID` | App Store API credentials, used only for the optional upload of the finished IPA. |

::: details Credential cleanup and release qualification
Missing or unsuitable profile configuration stops the job. Signing uses a throwaway keychain, and removes the imported identity and the installed profile copies before the signed IPA is uploaded as a workflow artifact. No API-key path is persisted through `GITHUB_ENV`.

A graceful SIGINT or SIGTERM stops the active Apple subprocess and runs the credential cleanup. SIGKILL, a lost runner or any other interruption that prevents cleanup relies on the disposable hosted `macos-15` runner being destroyed. Do not move this workflow to a persistent runner without a separately qualified cleanup and custody policy.

A release operator qualifies this path with the approved profile and identity, the hosted Xcode image, an exported IPA and App Store validation. Archive and profile fixtures exercise admission and cleanup without live credentials; they do not qualify a packaged app or App Store acceptance. The existing native runtime and release gates stay in force. Move or retire old signing secret locations only after this workflow is in use, because changing the workflow does not change GitHub environment settings or move credentials.
:::
