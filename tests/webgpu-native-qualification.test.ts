// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDesktopDependencies, nativeTarget, registryPackages, runtimeOverrides } from '../scripts/verify-webgpu-native.ts';

test('native qualification rejects registry drift rather than building another runtime', () => {
  const desktop = registryPackages('[[package]]\nname = "wry"\nversion = "0.57.0"\nchecksum = "abc"\n[[package]]\nname = "local-root"\nversion = "0.1.0"\n');
  assert.equal(desktop.length, 1);
  assertDesktopDependencies(desktop, desktop);
  assert.throws(() => assertDesktopDependencies(desktop, [{ ...desktop[0]!, version: '0.58.0' }]), /differs from desktop lock/);
  assert.throws(() => assertDesktopDependencies(desktop, [{ ...desktop[0]!, checksum: 'changed' }]), /differs from desktop lock/);
  assert.throws(() => assertDesktopDependencies(desktop, []), /must resolve/);
});

test('native qualification preserves default runtime and graphics preferences', () => {
  assert.deepEqual(runtimeOverrides({ DISPLAY: ':99', PATH: '/bin', LOLLY_WEBGPU_BROWSER: 'tauri-linux' }), {});
  assert.deepEqual(runtimeOverrides({ WEBKIT_DISABLE_DMABUF_RENDERER: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--enable-unsafe-webgpu', MESA_LOADER_DRIVER_OVERRIDE: 'zink' }),
    { WEBKIT_DISABLE_DMABUF_RENDERER: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--enable-unsafe-webgpu', MESA_LOADER_DRIVER_OVERRIDE: 'zink' });
  assert.equal(nativeTarget('win32'), 'tauri-windows');
  assert.equal(nativeTarget('linux'), 'tauri-linux');
  assert.throws(() => nativeTarget('darwin'), /Run this probe on Windows/);
});
