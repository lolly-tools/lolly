// SPDX-License-Identifier: MPL-2.0
/** Native Android WebView evidence, with the same required GPU corpus as other hosts. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANDROID_QUALIFICATION_PACKAGE = 'tools.lolly.webgpuqualification';
const repo = fileURLToPath(new URL('../', import.meta.url));
const hash = (input: Uint8Array | string) => createHash('sha256').update(input).digest('hex');

export function androidQualificationSource(expected: string | undefined, git: (args: string[]) => string): string {
  assert.ok(expected && /^[a-f0-9]{40}$/.test(expected), 'LOLLY_WEBGPU_SOURCE_SHA must name a reviewed full main SHA.');
  const actual = git(['rev-parse', 'HEAD']).trim();
  assert.equal(actual, expected, 'The checked-out source must match the reviewed SHA.');
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']).trim(), '', 'Qualification source must have no tracked changes.');
  git(['merge-base', '--is-ancestor', expected, 'origin/main']);
  return actual;
}

export function androidQualificationPort(input: string): number {
  const url = new URL(input), actor = url.searchParams.get('qualification');
  assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port
    && Number(url.port) >= 1024 && !url.username && !url.password && !url.hash && url.pathname === '/', 'Only an owned loopback qualification URL is allowed.');
  assert.ok(actor && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(actor)
    && url.searchParams.size === 1 && input === url.href, 'Missing or unsafe qualification page identity.');
  return Number(url.port);
}

export function androidWebViewProvider(dump: string): { name: string; version: string } {
  const value = /^.*Current WebView package.*:\s*\(([^,\s]+),\s*([^\s)]+)\)/m.exec(dump);
  const message = 'The actual selected WebView package and version must be recorded.';
  assert.ok(value, message); assert.ok(value[1]?.includes('.') && /^\d+\./.test(value[2] ?? ''), message);
  return { name: value[1]!, version: value[2]! };
}

export function androidNativeSettings(log: string, actors: string[], provider: { name: string; version: string }): Record<string, unknown>[] {
  const records = log.split('\n').flatMap(line => {
    try {
      const record = JSON.parse(line.slice(line.indexOf('{'))) as Record<string, unknown>;
      return actors.includes(String(record.actor)) ? [record] : [];
    } catch { return []; }
  });
  assert.ok(actors.length && actors.every(actor => records.some(record => record.actor === actor)), 'Every launched native page must record its actual runtime settings.');
  for (const record of records) {
    assert.equal(record.package, provider.name, 'The loaded WebView provider must match the device report.');
    assert.equal(record.version, provider.version, 'The loaded WebView version must match the device report.');
    assert.equal(record.javascriptEnabled, true); assert.equal(record.hardwareAccelerated, true);
  }
  return records;
}

type Adb = (args: string[]) => string;
export function installAndroidQualification(apk: string, adb: Adb): void {
  const packages = adb(['shell', 'pm', 'list', 'packages', ANDROID_QUALIFICATION_PACKAGE]);
  assert.ok(!packages.split(/\r?\n/).some(line => line.trim() === `package:${ANDROID_QUALIFICATION_PACKAGE}`), 'A pre-existing qualification fixture must not be replaced.');
  assert.match(adb(['install', '-t', apk]), /\bSuccess\b/, 'The owned test fixture must install successfully.');
}

function reverseMapping(list: string, port: number): string[] | undefined {
  return list.split(/\r?\n/).map(line => line.trim().split(/\s+/)).find(fields => fields[1] === `tcp:${port}`);
}

interface AndroidOwnership { installed: boolean; ports: readonly number[]; portCreated: (port: number) => void }
export function launchAndroidQualification(input: string, adb: Adb, ownership: AndroidOwnership): number {
  const port = androidQualificationPort(input);
  assert.ok(ownership.installed, 'Only the successfully installed owned fixture may be launched.');
  const mapping = reverseMapping(adb(['reverse', '--list']), port);
  assert.ok(!mapping || (ownership.ports.includes(port) && mapping[2] === `tcp:${port}`), 'A pre-existing reverse mapping must not be overwritten.');
  if (!mapping) {
    adb(['reverse', '--no-rebind', `tcp:${port}`, `tcp:${port}`]);
    try { ownership.portCreated(port); } catch (error) { adb(['reverse', '--remove', `tcp:${port}`]); throw error; }
  }
  adb(['shell', 'am', 'force-stop', ANDROID_QUALIFICATION_PACKAGE]);
  // The URL has a validated origin and UUID; no untrusted shell metacharacters survive.
  const result = adb(['shell', 'am', 'start', '-W', '-n', `${ANDROID_QUALIFICATION_PACKAGE}/.QualificationActivity`,
    '--es', 'qualification_url', input]);
  assert.doesNotMatch(result, /Error:|Exception/, 'The native qualification activity must launch.');
  return port;
}

export function cleanAndroidQualification(adb: Adb, ports: number[], installed: boolean): string[] {
  assert.ok(ports.every(port => Number.isInteger(port) && port >= 1024 && port <= 65535), 'Invalid owned reverse port.');
  if (!installed) return [];
  const errors: string[] = [];
  const actions = [() => adb(['shell', 'am', 'force-stop', ANDROID_QUALIFICATION_PACKAGE]),
    ...[...new Set(ports)].map(port => () => {
      const mapping = reverseMapping(adb(['reverse', '--list']), port);
      assert.ok(!mapping || mapping[2] === `tcp:${port}`, 'The owned reverse mapping changed; it must not be removed.');
      if (mapping) adb(['reverse', '--remove', `tcp:${port}`]);
    }), () => adb(['uninstall', ANDROID_QUALIFICATION_PACKAGE])];
  for (const action of actions) {
    try { action(); } catch (error) { errors.push(String(error)); }
  }
  return errors;
}

function command(binary: string, args: string[], cwd = repo): string {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${binary} failed: ${result.stderr}\n${result.stdout}`);
  return result.stdout;
}

function adbConnection(): { adb: Adb; binary: string; serial: string } {
  const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  const binary = process.env.LOLLY_WEBGPU_ADB ?? (sdk ? join(sdk, 'platform-tools/adb') : 'adb');
  const devices = command(binary, ['devices']).split('\n').map(line => /^(\S+)\s+device$/.exec(line)?.[1]).filter((value): value is string => !!value);
  const requested = process.env.LOLLY_WEBGPU_ANDROID_DEVICE;
  const serial = requested ?? (devices.length === 1 && devices[0]);
  assert.ok(serial && /^[a-zA-Z0-9._:-]{1,128}$/.test(serial) && devices.includes(serial), 'Select one connected owned Android device with LOLLY_WEBGPU_ANDROID_DEVICE.');
  assert.ok(requested || serial.startsWith('emulator-'), 'A physical device must be selected explicitly.');
  return { binary, serial, adb: args => command(binary, ['-s', serial, ...args]) };
}

async function buildApk(output: string): Promise<string> {
  const sdk = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  assert.ok(sdk, 'ANDROID_SDK_ROOT or ANDROID_HOME is required.');
  const tools = join(sdk, 'build-tools/36.0.0'), platform = join(sdk, 'platforms/android-36/android.jar');
  for (const binary of ['aapt2', 'd8', 'zipalign', 'apksigner']) assert.ok(existsSync(join(tools, binary)), `Missing Android build-tools/36.0.0/${binary}.`);
  assert.ok(existsSync(platform), 'Install Android SDK platform 36.');
  const source = join(repo, 'tests/fixtures/webgpu-android'), work = await mkdtemp(join(output, 'apk-build-'));
  try {
    await mkdir(join(work, 'classes'), { recursive: true }); await mkdir(join(work, 'dex'), { recursive: true });
    command('javac', ['--release', '8', '-classpath', platform, '-d', join(work, 'classes'), join(source, 'QualificationActivity.java')]);
    const classes = join(work, 'classes/tools/lolly/webgpuqualification');
    const classFiles = (await readdir(classes)).filter(file => file.endsWith('.class')).map(file => join(classes, file));
    command(join(tools, 'd8'), ['--min-api', '29', '--lib', platform, '--output', join(work, 'dex'), ...classFiles]);
    command(join(tools, 'aapt2'), ['compile', '--dir', join(source, 'res'), '-o', join(work, 'resources.zip')]);
    const unsigned = join(work, 'unsigned.apk'), aligned = join(work, 'aligned.apk'), apk = join(output, 'webgpu-qualification-test-only.apk');
    command(join(tools, 'aapt2'), ['link', '-I', platform, '--manifest', join(source, 'AndroidManifest.xml'), '--min-sdk-version', '29', '--target-sdk-version', '36', '--version-code', '1', '--version-name', '0.1.0-qualification', '-o', unsigned, join(work, 'resources.zip')]);
    command('zip', ['-q', '-j', unsigned, join(work, 'dex/classes.dex')]);
    command(join(tools, 'zipalign'), ['-f', '4', unsigned, aligned]);
    const key = join(work, 'qualification-debug.keystore');
    if (!existsSync(key)) command('keytool', ['-genkeypair', '-keystore', key, '-storepass', 'android', '-keypass', 'android', '-alias', 'qualification', '-dname', 'CN=Lolly Qualification Only', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '2']);
    command(join(tools, 'apksigner'), ['sign', '--ks', key, '--ks-pass', 'pass:android', '--out', apk, aligned]);
    return apk;
  } finally { await rm(work, { recursive: true, force: true }); }
}

export async function verifyAndroidWebGpu(): Promise<number> {
  const sourceSha = androidQualificationSource(process.env.LOLLY_WEBGPU_SOURCE_SHA, args => command('git', args));
  const output = resolve(process.env.LOLLY_WEBGPU_ANDROID_OUTPUT ?? join(repo, 'plans/295-validation/android-webview'));
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'source.json'), JSON.stringify({ sourceSha, expectedSourceSha: process.env.LOLLY_WEBGPU_SOURCE_SHA }, null, 2) + '\n');
  const { adb, binary, serial } = adbConnection();
  const apk = await buildApk(output);
  const { TAURI_CSP } = await import(new URL('../shells/tauri-shared/vite-csp.mjs', import.meta.url).href) as { TAURI_CSP: string };
  const properties = Object.fromEntries(['ro.build.version.sdk', 'ro.build.version.release', 'ro.build.version.security_patch', 'ro.build.fingerprint', 'ro.hardware', 'ro.hardware.egl', 'ro.hardware.vulkan', 'ro.kernel.qemu', 'ro.product.cpu.abi'].map(name => [name, adb(['shell', 'getprop', name]).trim()]));
  const provider = adb(['shell', 'dumpsys', 'webviewupdate']);
  await writeFile(join(output, 'webview-provider.txt'), provider);
  await writeFile(join(output, 'surface-flinger.txt'), adb(['shell', 'dumpsys', 'SurfaceFlinger']));
  const emulator = properties['ro.kernel.qemu'] === '1';
  const fixtureSha256 = Object.fromEntries(await Promise.all(['QualificationActivity.java', 'AndroidManifest.xml', 'res/xml/network_security_config.xml']
    .map(async file => [file, hash(await readFile(join(repo, 'tests/fixtures/webgpu-android', file)))])));
  const environment = { date: new Date().toISOString(), sourceSha, serial, properties, emulator, node: process.version,
    apkSha256: hash(await readFile(apk)), fixtureSha256, cspSha256: hash(TAURI_CSP),
    adbVersion: command(binary, ['version']).trim(), requestedEmulatorGraphics: process.env.LOLLY_WEBGPU_ANDROID_EMULATOR_GPU ?? null,
    scope: emulator ? 'Actual default Android WebView in this virtual Android device only. Physical Android devices and the installed Lolly/Tauri application are not qualified.' : 'Actual default Android WebView in this explicitly selected device only. Other devices and the installed Lolly/Tauri application are not qualified.',
    preferences: 'JavaScript enabled; hardware acceleration enabled; all other WebView feature settings unchanged. No GPU flags, provider switch or capability fallback.',
    csp: 'Exact shared shell policy applied by the existing corpus HTML meta tag.' };
  await writeFile(join(output, 'environment.json'), JSON.stringify(environment, null, 2) + '\n');
  const version = androidWebViewProvider(provider);
  const quote = (value: string) => `'${value.replaceAll("'", "'\"'\"'")}'`;
  const launcher = join(output, 'launch-owned-webview.sh');
  await writeFile(launcher, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(fileURLToPath(import.meta.url))} --open "$1"\n`);
  await chmod(launcher, 0o700);
  await writeFile(join(output, 'reverse-ports.json'), '[]\n');
  await writeFile(join(output, 'actors.json'), '[]\n');
  const log = openSync(join(output, 'qualification.log'), 'w');
  const nonce = randomUUID(), ownershipFile = join(output, 'owned-install.json');
  let status = 1, installed = false;
  try {
    installAndroidQualification(apk, adb); installed = true;
    await writeFile(ownershipFile, JSON.stringify({ nonce, serial, sourceSha }) + '\n');
    const result = spawnSync(process.execPath, ['scripts/verify-webgpu.ts'], { cwd: repo, stdio: ['ignore', log, log], timeout: 180_000,
      env: { ...process.env, LOLLY_WEBGPU_BROWSER: 'android-webview', LOLLY_WEBGPU_NATIVE_BINARY: launcher,
        LOLLY_WEBGPU_NATIVE_VERSION: `${version.name} ${version.version}`, LOLLY_WEBGPU_ANDROID_DEVICE: serial,
        LOLLY_WEBGPU_SOURCE_SHA: sourceSha, LOLLY_WEBGPU_ANDROID_RUN: nonce,
        LOLLY_WEBGPU_ANDROID_OUTPUT: output, LOLLY_WEBGPU_TEST_CSP: TAURI_CSP,
        LOLLY_WEBGPU_TEST_ADAPTER: emulator ? 'default Android WebView; emulator graphics only' : 'default Android WebView; explicitly selected device',
        LOLLY_WEBGPU_REPORT: join(output, 'qualification.json') } });
    if (result.error) throw result.error;
    status = result.status ?? 1;
  } finally {
    closeSync(log);
    if (installed) {
      try {
        const settings = adb(['logcat', '-d', '-s', 'LollyWebGpuQualification:I', '*:S']);
        await writeFile(join(output, 'native-settings.log'), settings);
        const actors = JSON.parse(await readFile(join(output, 'actors.json'), 'utf8')) as string[];
        await writeFile(join(output, 'native-settings.json'), JSON.stringify(androidNativeSettings(settings, actors, version), null, 2) + '\n');
      } catch (error) {
        status = 1; await writeFile(join(output, 'native-settings-error.txt'), String(error) + '\n');
      } finally {
        const errors: string[] = [];
        let ports: number[] = [];
        try {
          const recorded: unknown = JSON.parse(await readFile(join(output, 'reverse-ports.json'), 'utf8'));
          assert.ok(Array.isArray(recorded) && recorded.every(port => Number.isInteger(port) && port >= 1024 && port <= 65535), 'Invalid owned reverse-port record.');
          ports = recorded;
        } catch (error) { errors.push(String(error)); }
        errors.push(...cleanAndroidQualification(adb, ports, installed));
        try {
          if (errors.length) { status = 1; await writeFile(join(output, 'cleanup-errors.json'), JSON.stringify(errors, null, 2) + '\n'); }
        } finally { await rm(ownershipFile, { force: true }); }
      }
    }
  }
  return status;
}

async function main(): Promise<void> {
  if (process.argv[2] === '--open') {
    const sourceSha = androidQualificationSource(process.env.LOLLY_WEBGPU_SOURCE_SHA, args => command('git', args));
    const input = process.argv[3]; assert.ok(input && process.argv.length === 4, 'Provide exactly one qualification URL.');
    androidQualificationPort(input);
    const output = process.env.LOLLY_WEBGPU_ANDROID_OUTPUT; assert.ok(output, 'Missing owned output directory.');
    const file = join(output, 'reverse-ports.json');
    const ports = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as number[] : [];
    const owned = JSON.parse(await readFile(join(output, 'owned-install.json'), 'utf8')) as { nonce: string; serial: string; sourceSha: string };
    assert.ok(owned.nonce && owned.nonce === process.env.LOLLY_WEBGPU_ANDROID_RUN && owned.sourceSha === sourceSha, 'The launcher must belong to this successful owned install.');
    const connection = adbConnection(); assert.equal(owned.serial, connection.serial, 'The owned install belongs to a different device.');
    const actorsFile = join(output, 'actors.json'), actor = new URL(input).searchParams.get('qualification')!;
    const actors = existsSync(actorsFile) ? JSON.parse(readFileSync(actorsFile, 'utf8')) as string[] : [];
    await writeFile(actorsFile, JSON.stringify([...new Set([...actors, actor])]) + '\n');
    launchAndroidQualification(input, connection.adb, { installed: true, ports,
      portCreated: created => writeFileSync(file, JSON.stringify([...new Set([...ports, created])]) + '\n') });
  } else {
    assert.equal(process.argv.length, 2, 'Unknown Android qualification arguments.');
    process.exitCode = await verifyAndroidWebGpu();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
