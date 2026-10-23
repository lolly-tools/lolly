# Build the mobile apps

This page is for a developer who wants to run the Android app on an emulator or a phone, or build a signed APK and AAB. One mobile shell, `shells/tauri-mobile`, serves Android and iOS; iOS has its own page, [Building for iOS](/info/ios-build.html), because it needs a Mac and Apple signing.

You need a checkout from [Get the source](/info/contributing-setup.html), plus the Rust toolchain and Tauri CLI from [Build the desktop app](/info/build-desktop.html#prerequisites).

::: cols
## Android, on this page

- Any of macOS, Windows or Linux
- Android Studio, SDK Platform 36 and the NDK
- Signs with a Java keystore
- Writes an APK and an AAB

## iOS, on its own page

- A Mac with the full Xcode app
- CocoaPods and the iOS Rust targets
- Signs with an Apple Team ID and provisioning profile
- Writes an `.ipa`, then [Building for iOS](/info/ios-build.html) takes over
:::

## Prerequisites

1. <!--l:android-->Install [Android Studio](https://developer.android.com/studio).
2. In its SDK Manager, install:
   - Android SDK Platform 36 (the app compiles against and targets API 36);
   - NDK (Side by side), version 26 or later;
   - Android SDK Command-line Tools.
3. Point the build at the SDK and NDK:

   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS
   export NDK_HOME=$ANDROID_HOME/ndk/$(ls $ANDROID_HOME/ndk | tail -1)
   ```

4. Add the Android Rust targets:

   ```bash
   rustup target add \
     aarch64-linux-android \
     armv7-linux-androideabi \
     i686-linux-android \
     x86_64-linux-android
   ```

5. Install the mobile shell's own dependencies, a separate pnpm project, from the repository root:

   ```bash
   pnpm -C shells/tauri-mobile install --frozen-lockfile
   ```

## The native projects are in the repository

There is no init step. The Android Studio (Gradle) project is committed in `shells/tauri-mobile/src-tauri/gen/android/`, and the Xcode project in `shells/tauri-mobile/src-tauri/gen/apple/`.

::: warning Do not run tauri android init on a checkout
The Android project holds hand-maintained code: the share-target and file-open handling in `MainActivity.kt`, the intent filters and FileProvider in `AndroidManifest.xml`, and `res/xml/file_paths.xml`. Regenerating the project can overwrite those files. The same goes for `tauri ios init`.
:::

## Development

With an emulator running, or a phone connected with USB debugging turned on:

```bash
pnpm run dev:android
```

## Production build

Build with the public content profile. Provide `LOLLY_CATALOG_SIGNING_KEY` and `VITE_CATALOG_PUBLIC_KEY_JWK` from your private credential store; the production frontend wrapper signs the exact catalog embedded in the app.

```bash
export LOLLY_PROFILE=lolly-start
export LOLLY_EMBED_CATALOG=profile
pnpm run build:android     # writes an APK and an AAB
```

The mobile app ships the blank `lolly-start` brand. Without `LOLLY_EMBED_CATALOG=profile`, its build embeds a lean neutral seed from that same brand.

**Signing.** Set all four variables before a release build. With none set, the build is unsigned.

```bash
export ANDROID_KEY_STORE=/path/to/keystore.jks
export ANDROID_KEY_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
```

Keep the keystore and passwords outside the checkout. Release APK and AAB files must use the established application key, so that installed copies can update.

## Icons

```bash
cd shells/tauri-mobile
npx @tauri-apps/cli icon path/to/icon-1024.png
```

That regenerates the icon set in `src-tauri/icons/` from one 1024-pixel source image.
