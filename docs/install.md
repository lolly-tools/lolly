# Install Lolly

You may not need to install anything: [lolly.tools](/) runs in a current browser that supports WebGPU ([which browsers](/info/supported-environments.html)). Install the app when you want Lolly in your dock or app menu, with native file dialogs and a copy that keeps working with the network unplugged. It is the same app either way: the same tools, the same design systems and the same files out.

## Pick your device

| Your device | Get | Version |
|---|---|---|
| Mac with Apple silicon (M1 and later) | [`lolly-latest.dmg`](https://lolli.li/lolly-latest.dmg) | 1.1.1 |
| Mac with Intel | [`lolly-latest-x64.dmg`](https://lolli.li/lolly-latest-x64.dmg) | 1.1.0 |
| iPhone and iPad | **Lolly Tools** on the [App Store](https://apps.apple.com/app/id6804131681) | 1.1.1 |
| Android | [`lolly-latest.apk`](https://lolli.li/lolly-latest.apk) | 1.1.0 |
| Windows | [`lolly-latest.exe`](https://lolli.li/lolly-latest.exe) | 1.1.0 |
| Linux | [Flatpak, RPM, `.deb`, Arch or AppImage](#linux) | 1.1.0 |
| Your own server | [YunoHost](#yunohost) or [a container image](#a-container-image) | 1.1.1 and 1.1.2 |

lolly.tools always has the newest version. The 1.1.0 builds stay at 1.1.0 until each platform's web view passes the WebGPU check that later versions need. Every file links straight to `lolli.li`: a `lolly-latest.*` link always points at the newest build, and versioned files beside it never change. You can [check any file](#checking-what-you-downloaded) against the published checksums.

::: note Updates
Signed system repositories (openSUSE OBS, Flathub) are planned. Until they land, a direct `.rpm`, `.deb`, `.flatpak` bundle or AppImage does not update itself, so check back here for a newer build. The Arch repository updates through pacman, and the App Store keeps the iPhone and iPad app current.
:::

## Mac

**Apple silicon and Intel, `.dmg`. macOS 13.5 or later.**

Download the disk image, open it and drag Lolly to Applications. The app carries its own engine and tool catalogue, and its bundled terminal tools need the same macOS version.

- **Apple silicon:** [`lolly-latest.dmg`](https://lolli.li/lolly-latest.dmg), version 1.1.1.
- **Intel:** [`lolly-latest-x64.dmg`](https://lolli.li/lolly-latest-x64.dmg), version 1.1.0.
- **Versioned:** `https://lolli.li/Lolly_<version>_aarch64.dmg` and `https://lolli.li/Lolly_<version>_x64.dmg`, pinned and never overwritten.

## iPhone and iPad

**iOS and iPadOS 26 or later. From the App Store.**

Lolly for iPhone and iPad is **Lolly Tools** on the [App Store](https://apps.apple.com/app/id6804131681). The App Store signs the app and keeps it up to date, so there is no separate file to download or check.

You can also open [the web app](/) in Safari. **Share, then Add to Home Screen** gives the web app an icon of its own. The web app needs WebGPU; [supported environments](/info/supported-environments.html) lists what has been tested so far. To build and sign the app yourself, see [Building for iOS](/info/ios-build.html).

## Android

**Phone and tablet, `.apk`, installed directly. Android 7.0 or later, `arm64-v8a`.**

There is no store and no store account. Download the APK, open it and allow your browser or file manager to install applications this once. Android asks first: that prompt is the system working correctly, not a warning about this file.

- **Download:** [`lolly-latest.apk`](https://lolli.li/lolly-latest.apk), version 1.1.0.
- **Versioned:** `https://lolli.li/Lolly-<version>.apk`.

[Check the file](#checking-what-you-downloaded) against `SHA256SUMS.txt` before you install the APK. Newer versions are held back from Android because Android 11's web view has no WebGPU adapter, and Android 12 or later has not been checked yet.

## Windows

**x64, an installer. Version 1.1.0.**

Download [`lolly-latest.exe`](https://lolli.li/lolly-latest.exe) (an NSIS installer) or [`lolly-latest.msi`](https://lolli.li/lolly-latest.msi). The installers are not code-signed yet, so Windows SmartScreen warns before the first run. [Compare the file](#checking-what-you-downloaded) with `SHA256SUMS.txt` before you allow the install.

## Linux

Every Linux build is version 1.1.0, x86_64 unless the section says otherwise. Pick the one for your distribution:

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

Or download [`lolly-latest.rpm`](https://lolli.li/lolly-latest.rpm) and install the file directly. The versioned build sits beside it, for example `https://lolli.li/lolly-desktop-<version>-0.x86_64.rpm`. The package build is described in `shells/tauri-desktop/rpm/README.md`.

### Leap

Leap 16 has its own build:

```bash
sudo zypper install https://lolli.li/lolly-latest-leap16.rpm
```

The Tumbleweed RPM is compiled against a newer glibc and refuses to install on Leap 16 with `nothing provides 'libm.so.6(GLIBC_2.43)'`. The two packages are otherwise identical. The versioned build is, for example, `https://lolli.li/lolly-desktop-<version>-0.leap16.x86_64.rpm`.

::: details Why Leap 15.6 has no RPM
The dependency tree needs Rust 1.88 or newer, and 15.6's default toolchain is older. Supporting it would mean pinning a second Rust toolchain into the project and keeping two build stories. Tumbleweed and Leap 16 are the supported pair; on 15.6, use the Flatpak.
:::

### Debian and Ubuntu

```bash
# amd64 (Intel and AMD)
curl -LO https://lolli.li/lolly-latest.deb && sudo apt install ./lolly-latest.deb
# arm64 (ARM servers, Raspberry Pi, ARM VMs)
curl -LO https://lolli.li/lolly-latest-arm64.deb && sudo apt install ./lolly-latest-arm64.deb
```

Versioned files sit beside them, for example `https://lolli.li/lolly-desktop-<version>_amd64.deb` and `lolly-desktop-<version>_arm64.deb`.

### Arch

Add the Lolly repository to `/etc/pacman.conf`:

```ini
[lolly]
SigLevel = Optional TrustAll
Server = https://lolli.li/arch/$arch
```

Then install, and from here on update, with pacman itself:

```bash
sudo pacman -Syu lolly-desktop-bin
```

The `SigLevel` line is needed because the repository is not GPG-signed yet; it scopes that exception to this one repository. The package repacks the official desktop version pinned in its recipe and installs the whole desktop integration: the `.lolly` file type, `lolly://` links, the thumbnailer, the GNOME Shell search provider, the D-Bus services and the KDE service menu.

::: details Building the Arch package by hand, and Hyprland
An AUR package under the same name is planned once AUR account registration reopens. The recipe is in `shells/tauri-desktop/linux/arch/`, and you can build it today:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly/shells/tauri-desktop/linux/arch && makepkg -si
```

On Hyprland and other wlroots compositors, the colour picker and the wallpaper feature go through the desktop portal, so an `xdg-desktop-portal` backend must be running (Hyprland ships its own). The desktop search integration is a GNOME and KDE feature.
:::

### Flatpak

The Flatpak brings its own runtime, so it works on any distribution, whatever it ships:

```bash
curl -LO https://lolli.li/lolly-latest.flatpak
flatpak install --user ./lolly-latest.flatpak
flatpak run tools.lolly.Desktop
```

The app id is `tools.lolly.Desktop` and the runtime is `org.gnome.Platform` version 50. The manifest and the local build steps are in `shells/tauri-desktop/flatpak/README.md`.

### AppImage

[`lolly-latest.AppImage`](https://lolli.li/lolly-latest.AppImage) comes out of the same desktop build. Make the file executable and run it directly. The Flatpak is the supported cross-distribution package; the AppImage is there when you need a single file.

## Your own server

### YunoHost

On a [YunoHost](https://yunohost.org) server, install Lolly from its app package:

```bash
sudo yunohost app install https://github.com/lolly-tools/lolly_ynh
```

The package serves the same web app, version 1.1.1, from a domain of your own, with the same security headers as lolly.tools. It needs a whole domain, keeps nothing on the server and fetches the on-device models from `lolli.li` the first time a tool asks for one. The [YunoHost section of the deployment guide](/info/deployment.html#yunohost) covers what the package installs and how access works.

### A container image

The signed web image, `ghcr.io/lolly-tools/lolly-web`, serves the same app lolly.tools runs, version 1.1.2. A static bundle behind any web server works too, including an air-gapped one. [Deployment](/info/deployment.html) covers both, and which suits rolling Lolly out to other people.

## For developers

::: details The terminal, the SDK, the browser extension and building it yourself
| Surface | How you get it |
|---|---|
| **Terminal** | `pnpm run cli` in a checkout. The same engine, headless; the desktop app carries the same CLI. See [the CLI guide](/info/cli.html#install). |
| **Terminal, interactive** | `pnpm run tui` in a checkout. A full-screen terminal interface on the same engine. See [the TUI guide](/info/tui.html). |
| **Tool-author SDK** | `npm i -D @lolly-tools/core`. The `HostV1` contract types, the manifest validator and a mock host for testing a tool without the app or a clone of the repository. See [Publish and localize a tool](/info/tool-publishing.html#try-it-without-the-monorepo). |
| **Browser extension** | Load unpacked. See [Browser Extension](/info/extension.html). |

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

The app is written to `shells/tauri-desktop/src-tauri/target/release/bundle/macos/`. It opens with Lolly Demo, and Lolly Starter, a blank design system to make your own, is already on the device to switch to. `pnpm run build:desktop` builds the Windows installers on Windows, and `pnpm run build:android` in `shells/tauri-mobile` builds the APK; the Build Guide lists the prerequisites for each.
:::

## Checking what you downloaded

Every release publishes a checksums file at [`https://lolli.li/SHA256SUMS.txt`](https://lolli.li/SHA256SUMS.txt). Put it next to your file, then:

```bash
curl -LO https://lolli.li/SHA256SUMS.txt
sha256sum --check --ignore-missing SHA256SUMS.txt
```

A line reading `OK` means the file on your disk is byte for byte the file the build produced. A `lolly-latest.*` file is a copy of the current versioned build, so it carries that build's hash: compare the value, not the name, if you kept the `latest` name. A mismatch means the file changed somewhere between there and here. Download it again rather than installing it anyway.

The files Lolly itself makes carry their own seal, a separate and stronger check: see [Verify It Yourself](/info/verify-yourself.html).
