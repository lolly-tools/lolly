<!-- SPDX-License-Identifier: MPL-2.0 -->
# Native desktop WebGPU qualification fixture

This fixture runs the complete required corpus from
[`tests/webgpu-lut.browser.test.ts`](../../webgpu-lut.browser.test.ts) in an
actual Tauri/Wry webview. It is a test binary, never a Lolly release. The fixture
has no packaging or publishing path, receives no signing credentials and loads
only an owned qualification URL on `http://127.0.0.1:<port>`.

## Run on macOS

Use a supported repository Node version, pnpm 11.26.0, Rust 1.96.0 and the
macOS native build tools. Node 24 LTS or newer is recommended. Install the
workspace dependencies and populate the Cargo cache before the offline probe:

```sh
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal
cargo +1.96.0 fetch --locked --manifest-path shells/tauri-desktop/src-tauri/Cargo.toml
node scripts/webgpu-qualification.ts mark plans/295-validation/webgpu-tauri
node scripts/verify-webgpu-tauri.ts
```

Run these commands from the repository root on a logged-in macOS desktop. The
probe creates its own small, visible, nonpersistent windows. An existing
browser, personal profile or workspace is not used. Outputs default to
`plans/295-validation/webgpu-tauri`; set `LOLLY_WEBGPU_TAURI_OUTPUT` to an owned
scratch directory to change that location. Set `LOLLY_WEBGPU_TAURI_TARGET` only
when intentionally sharing a compatible build cache. If the output directory
changes, run the marker command against that directory too. Retain
`WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt` with the evidence and never
upload the binary as a product or updater artifact.

The macOS wrapper copies the current desktop `Cargo.lock` and verifies the
fixture's exact Tauri, tauri-build, Wry, Tao and serde_json versions. Cargo
metadata resolves the probe root offline. Every resolved registry package
version and checksum must appear in the desktop lock before the frozen
`--locked --offline` build. A missing cache entry or changed pin fails the
check; changing the lock to make qualification pass is not a workaround.

## Windows and Linux

[`webgpu-native-qualification.yml`](../../../.github/workflows/webgpu-native-qualification.yml)
is a manual workflow for a reviewed main commit. Its `source_sha` input must be
the full 40-character commit ID. It checks the exact source, builds this fixture
and calls [`verify-webgpu-native.ts`](../../../scripts/verify-webgpu-native.ts)
on Windows/WebView2 and Linux/WebKitGTK. The workflow writes the not-for-release
marker and uploads short-lived evidence, not packages.

For a local run, first obtain a reviewed full main commit ID. Do not derive
approval from an arbitrary current `HEAD`. Replace the placeholder below with
that exact 40-character lowercase hexadecimal ID. These commands create a new
isolated checkout; choose an unused worktree path and leave dirty development
trees intact. Rust 1.96.0 and the native Tauri platform prerequisites must
already be installed.

On Windows, use PowerShell 7.3 or newer in a desktop session with WebView2
installed. Native command failures stop this example:

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$env:LOLLY_WEBGPU_SOURCE_SHA = '<reviewed-full-main-commit-id>'
if ($env:LOLLY_WEBGPU_SOURCE_SHA -cnotmatch '^[a-f0-9]{40}$') {
    throw 'Provide the reviewed full main commit ID.'
}
git fetch origin main
git merge-base --is-ancestor $env:LOLLY_WEBGPU_SOURCE_SHA origin/main
git worktree add --detach .worktrees/webgpu-check $env:LOLLY_WEBGPU_SOURCE_SHA
Set-Location .worktrees/webgpu-check
pnpm install --frozen-lockfile
$env:LOLLY_WEBGPU_NATIVE_OUTPUT = 'plans/295-validation/webgpu-native'
node scripts/verify-webgpu-native.ts
```

On Linux, install the GTK/WebKitGTK development libraries and the owned
virtual-display prerequisites listed in the workflow, then run:

```sh
set -eu
export LOLLY_WEBGPU_SOURCE_SHA='<reviewed-full-main-commit-id>'
[ "${#LOLLY_WEBGPU_SOURCE_SHA}" -eq 40 ]
case "$LOLLY_WEBGPU_SOURCE_SHA" in *[!0-9a-f]*) exit 2 ;; esac
git fetch origin main
git merge-base --is-ancestor "$LOLLY_WEBGPU_SOURCE_SHA" origin/main
git worktree add --detach .worktrees/webgpu-check "$LOLLY_WEBGPU_SOURCE_SHA"
cd .worktrees/webgpu-check
pnpm install --frozen-lockfile
export LOLLY_WEBGPU_NATIVE_OUTPUT=plans/295-validation/webgpu-native
xvfb-run -a dbus-run-session -- node scripts/verify-webgpu-native.ts
```

`LOLLY_WEBGPU_SOURCE_SHA` is optional for local probes; these recipes supply the
reviewed ID so the helper verifies an exact checkout match. The Git main
ancestry check lives in the workflow and recipes. The native helper writes
`WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt` into the
selected evidence directory before qualification. Preserve that marker with
the receipts and never pass the generated binary to release publishing tools.

The workflow lists the Linux packages needed to build and run the probe. Its
Windows VM and Linux Xvfb results apply only to the recorded runtime, display
and graphics configuration. The native helper checks source and fixture
hashes, derives direct dependency pins from the desktop lock, verifies all
resolved registry checksums, then builds offline with the frozen lock. It
refuses browser/runtime/graphics environment overrides and WebView2 policies
that select runtimes or inject browser arguments.

## Settings, corpus and evidence

The native window uses fresh incognito storage, remains unfocused and disables
background throttling for predictable test execution. WebGPU preferences are
left at runtime defaults; no feature-enabling flags are added. The fixture's
native `csp` and `devCsp` configuration fields are null. Instead, the collector
injects the exact shared shell `TAURI_CSP` from
[`vite-csp.mjs`](../../../shells/tauri-shared/vite-csp.mjs) as an HTML meta tag.
This distinction is recorded and does not attest the product's custom protocol
or its CSP delivery path.

The unchanged required corpus covers LUT reference cases, exact alpha/no-op
behavior, offset views, photo worker and cache integration, resident operation
chains, allocation limits and cleanup, cancellation, device loss/recovery and
cold/warm PNG baking. Missing APIs or adapters and any failed assertion produce
a failing exit code; they are not successful skipped tests.

Keep `environment.json`, `conformance.json` and build/conformance logs together.
They record actual runtime and OS versions, CPU/architecture, desktop lock and
binary hashes, CSP hash, resolved package checksums, adapter capabilities,
compiled GPU source hashes and conformance results. The Windows/Linux helper
also records source/runner identity and native graphics/display information.
Startup timings exercise the production device service and immediate tool
mount fence, not the full gallery or tool route. The binary's `--runtime-info`
command reports the actual native webview version without creating a window.

The October 2026 Mac checks exercised this pinned native runtime on the local
physical Mac. They did not qualify the full installed Lolly product, the
`tauri` protocol, older macOS versions or other desktop machines. Playwright
WebKit is separate browser-engine evidence and cannot replace Safari or a
native-shell check. A VM or simulator receipt cannot replace required physical
qualification or close a published target row. These helpers do not modify
the supported-target table or release gate.

See the sibling [iOS simulator fixture](../webgpu-ios/README.md) and
[Android WebView fixture](../webgpu-android/README.md) for their distinct native
runtime checks and evidence limits.
