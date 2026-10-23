# Supported environments

Lolly's web app draws with WebGPU, a graphics feature of current browsers, and checks for it before it opens a tool. This page says where that check has been tested and what to try when your device does not pass.

## If Lolly says it requires WebGPU

The notice reads "Lolly requires WebGPU. Use an up-to-date browser or app with graphics acceleration enabled." Try these in order:

1. Update your browser to its current version.
2. Turn on graphics or hardware acceleration in the browser's settings, then restart the browser.
3. Open Lolly in one of the tested browsers below.
4. On a Mac, iPhone or iPad, [install the app](/info/install.html) instead.

The page must be served over HTTPS, or from a local development server on `localhost`: browsers only offer WebGPU to secure pages, and Lolly says so when an instance is served over plain HTTP.

## What has been tested

::: cols
## Tested and supported

- Chrome, Edge, Firefox and Safari on a Mac with Apple silicon
- The Mac app
- The iPhone and iPad app, checked by hand

## Not checked yet

- The Windows, Linux and Android apps
- The same browsers on Windows, Linux, Android, iOS, Intel Macs or other graphics hardware
:::

Web releases since 9 October 2026, including 1.1.2 on lolly.tools, rely on the completed Mac browser checks below. These are results on **macOS 27, Apple M4**, with the browser's
default adapter and graphics settings. They do not establish support for the
same browsers on Windows, Linux, Android, iOS, Intel Macs or other GPUs.

## Qualification results

| Environment | WebGPU result | Versions and platform | Adapter and backend | Evidence |
|---|---|---|---|---|
| Chrome and Edge (Chromium) | Supported: tested on macOS only | Chrome 154.0.8037.99; Edge 155.0.4283.45; macOS 27, Apple M4 | Default Apple Metal 3 adapter; no software fallback | 9 October 2026; stock browsers, isolated headless hardware runs; required corpus passed, zero skips |
| Firefox | Supported: tested on macOS only | Firefox 157.0.1; macOS 27, Apple M4 | Default non-fallback adapter; GPU identity not reported by the browser | 9 October 2026; installed visible browser; required corpus passed |
| Safari (WebKit) | Supported: tested on macOS only | Safari 27.0.1; macOS 27, Apple M4 | Default Apple adapter; no software fallback | 9 October 2026; installed visible browser; required corpus passed |
| macOS app (WKWebView) | Supported: qualification build | WKWebView 22625.1.29.11.28; macOS 27, Apple M4 | Default Apple adapter; no software fallback | 9 October 2026; compiled qualification app, second execution with its existing isolated profile; startup, tool mount and required corpus passed |
| iOS and iPadOS app (WKWebView) | Supported: manual device check | Lolly 1.1.1 app; iPhone 16 Pro Max, iOS 27.2 beta (24B5099f); iPad Pro 13-inch (M4), iPadOS 27.0 beta (24A5424a) | Default Apple GPU adapter; adapter identity not recorded | 15 October 2026; development-signed 1.1.1 app installed on both devices; startup, a mounted tool, editing and export checked by hand; the automated corpus did not run (see Recorded evidence) |
| Windows app (WebView2) | Pending: physical runtime not qualified | Not established | Not established | Required device/runtime check has not run |
| Linux app (WebKitGTK) | Pending: physical runtime not qualified | Not established | Not established | Required device/runtime check has not run |
| Android app (WebView) | Pending: physical runtime not qualified | Android 11 tested only (see Recorded evidence) | Not established | 15 October 2026: Android 11 has no adapter; Android 12 or later not yet checked |

A pending row means the check has not run, not that the app fails. A packaged app is released only once its own row is supported, which is why the Windows, Linux and Android builds on the [install page](/info/install.html) stay at 1.1.0.

::: details How the checks work
The browser corpus checks numerical results on the main thread and in a worker, photo baking, cancellation, device recovery and operation chains. Its browser startup measurement covers the device service and tool mount fence, rather than the complete gallery.

The Mac qualification app also checked actual gallery startup, a mounted tool, its embedded content and Content Security Policy. These checks do not certify every presentation clicker, embedded website or native platform.

The release tools read the table above: `scripts/webgpu-release-gate.ts` refuses a release whose environments are not all published as supported, and its header explains the web and per-platform release scopes. The MCP, certificate service, Penpot service and documentation builds do not depend on this table.
:::

::: details Recorded evidence
The Chrome run used source commit `20843cb22d3ad36dfd3d93e518bfd8ee812527a7`. The Firefox, Safari and Edge runs used `26799926739fa58bbbf6a8e081f13ab5a8f74617`; the required browser corpus and launcher inputs are unchanged between those commits. The Mac qualification app was built from `ed6c32571593dba96b0562b47396ff42e2cf3270`; its passed execution is not a new current-main build or a fresh-profile startup result. Original failed attempts remain recorded separately.

The iOS and iPadOS result is a manual check, not the automated corpus. On 15 October 2026 a development-signed Lolly 1.1.1 app, built from `26cf05324f46dc4cacd65d12d6f454ada181fb5e` with the unsigned qualification frontend, was installed on an iPhone 16 Pro Max (iOS 27.2 beta) and an iPad Pro 13-inch with M4 (iPadOS 27.0 beta). On both devices the app started without the WebGPU notice, opened bundled tools, edited a tool and exported.

The automated product corpus could not run on either device: its qualification broker reads commands from standard input, which is closed when the app is launched on an iOS device or simulator, and its exit on that input crashes the app (an iOS event-loop fault in tao 0.37.1). The release app does not contain that broker.

The Android 11 result is from `scripts/verify-webgpu-android.ts` on a TCL T810H (Android 11, Android System WebView 155.0.8059.43, Adreno GPU), source `26cf05324f46dc4cacd65d12d6f454ada181fb5e`: the WebGPU API is present and no adapter is returned. Its `qualification.json` has SHA-256 `5b45834fd228a68d14e218531796a4a3302f1a7d063f44e65ff9fa1b94ab59be`. Android 12 or later has not been checked, so the Android row stays pending.

Retained conformance reports have these SHA-256 digests:

| Report | SHA-256 |
|---|---|
| Chrome | `0c9e9628f215692b00f0eba5eacce1820c31d36dc47a57cef1190619bd66033f` |
| Edge | `9f04aac38b91bdf70a10f3078c288ebb690ad8d4827572f0810248fed2834a75` |
| Firefox conformance report | `bdc263c2268485ce9718d40feff26e993ebf68ebcdc30e55484172bbd9f62952` |
| Safari | `ea8b87aa0f60e763b6ac80b6d0663d83323e47ae8e899d2616ab1d4f28becdac` |
| Mac qualification app | `9f5ed9cd19f7f522a9a221141ace046b789b556b3085400ebb884c5c3bea7fec` |
:::
