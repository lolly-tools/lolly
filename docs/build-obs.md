# Build with Open Build Service

Plan OBS recipes for Lolly artifacts and their dependencies.

Part of [Build Guide](/info/build-guide.html).

## Open Build Service (OBS)

[Open Build Service](https://openbuildservice.org) is SUSE's source-to-package build system. It compiles a single source definition into native packages for many distributions at once, in clean and reproducible network-isolated chroots, and publishes them through signed, hosted repositories. One Lolly package definition on OBS can target the whole Linux matrix below from the same source.

### What OBS can build for Lolly

| Format | Distributions | Lolly artifact packaged |
|---|---|---|
| RPM | <!--l:opensuse-->openSUSE Leap / Tumbleweed, SLE / SLES, <!--l:fedora-->Fedora, RHEL / CentOS / Alma / Rocky, Mageia, openEuler | CLI binary and/or Tauri desktop app |
| DEB | <!--l:debian-->Debian, <!--l:ubuntu-->Ubuntu, Raspbian | CLI binary and/or Tauri desktop app |
| Arch | <!--l:arch-->Arch Linux (`PKGBUILD`) | CLI binary / desktop app |
| <!--l:flatpak-->Flatpak | distro-agnostic sandboxed desktop app | Tauri desktop app |
| AppImage | distro-agnostic portable app | reuses Tauri's `.AppImage` output |
| Container images | OCI / <!--l:docker-->Docker (built via Kiwi or a `Dockerfile`) | CLI as a container image |
| Appliance / disk images | ISO, VM and cloud images (built via Kiwi) | full preloaded image |

The local Tauri build already emits `.deb`, `.rpm` and `.AppImage` packages (see [Build the desktop app](/info/build-desktop.html#production-build)), and the repository carries release recipes for RPM, deb, Flatpak and Arch (listed below). OBS does not replace those - its value is **fan-out across the rest of the matrix** (every RPM- and deb-based distro, Arch, Flatpak, containers, appliances) plus **signed, hosted repositories** that users can add and update from like any other system package.

### How it fits Lolly's artifacts

OBS packages one of the two Linux artifacts this guide already produces:

- **The standalone CLI** - `pnpm run pack:cli` (an npm-compatible package) or `pnpm run build:cli-sidecar` (a small Node launcher in `dist/cli-sidecar/bin/` plus its ESM resources in `dist/cli-sidecar/cli-lib/`, which must stay together), described in [Build the CLI and TUI](/info/build-terminal.html#standalone-binary). Neither form contains tools or a catalog, so a package also installs a content root (a materialised public content bundle) and points `LOLLY_ROOT` at that directory.
- **The Tauri desktop app** - the `tauri build` output, packaged as RPM / DEB / Flatpak / AppImage for desktop delivery. It already carries the CLI sidecar (installed as `lolly-cli` by the RPM recipe) and its own embedded content.

### Build-environment constraints

> **No network at build time.** OBS builds inside clean, network-isolated chroots, so every build input must be present up front. For a Node + Vite + Rust/Tauri app this is the main porting effort: vendor the npm and Cargo dependencies (an offline npm cache / `cargo vendor`) or supply them through OBS source services, and declare the toolchain as `BuildRequires` - e.g. `nodejs >= 22.18`, `npm`, `rust`, `cargo` (the desktop app's dependency tree needs Rust 1.88 or later), plus the desktop build's GTK/WebKit `-devel` packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` and equivalents).

The repository's RPM recipe avoids most of that porting effort: `rpm/make-sources.sh` runs the Node build ahead of time on a machine with network access, and ships the prebuilt frontend, a `cargo vendor` tree and a pinned ONNX Runtime archive as the package's sources, so the OBS build itself runs offline.

### Recipes in the repository

These recipes are maintained in the repository. All paths are under `shells/tauri-desktop/`.

| Format | Recipe | Workflow |
|---|---|---|
| RPM (openSUSE Tumbleweed and Leap 16) | `rpm/lolly-desktop.spec`, with `rpm/make-sources.sh` producing every source it needs; `rpm/README.md` shows the `osc` steps for an OBS project | `linux-rpm.yml` |
| DEB | `release/build-deb.sh` (`tauri build` in a pinned container) | the `build-deb` job in `flatpak.yml` |
| Flatpak | `flatpak/tools.lolly.Desktop.yml` (app ID `tools.lolly.Desktop`), which repackages the prebuilt `.deb` | `flatpak.yml` |
| Arch | `linux/arch/PKGBUILD`, which repackages the published `.deb`; `release/build-arch.sh` builds it | `arch-repackage.yml` |

`release/README.md` gives the order for a full Linux release.

For readers wiring this up for real, see the [OBS documentation](https://openbuildservice.org/help/) and the [openSUSE packaging guidelines](https://en.opensuse.org/openSUSE:Packaging_guidelines).

[Back to Build Guide](/info/build-guide.html).
