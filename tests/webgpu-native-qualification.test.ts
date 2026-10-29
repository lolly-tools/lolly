// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { assertDesktopDependencies, desktopPatches, nativeTarget, pinFixtureToLock, registryPackages, runtimeOverrides } from '../scripts/verify-webgpu-native.ts';

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

test('native qualification pins the probe to the runtime the desktop lock ships', () => {
  const lock = registryPackages(['tauri 2.12.5', 'tauri-build 2.7.4', 'serde_json 1.0.154'].map(row => {
    const [name, version] = row.split(' ');
    return `[[package]]\nname = "${name}"\nversion = "${version}"\nchecksum = "c"\n`;
  }).join(''));
  const fixture = '[build-dependencies]\ntauri-build = "=2.7.1"\n\n[dependencies]\ntauri = { version = "=2.12.1", features = ["custom-protocol"] }\nserde_json = "=1.0.151"\n';
  const pinned = pinFixtureToLock(fixture, lock);
  assert.match(pinned, /tauri-build = "=2\.7\.4"/);
  assert.match(pinned, /tauri = \{ version = "=2\.12\.5", features = \["custom-protocol"\] \}/);
  assert.match(pinned, /serde_json = "=1\.0\.154"/);
  assert.equal(pinFixtureToLock(pinned, lock), pinned);
  assert.throws(() => pinFixtureToLock(fixture, lock.filter(row => row.name !== 'tauri')), /exactly one tauri version/);
  assert.throws(() => pinFixtureToLock(fixture, [...lock, { name: 'serde_json', version: '1.0.155', checksum: 'd' }]), /exactly one serde_json version/);
  assert.throws(() => pinFixtureToLock(fixture.replace(/serde_json[^\n]*\n/, ''), lock), /must name serde_json/);
});

test('native qualification builds the same patched crates as the desktop app', () => {
  const manifest = '[dependencies]\ntauri = "2"\n\n[patch.crates-io]\n# vendored fix\nglib = { path = "../../../vendor/glib" }\n\n[target.\'cfg(windows)\'.dependencies]\nwindows-sys = "0.61"\n';
  const section = desktopPatches(manifest, '/repo/shells/tauri-desktop/src-tauri');
  assert.equal(section, '\n[patch.crates-io]\nglib = { path = "/repo/vendor/glib" }\n');
  assert.equal(desktopPatches('[dependencies]\ntauri = "2"\n', '/repo'), '');
  assert.throws(() => desktopPatches('[patch.crates-io]\nglib = { git = "https://example.invalid/glib" }\n', '/repo'), /only path patches/);
});

test('the real desktop manifest patches resolve to directories in this checkout', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const dir = fileURLToPath(new URL('../shells/tauri-desktop/src-tauri/', import.meta.url));
  const section = desktopPatches(readFileSync(join(dir, 'Cargo.toml'), 'utf8'), dir);
  for (const path of section.matchAll(/path = "([^"]+)"/g)) assert.ok(existsSync(join(path[1]!, 'Cargo.toml')), path[1]!);
});
