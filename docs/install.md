# Install Lolly

[lolly.tools](/) runs in a current browser that supports WebGPU ([which browsers](/info/supported-environments.html)). The installed app adds a dock or app menu icon, native file dialogs and offline use, with the same tools, design systems and files.

<!--i:eti-checklist-->
## Pick your device

| Your device | Get | Version |
|---|---|---|
| Mac with Apple silicon (M1 and later) | [`lolly-latest.dmg`](https://lolli.li/lolly-latest.dmg) | %download{macos} |
| Mac with Intel (last build, no updates) | [`Lolly_1.1.0_x64.dmg`](https://lolli.li/Lolly_1.1.0_x64.dmg) | %download{macos-intel} |
| iPhone and iPad | **Lolly** on the [App Store](https://apps.apple.com/app/id6836763603) | %download{ios} |
| Android | [`lolly-latest.apk`](https://lolli.li/lolly-latest.apk) | %download{android} |
| Windows | [`lolly-latest.exe`](https://lolli.li/lolly-latest.exe), not code-signed yet | %download{windows} |
| Linux | [The web app, installed from your browser](#linux) | Newest |
| Linux packages | [Flatpak, RPM, `.deb`, Arch or AppImage](#linux) | 1.1.0 |
| Your own server | [YunoHost](#yunohost) or [a container image](#a-container-image) | %download{yunohost} |

lolly.tools always has the newest version. The 1.1.0 builds stay at 1.1.0 until each platform's web view passes the WebGPU check that later versions need. Every file is on `lolli.li`. A `lolly-latest.*` link always points at the newest build, and versioned files never change. You can [check any file](#checking-what-you-downloaded) against the published checksums.

::: note Updates
Signed system repositories (openSUSE OBS, Flathub) are planned. Until then, a direct `.rpm`, `.deb`, `.flatpak` bundle or AppImage does not update itself. Check back here for a newer build. The Arch repository updates through pacman, and the App Store keeps the iPhone and iPad app current.
:::

<!--i:eti-monitor-->
## Mac

**Apple silicon, `.dmg`. macOS 13.5 or later.**

Download the disk image, open the image and drag Lolly to Applications. The current download is version %download{macos}. The app carries its own engine and tool catalogue. Its bundled terminal tools need the same macOS version.

- **Apple silicon:** [`lolly-latest.dmg`](https://lolli.li/lolly-latest.dmg), version %download{macos}.
- **Versioned:** `https://lolli.li/Lolly_<version>_aarch64.dmg`, pinned and never overwritten.
- **Intel, last build:** [`Lolly_1.1.0_x64.dmg`](https://lolli.li/Lolly_1.1.0_x64.dmg), version %download{macos-intel}. Intel Macs are not supported after 1.1.0. This build stays available and gets no updates.

<!--i:eti-grid-->
## iPhone and iPad

**iOS and iPadOS 26 or later. From the App Store.**

Lolly for iPhone and iPad is **Lolly** on the [App Store](https://apps.apple.com/app/id6836763603). The App Store signs and updates the app. There is no file to download or check.

You can also open [the web app](/) in Safari. **Share, then Add to Home Screen** gives the web app its own icon. The web app needs WebGPU. [Supported environments](/info/supported-environments.html) lists what has been tested. To build and sign the app yourself, see [Building for iOS](/info/ios-build.html).

<!--i:eti-package-->
## Android

**Phone and tablet, `.apk`, installed directly. Android 7.0 or later, `arm64-v8a`.**

There is no store and no store account. Download the APK, open the file and allow your browser or file manager to install apps this once. Android asks first. The prompt is a normal system step, not a warning about this file.

- **Download:** [`lolly-latest.apk`](https://lolli.li/lolly-latest.apk), version %download{android}.
- **Versioned:** `https://lolli.li/Lolly-<version>.apk`.

[Check the file](#checking-what-you-downloaded) against `SHA256SUMS.txt` before you install the APK. Newer versions are held back from Android because Android 11's web view has no WebGPU adapter, and Android 12 or later has not been checked yet.

<!--i:eti-download-->
## Windows

**x64, an installer. Version %download{windows}.**

Download [`lolly-latest.exe`](https://lolli.li/lolly-latest.exe) (an NSIS installer) or [`lolly-latest.msi`](https://lolli.li/lolly-latest.msi).

::: warning The Windows installers are not code-signed yet
Windows SmartScreen warns before the first run. [Compare the file](#checking-what-you-downloaded) with `SHA256SUMS.txt` before you allow the install.
:::

<!--i:eti-box-->
## Linux

For the newest version on Linux, install the web app from your browser. Open [lolly.tools](/) in Chrome, Chromium, Edge or Brave and choose **Install app** from the address bar or the browser menu. Lolly opens in its own window with a launcher icon, keeps your work on your computer and runs offline after the first visit. The browser needs WebGPU, which a current GNOME or KDE desktop with working graphics drivers normally has. Nobody on the project has checked this route on a Linux desktop yet, so [supported environments](/info/supported-environments.html) does not list Linux as tested. A package that opens Lolly in your installed browser is being built.

Every Linux package is version 1.1.0, x86_64 unless the section says otherwise. Newer versions are held back because WebKitGTK, the Linux app's web view, has no WebGPU yet ([supported environments](/info/supported-environments.html)). Pick the package for your distribution:

| You run | Get |
|---|---|
| openSUSE Tumbleweed | [The Tumbleweed RPM](#tumbleweed) |
| openSUSE Leap 16 | [The Leap 16 RPM](#leap) |
| Debian, Ubuntu and derivatives | [The `.deb`](#debian-and-ubuntu), for amd64 or arm64 |
| Arch and derivatives | [The pacman repository](#arch) |
| Fedora, Leap 15.6, an immutable desktop or anything else | [The Flatpak](#flatpak) |

### Tumbleweed

```bash
sudo zypper install https://lolli.li/lolly-latest.rpm
```

Or download [`lolly-latest.rpm`](https://lolli.li/lolly-latest.rpm) and install the file directly. Versioned builds have names such as `https://lolli.li/lolly-desktop-<version>-0.x86_64.rpm`. `shells/tauri-desktop/rpm/README.md` describes the package build.

### Leap

Leap 16 has its own build:

```bash
sudo zypper install https://lolli.li/lolly-latest-leap16.rpm
```

The Tumbleweed RPM is compiled against a newer glibc and refuses to install on Leap 16 with `nothing provides 'libm.so.6(GLIBC_2.43)'`. The two packages are otherwise identical. The versioned build is, for example, `https://lolli.li/lolly-desktop-<version>-0.leap16.x86_64.rpm`.

::: details Why Leap 15.6 has no RPM
The dependency tree needs Rust 1.88 or newer, and the default toolchain on 15.6 is older. Supporting that release would mean a second pinned Rust toolchain and a second build. Tumbleweed and Leap 16 are supported. On 15.6, use the Flatpak.
:::

### Debian and Ubuntu

```bash
# amd64 (Intel and AMD)
curl -LO https://lolli.li/lolly-latest.deb && sudo apt install ./lolly-latest.deb
# arm64 (ARM servers, Raspberry Pi, ARM VMs)
curl -LO https://lolli.li/lolly-latest-arm64.deb && sudo apt install ./lolly-latest-arm64.deb
```

Versioned files have names such as `https://lolli.li/lolly-desktop-<version>_amd64.deb` and `lolly-desktop-<version>_arm64.deb`.

### Arch

::: note The repository is not GPG-signed yet
The `SigLevel` line in the entry below makes an exception for this repository only.
:::

Add the Lolly repository to `/etc/pacman.conf`:

```ini
[lolly]
SigLevel = Optional TrustAll
Server = https://lolli.li/arch/$arch
```

Then install and update with pacman:

```bash
sudo pacman -Syu lolly-desktop-bin
```

The package repacks the official desktop version pinned in its recipe. It installs the desktop integration: the `.lolly` file type, `lolly://` links, the thumbnailer, the GNOME Shell search provider, the D-Bus services and the KDE service menu.

::: details Building the Arch package by hand, and Hyprland
An AUR package with the same name is planned for when AUR account registration reopens. You can build from the recipe in `shells/tauri-desktop/linux/arch/` now:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly/shells/tauri-desktop/linux/arch && makepkg -si
```

On Hyprland and other wlroots compositors, the colour picker and the wallpaper feature use the desktop portal. An `xdg-desktop-portal` backend must be running (Hyprland ships its own). The desktop search integration is for GNOME and KDE.
:::

### Flatpak

The Flatpak brings its own runtime and works on any distribution:

```bash
curl -LO https://lolli.li/lolly-latest.flatpak
flatpak install --user ./lolly-latest.flatpak
flatpak run tools.lolly.Desktop
```

The app id is `tools.lolly.Desktop` and the runtime is `org.gnome.Platform` version 50. The manifest and the local build steps are in `shells/tauri-desktop/flatpak/README.md`.

### AppImage

[`lolly-latest.AppImage`](https://lolli.li/lolly-latest.AppImage) comes from the same desktop build. Make the file executable and run the file. The Flatpak is the supported cross-distribution package. Use the AppImage when you need a single file.

<!--i:eti-cpu-->
## Your own server

### YunoHost

On a [YunoHost](https://yunohost.org) server, install [Lolly Work for YunoHost](https://github.com/lolly-tools/lolly-work_ynh) (`lolly-work_ynh`). From 1.2.0 it is the only Lolly package for YunoHost. It serves the same web app from a whole domain of your own, adds the Lolly Work server with its PostgreSQL database and signs people in with the server's YunoHost accounts. [Install Lolly Work, section 7](/info/work-install.html#7-yunohost) has the install command and the exact package revision. The [YunoHost section of the deployment guide](/info/deployment.html#yunohost) compares this package with other ways to deploy.

The static `lolly_ynh` package, which served only the app, is discontinued. A guide for replacing a static install with Lolly Work on the same domain is coming.

### A container image

The signed web image, `ghcr.io/lolly-tools/lolly-web`, serves the same app as lolly.tools, version 1.2.0. The [1.2.0 release notes](https://github.com/lolly-tools/lolly/releases/tag/v1.2.0) list its digest. A static bundle behind any web server also works, including an air-gapped one. [Deployment](/info/deployment.html) covers both, and which one suits a rollout to other people.

<!--i:eti-code-->
## For developers

::: details The terminal, the SDK, the browser extension and building it yourself
| Surface | How you get it |
|---|---|
| **Terminal** | `pnpm run cli` in a checkout. The same engine, headless. The desktop app includes the same CLI. See [the CLI guide](/info/cli.html#install). |
| **Terminal, interactive** | `pnpm run tui` in a checkout. A full-screen terminal interface on the same engine. See [the TUI guide](/info/tui.html). |
| **Tool-author SDK** | `npm i -D @lolly-tools/core`. The `HostV1` contract types, the manifest validator and a mock host for testing a tool without the app or a clone of the repository. See [Publish and localize a tool](/info/tool-publishing.html#try-it-without-the-monorepo). |
| **Browser extension** | Load unpacked. See [Browser extension](/info/extension.html). |

To build the desktop app yourself on a Mac:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly && pnpm install
pnpm -C shells/tauri-desktop install --frozen-lockfile
```

Configure catalog signing as described in the [Build Guide](/info/build-guide.html), then build:

```bash
LOLLY_PROFILE=lolly-demo LOLLY_EMBED_CATALOG=profile pnpm run build:desktop
```

The app is written to `shells/tauri-desktop/src-tauri/target/release/bundle/macos/`. It opens with Lolly Demo. Lolly Starter, a blank design system to make your own, is also on the device. On Windows, `pnpm run build:desktop` builds the Windows installers. `pnpm run build:android` in `shells/tauri-mobile` builds the APK. The Build Guide lists the prerequisites for each.
:::

<!--i:eti-badge-check-->
## Checking what you downloaded

Every release publishes a checksums file at [`https://lolli.li/SHA256SUMS.txt`](https://lolli.li/SHA256SUMS.txt). Put it next to your file, then:

```bash
curl -LO https://lolli.li/SHA256SUMS.txt
sha256sum --check --ignore-missing SHA256SUMS.txt
```

`OK` means the file on your disk is byte for byte the file the build produced. A `lolly-latest.*` file is a copy of the current versioned build and has that build's hash. If you kept the `latest` name, compare the hash value, not the file name. A mismatch means the file changed on the way to you. Download it again rather than installing it anyway. Download the file again and do not install the changed file.

Files that Lolly makes carry their own seal, a separate and stronger check. See [Verify It Yourself](/info/verify-yourself.html).
