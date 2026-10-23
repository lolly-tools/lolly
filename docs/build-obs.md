# Linux packages

This page is for a Linux packager or distributor who wants Lolly as native packages. It covers the formats the repository builds today, the recipe and workflow behind each and what the Open Build Service (OBS) would add. People who only want to install Lolly should read [Install Lolly](/info/install.html).

## What ships today

The desktop app's own build already writes a `.deb`, an `.rpm` and an `.AppImage` on Linux (see [Build the desktop app](/info/build-desktop.html#production-build)). For releases, the repository carries a recipe per format. All paths are under `shells/tauri-desktop/`.

| Format | Recipe | Workflow |
|---|---|---|
| RPM (openSUSE Tumbleweed and Leap 16) | `rpm/lolly-desktop.spec`, with `rpm/make-sources.sh` producing every source it needs; `rpm/README.md` shows the `osc` steps for an OBS project | `linux-rpm.yml` |
| DEB | `release/build-deb.sh` (`tauri build` in a pinned container) | the `build-deb` job in `flatpak.yml` |
| Flatpak | `flatpak/tools.lolly.Desktop.yml` (app ID `tools.lolly.Desktop`), which repackages the prebuilt `.deb` | `flatpak.yml` |
| Arch | `linux/arch/PKGBUILD`, which repackages the published `.deb`; `release/build-arch.sh` builds it | `arch-repackage.yml` |

`release/README.md` gives the order for a full Linux release. Public packages carry a public brand, `lolly-start`, never the private `suse` pack.

## What a package carries

A Linux package holds one of two artifacts:

- **The desktop app**, the `tauri build` output, as an RPM, deb, Flatpak or AppImage. It already carries the CLI sidecar (installed as `lolly-cli` by the RPM recipe) and its own embedded content.
- **The standalone CLI**, from `pnpm run pack:cli` (an npm-compatible package) or `pnpm run build:cli-sidecar` (a small Node launcher in `dist/cli-sidecar/bin/` plus its ESM resources in `dist/cli-sidecar/cli-lib/`, which must stay together). See [Build the CLI and TUI](/info/build-terminal.html#standalone-binary). Neither form contains tools or a catalog, so a CLI package also installs a content root, a materialised public content bundle, and points `LOLLY_ROOT` at that directory.

## Build with no network

Distribution build systems such as OBS build in clean chroots with no network, so every input must be present before the build starts. For a Node, Vite and Rust app that is the main porting work: vendor the npm and Cargo dependencies (an offline npm cache and `cargo vendor`) or supply them through source services, and declare the toolchain as build requirements, such as `nodejs >= 22.18`, `npm`, `rust` and `cargo` (the desktop app needs Rust 1.88 or later), plus the GTK and WebKit development packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` or their equivalents).

The RPM recipe avoids most of that work. `rpm/make-sources.sh` runs the Node build ahead of time on a machine with network access, and ships the prebuilt frontend, a `cargo vendor` tree and a pinned ONNX Runtime archive as the package's sources. The package build itself then runs offline.

## What the Open Build Service would add

[Open Build Service](https://openbuildservice.org) is SUSE's source-to-package build system. It compiles one source definition into native packages for many distributions at once, in clean, reproducible, network-isolated chroots, and publishes them through signed, hosted repositories that people add and update like any other system package.

Today the RPMs are direct downloads (see [Install Lolly](/info/install.html)), and a signed OBS repository is planned. OBS would not replace the recipes above. What it adds is fan-out across the rest of the matrix and those hosted repositories:

| Format | Distributions | Lolly artifact |
|---|---|---|
| RPM | <!--l:opensuse-->openSUSE Leap and Tumbleweed, SLE and SLES, <!--l:fedora-->Fedora, RHEL, CentOS, Alma, Rocky, Mageia and openEuler | CLI and desktop app |
| DEB | <!--l:debian-->Debian, <!--l:ubuntu-->Ubuntu and Raspbian | CLI and desktop app |
| Arch | <!--l:arch-->Arch Linux (`PKGBUILD`) | CLI and desktop app |
| <!--l:flatpak-->Flatpak | any distribution, sandboxed | desktop app |
| AppImage | any distribution, portable | Tauri's `.AppImage` output |
| Container images | OCI and <!--l:docker-->Docker, built with Kiwi or a `Dockerfile` | the CLI as a container |
| Appliance and disk images | ISO, VM and cloud images, built with Kiwi | a preloaded system image |

For the details of wiring a project up, see the [OBS documentation](https://openbuildservice.org/help/) and the [openSUSE packaging guidelines](https://en.opensuse.org/openSUSE:Packaging_guidelines).
