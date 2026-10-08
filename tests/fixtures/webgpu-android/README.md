<!-- SPDX-License-Identifier: MPL-2.0 -->
# Android WebView qualification fixture

This test-only app runs the unchanged WebGPU corpus in an actual Android
WebView. It enables JavaScript and application hardware acceleration; other
WebView feature settings retain the provider defaults. It uses the shared shell
CSP and permits cleartext only for the local test collector at `127.0.0.1`.

With JDK 17, Android SDK platform 36, build-tools 36.0.0 and an owned emulator
connected, set `LOLLY_WEBGPU_SOURCE_SHA` to the reviewed main commit's full
40-character lowercase SHA and run `node scripts/verify-webgpu-android.ts` from
that clean checkout. The helper checks the exact HEAD, tracked changes and main
ancestry before it changes a device; the full SHA is recorded with the evidence.
The manual **Android WebView WebGPU qualification (emulator only)** workflow
requires the same `source_sha` input and performs the same check using an API 36
virtual device with software graphics.
For an owned physical device, explicitly set `LOLLY_WEBGPU_ANDROID_DEVICE` to
its adb serial. The script will not select a physical device automatically.

Evidence is written to `plans/295-validation/android-webview`, or the directory
specified by `LOLLY_WEBGPU_ANDROID_OUTPUT`. It includes the full corpus result,
selected and loaded provider versions, actual runtime settings, Android and
graphics metadata, and source, APK and CSP hashes. Temporary compilation files
and signing material are removed. The script stops and removes only its fixture
app and the collector port forwards it created.
It refuses a pre-existing fixture app or borrowed port forward, uses installation
without replacement and creates forwards without rebinding. Later corpus pages
may reuse only the current run's successful install and its recorded forward.

Missing WebGPU APIs, adapters, runtime evidence and corpus failures fail the
check. Emulator evidence applies only to that virtual device; it does not
qualify physical Android devices or the installed Lolly/Tauri product. A check
on a selected physical device also applies only to this fixture on that device.
This workflow does not publish support claims or change the release gate.
