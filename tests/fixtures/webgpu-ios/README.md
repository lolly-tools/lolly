<!-- SPDX-License-Identifier: MPL-2.0 -->
# iOS and iPadOS simulator WebGPU qualification fixture

This test-only UIKit app runs the complete required corpus from
[`tests/webgpu-lut.browser.test.ts`](../../webgpu-lut.browser.test.ts) in an
actual WKWebView inside owned Apple simulators. It collects reproducible
simulator evidence. It does not qualify physical phones/tablets or the full
installed Lolly/Tauri app.

## Prerequisites and command

Use an Apple Silicon Mac, a supported repository Node version, pnpm 11.26.0,
Xcode with an iPhone Simulator SDK that supports iOS 26.5 or newer, and the
exact iOS 26.5 simulator runtime. Node 24 LTS or newer is recommended. The
default device types are iPhone 17 Pro and iPad Pro 13-inch (M4, 8 GB). Check
the selected SDK and available runtimes before running:

```sh
pnpm install --frozen-lockfile
xcrun --sdk iphonesimulator --show-sdk-path
xcrun simctl list runtimes
node scripts/verify-webgpu-ios.ts
```

Run from the repository root. The script compiles an arm64 simulator app with
Swift, applies a local ad hoc simulator signature and creates a fresh phone
and tablet simulator for the test. No distribution signing credential is used.
It boots, installs and launches only the owned fixture, then always attempts
to shut down and delete each exact simulator it created. Existing simulators,
personal devices and installed applications are not selected or changed.

Outputs default to `plans/295-validation/webgpu-ios`. Set
`LOLLY_WEBGPU_IOS_OUTPUT` to change the owned evidence directory. Set
`LOLLY_WEBGPU_IOS_RUNTIME` to an exact installed compatible runtime identifier
to test another runtime; the default is
`com.apple.CoreSimulator.SimRuntime.iOS-26-5`. Record each runtime separately.
The outer qualification child is bounded to 180 seconds, and the shared corpus
retains its required-test deadline. Compilation or launch errors and missing
WebGPU adapters remain failures.

## Settings and evidence

The WKWebView uses `WKWebsiteDataStore.nonPersistent()` and default WebKit/GPU
preferences. No WebGPU feature flags or browser automation setting are enabled.
The app accepts only an owned `http://127.0.0.1:<port>` qualification URL. Its
App Transport Security exception permits local networking for that collector.
The exact shared shell `TAURI_CSP` from
[`vite-csp.mjs`](../../../shells/tauri-shared/vite-csp.mjs) is injected as HTML
metadata; this does not test the installed product's protocol or CSP delivery.

The unchanged mandatory corpus covers LUT references and exact alpha/no-op
cases, offset views, photo workers and caches, resident chains, memory limits
and cleanup, cancellation, device-loss recovery and cold/warm PNG baking. A
missing API/adapter or failed assertion fails the qualification rather than
becoming a skipped pass. A capability failure can occur before numerical tests
run; that receipt must not be described as numerical conformance.

Keep the `iphone/` and `ipad/` `environment.json` and `conformance.json` files
with the not-for-release marker and execution log. They identify the simulator
device type, exact runtime/build and WKWebView framework version, selected SDK,
native source and binary hashes, CSP hash, default/nonpersistent settings and
`physicalDevice: false`. The shared conformance receipt records compiled GPU
source hashes, actual adapter availability and, when available, the full corpus
results and timings. Startup timings cover the production device service and
immediate tool mount fence, not the complete gallery or tool route.

`WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt` marks the generated bundle and
evidence as test-only. Do not publish the `.app` as a release or use the local
signature for product distribution. Generated bundles and compilation scratch
can be recreated; preserve the small receipts needed to assess the result.

The local October 2026 iOS 26.5 phone/tablet simulator checks exposed WebGPU but
returned no adapter under default settings. Their required checks failed, and
the physical iOS/iPadOS target remains unqualified. A simulator result, a VM
result or Playwright WebKit cannot substitute for required physical
browser/native-shell qualification or change the published supported-target
matrix. These helpers do not relax the release gate.

See the sibling [desktop Tauri fixture](../webgpu-tauri/README.md), its
[Windows/Linux manual workflow](../../../.github/workflows/webgpu-native-qualification.yml)
and the [Android WebView fixture](../webgpu-android/README.md) for separate
runtime checks.
