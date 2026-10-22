# Build the mobile apps

Set up, develop and package Android and iOS shells.

Part of [Build Guide](/info/build-guide.html).

## Mobile apps (iOS / Android)

### Prerequisites

Install the [Rust toolchain and Tauri CLI](/info/build-desktop.html#prerequisites), then add the prerequisites for your target:

#### Android

1. <!--l:android-->Install [Android Studio](https://developer.android.com/studio)
2. In SDK Manager, install:
   - Android SDK Platform 36 (the app compiles and targets API 36)
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
3. Install CocoaPods: `brew install cocoapods`
4. Add iOS Rust targets:

```bash
rustup target add \
  aarch64-apple-ios \
  aarch64-apple-ios-sim \
  x86_64-apple-ios
```

See [Building for iOS](/info/ios-build.html) for the full iOS walkthrough - prerequisites, the simulator dev loop, code signing and permissions.

### First-time platform init

There is no init step. Both native projects are in the repository: the Android Studio (Gradle) project in `shells/tauri-mobile/src-tauri/gen/android/` and the Xcode project in `shells/tauri-mobile/src-tauri/gen/apple/`. Do not run `tauri android init` or `tauri ios init` on a checkout. The Android project holds hand-maintained code (the share-target and file-open handling in `MainActivity.kt`, the intent filters and FileProvider in `AndroidManifest.xml`, and `res/xml/file_paths.xml`), and regenerating the project can overwrite those files.

Install the mobile shell's own dependencies once, from the repository root, then go to [Development](#development):

```bash
pnpm -C shells/tauri-mobile install --frozen-lockfile
```

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

**iOS signing** - configure your Development Team in Xcode. From the repository root:

```bash
open shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj
```

Set the team in the project's Signing & Capabilities tab, then build from CLI or Xcode. The committed project and `bundle.iOS.developmentTeam` in `shells/tauri-mobile/src-tauri/tauri.conf.json` already name a development team; the `APPLE_DEVELOPMENT_TEAM` environment variable overrides the configured team.

The `ios-release.yml` GitHub workflow builds a signed IPA using the configured distribution identity on a supported macOS runner. Dispatch it with `upload=false` to collect the IPA without submitting it to App Store Connect.

---

[Back to Build Guide](/info/build-guide.html).
