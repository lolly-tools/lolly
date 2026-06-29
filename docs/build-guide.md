# Build Guide

How to build Lolly for each distribution target: standalone CLI binary, desktop app (macOS / Windows / Linux), mobile apps (iOS / Android), and the web shell as a container image for Kubernetes.

---

## Prerequisites (all targets)

- **Node.js 20+** and **npm 10+**
- Repo checked out, dependencies installed:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
npm install
```

---

## CLI

### Development use (no build needed)

The CLI shell runs directly from the repo with Node.js:

```bash
# List available tools
npm run cli

# Show inputs for a tool
npm run cli -- qr-code

# Run a tool and write output
npm run cli -- qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg

# Explicit format
npm run cli -- quotes --quote="Open source wins." --name="Andy" --export=png --output=./quote.png
```

The CLI supports **SVG, EMF, HTML, and the text/data formats** (JSON, CSV, ICS, VCF) natively — these are hydrated by the engine with no browser engine needed (SVG/EMF only for tools with an `<svg>`-based template, since the lean CLI has no layout engine). Raster/PDF/ZIP and video formats (PNG, JPG, PDF, ZIP, GIF, WebM, MP4, …) require a real WebView renderer, so use the desktop app or the Tauri-bundled CLI for those.

### Standalone binary

To distribute the CLI without requiring Node.js installed:

**1. Bundle to a single CJS file:**

```bash
cd shells/cli
npx esbuild bin/brand-tool.js \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=cjs \
  --outfile=dist/brand-tool.cjs
```

**2. Package with `@yao-pkg/pkg` (includes a Node runtime):**

```bash
npx @yao-pkg/pkg dist/brand-tool.cjs \
  --targets node20-macos-arm64,node20-macos-x64,node20-linux-x64,node20-win-x64 \
  --output dist/brand-tool
```

Output binaries land in `shells/cli/dist/` — one per platform target.

> The `tools/` and `catalog/` directories must ship alongside the binary. The CLI resolves them relative to the binary location, so the expected layout is:
> ```
> brand-tool          ← binary
> tools/              ← tool definitions
> catalog/            ← asset + tool catalogs
> ```

---

## Desktop app (macOS / Windows / Linux)

### Prerequisites

**Rust toolchain:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update
```

**Tauri CLI (Node package — installed per-shell):**

```bash
cd shells/tauri-desktop
npm install
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

> Placeholder icons committed to the repo are solid-green squares — replace them with production artwork before releasing.

### Development

```bash
cd shells/tauri-desktop
npm run dev
# or from repo root:
npm run dev:desktop
```

Tauri opens a native window. The Vite dev server runs in the background; hot reload works. The state bridge uses the filesystem override (`bridge-overrides/state.js`) — saved states go to `$APPDATA/Lolly/saved-state/`.

### Production build

```bash
cd shells/tauri-desktop
npm run build
# or from repo root:
npm run build:desktop
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

