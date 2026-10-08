// SPDX-License-Identifier: MPL-2.0
/** Source-bound, unsigned WebView2/WebKitGTK qualification with the complete maintained corpus. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { arch, cpus, release } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MARKER_FILE, assertQualificationAllowed } from './webgpu-qualification.ts';

export interface RegistryPackage { name: string; version: string; checksum: string }
export function registryPackages(lock: string): RegistryPackage[] {
  return lock.split('[[package]]').slice(1).flatMap(block => {
    const name = /\nname = "([^"]+)"/.exec(block)?.[1];
    const version = /\nversion = "([^"]+)"/.exec(block)?.[1];
    const checksum = /\nchecksum = "([^"]+)"/.exec(block)?.[1];
    return name && version && checksum ? [{ name, version, checksum }] : [];
  });
}
export function assertDesktopDependencies(desktop: readonly RegistryPackage[], probe: readonly RegistryPackage[]): void {
  assert.ok(probe.length, 'The native probe must resolve registry packages.');
  for (const row of probe) assert.ok(desktop.some(pin => pin.name === row.name && pin.version === row.version && pin.checksum === row.checksum),
    `Native probe differs from desktop lock: ${row.name} ${row.version}.`);
}
/** Configuration overrides must not become evidence for default runtime preferences. */
export function runtimeOverrides(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([key, value]) => value && /^(?:WEBVIEW2_|WEBKIT_|LIBGL_|MESA_|VK_|ANGLE_)/i.test(key))) as Record<string, string>;
}
export function nativeTarget(platform: string): 'tauri-windows' | 'tauri-linux' {
  if (platform === 'win32') return 'tauri-windows';
  if (platform === 'linux') return 'tauri-linux';
  throw new Error('Run this probe on Windows/WebView2 or Linux/WebKitGTK; macOS has verify-webgpu-tauri.ts.');
}
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const repo = fileURLToPath(new URL('../', import.meta.url));

function inspect(command: string, args: string[]): Record<string, unknown> {
  const result = spawnSync(command, args, { cwd: repo, encoding: 'utf8', timeout: 15_000, maxBuffer: 8 * 1024 * 1024 });
  return { command, args, status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '',
    ...(result.error ? { error: String(result.error) } : {}) };
}

