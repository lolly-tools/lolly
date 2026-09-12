# Build Guide

> **Scope.** This page is *how each artefact is produced*: getting the source, toolchain prerequisites and the per-platform build, signing and packaging steps. The [Deployment guide](/info/deployment.html) is *where each artefact runs* - delivery models, hosting and routing for the web shell and what the optional MCP and CA services need. Compilers, SDKs and store submission here; hosts, rewrites and rollout there.

How to build Lolly for each distribution target: standalone CLI binary, desktop app (macOS / Windows / Linux), mobile apps (iOS / Android) and the web shell as a container image for Kubernetes.

---

## Prerequisites (all targets)

- <!--l:node-->**Node.js ≥ 22.18** (the 22 LTS line) **or ≥ 24**, and **npm 10+**. The repo's scripts run TypeScript sources directly (`node scripts/foo.ts`), which relies on Node's unflagged type-stripping - added in Node 22.18 and 24. Node 20 and early 22.x fail at `pnpm install`. `.nvmrc` pins `22`, so nvm users can just run `nvm install` in the repo.
- The repo checked out, dependencies installed - see below

---

## Getting the source

Lolly is one repository. `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `docs/`, `community/`, `brands/lolly-start/`, every `shells/*` and both services live here as plain directories. The one exception is `brands/suse`, a **private** git submodule holding the SUSE tool pack and catalog - licensed fonts and music included, which is why it stays out of the public tree.

Everything except `brands/suse` is public, so a read-only contributor gets a complete, buildable checkout with the script (or single command) below. Write access is enforced by the host at push time, not by the checkout, so the setup is identical whether you're a maintainer or just reading it.

### The setup script

On macOS and openSUSE, one script takes a fresh clone to a running state - it detects your package manager (<!--l:homebrew-->Homebrew or zypper), installs git and Node if they are missing or too old, runs `pnpm install` and selects a content profile:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
./setup.sh                # public setup: community tools + the blank "lolly-start" brand
pnpm run dev:web           # web shell at http://localhost:5173
```

`./setup.sh` is idempotent - safe to re-run any time: after a `git pull`, or to repair a half-finished checkout. Flags:

- `--suse` also mounts the private SUSE brand pack and selects the SUSE profile (needs repo access)
- `--profile <suse|lolly-start>` forces a content profile after install
- `--skip-node` leaves Node entirely to you - the nvm path: `nvm install` in the repo (it reads `.nvmrc`), then `./setup.sh --skip-node`
- `--help` lists everything

### By hand

If you'd rather run the steps yourself, or are on a distro the script doesn't cover:

```bash
git -c url."git@github.com:".insteadOf=https://github.com/ \
    clone git@github.com:lolly-tools/lolly.git && \
cd lolly && \
git config url."git@github.com:".insteadOf https://github.com/ && \
pnpm install
```

`url.insteadOf` rewrites the HTTPS URL to SSH, which is safe for everyone since this is a public repo, and means the moment you get push access nothing else needs to change. Drop both `git config` lines if you'd rather authenticate over HTTPS.

`pnpm install`'s preinstall check confirms at least one content profile is complete on disk; a content-pack resolver (`packages/node-shell/src/content-roots.ts`) then picks a profile from `profiles.json` the first time anything reads tool or catalog content - see [Configuration](/info/configuration.html).

Verify the result with `pnpm run profile` (shows the resolved profile) and `pnpm run cli` (lists the tools it can see).

### The private SUSE brand pack

`brands/suse` holds the SUSE tool pack and its catalog, including licensed fonts and music, so it lives in a private repository, mounted as a submodule. If you have access, opt in explicitly:

```bash
git submodule update --init --checkout brands/suse
LOLLY_PROFILE=suse pnpm run dev:web
```

(`./setup.sh --suse` mounts it and selects the profile in one go.) Without it, `pnpm run profile` reports `lolly-start` as active - the blank brand, which is the correct default for anyone not doing SUSE-specific work, and the profile the public site and CI build against.

### If something fails

- **`pnpm install` dies with a syntax error in a `.ts` file** - your Node is too old for type-stripping; you need ≥ 22.18 or ≥ 24 (`node -v`). With Homebrew, note `node@22` is keg-only: add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile.
- **`brands/suse` won't clone** - it's private. Drop `--suse`; you land on `lolly-start` and everything still builds and runs.
- **A SUSE tool edit doesn't show up** - `brands/suse` is a separate, private repository (`suse-lolly`) mounted as a submodule. Commit *inside* it, then commit the moved pointer here - see the next section. A community tool has no such indirection: it is a plain directory in this repository, and a normal commit is enough.

### The one thing that still touches two repositories

A change inside `brands/suse` needs **two commits**: one in that submodule, and one that moves the recorded pointer in this repository. Push the submodule first, or this repository will point at a commit nobody else can fetch. Every other directory in the tree takes a plain commit, no pointer involved.

One case deserves care even though it is not cross-repository. `catalog/tools/index.json` is generated **per brand**, and every brand's index lists the community tools - so editing a community `tool.json` leaves the SUSE profile's index stale, and the single-profile `pnpm run build:catalog` can't see the drift because it only ever looks at the active profile. After any community tool change, run the all-profiles variants instead:

```bash
pnpm run build:catalog:all      # rebuild every mounted profile, then restore the active one
pnpm run validate:catalog:all   # validate every mounted profile; exits 1 on drift (the CI guard)
```

---

## CLI

### Development use (no build needed)

The CLI shell runs directly from the repo with Node.js:

```bash
# List available tools
pnpm run cli

# Show inputs for a tool
pnpm run cli qr-code

# Run a tool and write output
pnpm run cli qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg

# Explicit format
pnpm run cli quotes --quote="Open source wins." --name="Andy" --export=png --output=./quote.png
```

The CLI supports **SVG, EMF, EPS, HTML and the text/data formats** (JSON, CSV, ICS, VCF, MD, TXT) natively - hydrated by the engine with no browser engine needed (SVG/EMF only for tools with an `<svg>`-based template, since the lean CLI has no layout engine). **PNG** from an `<svg>`-based tool is also browser-free: resvg rasterises the engine's own SVG (Tier A). The remaining raster formats - **JPG, WebP, PDF and video (GIF, WebM, MP4)**, plus HTML-layout PNG - render through the CLI's own scoped headless Chromium (Tier B): install it once with `lolly install-browser`, then they export straight from the CLI. (ZIP is the one format the lean CLI leaves out - no zip dependency - so its batch writes a folder instead.)

### Standalone binary

To distribute the CLI without requiring Node.js installed:

**1. Bundle to a single CJS file:**

```bash
cd shells/cli
pnpm exec esbuild bin/lolly.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=dist/lolly.cjs
```

**2. Package with `@yao-pkg/pkg` (includes a Node runtime):**

```bash
npx @yao-pkg/pkg dist/lolly.cjs \
  --targets node20-macos-arm64,node20-macos-x64,node20-linux-x64,node20-win-x64 \
  --output dist/lolly
```

Output binaries land in `shells/cli/dist/` - one per platform target.

> The `tools/` and `catalog/` directories must ship alongside the binary. The CLI resolves them relative to the binary location, so the expected layout is:
> ```
> lolly          ← binary
> tools/              ← tool definitions
> catalog/            ← asset + tool catalogs
> ```

---

## TUI

### Development use (no build needed)

The interactive terminal shell runs straight from the repo - it needs a real TTY, so run it in your terminal rather than a captured pipe:

```bash
pnpm run tui
```

It's the CLI's engine and render path under an interactive, keyboard-first UI (built on Ink, run through `tsx`). The DOM-free formats - **SVG, EMF, EPS, HTML and the text/data formats** - render with nothing extra. State (saved sessions, project folders, profile) persists on disk in the directory all three local shells share - `$LOLLY_STATE_DIR`, else the desktop app's data directory when the app is installed here, else `~/.lolly`; exports default to `~/Desktop`. See the [TUI guide](/info/tui.html) for the full key map and views.

### Browser render tier (raster / PDF / video / URL capture)

Unlike the bare CLI, the TUI can produce browser-bound formats via a scoped headless Chromium - the same one the MCP server uses. Set it up once:

```bash
pnpm run install:browser   # Chromium → services/mcp/.browsers (shared with services/mcp)
pnpm run build:web         # a built web shell the TUI drives for pixel-identical raster/pdf/video
```

With those present, raster (PNG/JPG), PDF, video and the `url-shot` live-URL capture all export from the terminal; without them, those formats fail with a clear setup message and the TUI writes HTML instead. The browser is lazy - it launches only on the first such export, never at startup. Override the browser with `LOLLY_BROWSER_CHANNEL` / `LOLLY_BROWSER_PATH`, or point at a running/prebuilt web shell with `LOLLY_WEB_BASE` / `LOLLY_WEB_DIST`.

> No standalone-binary recipe yet - the TUI ships as a repo/dev surface today. Package it like the CLI (esbuild + `@yao-pkg/pkg`) once a target calls for it.

---

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
| Linux | `build-essential`, `libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` |

Full list: https://tauri.app/start/prerequisites/

### Icons

Tauri requires icon files at `src-tauri/icons/`. Generate them from a 1024×1024 source PNG (the build will fail with a missing-file error if this step is skipped):

```bash
cd shells/tauri-desktop
npx @tauri-apps/cli icon path/to/icon-1024.png
```

This writes all required sizes and formats (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`, etc.) to `src-tauri/icons/`.

> Placeholder icons committed to the repo are solid-green squares - replace them with production artwork before releasing.

### Development

```bash
cd shells/tauri-desktop
pnpm run dev
# or from repo root:
pnpm run dev:desktop
```

Tauri opens a native window. The Vite dev server runs in the background; hot reload works. The state bridge uses the filesystem override (`bridge-overrides/state.ts`) - saved states go to `$APPDATA/Lolly/saved-state/`.

### Production build

```bash
cd shells/tauri-desktop
pnpm run build
# or from repo root:
pnpm run build:desktop
```

This runs `vite build` (producing `dist/`) then `tauri build`. Output:

| Platform | Artifact | Location |
|---|---|---|
| macOS | `.app` + `.dmg` | `src-tauri/target/release/bundle/macos/` |
| Windows | `.msi` + `.exe` NSIS installer | `src-tauri/target/release/bundle/` |
| Linux | `.deb` + `.AppImage` | `src-tauri/target/release/bundle/` |

### Cross-compilation

Tauri does not support cross-compilation out of the box. Build each platform on its native OS, or use a CI matrix (GitHub Actions `macos-latest` / `windows-latest` / `ubuntu-latest`).

---

## Mobile apps (iOS / Android)

### Prerequisites

**In addition to the Rust toolchain and Tauri CLI above:**

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

Run once to generate the native project files (`gen/android/` or `gen/apple/`):

```bash
cd shells/tauri-mobile
pnpm install

# Android
pnpm run tauri android init

# iOS
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
cd shells/tauri-mobile
pnpm run dev:android
# or from repo root:
pnpm run dev:android
```

**iOS** (macOS only - requires Simulator or provisioned device):

```bash
cd shells/tauri-mobile
pnpm run dev:ios
# or from repo root:
pnpm run dev:ios
```

### Production build

```bash
# Android - outputs APK + AAB
pnpm run build:android
# or: pnpm run build:android from repo root

# iOS - outputs .ipa
pnpm run build:ios
# or: pnpm run build:ios from repo root
```

**Android signing** - set these env vars before building for release:

```bash
export ANDROID_KEY_STORE=/path/to/keystore.jks
export ANDROID_KEY_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
```

**iOS signing** - configure your Development Team in Xcode:

```bash
cd gen/apple
open Lolly.xcodeproj
```

Set the team in the project's Signing & Capabilities tab, then build from CLI or Xcode.

---

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

The local Tauri build already emits a `.deb` and an `.AppImage` (see the Desktop table above). OBS does not replace that - its value is **fan-out across the rest of the matrix** (every RPM- and deb-based distro, Arch, Flatpak, containers, appliances) plus **signed, hosted repositories** that users can add and update from like any other system package.

### How it fits Lolly's artifacts

OBS packages one of the two Linux artifacts this guide already produces:

- **The standalone CLI binary** - the esbuild + `@yao-pkg/pkg` output from the CLI section above. The `tools/` and `catalog/` directories must ship alongside the binary (the CLI resolves them relative to its own location), so that layout carries straight into the package's `%files` (RPM) or `debian/install` (deb) list.
- **The Tauri desktop app** - the `tauri build` output, packaged as RPM / DEB / Flatpak / AppImage for desktop delivery.

### Build-environment constraints

> **No network at build time.** OBS builds inside clean, network-isolated chroots, so every build input must be present up front. For a Node + Vite + Rust/Tauri app this is the main porting effort: vendor the npm and Cargo dependencies (an offline npm cache / `cargo vendor`) or supply them through OBS source services, and declare the toolchain as `BuildRequires` - e.g. `nodejs>=20`, `npm`, `rust`, `cargo`, plus the desktop build's GTK/WebKit `-devel` packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` and equivalents).

### Illustrative project layout

The snippets below are **illustrative starting points, not a production-tested recipe** - they show what an OBS package for Lolly looks like.

A `_service` file fetches and versions the source from git at build time:

```ini
<services>
  <service name="obs_scm" mode="manual">
    <param name="scm">git</param>
    <param name="url">https://github.com/lolly-tools/lolly.git</param>
    <param name="revision">v1.0.0</param>
    <param name="versionformat">@PARENT_TAG@</param>
  </service>
  <service name="set_version" mode="buildtime"/>
  <service name="tar" mode="buildtime"/>
</services>
```

A trimmed RPM `.spec` declares the toolchain, builds the artifact and installs it with the required `tools/` + `catalog/` layout:

```spec
Name:           lolly
Version:        1.0.0
Release:        0
Summary:        Lolly - template-driven creative asset generator
License:        MPL-2.0
URL:            https://lolly.tools
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  nodejs >= 20
BuildRequires:  npm
BuildRequires:  rust
BuildRequires:  cargo

%build
pnpm install --frozen-lockfile --offline
# CLI binary: bundle with esbuild, then wrap with @yao-pkg/pkg (see CLI » Standalone binary above).
# For the desktop app instead, run `pnpm run build:desktop`.
pnpm exec esbuild shells/cli/bin/lolly.ts --bundle --platform=node \
  --target=node20 --format=cjs --outfile=shells/cli/dist/lolly.cjs
npx @yao-pkg/pkg shells/cli/dist/lolly.cjs \
  --targets node20-linux-x64 --output shells/cli/dist/lolly

%install
install -Dm0755 shells/cli/dist/lolly %{buildroot}%{_bindir}/lolly
cp -a tools   %{buildroot}%{_datadir}/lolly/tools
cp -a catalog %{buildroot}%{_datadir}/lolly/catalog

%files
%license LICENSE
%{_bindir}/lolly
%{_datadir}/lolly/
```

A matching `debian/` directory (`control`, `rules`, `install`) produces the `.deb` from the same OBS package, and OBS's per-repository configuration maps that single package onto every distribution target you enable.

A Flatpak manifest wraps the Tauri desktop bundle:

```yaml
app-id: org.lolly.Lolly
runtime: org.gnome.Platform
runtime-version: '46'
sdk: org.gnome.Sdk
command: lolly
modules:
  - name: lolly
    buildsystem: simple
    build-commands:
      - pnpm install --frozen-lockfile --offline && pnpm run build:desktop
      - install -Dm0755 src-tauri/target/release/lolly /app/bin/lolly
    sources:
      - type: archive
        path: lolly-1.0.0.tar.gz
```

For readers wiring this up for real, see the [OBS documentation](https://openbuildservice.org/help/) and the [openSUSE packaging guidelines](https://en.opensuse.org/openSUSE:Packaging_guidelines).

---

<!--lb:kubernetes helm-->

## Web shell on Kubernetes (Helm)

The web shell is a **static site** - `pnpm run build:web` produces a `dist/` folder of HTML, CSS, JS, the service worker, the HarfBuzz WASM, fonts, the bundled tool catalog and the `/info` site. Anything that can serve static files can host it (which is why the production site runs behind a CDN). To run it **inside your own Kubernetes cluster** - air-gapped, on-prem or alongside the rest of your platform - the artefacts ship in this repo: `deploy/docker/` bakes `dist/` into an <!--l:nginx-->nginx image, and `deploy/helm/` deploys it. This section is what those files do and how to adapt them; [Deployment](/info/deployment.html) is where each piece runs.

Nothing in the chart is specific to one cluster: it is plain Kubernetes, so it deploys on any conformant distribution - including SUSE's own RKE2 and <!--l:k3s-->k3s - and on any managed service.

> **The chart is shipped, the images are yours to build.** `deploy/helm/` is a real chart with three components - `web` (the PWA, on by default), `mcp` and `ca` (both opt-in) - one `values.yaml` you edit and secure defaults on every pod. What it cannot do is invent an image: build and push the three `deploy/docker/` images to a registry your cluster can reach, then pin the tags you verified. There is no hosted Lolly chart repository, so you install from a checkout of this repo, and the SUSE Application Collection carries no Lolly chart of its own. Where a curated image or chart *does* exist there - the nginx runtime base, cert-manager - this section prefers it.

### Why the SUSE Application Collection

<!--l:suse-->[The SUSE Application Collection](https://apps.rancher.io) is a curated, signed, continuously-rebuilt catalog of open-source container images and Helm charts, all based on SUSE Linux Enterprise Base Container Images (BCI). Pulling the nginx runtime from it - rather than an arbitrary upstream tag - gets you a hardened, attested base with a known CVE posture.

| Host | Role |
|---|---|
| `apps.rancher.io` | Browse / catalog UI (and where you mint credentials) |
| `docs.apps.rancher.io` | Documentation |
| `dp.apps.rancher.io` | **OCI distribution registry you pull from** - images under `/containers/<name>`, Helm charts under `/charts/<name>` |

Access needs a free **SUSE Customer Center** account (`scc.suse.com`); sign in to `apps.rancher.io` and create either a personal **access token** (Settings → Access tokens) or an organization **service account** (Settings → Service accounts). Pulls are never anonymous.

> **Free-tier gotcha for clusters.** A *user* access token on the Free tier allows pulls (≈100/24h), but a Free **service account is allowed 0 pulls** - so unattended in-cluster pulls through a service-account `imagePullSecret` realistically need a paid (Prime or higher) organization subscription. For builds on your own laptop a personal token on the Free tier is fine. If you can't subscribe, use the SUSE BCI nginx image from `registry.suse.com` instead (see the *Fallback* note under step 2) - it's free and needs no login.

Log in - the same host for every client. The username/password pairing differs by credential type: a **user account** uses your username + an **access token**; a **service account** uses its username + a **secret** (never your account password):

```bash
helm registry login dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
docker login        dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
```

### 1. Build the image

`deploy/docker/web.Dockerfile` does the static build *and* the packaging in one multi-stage build, so there is no separate "run npm, then copy `dist/`" step to perform by hand. The one thing it needs from you: the **build context must be the repo root**. A plain clone already has `community/` and `brands/lolly-start/` checked out, so a `LOLLY_PROFILE=lolly-start` build needs nothing further; building the `suse` profile needs `brands/suse` mounted first (`git submodule update --init --checkout brands/suse`).

```bash
docker build -f deploy/docker/web.Dockerfile \
  --build-arg LOLLY_PROFILE=lolly-start \
  -t <your-registry>/lolly-web:0.1.0 .
docker push <your-registry>/lolly-web:0.1.0
```

What the two stages do:

- **build** - `node:26-bookworm`, pinned by digest, runs `pnpm install --frozen-lockfile` then the real `pnpm run build:web`. Deliberately not the slim variant: the optional native dependencies (sharp, onnxruntime, resvg, playwright) need build tooling slim doesn't carry.
- **runtime** - `nginxinc/nginx-unprivileged`, also digest-pinned, running as uid 101 on port **8080**. `dist/` is copied to `/usr/share/nginx/html`, `deploy/docker/nginx.conf` becomes `conf.d/default.conf` and `deploy/docker/security-headers.conf` is copied beside it.

`--build-arg LOLLY_PROFILE=suse|lolly-start` bakes one brand into the static output - theme colour, PWA chrome and the resolved tool and catalog content. Nothing is read at serve time, which is why the chart needs no pack, config or volume mounted for the web app; changing brand means rebuilding the image and rolling the deployment.

`mcp.Dockerfile` and `ca.Dockerfile` follow the same pattern (repo-root context, digest-pinned `node:26-bookworm-slim`, non-root `node` user) and run their entry point on Node directly. Build them only if you enable those components.

### 2. Swapping in a SUSE nginx base (optional)

The shipped runtime stage uses the upstream unprivileged nginx image so a plain `docker build` works with no registry credentials. To take the Application Collection's curated build instead, replace that one `FROM` line and keep the `COPY` lines untouched:

```dockerfile
# ---- runtime stage: SUSE Application Collection nginx ----
# Pin the current tag from https://apps.rancher.io/applications/nginx
FROM dp.apps.rancher.io/containers/nginx:1.29.4
```

Two things to check against whichever base you pick. The shipped `nginx.conf` sets `root` explicitly, so the base image's default document root doesn't matter - but `dist/` has to be copied where that `root` points (or change the directive). And it listens on 8080 because non-root nginx cannot bind below 1024; if your base runs as root and you switch to 80, change `web.service.targetPort` in the chart to match.

> **Fallback without an Application Collection subscription:** use the free SUSE BCI image `FROM registry.suse.com/suse/nginx:1.27` (no login required). Its default document root is `/srv/www/htdocs/` - copy there instead, or just keep the `root` directive from the shipped `nginx.conf`, which wins regardless of the base image's default.

### 3. What the nginx config already handles

Lolly is a single-page PWA, so the server has real work to do: URL-mode deep links (`/?tool=qr-code`) must fall back to `index.html`, the service worker must never be cached, hashed assets should be immutable, the HarfBuzz `.wasm` and the `.webmanifest` need correct MIME types and the security headers have to be on every response. `deploy/docker/nginx.conf` does all of it - `tests/security-headers.test.ts` pins its CSP against the other two copies in the repo, so edit it rather than writing a fresh one. The parts that matter, quoted from the shipped file:

```nginx
server {
    # nginx-unprivileged cannot bind <1024; 8080 is the image default.
    listen       8080;
    root   /usr/share/nginx/html;
    index  index.html;

    # Security headers on every response (see the $lolly_csp map above).
    include /etc/nginx/security-headers.conf;

    # ── Service worker: MUST never be cached, and may control the whole scope.
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
        include /etc/nginx/security-headers.conf;
    }

    # ── Content-hashed build output: safe to cache forever (immutable).
    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        include /etc/nginx/security-headers.conf;
        try_files $uri =404;
    }

    # ── Everything else: serve the file, then its .html twin, then a directory
    # index, then fall back to the SPA shell. Covers /t/<id> → /t/<id>.html and
    # /info/* real pages while keeping client-routed paths on index.html.
    location / {
        try_files $uri $uri.html $uri/index.html /index.html;
    }
}
```

That repeated `include` is not redundancy: nginx drops **every** inherited `add_header` inside a location that declares one of its own, so any location setting `Cache-Control` would otherwise ship with no security headers at all. Keep the include when you add a location. The file also carries a cheap unauthenticated `/healthz` for the chart's probes, explicit `types` for `.wasm`/`.avif`/`.webmanifest`, long-cache rules for `/ort/`, `/models/` and `/fonts/` and the short URL aliases (`/d`, `/v`, `/c`, `/p`, `/profile`) that mirror the hosted deployment's rewrites.

### 4. The chart

The Application Collection ships charts for stateful services (redis, postgresql, prometheus, cert-manager, …) but **not** a generic static-web-server chart - nginx lives there as a *container image only*. Lolly's own chart is `deploy/helm/`:

```
deploy/helm/
├── Chart.yaml
├── values.yaml               ← the one file you edit
└── templates/
    ├── _helpers.tpl          names, labels, image references
    ├── web-deployment.yaml   the PWA (on by default)
    ├── web-service.yaml
    ├── mcp-deployment.yaml   MCP server (opt-in)
    ├── mcp-service.yaml
    ├── ca-deployment.yaml    credential authority (opt-in)
    ├── ca-service.yaml
    ├── ca-secret.yaml        chart-managed mode only
    ├── ingress.yaml          one Ingress per enabled component
    ├── networkpolicy.yaml    off by default
    ├── serviceaccount.yaml
    └── NOTES.txt
```

`web` is enabled by default at 2 replicas - the PWA holds no server-side state (everything lives in the browser's IndexedDB), so replicas are interchangeable and you can raise the count freely. `mcp` and `ca` are `enabled: false` until you turn them on. The security posture is shared and applied to every component: `runAsNonRoot`, `RuntimeDefault` seccomp, all capabilities dropped, no privilege escalation, a read-only root filesystem with `emptyDir`s mounted exactly where nginx needs to write, no ServiceAccount token mounted (none of the components talk to the Kubernetes API), soft pod anti-affinity so replicas spread across nodes without blocking a single-node cluster and an off-by-default NetworkPolicy that restricts ingress to each component's port.

The values you are most likely to touch:

```yaml
web:
  enabled: true
  replicaCount: 2
  image:
    repository: ghcr.io/lolly-tools/lolly-web   # ← your registry
    tag: ""                                     # empty ⇒ the chart's appVersion
  service:
    port: 80
    targetPort: 8080        # what nginx-unprivileged listens on
  ingress:
    enabled: false
    hosts:
      - host: lolly.example.com
        paths: [{ path: /, pathType: Prefix }]

# Private registry (see step 5). e.g. [{ name: application-collection }]
imagePullSecrets: []
```

Read `values.yaml` top to bottom before a production install - it is written to be read, and the `mcp` and `ca` sections document what each service needs.

### 5. Install

If the image (or its base) is pulled from `dp.apps.rancher.io`, create the pull secret first and name it in `imagePullSecrets`:

```bash
kubectl create namespace lolly

# the SUSE Application Collection pull secret (skip if your image is on a public registry)
kubectl create secret docker-registry application-collection \
  --docker-server=dp.apps.rancher.io \
  --docker-username=<username-or-sa-username> \
  --docker-password=<access-token-or-sa-secret> \
  -n lolly
```

The minimum viable install is one flag - the image you built in step 1. Port-forward to try it before you publish a hostname:

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.repository=<your-registry>/lolly-web \
  --set web.image.tag=0.1.0

kubectl port-forward -n lolly svc/lolly-web 8080:80   # → http://localhost:8080/
```

To publish it on your own hostname with TLS from cert-manager (drop the `imagePullSecrets` line if your registry is public):

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.repository=<your-registry>/lolly-web \
  --set web.image.tag=0.1.0 \
  --set imagePullSecrets[0].name=application-collection \
  --set web.ingress.enabled=true \
  --set web.ingress.hosts[0].host=lolly.example.com \
  --set web.ingress.tls[0].secretName=lolly-web-tls \
  --set web.ingress.tls[0].hosts[0]=lolly.example.com
```

`NOTES.txt` prints the resulting URLs, which components came up and any secret still missing.

### 6. The optional services

Both stay off until you ask for them, and both are stateless.

**MCP** (`--set mcp.enabled=true`) exposes the tool catalog to AI agents over Streamable-HTTP on port 8790. Its brand content is baked in at build time exactly like the web image. Browser-tier render formats are disabled unless you point it at a renderer - `--set mcp.webBase=https://lolly.example.com` - and SVG/data plus resvg-PNG work without one, which is why the image ships no Chromium. Probes are TCP socket checks: there is no unauthenticated health route to poll.

**CA** (`--set ca.enabled=true`) issues short-lived certificates for on-device C2PA signing on port 8787, under `/api/ca`. It needs a root key and certificate, generated once with `node services/ca/scripts/gen-root.mjs`, plus a service secret (`openssl rand -hex 32`). Two ways to supply them: fill in `ca.secrets` and let the chart create the Secret, or - the production choice - set `ca.existingSecret` to one your platform's secret store manages and leave `ca.secrets` empty. The chart refuses to render rather than deploy a CA with a missing root. Set `ca.config.allowedOrigins` to your web host, or enrollment tokens are rejected.

### TLS, the SUSE-curated way (optional)

For HTTPS, pull **cert-manager** - which *is* a real chart in the Application Collection - and let it issue the Ingress certificate:

```bash
helm install cert-manager oci://dp.apps.rancher.io/charts/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true \
  --set 'global.imagePullSecrets={application-collection}'
```

Then add a `ClusterIssuer` (e.g. Let's Encrypt), point the chart's `web.ingress.tls[0]` at a secret name and annotate the Ingress for cert-manager through `web.ingress.annotations` (`cert-manager.io/cluster-issuer: letsencrypt-prod`); `mcp` and `ca` take the same three keys under their own sections. Every Application Collection chart accepts the same `--set 'global.imagePullSecrets={application-collection}'`, so the pattern carries across redis, postgresql, prometheus and the rest if Lolly ever grows backing services.

> For the authoritative, current registry paths, tags, chart versions and value keys, see the [SUSE Application Collection docs](https://docs.apps.rancher.io) and run `helm show values oci://dp.apps.rancher.io/charts/<chart>` before relying on any default.

---

## How the Tauri shells relate to the web shell

Both Tauri shells share the web shell's source (`shells/web/src/`). They build it with a Vite alias that swaps `bridge/state.ts` for a Tauri filesystem implementation at build time. Everything else - the engine, tools, templates, export logic - is identical to the web build. One render path, three delivery targets.

```
shells/web/src/         ← canonical source
    └── bridge/
        └── state.ts    ← IndexedDB (web build)

shells/tauri-desktop/
shells/tauri-mobile/
    └── bridge-overrides/
        └── state.ts    ← filesystem via tauri-plugin-fs (Tauri builds)
```

The Tauri-built frontend is written to `shells/tauri-{desktop,mobile}/dist/`, which `tauri.conf.json` references as `frontendDist`. The web shell's own `dist/` is unaffected.