1. Install [Android Studio](https://developer.android.com/studio)
2. In SDK Manager, install:
   - Android SDK Platform (API 33 or higher)
   - NDK (Side by side) — version 26+
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

1. Install Xcode from the App Store (the full app, not just the Command Line Tools)
2. Accept the license: `sudo xcodebuild -license accept`
3. Install CocoaPods — `tauri ios init` generates a Podfile and runs `pod install`: `brew install cocoapods`
4. Add iOS Rust targets:

```bash
rustup target add \
  aarch64-apple-ios \
  aarch64-apple-ios-sim \
  x86_64-apple-ios
```

See `docs/ios-build.md` in the repository for the full iOS walkthrough — prerequisites, one-time init, the simulator dev loop, code signing, and camera permissions.

### First-time platform init

Run once to generate the native project files (`gen/android/` or `gen/apple/`):

```bash
cd shells/tauri-mobile
npm install

# Android
npm run tauri android init

# iOS
npm run tauri ios init
```

The `gen/` directory contains the generated Gradle / Xcode projects. It is gitignored — regenerate it with the init command on a fresh checkout.

### Icons (mobile)

```bash
cd shells/tauri-mobile
npx @tauri-apps/cli icon path/to/icon-1024.png
```

### Development

**Android** (emulator or connected device with USB debugging enabled):

```bash
cd shells/tauri-mobile
npm run dev:android
# or from repo root:
npm run dev:android
```

**iOS** (macOS only — requires Simulator or provisioned device):

```bash
cd shells/tauri-mobile
npm run dev:ios
# or from repo root:
npm run dev:ios
```

### Production build

```bash
# Android — outputs APK + AAB
npm run build:android
# or: npm run build:android from repo root

# iOS — outputs .ipa
npm run build:ios
# or: npm run build:ios from repo root
```

**Android signing** — set these env vars before building for release:

```bash
export ANDROID_KEY_STORE=/path/to/keystore.jks
export ANDROID_KEY_STORE_PASSWORD=...
export ANDROID_KEY_ALIAS=...
export ANDROID_KEY_PASSWORD=...
```

**iOS signing** — configure your Development Team in Xcode:

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
| RPM | openSUSE Leap / Tumbleweed, SLE / SLES, Fedora, RHEL / CentOS / Alma / Rocky, Mageia, openEuler | CLI binary and/or Tauri desktop app |
| DEB | Debian, Ubuntu, Raspbian | CLI binary and/or Tauri desktop app |
| Arch | Arch Linux (`PKGBUILD`) | CLI binary / desktop app |
| Flatpak | distro-agnostic sandboxed desktop app | Tauri desktop app |
| AppImage | distro-agnostic portable app | reuses Tauri's `.AppImage` output |
| Container images | OCI / Docker (built via Kiwi or a `Dockerfile`) | CLI as a container image |
| Appliance / disk images | ISO, VM, and cloud images (built via Kiwi) | full preloaded image |

The local Tauri build already emits a `.deb` and an `.AppImage` (see the Desktop table above). OBS does not replace that — its value is **fan-out across the rest of the matrix** (every RPM- and deb-based distro, Arch, Flatpak, containers, appliances) plus **signed, hosted repositories** that users can add and update from like any other system package.

### How it fits Lolly's artifacts

OBS packages one of the two Linux artifacts this guide already produces:

- **The standalone CLI binary** — the esbuild + `@yao-pkg/pkg` output from the CLI section above. The `tools/` and `catalog/` directories must ship alongside the binary (the CLI resolves them relative to its own location), so that layout carries straight into the package's `%files` (RPM) or `debian/install` (deb) list.
- **The Tauri desktop app** — the `tauri build` output, packaged as RPM / DEB / Flatpak / AppImage for desktop delivery.

### Build-environment constraints

> **No network at build time.** OBS builds inside clean, network-isolated chroots, so every build input must be present up front. For a Node + Vite + Rust/Tauri app this is the main porting effort: vendor the npm and Cargo dependencies (an offline npm cache / `cargo vendor`) or supply them through OBS source services, and declare the toolchain as `BuildRequires` — e.g. `nodejs>=20`, `npm`, `rust`, `cargo`, plus the desktop build's GTK/WebKit `-devel` packages (`libgtk-3-dev`, `libwebkit2gtk-4.1-dev`, `libappindicator3-dev` and equivalents).

### Illustrative project layout

The snippets below are **illustrative starting points, not a production-tested recipe** — they show the shape of an OBS package for Lolly.

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

A trimmed RPM `.spec` declares the toolchain, builds the artifact, and installs it with the required `tools/` + `catalog/` layout:

```spec
Name:           lolly
Version:        1.0.0
Release:        0
Summary:        Lolly — template-driven creative asset generator
License:        MPL-2.0
URL:            https://lolly.tools
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  nodejs >= 20
BuildRequires:  npm
BuildRequires:  rust
BuildRequires:  cargo

%build
npm ci --offline
# CLI binary: bundle with esbuild, then wrap with @yao-pkg/pkg (see CLI » Standalone binary above).
# For the desktop app instead, run `npm run build:desktop`.
npx esbuild shells/cli/bin/brand-tool.js --bundle --platform=node \
  --target=node20 --format=cjs --outfile=shells/cli/dist/brand-tool.cjs
npx @yao-pkg/pkg shells/cli/dist/brand-tool.cjs \
  --targets node20-linux-x64 --output shells/cli/dist/brand-tool

%install
install -Dm0755 shells/cli/dist/brand-tool %{buildroot}%{_bindir}/lolly
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
      - npm ci --offline && npm run build:desktop
      - install -Dm0755 src-tauri/target/release/lolly /app/bin/lolly
    sources:
      - type: archive
        path: lolly-1.0.0.tar.gz
```

For readers wiring this up for real, see the [OBS documentation](https://openbuildservice.org/help/) and the [openSUSE packaging guidelines](https://en.opensuse.org/openSUSE:Packaging_guidelines).

---

## Web shell on Kubernetes (Helm)

The web shell is a **static site** — `npm run build:web` produces a `dist/` folder of HTML, CSS, JS, the service worker, the HarfBuzz WASM, fonts, the bundled tool catalog, and the `/info` site. Anything that can serve static files can host it (which is why the production site runs behind a CDN). To run it **inside your own Kubernetes cluster** — air-gapped, on-prem, or alongside the rest of your platform — bake `dist/` into a container image built on a SUSE-maintained nginx base and deploy it with Helm.

> **These are example charts, not a published product.** Lolly does not ship an official Helm chart, and the SUSE Application Collection does not contain one for it. The Dockerfile, `nginx.conf`, and chart below are a complete, self-contained example that *should actually deploy* — but treat them as a starting point to adapt, and pin the image tags and chart versions you verify yourself. Where a curated image or chart exists in the [SUSE Application Collection](https://apps.rancher.io), this section prefers it.

### Why the SUSE Application Collection

[The SUSE Application Collection](https://apps.rancher.io) is a curated, signed, continuously-rebuilt catalog of open-source container images and Helm charts, all based on SUSE Linux Enterprise Base Container Images (BCI). Pulling the nginx runtime from it — rather than an arbitrary upstream tag — gets you a hardened, attested base with a known CVE posture.

| Host | Role |
|---|---|
| `apps.rancher.io` | Browse / catalog UI (and where you mint credentials) |
| `docs.apps.rancher.io` | Documentation |
| `dp.apps.rancher.io` | **OCI distribution registry you pull from** — images under `/containers/<name>`, Helm charts under `/charts/<name>` |

Access needs a free **SUSE Customer Center** account (`scc.suse.com`); sign in to `apps.rancher.io` and create either a personal **access token** (Settings → Access tokens) or an organization **service account** (Settings → Service accounts). Pulls are never anonymous.

> **Free-tier gotcha for clusters.** A *user* access token on the Free tier allows pulls (≈100/24h), but a Free **service account is allowed 0 pulls** — so unattended in-cluster pulls through a service-account `imagePullSecret` realistically need a paid (Prime or higher) organization subscription. For builds on your own laptop a personal token on the Free tier is fine. If you can't subscribe, use the SUSE BCI nginx image from `registry.suse.com` instead (see the *Fallback* note under step 2) — it's free and needs no login.

Log in — the same host for every client. The username/password pairing differs by credential type: a **user account** uses your username + an **access token**; a **service account** uses its username + a **secret** (never your account password):

```bash
helm registry login dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
docker login        dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
```

### 1. Build the static site

```bash
npm install
npm run build:web      # → shells/web/dist/
```

### 2. Containerise it on a SUSE nginx base

A multi-stage build compiles `dist/` in a Node stage, then copies it into an nginx runtime pulled from the Application Collection.

`Dockerfile`:

```dockerfile
# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build:web          # → /app/shells/web/dist

# ---- runtime stage: SUSE Application Collection nginx ----
# Pin the current tag from https://apps.rancher.io/applications/nginx
FROM dp.apps.rancher.io/containers/nginx:1.29.4
COPY --from=build /app/shells/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

> **Fallback without an Application Collection subscription:** swap the runtime line for the free SUSE BCI image `FROM registry.suse.com/suse/nginx:1.27` (no login required). Its default document root is `/srv/www/htdocs/` — copy there instead, or just keep your own `root` directive in `nginx.conf`, which wins regardless of the base image's default.

### 3. Serve it like a PWA

Lolly is a single-page PWA: client-side URL-mode deep links (`/?tool=qr-code`) must fall back to `index.html`, the service worker (`/sw.js`) must never be cached, and the HarfBuzz `.wasm` and `.webmanifest` need correct MIME types. SUSE/BCI nginx images run **rootless on port 8080**, so the config listens there.

`deploy/nginx.conf`:

```nginx
server {
  listen 8080;                       # rootless SUSE/BCI nginx; use 80 if your base runs as root
  server_name _;
  root /usr/share/nginx/html;        # set explicitly — the default doc root varies by base image
  index index.html;

  # nginx 1.21+ already maps these; harmless to restate for older bases
  types { application/wasm wasm; application/manifest+json webmanifest; }

  # content-hashed, immutable build assets (includes harfbuzz-<hash>.wasm)
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # the service worker must revalidate so redeploys roll out
  location = /sw.js       { add_header Cache-Control "no-cache, no-store, must-revalidate"; expires off; }
  location = /index.html  { add_header Cache-Control "no-cache"; }

  # SPA fallback — unknown paths serve the app shell
  location / { try_files $uri $uri/ /index.html; }
}
```

Build and push to a registry your cluster can reach:

```bash
docker build -t <your-registry>/lolly-web:1.0.0 .
docker push     <your-registry>/lolly-web:1.0.0
```

### 4. An example Helm chart

The Application Collection ships charts for stateful services (redis, postgresql, prometheus, cert-manager, …) but **not** a generic static-web-server chart — nginx lives there as a *container image only*. So the chart below is a small, self-contained one of your own; it's deliberately minimal and should deploy as-is.

```
deploy/lolly-chart/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml
```

`Chart.yaml`:

```yaml
apiVersion: v2
name: lolly-web
description: Lolly web shell (static PWA) served by SUSE nginx
type: application
version: 0.1.0
appVersion: "1.0.0"
```

`values.yaml`:

```yaml
image:
  repository: <your-registry>/lolly-web
  tag: "1.0.0"
  pullPolicy: IfNotPresent

replicaCount: 2

# Only needed if your image (or its base layer) is pulled from an authenticated
# registry such as dp.apps.rancher.io. Create the secret first (see step 5); the
# SUSE Application Collection convention names it "application-collection".
imagePullSecrets:
  - name: application-collection

service:
  type: ClusterIP
  port: 80
  targetPort: 8080          # matches the nginx `listen` above

ingress:
  enabled: true
  className: ""             # e.g. "nginx", or your cluster's ingress class
  host: lolly.example.com
  tls: false               # flip to true + a secretName once cert-manager issues a cert
  tlsSecretName: lolly-tls
```

`templates/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: { app: {{ .Release.Name }} }
  template:
    metadata:
      labels: { app: {{ .Release.Name }} }
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets: {{ toYaml . | nindent 8 }}
      {{- end }}
      containers:
        - name: web
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - containerPort: {{ .Values.service.targetPort }}
          readinessProbe:
            httpGet: { path: /index.html, port: {{ .Values.service.targetPort }} }
```

`templates/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}
spec:
  type: {{ .Values.service.type }}
  selector: { app: {{ .Release.Name }} }
  ports:
    - port: {{ .Values.service.port }}
      targetPort: {{ .Values.service.targetPort }}
```

`templates/ingress.yaml`:

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}
spec:
  {{- with .Values.ingress.className }}
  ingressClassName: {{ . }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    - hosts: [ {{ .Values.ingress.host | quote }} ]
      secretName: {{ .Values.ingress.tlsSecretName }}
  {{- end }}
  rules:
    - host: {{ .Values.ingress.host | quote }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}
                port: { number: {{ .Values.service.port }} }
{{- end }}
```

### 5. Install

If the image (or its base) is pulled from `dp.apps.rancher.io`, create the pull secret the chart references, then install:

```bash
kubectl create namespace lolly

# the SUSE Application Collection pull secret (skip if your image is on a public registry)
kubectl create secret docker-registry application-collection \
  --docker-server=dp.apps.rancher.io \
  --docker-username=<username-or-sa-username> \
  --docker-password=<access-token-or-sa-secret> \
  -n lolly

helm upgrade --install lolly ./deploy/lolly-chart -n lolly \
  --set image.repository=<your-registry>/lolly-web \
  --set image.tag=1.0.0 \
  --set ingress.host=lolly.example.com
```

### TLS, the SUSE-curated way (optional)

For HTTPS, pull **cert-manager** — which *is* a real chart in the Application Collection — and let it issue the Ingress certificate:

```bash
helm install cert-manager oci://dp.apps.rancher.io/charts/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true \
  --set 'global.imagePullSecrets={application-collection}'
```

Then add a `ClusterIssuer` (e.g. Let's Encrypt), set `ingress.tls=true` with a `tlsSecretName`, and annotate the Ingress for cert-manager. Every Application Collection chart accepts the same `--set 'global.imagePullSecrets={application-collection}'`, so the pattern carries across redis, postgresql, prometheus, and the rest if Lolly ever grows backing services.

> For the authoritative, current registry paths, tags, chart versions, and value keys, see the [SUSE Application Collection docs](https://docs.apps.rancher.io) and run `helm show values oci://dp.apps.rancher.io/charts/<chart>` before relying on any default.

---

## How the Tauri shells relate to the web shell

Both Tauri shells share the web shell's source (`shells/web/src/`). They build it with a Vite alias that swaps `bridge/state.js` for a Tauri filesystem implementation at build time. Everything else — the engine, tools, templates, export logic — is identical to the web build. One render path, three delivery targets.

```
shells/web/src/         ← canonical source
    └── bridge/
        └── state.js    ← IndexedDB (web build)

shells/tauri-desktop/
shells/tauri-mobile/
    └── bridge-overrides/
        └── state.js    ← filesystem via tauri-plugin-fs (Tauri builds)
```

The Tauri-built frontend lands in `shells/tauri-{desktop,mobile}/dist/`, which `tauri.conf.json` references as `frontendDist`. The web shell's own `dist/` is unaffected.
