// SPDX-License-Identifier: MPL-2.0
/** The whole shared corpus in owned iPhone/iPad simulators; personal devices are untouched. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'darwin') throw new Error('iOS native qualification requires Apple CoreSimulator.');
const output = resolve(repo, process.env.LOLLY_WEBGPU_IOS_OUTPUT ?? 'plans/295-validation/webgpu-ios');
const app = join(output, 'LollyWebGpuQualification.app');
await mkdir(app, { recursive: true });
await cp(join(repo, 'tests/fixtures/webgpu-ios/Info.plist'), join(app, 'Info.plist'));
await writeFile(join(output, 'WEBGPU-QUALIFICATION-BUILD-NOT-FOR-RELEASE.txt'), 'Isolated unsigned simulator qualification fixture. Never publish as Lolly.\n');
const run = (command: string, args: string[], timeout = 180_000) => {
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8', timeout });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
};
const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
const source = join(repo, 'tests/fixtures/webgpu-ios/Probe.swift');
run('xcrun', ['--sdk', 'iphonesimulator', 'swiftc', '-parse-as-library', '-target', 'arm64-apple-ios26.5-simulator',
  '-sdk', sdk, source, '-o', join(app, 'LollyWebGpuProbe')]);
run('/usr/bin/codesign', ['--force', '--sign', '-', app]);
interface Runtime { identifier: string; version: string; buildversion: string; isAvailable: boolean; runtimeRoot: string }
const runtimes = JSON.parse(run('xcrun', ['simctl', 'list', 'runtimes', '--json'])) as { runtimes: Runtime[] };
const runtime = runtimes.runtimes.find(row => row.identifier === (process.env.LOLLY_WEBGPU_IOS_RUNTIME ?? 'com.apple.CoreSimulator.SimRuntime.iOS-26-5'));
assert.ok(runtime?.isAvailable, 'The exact requested iOS simulator runtime is required.');
const version = run('/usr/bin/plutil', ['-extract', 'CFBundleVersion', 'raw', join(runtime.runtimeRoot, 'System/Library/Frameworks/WebKit.framework/Info.plist')]);
const { TAURI_CSP } = await import(join(repo, 'shells/tauri-shared/vite-csp.mjs')) as { TAURI_CSP: string };
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
let failed = false;
for (const [family, type] of [['iphone', 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro'], ['ipad', 'com.apple.CoreSimulator.SimDeviceType.iPad-Pro-13-inch-M4-8GB']]) {
  const lane = join(output, family!); await mkdir(lane, { recursive: true });
  const device = run('xcrun', ['simctl', 'create', `LollyWebGpuQualification-${family}-${process.pid}`, type!, runtime.identifier]);
  let probeThrew = false;
  const cleanupErrors: unknown[] = [];
  try {
    run('xcrun', ['simctl', 'boot', device]); run('xcrun', ['simctl', 'bootstatus', device, '-b']);
    run('xcrun', ['simctl', 'install', device, app]);
    await writeFile(join(lane, 'environment.json'), JSON.stringify({ date: new Date().toISOString(), family, type, device,
      runtime: { identifier: runtime.identifier, version: runtime.version, build: runtime.buildversion }, webKitFramework: version,
      sdk, sourceSha256: hash(await readFile(source)), binarySha256: hash(await readFile(join(app, 'LollyWebGpuProbe'))), cspSha256: hash(TAURI_CSP),
      nonpersistent: true, gpuPreferences: 'default', physicalDevice: false,
      cspApplication: 'Exact shared shell policy in the fixture HTML meta tag; no WKWebView preferences changed.',
      scope: 'Actual UIKit/WKWebView in an owned Apple simulator with shared shell CSP and the unchanged full GPU corpus. Physical devices, the full installed Tauri app and other OS versions are not qualified.' }, null, 2) + '\n');
    const result = spawnSync(process.execPath, ['scripts/verify-webgpu.ts'], { cwd: repo, stdio: 'inherit', timeout: 180_000, env: {
      ...process.env, LOLLY_WEBGPU_BROWSER: 'ios-simulator', LOLLY_WEBGPU_NATIVE_VERSION: `WKWebView ${version}; iOS ${runtime.version} simulator`,
      LOLLY_WEBGPU_IOS_DEVICE: device, LOLLY_WEBGPU_TEST_CSP: TAURI_CSP,
      LOLLY_WEBGPU_REPORT: join(lane, 'conformance.json'),
    } });
    if (result.error) throw result.error;
    if (result.status !== 0) failed = true;
  } catch (error) {
    probeThrew = true;
    throw error;
  } finally {
    // Only the throwaway simulator this iteration just created is removed.
    try {
      try { run('xcrun', ['simctl', 'shutdown', device]); } catch (error) { cleanupErrors.push(error); }
    } finally {
      try { run('xcrun', ['simctl', 'delete', device]); } catch (error) { cleanupErrors.push(error); }
    }
    if (probeThrew && cleanupErrors.length) console.error(new AggregateError(cleanupErrors, `Owned simulator ${device} cleanup failed.`));
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `Owned simulator ${device} cleanup failed.`);
}
process.exitCode = failed ? 1 : 0;
