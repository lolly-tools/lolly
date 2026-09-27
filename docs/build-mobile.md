# Build the mobile apps

Set up, develop and package Android and iOS shells.

Part of [Build Guide](/info/build-guide.html).

## Mobile apps (iOS / Android)

### Prerequisites

Install the [Rust toolchain and Tauri CLI](/info/build-desktop.html#prerequisites), then add the prerequisites for your target:

#### Android

1. <!--l:android-->Install [Android Studio](https://developer.android.com/studio)
2. In SDK Manager, install:
   - Android SDK Platform (API 33 or higher)
   - NDK (Side by side) - version 26+
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

1. <!--l:apple-->Install Xcode from the App Store (the full app, not just the Command Line Tools)
2. Accept the license: `sudo xcodebuild -license accept`
3. Install CocoaPods - `tauri ios init` generates a Podfile and runs `pod install`: `brew install cocoapods`
4. Add iOS Rust targets:

```bash
rustup target add \
  aarch64-apple-ios \
  aarch64-apple-ios-sim \
  x86_64-apple-ios
```

See [Building for iOS](/info/ios-build.html) for the full iOS walkthrough - prerequisites, one-time init, the simulator dev loop, code signing and camera permissions.

### First-time platform init

Run once to generate the native project files, from the repository root. For Android, which writes `gen/android/`:

```bash
cd shells/tauri-mobile
pnpm install
pnpm run tauri android init
```

For iOS, which writes `gen/apple/`:

```bash
cd shells/tauri-mobile
pnpm install
pnpm run tauri ios init
```

The `gen/` directory contains the generated Gradle / Xcode projects. It is gitignored - regenerate it with the init command on a fresh checkout.

### Icons (mobile)

```bash
cd shells/tauri-mobile
npx @tauri-apps/cli icon path/to/icon-1024.png
```

### Development

**Android** (emulator or connected device with USB debugging enabled):

```bash
pnpm run dev:android
```

**iOS** (macOS only - requires Simulator or provisioned device):

```bash
pnpm run dev:ios
```

Run both from the repository root; the same script names also work inside `shells/tauri-mobile`.

### Production build

Use the public content profile and provide `LOLLY_CATALOG_SIGNING_KEY` plus `VITE_CATALOG_PUBLIC_KEY_JWK` through your private credential store. The production frontend wrapper signs the exact catalog embedded in the app. Install the mobile shell's separate dependencies with `pnpm -C shells/tauri-mobile install --frozen-lockfile` from the repository root.

For Android, which writes an APK and an AAB:

```bash
export LOLLY_PROFILE=lolly-start
export LOLLY_EMBED_CATALOG=profile
pnpm run build:android
```

For iOS, which writes an `.ipa`:

```bash
export LOLLY_PROFILE=lolly-start
export LOLLY_EMBED_CATALOG=profile
pnpm run build:ios
```

**Android signing** - set these env vars before building for release:

```bash
export ANDROID_KEY_STORE=/path/to/keystore.jks
export ANDROID_KEY_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
```

All four variables are required together. With none set, the build is unsigned. Keep the keystore and passwords outside the checkout; release APK and AAB files must use the established application key so installed copies can update.

**iOS signing** - configure your Development Team in Xcode:

```bash
cd gen/apple
open Lolly.xcodeproj
```

Set the team in the project's Signing & Capabilities tab, then build from CLI or Xcode.

The `ios-release.yml` GitHub workflow builds a signed IPA using the configured distribution identity on a supported macOS runner. Dispatch it with `upload=false` to collect the IPA without submitting it to App Store Connect.

---

[Back to Build Guide](/info/build-guide.html).
