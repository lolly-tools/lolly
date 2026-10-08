// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webGpuBrowserEngine } from './helpers/webgpu-browser.ts';

test('WebGPU qualification accepts only the explicitly named engines', () => {
  for (const engine of ['chromium', 'firefox', 'webkit', 'safari-local', 'firefox-local', 'tauri-macos', 'tauri-windows', 'tauri-linux', 'ios-simulator', 'android-webview'] as const) assert.equal(webGpuBrowserEngine(engine), engine);
  for (const label of ['', 'safari', 'wkwebview', 'edge', 'firefox-nightly']) {
    assert.throws(() => webGpuBrowserEngine(label), /Unknown WebGPU qualification browser/);
  }
});
