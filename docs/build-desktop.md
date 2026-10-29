# Build the desktop app

This page is for a developer who wants to run the desktop app from source or package it for macOS, Windows or Linux. The desktop app is a Tauri shell around the web app's own code (see [One source, three apps](/info/build-guide.html#one-source-three-apps)), so you need a checkout from [Get the source](/info/contributing-setup.html) plus a Rust toolchain.

## Prerequisites

<!--l:rust-->**Rust toolchain:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

<!--l:tauri-->**Tauri CLI.** It is a Node package installed with the desktop shell's own dependencies, which are a separate pnpm project:

```bash
pnpm -C shells/tauri-desktop install
```

**Platform build tools:**

| Platform | Required |
|---|---|
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Windows | Microsoft C++ Build Tools, or Visual Studio with the C++ workload |
| Linux | `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `libsoup-3.0-dev`, `libssl-dev` |

Tauri keeps the full list at <https://tauri.app/start/prerequisites/>.

## Development

```bash
pnpm run dev:desktop
```

Tauri opens a native window with the Vite dev server running behind it, and hot reload works. Storage uses the filesystem override (`bridge-overrides/state.ts`): saved work goes to `<AppData>/saved-state/`, where `<AppData>` is the app's data directory for the identifier `tools.lolly.Desktop`, for example `~/Library/Application Support/tools.lolly.Desktop/` on macOS.

## Production build

Each platform's build ships one brand, chosen with `LOLLY_PROFILE`:

| Build | Profile | What a new person sees |
|---|---|---|
| macOS | `lolly-demo` | Lolly Demo, the brand lolly.tools serves, with Lolly Starter on the device to switch to or edit |
| Windows and Linux | `lolly-start` | The blank starter brand |

Lolly Starter reaches the Mac app because Lolly Demo's asset index lists it as a companion design system. Without `LOLLY_EMBED_CATALOG`, the desktop build takes its default seed, which is also `lolly-demo`.

Provide `LOLLY_CATALOG_SIGNING_KEY` and `VITE_CATALOG_PUBLIC_KEY_JWK` from your private credential store. They sign the catalog embedded in the app; operating-system code signing uses a separate identity. Then, from the repository root:

```bash
export LOLLY_PROFILE=lolly-demo     # macOS
# export LOLLY_PROFILE=lolly-start  # Windows and Linux
export LOLLY_EMBED_CATALOG=profile
pnpm run build:desktop
```

The build runs in this order:

::: timeline
- <!--i:seal--> **Build and sign the frontend.** The web app's code is compiled with the Tauri bridge modules, and the catalog embedded in it is signed.
- <!--i:photos--> **Build the Quick Look extensions** (macOS only), which give Lolly files a thumbnail and a preview in Finder.
- <!--i:code--> **Build the native CLI sidecar**, which gives the app a `lolly` command of its own.
- <!--i:box--> **Compile and package the app** into the installers below.
:::

| Platform | Artifact | Location |
|---|---|---|
| macOS | `.app` and `.dmg` | `src-tauri/target/release/bundle/macos/` and `bundle/dmg/` |
| Windows | `.msi` and an `.exe` NSIS installer | `src-tauri/target/release/bundle/` |
| Linux | `.deb`, `.rpm` and `.AppImage` | `src-tauri/target/release/bundle/` |

The complete macOS package needs macOS 13.5 or later, the minimum for its bundled Node CLI runtime. Set `APPLE_SIGNING_IDENTITY` for a Developer ID build, then notarise and staple the app and DMG before you distribute them.

Public builds, workflows, download buckets and package services use a public brand: `lolly-demo` for the Mac app and `lolly-start` for Windows and Linux, never the private `suse` pack.

::: details A private build from the SUSE pack
For an authorised private SUSE build, mount `brands/suse` and set `LOLLY_PROFILE=suse` with `LOLLY_EMBED_CATALOG=profile`. Use a separate app identifier, such as `tools.lolly.SUSE.Desktop`, so its state and cached CLI catalog do not share the public edition's directory, and match the Quick Look extension identifiers to it on macOS. RPM source preparation also needs `rpm/make-sources.sh --private --out <private-build-directory>` and CLI resources built for the target Linux architecture. Source archives leave out macOS extended-attribute files. Keep the sources and packages in private storage.
:::

## Intel Macs

The Mac app is built for Apple silicon only. Intel Macs are not supported after 1.1.0, the last Intel build, which stays downloadable from the [install page](/info/install.html) and gets no updates.

## Cross-compilation

Tauri does not cross-compile out of the box, so build each platform on its own operating system. The repository's release path builds the Linux packages in containers with the scripts in `shells/tauri-desktop/release/` (`build-deb.sh`, `build-rpm.sh`, `build-flatpak.sh` and `build-arch.sh`; the README there gives the order). GitHub workflows cover specific targets: `linux-arm64.yml`, `linux-rpm.yml`, `flatpak.yml` and `desktop-extra.yml` (the Windows installers). [Linux packages](/info/build-obs.html) maps each Linux format to its recipe.

## Icons

Production icons are committed under `src-tauri/icons/`. To regenerate the fallback sizes from new artwork:

```bash
cd shells/tauri-desktop
npx @tauri-apps/cli icon path/to/icon-1024.png
```

That writes every required size and format (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` and the rest) to `src-tauri/icons/`. The macOS bundle also carries a branded asset catalog and document icon; keep them consistent with any replacement artwork.

::: details What the desktop app guards at runtime
These are behaviours of the built app rather than build steps.

- **Website reads.** The Website source reads public HTTP and HTTPS pages anonymously. It resolves and pins public addresses for each page, redirect, stylesheet and image read, and refuses local and private addresses. A page redirect stays with the same party. A missing resource can leave a partial import, while a refused network address stops the import. Signed-in screen capture is a separate feature.
- **Hot folders.** File events keep an open descriptor until the client consumes the file. Files must be regular, direct children of the selected folder; links and files outside it are refused. Custody and event queues hold at most 256 entries, and each file has a 256 MiB read limit. Replacing a folder with invalid settings keeps the previous watcher running.
- **Renderer adverts.** The app writes the advert that tells local clients where its renderer listens through a private temporary file and an atomic replace. Node clients accept only a bounded, regular advert owned by the current user, with owner-only permissions on Unix. A stale or unsuitable advert is ignored, and normal renderer selection continues.
:::