export async function qualifyNative(): Promise<number> {
  const output = resolve(repo, process.env.LOLLY_WEBGPU_NATIVE_OUTPUT ?? 'plans/295-validation/webgpu-native');
  await mkdir(output, { recursive: true });
  // This probe has no publishing path and receives no signing credentials.
  await writeFile(join(output, MARKER_FILE), 'Unsigned, source-bound WebGPU runtime probe. Not for release.\n');
  const receipt: Record<string, unknown> = { date: new Date().toISOString(), node: process.version, platform: process.platform,
    os: release(), architecture: arch(), cpu: cpus()[0]?.model, status: 'not run',
    runner: { name: process.env.RUNNER_NAME, image: process.env.ImageOS, imageVersion: process.env.ImageVersion,
      environment: process.env.RUNNER_ENVIRONMENT, runId: process.env.GITHUB_RUN_ID, repository: process.env.GITHUB_REPOSITORY },
    release: false, nonpersistent: true, visibleWindow: true, focused: false,
    backgroundThrottling: 'disabled-for-probe',
    scope: 'Actual pinned Tauri/Wry runtime, fresh incognito windows, localhost fixtures and shared shell CSP. A VM/display result applies only to its recorded runtime and graphics configuration. The installed product and tauri protocol are not qualified.' };
  const save = () => writeFile(join(output, 'environment.json'), JSON.stringify(receipt, null, 2) + '\n');
  let phase = 'preflight';
  try {
    assertQualificationAllowed(process.env);
    const targetName = nativeTarget(process.platform);
    receipt.target = targetName;
    receipt.runtimeOverrides = runtimeOverrides(process.env);
    assert.equal(Object.keys(receipt.runtimeOverrides as object).length, 0, 'Refused runtime/graphics environment overrides; qualify defaults first.');
    const source = inspect('git', ['rev-parse', 'HEAD']);
    assert.equal(source.status, 0, 'The source commit must be recorded.');
    const commit = String(source.stdout).trim();
    const expected = process.env.LOLLY_WEBGPU_SOURCE_SHA;
    if (expected) { assert.match(expected, /^[a-f0-9]{40}$/); assert.equal(commit, expected, 'Qualification checkout differs from the requested source.'); }
    const dirty = inspect('git', ['status', '--porcelain', '--untracked-files=no']);
    assert.equal(dirty.status, 0);
    if (process.env.GITHUB_ACTIONS === 'true') assert.equal(String(dirty.stdout).trim(), '', 'CI qualification needs an unchanged checkout.');
    receipt.source = { commit, expected, trackedChanges: dirty.stdout,
      diffSha256: hash(String(inspect('git', ['diff', '--binary', 'HEAD']).stdout)) };
    receipt.session = { display: process.env.DISPLAY ?? null, wayland: process.env.WAYLAND_DISPLAY ?? null,
      sessionType: process.env.XDG_SESSION_TYPE ?? null, desktop: process.env.XDG_CURRENT_DESKTOP ?? null };
    if (process.platform === 'win32') {
      // Read policies only; never add diagnostic flags to an elevated runner.
      const policy = inspect('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        "$out=@(); foreach($root in @('HKLM:\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2','HKCU:\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2','HKLM:\\SOFTWARE\\WOW6432Node\\Policies\\Microsoft\\Edge\\WebView2')) { if(Test-Path $root) { @((Get-Item $root)) + @(Get-ChildItem $root -Recurse) | ForEach-Object { $key=$_; foreach($name in $key.GetValueNames()) { $out += @{path=$key.Name;name=$name;value=$key.GetValue($name)} } } } }; ConvertTo-Json -InputObject @($out) -Depth 5"]);
      assert.equal(policy.status, 0, 'WebView2 policies must be readable.');
      receipt.webView2Policies = policy;
      const policies = JSON.parse(String(policy.stdout)) as Array<{ path: string; name: string; value: unknown }>;
      assert.ok(!policies.some(row => /AdditionalBrowserArguments|BrowserExecutableFolder|ReleaseChannels|ReleaseChannelPreference|ChannelSearchKind/i.test(row.path + '\\' + row.name) && String(row.value ?? '').trim()), 'Refused WebView2 runtime selection or browser-argument policies.');
      receipt.graphics = inspect('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,PNPDeviceID,Status | ConvertTo-Json -Depth 4']);
    } else {
      const format = '-f=' + ['Package', 'Version', 'Architecture'].map(key => '$' + '{' + key + '}').join('\t') + '\n';
      receipt.packages = inspect('dpkg-query', ['-W', format,
        'libwebkit2gtk-4.1-0', 'libjavascriptcoregtk-4.1-0', 'libgtk-3-0*', 'libegl-mesa0', 'mesa-vulkan-drivers', 'xvfb']);
      receipt.graphics = inspect('lspci', ['-nnk']);
      receipt.vulkan = inspect('vulkaninfo', ['--summary']);
      receipt.display = inspect('xdpyinfo', []);
    }
    const inputs = ['tests/webgpu-lut.browser.test.ts', 'tests/helpers/lut-cases.ts', 'tests/helpers/webgpu-local-receiver.ts',
      'tests/helpers/webgpu-browser.ts', 'tests/fixtures/webgpu-tauri/src/main.rs', 'tests/fixtures/webgpu-tauri/Cargo.toml',
      'tests/fixtures/webgpu-tauri/tauri.conf.json', 'scripts/verify-webgpu-native.ts', 'scripts/verify-webgpu.ts'];
    receipt.sourceFiles = Object.fromEntries(await Promise.all(inputs.map(async path => [path, hash(await readFile(join(repo, path)))])));
    const crate = join(output, 'crate'), target = join(output, 'target');
    await cp(join(repo, 'tests/fixtures/webgpu-tauri'), crate, { recursive: true });
    await mkdir(join(crate, 'frontend'), { recursive: true });
    await writeFile(join(crate, 'frontend/index.html'), '<!doctype html><title>Lolly WebGPU Qualification</title>');
    await mkdir(join(crate, 'icons'), { recursive: true });
    await cp(join(repo, 'shells/tauri-desktop/src-tauri/icons/32x32.png'), join(crate, 'icons/icon.png'));
    const lock = await readFile(join(repo, 'shells/tauri-desktop/src-tauri/Cargo.lock'), 'utf8');
    const pinned = registryPackages(lock);
    const fixture = await readFile(join(crate, 'Cargo.toml'), 'utf8');
    for (const name of ['tauri', 'tauri-build', 'serde_json']) {
      const version = new RegExp(`(?:^|\\n)${name}\\s*=\\s*(?:\\{[^\\n]*version\\s*=\\s*)?"=([^"\\n]+)"`).exec(fixture)?.[1];
      assert.ok(version && pinned.some(row => row.name === name && row.version === version), `Probe must pin ${name} from the desktop lock.`);
    }
    await writeFile(join(crate, 'Cargo.lock'), lock);
    receipt.desktopLockSha256 = hash(lock);
    const cargo = (args: string[], name: string, timeout = 900_000) => {
      const log = openSync(join(output, `${name}.log`), 'w');
      try {
        const result = spawnSync('cargo', ['+1.96.0', ...args], { cwd: crate, stdio: ['ignore', log, log], timeout });
        if (result.error) throw result.error;
        assert.equal(result.status, 0, `Cargo ${name} failed; see ${join(output, `${name}.log`)}.`);
      } finally { closeSync(log); }
    };
    phase = 'dependency resolution';
    // The copied desktop root changes to the probe crate. Validate every resolved
    // registry checksum before building with the resulting frozen lock.
    cargo(['metadata', '--format-version=1'], 'metadata');
    const resolved = registryPackages(await readFile(join(crate, 'Cargo.lock'), 'utf8'));
    assertDesktopDependencies(pinned, resolved);
    receipt.resolved = resolved;
    receipt.rust = inspect('rustc', ['+1.96.0', '--version', '--verbose']);
    await save();
    phase = 'native build';
    cargo(['build', '--locked', '--offline', '--target-dir', target], 'build');
    const binary = join(target, 'debug', `lolly-webgpu-probe${process.platform === 'win32' ? '.exe' : ''}`);
    receipt.binarySha256 = hash(await readFile(binary));
    phase = 'runtime version';
    const runtime = inspect(binary, ['--runtime-info']);
    assert.equal(runtime.status, 0, 'Actual native runtime must report its version.');
    const runtimeInfo = JSON.parse(String(runtime.stdout)) as { version: string; os: string; architecture: string };
    assert.ok(typeof runtimeInfo.version === 'string' && runtimeInfo.version.trim(), 'Native runtime version is missing.');
    assert.equal(runtimeInfo.os, process.platform === 'win32' ? 'windows' : 'linux');
    receipt.runtime = runtimeInfo;
    const { TAURI_CSP } = await import(pathToFileURL(join(repo, 'shells/tauri-shared/vite-csp.mjs')).href) as { TAURI_CSP: string };
    receipt.cspSha256 = hash(TAURI_CSP);
    await save();
    phase = 'complete conformance corpus';
    const env: NodeJS.ProcessEnv = { ...process.env, LOLLY_WEBGPU_BROWSER: targetName, LOLLY_WEBGPU_NATIVE_BINARY: binary,
      LOLLY_WEBGPU_NATIVE_VERSION: `${targetName === 'tauri-windows' ? 'WebView2' : 'WebKitGTK'} ${runtimeInfo.version}`,
      LOLLY_WEBGPU_TEST_CSP: TAURI_CSP, LOLLY_WEBGPU_REPORT: join(output, 'conformance.json') };
    delete env.LOLLY_CATALOG_SIGNING_KEY;
    const log = openSync(join(output, 'conformance.log'), 'w');
    let result: ReturnType<typeof spawnSync>;
    try { result = spawnSync(process.execPath, ['scripts/verify-webgpu.ts'], { cwd: repo, stdio: ['ignore', log, log], env, timeout: 120_000 }); }
    finally { closeSync(log); }
    if (result.error) throw result.error;
    receipt.corpusExitCode = result.status;
    // Preserve a typed not-run/unsupported result from the maintained corpus;
    // compilation, display and missing-device failures never become Unsupported.
    try { receipt.conformance = JSON.parse(await readFile(join(output, 'conformance.json'), 'utf8')); } catch { receipt.conformance = null; }
    receipt.status = result.status === 0 ? 'passed' : 'failed';
    receipt.phase = phase;
    await save();
    console.log(`Native WebGPU ${receipt.status}: ${join(output, 'environment.json')}`);
    return result.status ?? 1;
  } catch (error) {
    receipt.status = 'not run'; receipt.phase = phase; receipt.error = String(error);
    await save();
    console.error(`${error}\nQualification receipt: ${join(output, 'environment.json')}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await qualifyNative();
