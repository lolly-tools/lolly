// SPDX-License-Identifier: MPL-2.0
/** The full maintained GPU corpus in real, nonpersistent Tauri/Wry WKWebView windows. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { arch, cpus, release } from 'node:os';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'darwin') throw new Error('This qualification requires the macOS Tauri WKWebView runtime.');
const output = resolve(repo, process.env.LOLLY_WEBGPU_TAURI_OUTPUT ?? 'plans/295-validation/webgpu-tauri');
const crate = join(output, 'crate');
const target = resolve(process.env.LOLLY_WEBGPU_TAURI_TARGET ?? join(output, 'target'));
await mkdir(join(crate, 'frontend'), { recursive: true });
await cp(join(repo, 'tests/fixtures/webgpu-tauri'), crate, { recursive: true });
await writeFile(join(crate, 'frontend/index.html'), '<!doctype html><title>Lolly WebGPU Qualification</title>');
await mkdir(join(crate, 'icons'), { recursive: true });
await cp(join(repo, 'shells/tauri-desktop/src-tauri/icons/32x32.png'), join(crate, 'icons/icon.png'));
const lock = await readFile(join(repo, 'shells/tauri-desktop/src-tauri/Cargo.lock'), 'utf8');
const packages = (source: string) => source.split('[[package]]').slice(1).map(block => ({
  name: /\nname = "([^"]+)"/.exec(block)?.[1], version: /\nversion = "([^"]+)"/.exec(block)?.[1],
  checksum: /\nchecksum = "([^"]+)"/.exec(block)?.[1],
})).filter(row => row.checksum);
const pinned = packages(lock);
for (const [name, version] of [['tauri', '2.12.1'], ['tauri-build', '2.7.1'], ['wry', '0.57.0'], ['tao', '0.37.1'], ['serde_json', '1.0.151']]) {
  assert.ok(pinned.some(row => row.name === name && row.version === version), `Desktop lock must retain ${name} ${version}.`);
}
await writeFile(join(crate, 'Cargo.lock'), lock);
function cargo(args: string[], name: string) {
  const log = openSync(join(output, `${name}.log`), 'w');
  try {
    const result = spawnSync('cargo', ['+1.96.0', ...args], { cwd: crate, stdio: ['ignore', log, log], timeout: 900_000 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Cargo ${name} failed; see ${join(output, `${name}.log`)}.`);
  } finally { closeSync(log); }
}
cargo(['metadata', '--offline', '--format-version=1'], 'metadata');
const resolved = packages(await readFile(join(crate, 'Cargo.lock'), 'utf8'));
for (const row of resolved) assert.ok(pinned.some(pin => pin.name === row.name && pin.version === row.version && pin.checksum === row.checksum), `Native probe differs from desktop lock: ${row.name} ${row.version}.`);
cargo(['build', '--locked', '--offline', '--target-dir', target], 'build');
const binary = join(target, 'debug/lolly-webgpu-probe');
const framework = '/System/Library/Frameworks/WebKit.framework/Resources/Info.plist';
const version = spawnSync('/usr/bin/plutil', ['-extract', 'CFBundleVersion', 'raw', framework], { encoding: 'utf8' });
assert.equal(version.status, 0, 'System WebKit version must be recorded.');
const { TAURI_CSP } = await import(join(repo, 'shells/tauri-shared/vite-csp.mjs')) as { TAURI_CSP: string };
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
await writeFile(join(output, 'environment.json'), JSON.stringify({ date: new Date().toISOString(), node: process.version,
  os: release(), arch: arch(), cpu: cpus()[0]?.model, webKitFramework: version.stdout.trim(),
  desktopLockSha256: hash(lock), binarySha256: hash(await readFile(binary)), cspSha256: hash(TAURI_CSP), resolved,
  nonpersistent: true, visibleWindow: true, backgroundThrottling: 'disabled-for-probe',
  cspApplication: 'Exact shared shell policy in the fixture HTML meta tag; native fixture config csp/devCsp are null.',
  scope: 'Actual pinned Tauri/Wry WKWebView; localhost fixture with the shared shell CSP and unchanged full GPU corpus. The full installed product, tauri protocol, older macOS and other native platforms are not qualified.' }, null, 2) + '\n');
const result = spawnSync(process.execPath, ['scripts/verify-webgpu.ts'], { cwd: repo, stdio: 'inherit', env: {
  ...process.env, LOLLY_WEBGPU_BROWSER: 'tauri-macos', LOLLY_WEBGPU_NATIVE_BINARY: binary,
  LOLLY_WEBGPU_NATIVE_VERSION: `WKWebView ${version.stdout.trim()}`, LOLLY_WEBGPU_TEST_CSP: TAURI_CSP,
  LOLLY_WEBGPU_REPORT: join(output, 'conformance.json'),
} });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
