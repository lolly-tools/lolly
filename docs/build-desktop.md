# Build the desktop app

Set up and package the Tauri desktop shell.

Part of [Build Guide](/info/build-guide.html).

## Desktop app (macOS / Windows / Linux)

### Prerequisites

<!--l:rust-->**Rust toolchain:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

<!--l:tauri-->**Tauri CLI (Node package - installed per-shell):**

```bash
cd shells/tauri-desktop
pnpm install
```

**Platform build tools:**

| Platform | Required |
|---|---|
| macOS | Xcode Command Line Tools (`xcode-select --install`) |
| Windows | Microsoft C++ Build Tools or Visual Studio with C++ workload |
| Linux | `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `libsoup-3.0-dev`, `libssl-dev` |

Full list: https://tauri.app/start/prerequisites/

### Icons

Production icons are committed under `src-tauri/icons/`. To regenerate the fallback sizes from new artwork:

```bash
cd shells/tauri-desktop
npx @tauri-apps/cli icon path/to/icon-1024.png
```

This writes all required sizes and formats (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, etc.) to `src-tauri/icons/`.

The macOS bundle also carries the branded asset catalog and document icon. Keep these consistent with any replacement artwork.

### Development

From the repository root:

```bash
pnpm run dev:desktop
```

Inside `shells/tauri-desktop`, `pnpm run dev` does the same.

Tauri opens a native window. The Vite dev server runs in the background; hot reload works. The state bridge uses the filesystem override (`bridge-overrides/state.ts`) - saved states go to `<AppData>/saved-state/`, where `<AppData>` is the app's data directory under the identifier `tools.lolly.Desktop` (for example `~/Library/Application Support/tools.lolly.Desktop/` on macOS).

### Production build

Provide `LOLLY_CATALOG_SIGNING_KEY` and `VITE_CATALOG_PUBLIC_KEY_JWK` through your private credential store. These sign the catalog embedded in the app; operating-system code signing uses a separate identity.

From the repository root:

```bash
export LOLLY_PROFILE=lolly-start
export LOLLY_EMBED_CATALOG=profile
pnpm run build:desktop
```

Inside `shells/tauri-desktop`, `pnpm run build` does the same, with the same two variables set.

Tauri first builds and signs its frontend, builds the native CLI sidecar, and builds the Quick Look extensions on macOS. It then compiles and packages the application. Output:

| Platform | Artifact | Location |
|---|---|---|
| macOS | `.app` + `.dmg` | `src-tauri/target/release/bundle/macos/` and `bundle/dmg/` |
| Windows | `.msi` + `.exe` NSIS installer | `src-tauri/target/release/bundle/` |
| Linux | `.deb` + `.AppImage` | `src-tauri/target/release/bundle/` |

The complete macOS package requires macOS 13.5 or later, matching the bundled Node CLI runtime. Set `APPLE_SIGNING_IDENTITY` for a Developer ID build, then notarise and staple the app and DMG before distribution.

For Intel Macs, use `.github/workflows/macos-intel.yml`. It builds the pinned ONNX Runtime 1.28.0 from source, verifies API 28, and bundles the resulting x86_64 library with the application. The matching Node CLI and native SVG addon are built on the Intel runner. The collected app still needs distribution signing and notarisation.

For a rebuild using the same runtime, supply `runtime_run_id` from a previous successful Intel build and `runtime_sha256` for its bundled `libonnxruntime.dylib`. The workflow checks that digest, the x86_64 architecture, runtime version and API before reuse. Leave both inputs empty to compile the runtime again.

For an authorised private SUSE build, mount `brands/suse` and set `LOLLY_PROFILE=suse` with `LOLLY_EMBED_CATALOG=profile`. Use a separate app identifier, such as `tools.lolly.SUSE.Desktop`, so its state and cached CLI catalog do not share the public edition's directory. Match the Quick Look extension identifiers to that app identifier on macOS. RPM source preparation additionally requires `rpm/make-sources.sh --private --out <private-build-directory>` and CLI resources built for the target Linux architecture. Source archives omit macOS extended-attribute files. Keep the sources and packages in private storage. Public workflows, S3 download buckets and OBS must continue using `lolly-start`.

### Cross-compilation

Tauri does not support cross-compilation out of the box. Build each platform on its native OS, or use a CI matrix (GitHub Actions `macos-latest` / `windows-latest` / `ubuntu-latest`).

---

[Back to Build Guide](/info/build-guide.html).
