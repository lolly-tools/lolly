// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { productProbeIdentity, productProbeOptions, webGpuProductProbe } from '../shells/tauri-shared/webgpu-product-probe.mjs';
import { DeviceMutationError, installJournal, OwnedIosDevice, consoleEnvironment, type DeviceCommands, type IosInstallLease } from '../scripts/lib/webgpu-ios-device.ts';
import { appDigest, completeIosRuntime, installedAppUrl, IOS_REGISTRATIONS, ownedAppName, ownedProcesses, parseApplePlist, physicalDevice, requireAbsentApp,
  requireSourceSha, sanitizeIosInfo, sha256, validateIosInfo, validateProfile, validateReceiptFiles, validateSignedEntitlements,
  type IosProductReceipt } from '../scripts/lib/webgpu-ios-product.ts';
import { iosProbeConfig } from '../scripts/verify-webgpu-product-ios.ts';
import { decodeProductMessage, ProductProbeProtocol } from './helpers/webgpu-product-receiver.ts';
import { webGpuBrowserEngine } from './helpers/webgpu-browser.ts';
import { PRODUCT_CORPUS_MS, waitOwnedCorpus } from '../scripts/lib/webgpu-product-corpus.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = '4c3d9db0-f06e-4870-a75f-c4a2a1502bad';
const identifier = productProbeIdentity(runId);
const scene = { UIApplicationSupportsMultipleScenes: true, UISceneConfigurations: { UIWindowSceneSessionRoleApplication: [{ UISceneConfigurationName: 'TaoScene', UISceneDelegateClassName: 'TaoSceneDelegate' }] } };
const profile = { Platform: ['iOS'], ExpirationDate: '2035-01-01T00:00:00Z', ProvisionedDevices: ['test-physical-device'], DeveloperCertificates: ['dGVzdA=='],
  Entitlements: { 'application-identifier': 'TESTTEAM00.*', 'com.apple.developer.team-identifier': 'TESTTEAM00', 'get-task-allow': true } };
const successful = (result: unknown) => ({ info: { outcome: 'success' }, result });
const device = { identifier: 'test-device', hardwareProperties: { platform: 'iOS', reality: 'physical', deviceType: 'iPhone', udid: 'test-physical-device', productType: 'iPhone17,2' },
  deviceProperties: { osVersionNumber: '27.2', osBuildUpdate: 'test-os-build', developerModeStatus: 'enabled', ddiServicesAvailable: true }, connectionProperties: { pairingState: 'paired' } };
const receipt = (): IosProductReceipt => ({ version: 1, platform: 'ios', runId, identifier, app: '/owned/' + ownedAppName(runId), binary: '/owned/' + ownedAppName(runId) + '/Lolly',
  binarySha256: 'binary-hash', appSha256: 'app-hash', sources: {}, signing: { profileSha256: 'profile-hash', identitySha1: 'certificate-hash', expires: '2035-01-01T00:00:00Z', development: true } });
const appUrl = 'file:///private/owned/' + ownedAppName(runId) + '/';
const requireJournal = (path: string) => readFileSync(path, 'utf8');

function fakeDevice(options: { collision?: boolean; installFails?: boolean; uninstallFails?: boolean; device?: typeof device } = {}) {
  const changes: string[][] = [], launches: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
  let installed = Boolean(options.collision);
  const commands: DeviceCommands = {
    read(args) {
      if (args[0] === 'list') return successful({ devices: [options.device ?? device] });
      if (args.includes('apps')) return successful({ apps: installed ? [{ url: appUrl }] : [] });
      return successful({ runningProcesses: [] });
    },
    change(args) {
      changes.push(args);
      if (args.includes('install')) { if (options.installFails) throw new Error('install refused'); installed = true; }
      if (args.includes('uninstall')) { if (options.uninstallFails) throw new Error('uninstall refused'); installed = false; }
    },
    launch(args, env) { launches.push({ args, env }); return {} as ChildProcessWithoutNullStreams; },
  };
  return { owned: new OwnedIosDevice(receipt(), 'test-device', commands), changes, launches };
}

test('Apple plist reader preserves profile dates and certificate data without JSON conversion', () => {
  const row = parseApplePlist('<?xml version="1.0"?><plist version="1.0"><dict><key>ExpirationDate</key><date>2035-01-01T00:00:00Z</date><key>DeveloperCertificates</key><array><data>dGVz\ndA==</data></array><key>enabled</key><true/></dict></plist>');
  assert.deepEqual(row, { ExpirationDate: '2035-01-01T00:00:00Z', DeveloperCertificates: ['dGVzdA=='], enabled: true });
  for (const xml of ['<plist><array/></plist>', '<plist><dict><key>x</key></dict></plist>', '<plist><dict><key>x</key><true/><key>x</key><false/></dict></plist>']) assert.throws(() => parseApplePlist(xml));
});

test('unique product packaging keeps the real scene and removes every handler before signing', () => {
  const normal = { CFBundleIdentifier: 'tools.lolly.mobile', CFBundleExecutable: 'lolly-mobile', UIApplicationSceneManifest: scene,
    UIRequiredDeviceCapabilities: ['arm64', 'metal'], NSCameraUsageDescription: 'existing purpose', ...Object.fromEntries(IOS_REGISTRATIONS.map(key => [key, [{ existing: true }]])) };
  const own = sanitizeIosInfo(normal, runId); validateIosInfo(own, runId, scene);
  assert.equal(normal.CFBundleIdentifier, 'tools.lolly.mobile'); assert.ok(Object.hasOwn(normal, 'CFBundleURLTypes'));
  assert.deepEqual(own.UIRequiredDeviceCapabilities, normal.UIRequiredDeviceCapabilities); assert.equal(own.NSCameraUsageDescription, normal.NSCameraUsageDescription);
  assert.throws(() => validateIosInfo(normal, runId, scene));
  assert.throws(() => validateIosInfo({ ...own, UIApplicationSceneManifest: {} }, runId, scene));
  assert.throws(() => validateIosInfo({ ...own, CFBundleExecutable: '../Lolly' }, runId, scene));
  assert.deepEqual(iosProbeConfig(runId), { identifier, productName: 'Lolly WebGPU Product Qualification', bundle: { createUpdaterArtifacts: false, fileAssociations: [] } });
});

test('development signing requires the separate app, matching physical device and unexpired profile', () => {
  const entitlements = validateProfile(profile, identifier, 'test-physical-device'); validateSignedEntitlements(entitlements, profile, runId, 'test-physical-device');
  assert.equal(entitlements['application-identifier'], 'TESTTEAM00.' + identifier);
  assert.throws(() => validateProfile(profile, identifier, 'other-device'));
  for (const patch of [{ Platform: ['macOS'] }, { ExpirationDate: '2000-01-01' }, { ProvisionedDevices: [] },
    { Entitlements: { ...profile.Entitlements, 'get-task-allow': false } },
    { Entitlements: { ...profile.Entitlements, 'application-identifier': 'TESTTEAM00.tools.lolly.mobile' } }]) {
    assert.throws(() => validateProfile({ ...profile, ...patch }, identifier, 'test-physical-device'));
  }
  assert.throws(() => validateSignedEntitlements({ ...entitlements, 'application-identifier': 'TESTTEAM00.tools.lolly.mobile' }, profile, runId));
  assert.throws(() => validateSignedEntitlements({ ...entitlements, 'com.apple.security.application-groups': ['shared'] }, profile, runId));
});

test('immutable source and complete owned artifact hashes are required before device use', async () => {
  requireSourceSha('a'.repeat(40), 'a'.repeat(40));
  for (const [expected, actual] of [['main', 'main'], ['a'.repeat(40), 'b'.repeat(40)], ['A'.repeat(40), 'A'.repeat(40)]]) assert.throws(() => requireSourceSha(expected!, actual!));
  const parent = resolve(root, 'plans/295-validation/ios-product-source-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'artifact-'));
  try {
    const row = receipt(); row.app = join(output, ownedAppName(runId)); row.binary = join(row.app, 'Lolly');
    await mkdir(row.app); await writeFile(row.binary, 'owned-test-binary'); await writeFile(join(row.app, 'Info.plist'), 'owned-info');
    row.binarySha256 = sha256(await readFile(row.binary)); row.appSha256 = await appDigest(row.app);
    await validateReceiptFiles(row, output);
    await writeFile(join(row.app, 'Info.plist'), 'modified'); await assert.rejects(validateReceiptFiles(row, output), /app changed/);
    await symlink(row.binary, join(row.app, 'ambiguous-link')); await assert.rejects(appDigest(row.app), /links/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('physical lane refuses simulator, unavailable developer services, ambiguous identity and inventory failures', () => {
  assert.equal(physicalDevice(successful({ devices: [device] }), 'test-device').osVersion, '27.2');
  for (const row of [{ ...device, hardwareProperties: { ...device.hardwareProperties, reality: 'simulated' } },
    { ...device, deviceProperties: { ...device.deviceProperties, ddiServicesAvailable: false } },
    { ...device, connectionProperties: { pairingState: 'unpaired' } }]) assert.throws(() => physicalDevice(successful({ devices: [row] }), 'test-device'));
  assert.throws(() => physicalDevice(successful({ devices: [device, device] }), 'test-device'));
  assert.throws(() => requireAbsentApp({ info: { outcome: 'failure' } }));
  assert.throws(() => requireAbsentApp(successful({ apps: [{}] })));
  assert.throws(() => requireAbsentApp(successful({ unknownApps: [] })));
});

test('install requires successful collision preflight; failed install never grants cleanup ownership', () => {
  const ordinary = fakeDevice(); assert.throws(() => ordinary.owned.install(), /preflight/); assert.equal(ordinary.changes.length, 0);
  const existing = fakeDevice({ collision: true }); assert.throws(() => existing.owned.preflight(), /already installed/); existing.owned.cleanup(); assert.equal(existing.changes.length, 0);
  const failed = fakeDevice({ installFails: true }); failed.owned.preflight(); assert.throws(() => failed.owned.install(), /install refused/);
  failed.owned.cleanup(); assert.equal(failed.changes.length, 1); assert.equal(failed.owned.ownsInstall, false);
});

test('successful installation is cleaned on corpus failure and cleanup failure retains ownership', () => {
  const owned = fakeDevice(); owned.owned.preflight(); owned.owned.install();
  try { throw new Error('simulated corpus failure'); } catch { owned.owned.cleanup(); }
  assert.equal(owned.changes.length, 2); assert.deepEqual(owned.changes[1]?.slice(0, 3), ['device', 'uninstall', 'app']); assert.equal(owned.owned.ownsInstall, false);
  const failed = fakeDevice({ uninstallFails: true }); failed.owned.preflight(); failed.owned.install(); assert.throws(() => failed.owned.cleanup(), /cleanup/); assert.equal(failed.owned.ownsInstall, true);
});

test('cleanup rechecks the installed URL after process inventory and preserves a replacement', () => {
  const fixture = fakeDevice(), normalRead = fixture.owned.commands.read;
  let replaced = false;
  fixture.owned.commands.read = args => {
    if (replaced && args.includes('apps')) return successful({ apps: [{ url: 'file:///private/replacement/' + ownedAppName(runId) + '/' }] });
    const reply = normalRead(args);
    if (args.includes('processes')) replaced = true;
    return reply;
  };
  fixture.owned.preflight(); fixture.owned.install(); assert.throws(() => fixture.owned.cleanup(), /cleanup/);
  assert.equal(fixture.changes.length, 1); assert.equal(fixture.owned.ownsInstall, true);
  assert.equal(fixture.owned.ownership.state, 'cleanup-blocked'); assert.equal(fixture.owned.ownership.appUrl, appUrl);
});

test('incomplete install responses retain explicit ownership and never authorize an uncertain delete', () => {
  for (const cliSucceeded of [true, false]) {
    const fixture = fakeDevice(), normalChange = fixture.owned.commands.change;
    fixture.owned.commands.change = args => {
      if (args.includes('install')) {
        if (cliSucceeded) normalChange(args);
        throw new DeviceMutationError(cliSucceeded);
      }
      normalChange(args);
    };
    fixture.owned.preflight(); assert.throws(() => fixture.owned.install(), /incomplete/);
    assert.equal(fixture.owned.ownership.state, cliSucceeded ? 'installed-unverified' : 'install-uncertain');
    assert.equal(fixture.owned.ownership.needsInspection, true); assert.equal(fixture.owned.ownsInstall, cliSucceeded);
    assert.throws(() => fixture.owned.install(), /once|previous/);
    fixture.owned.cleanup();
    assert.equal(fixture.changes.length, cliSucceeded ? 2 : 0);
    assert.equal(fixture.owned.ownership.state, cliSucceeded ? 'removed-verified' : 'install-uncertain');
  }
  const postRead = fakeDevice(), normalRead = postRead.owned.commands.read;
  let reads = 0;
  postRead.owned.commands.read = args => {
    if (args.includes('apps') && ++reads >= 3) throw new Error('installed app reply incomplete');
    return normalRead(args);
  };
  postRead.owned.preflight(); assert.throws(() => postRead.owned.install(), /reply incomplete/);
  assert.equal(postRead.owned.ownership.state, 'installed-unverified');
  assert.throws(() => postRead.owned.cleanup(), /cleanup/); assert.equal(postRead.changes.length, 1);
  assert.equal(postRead.owned.ownership.state, 'cleanup-blocked');
});

test('the durable journal records mutation boundaries and blocks install when persistence fails', async () => {
  const parent = resolve(root, 'plans/295-validation/ios-product-source-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'journal-'));
  try {
    const fixture = fakeDevice(), leasePath = join(output, 'owned-install.json');
    const row = physicalDevice(successful({ devices: [device] }), 'test-device');
    fixture.owned.observeOwnership(installJournal(leasePath, receipt(), row, fixture.owned));
    const normalChange = fixture.owned.commands.change, observations: string[] = [];
    fixture.owned.commands.change = args => {
      observations.push(JSON.parse(requireJournal(leasePath)).ownership.state); normalChange(args);
    };
    fixture.owned.preflight(); fixture.owned.install();
    const installed = JSON.parse(requireJournal(leasePath)) as IosInstallLease;
    assert.equal(installed.installed, true); assert.equal(installed.appUrl, appUrl); assert.equal(installed.ownership.state, 'installed-verified');
    fixture.owned.cleanup(); assert.deepEqual(observations, ['install-attempted', 'remove-attempted']);
    assert.equal(JSON.parse(requireJournal(leasePath)).ownership.state, 'removed-verified');
    assert.throws(() => installJournal(leasePath, receipt(), row, fixture.owned), /EEXIST/);
    const blocked = fakeDevice(); blocked.owned.preflight();
    blocked.owned.observeOwnership(state => { if (state.state === 'install-attempted') throw new Error('journal unavailable'); });
    assert.throws(() => blocked.owned.install(), /journal unavailable/); assert.equal(blocked.changes.length, 0);
    const interrupted = fakeDevice(), interruptedPath = join(output, 'interrupted.json');
    interrupted.owned.observeOwnership(installJournal(interruptedPath, receipt(), row, interrupted.owned));
    interrupted.owned.commands.change = () => { throw new DeviceMutationError(false); };
    interrupted.owned.preflight(); assert.throws(() => interrupted.owned.install()); interrupted.owned.cleanup();
    assert.equal(JSON.parse(requireJournal(interruptedPath)).ownership.state, 'install-uncertain');
    const incomplete = fakeDevice(), incompletePath = join(output, 'incomplete.json'), completeChange = incomplete.owned.commands.change;
    incomplete.owned.observeOwnership(installJournal(incompletePath, receipt(), row, incomplete.owned));
    incomplete.owned.commands.change = args => { completeChange(args); throw new DeviceMutationError(true); };
    incomplete.owned.preflight(); assert.throws(() => incomplete.owned.install());
    const incompleteLease = JSON.parse(requireJournal(incompletePath)) as IosInstallLease;
    assert.equal(incompleteLease.installed, true); assert.equal(incompleteLease.ownership.state, 'installed-unverified');
    assert.throws(() => incomplete.owned.cleanup());
    assert.equal(JSON.parse(requireJournal(incompletePath)).ownership.state, 'removed-unverified');
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('console launch uses the exact lease and two qualification vars without takeover or credential inheritance', () => {
  const owned = fakeDevice({ collision: true }); assert.throws(() => owned.owned.launch('/owned/console.json'), /lease/);
  assert.throws(() => owned.owned.allowInstalledConsole({ ...receipt(), installed: false, appUrl }));
  owned.owned.allowInstalledConsole({ ...receipt(), installed: true, appUrl });
  owned.owned.launch('/owned/console.json', { PATH: '/usr/bin', DEVICECTL_CHILD_SECRET: 'test-only', APPLE_PASSWORD: 'test-only' });
  const launch = owned.launches[0]!; assert.deepEqual(launch.env, { PATH: '/usr/bin' });
  assert.ok(launch.args.includes('--console')); assert.ok(!launch.args.includes('--terminate-existing')); assert.equal(launch.args.at(-1), identifier);
  assert.deepEqual(JSON.parse(launch.args[launch.args.indexOf('--environment-variables') + 1]!), { LOLLY_WEBGPU_PRODUCT_PROBE: runId, LOLLY_WEBGPU_QUALIFICATION_BUILD: '1' });
  assert.throws(() => owned.owned.launch('/owned/second.json'), /previous/);
  assert.deepEqual(consoleEnvironment({ PATH: '/usr/bin', LOLLY_CATALOG_SIGNING_KEY: 'test-only' }), { PATH: '/usr/bin' });
});

test('process cleanup cannot claim a foreign executable or malformed PID', () => {
  const appUrl = 'file:///private/owned/' + ownedAppName(runId) + '/';
  assert.equal(installedAppUrl(successful({ apps: [{ url: appUrl }] }), ownedAppName(runId)), appUrl);
  assert.throws(() => installedAppUrl(successful({ apps: [{ url: 'file:///private/regular/Lolly.app/' }] }), ownedAppName(runId)));
  assert.throws(() => installedAppUrl(successful({ apps: [{ unknownUrl: appUrl }] }), ownedAppName(runId)));
  assert.deepEqual(ownedProcesses(successful({ runningProcesses: [{ executable: '/private/owned/' + ownedAppName(runId) + '/Lolly', processIdentifier: 42 }] }), 'file:///private/owned/' + ownedAppName(runId) + '/'), [42]);
  assert.deepEqual(ownedProcesses(successful({ runningProcesses: [{ executable: '/other/Lolly.app/Lolly', processIdentifier: 42 }] }), 'file:///private/owned/' + ownedAppName(runId) + '/'), []);
  assert.throws(() => ownedProcesses(successful({ runningProcesses: [{ executable: '/private/owned/' + ownedAppName(runId) + '/Lolly', processIdentifier: 0 }] }), 'file:///private/owned/' + ownedAppName(runId) + '/'));
});

test('corpus interruption and fixed deadline terminate only the newly created group and remove listeners', async () => {
  for (const kind of ['interrupt', 'deadline', 'exit'] as const) {
    const child = Object.assign(new EventEmitter(), { pid: 321, exitCode: null as number | null, signalCode: null });
    const signals = new EventEmitter(), kills: Array<[number, NodeJS.Signals]> = [];
    let timeout: (() => void) | undefined, cleared = false;
    const pending = waitOwnedCorpus(child as unknown as ChildProcessWithoutNullStreams, {
      signals, clock: { set(callback, ms) { assert.equal(ms, PRODUCT_CORPUS_MS); assert.equal(ms, 120_000); timeout = callback; return 42; }, clear(handle) { assert.equal(handle, 42); cleared = true; } },
      killGroup(pid, signal) { kills.push([pid, signal]); child.exitCode = 0; child.emit('exit', 0); },
    });
    if (kind === 'interrupt') signals.emit('SIGINT');
    else if (kind === 'deadline') timeout!();
    else { child.exitCode = 0; child.emit('exit', 0); }
    if (kind === 'exit') assert.equal(await pending, 0);
    else await assert.rejects(pending, kind === 'interrupt' ? /interrupted/ : /deadline/);
    assert.ok(cleared); assert.ok(kills.length > 0 && kills.every(([pid, signal]) => pid === 321 && signal === 'SIGTERM'));
    assert.equal(signals.listenerCount('SIGINT'), 0); assert.equal(signals.listenerCount('SIGTERM'), 0);
  }
});

test('forced corpus teardown waits for actual exit and fails boundedly if SIGKILL has no exit', async () => {
  for (const stubborn of [false, true]) {
    const child = Object.assign(new EventEmitter(), { pid: 321, exitCode: null as number | null, signalCode: null as NodeJS.Signals | null });
    const signals = new EventEmitter(), timers: Array<{ callback: () => void; ms: number; cleared: boolean }> = [], kills: NodeJS.Signals[] = [];
    let settled = false;
    const pending = waitOwnedCorpus(child as unknown as ChildProcessWithoutNullStreams, {
      signals, clock: { set(callback, ms) { const timer = { callback, ms, cleared: false }; timers.push(timer); return timer; }, clear(handle) { (handle as typeof timers[number]).cleared = true; } },
      killGroup(pid, signal) { assert.equal(pid, 321); kills.push(signal); },
    });
    const observed = pending.then(() => { settled = true; }, error => { settled = true; return error; });
    signals.emit('SIGTERM'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false); timers.find(timer => timer.ms === 3000 && !timer.cleared)!.callback();
    await new Promise(resolve => setImmediate(resolve)); assert.ok(kills.includes('SIGKILL')); assert.equal(settled, false);
    if (stubborn) timers.find(timer => timer.ms === 3000 && !timer.cleared)!.callback();
    else { child.signalCode = 'SIGKILL'; child.emit('exit', null, 'SIGKILL'); }
    const error = await observed; assert.match(String(error), stubborn ? /did not exit/ : /interrupted/);
    assert.ok(timers.every(timer => timer.cleared)); assert.equal(signals.listenerCount('SIGTERM'), 0);
  }
});

test('iOS handshake reports unavailable WebKit facts honestly while macOS validation remains strict', async () => {
  const ready = { event: 'ready', runId, identifier, url: 'tauri://localhost/', nativeUrl: 'tauri://localhost/', runtime: 'unavailable: test bundle missing', secureContext: true, os: 'ios', architecture: 'aarch64' };
  const frame = (row: unknown) => 'LOLLY_WEBGPU_PRODUCT ' + JSON.stringify(row);
  assert.deepEqual(decodeProductMessage(frame(ready), runId, 'ios'), ready);
  assert.throws(() => decodeProductMessage(frame(ready), runId));
  for (const patch of [{ os: 'macos' }, { architecture: 'x86_64' }, { nativeUrl: 'http://localhost/' }, { runId: 'wrong' }]) assert.throws(() => decodeProductMessage(frame({ ...ready, ...patch }), runId, 'ios'));
  const protocol = new ProductProbeProtocol(runId, () => {}, () => {}, () => {}, 'ios'); protocol.receive(frame(ready));
  const pending = protocol.request('() => true'); protocol.receive(frame({ event: 'reply', runId, reply: { id: 1, value: true } })); assert.equal(await pending, true);
  assert.equal(webGpuBrowserEngine('tauri-product-ios'), 'tauri-product-ios');
  const report = { engine: 'tauri-product-ios', status: 'conformance passed', productStartup: [ready] };
  assert.equal(completeIosRuntime(report), false);
  assert.equal(completeIosRuntime({ ...report, productStartup: [{ ...ready, runtime: 'actual-system-webkit-build' }] }), true);
  for (const patch of [{ engine: 'tauri-product-macos' }, { status: 'not run' }, { productStartup: [] }]) assert.equal(completeIosRuntime({ ...report, ...patch }), false);
});

test('ordinary mobile builds omit the probe and retain the native dispatcher, scene and CSP', async () => {
  assert.equal(productProbeOptions({}), null); assert.equal(webGpuProductProbe({ root, env: {} }), null);
  const lib = await readFile(join(root, 'shells/tauri-mobile/src-tauri/src/lib.rs'), 'utf8');
  assert.match(lib, /#\[cfg\(feature = "webgpu-probe"\)\]\s*#\[path = "\.\.\/\.\.\/\.\.\/tauri-shared\/webgpu-product-broker.rs"\]/);
  assert.match(lib, /normal\(invoke\)/); assert.match(lib, /mobile_poll_events,\s*mobile_take_open_file/);
  assert.doesNotMatch(lib, /incognito\(|background_throttling\(|use_https_scheme\(/);
  const config = JSON.parse(await readFile(join(root, 'shells/tauri-mobile/src-tauri/tauri.conf.json'), 'utf8'));
  assert.equal(config.identifier, 'tools.lolly.mobile'); assert.equal(config.app.security.csp, null); assert.equal(config.app.security.devCsp, null);
  const info = parseApplePlist(await readFile(join(root, 'shells/tauri-mobile/src-tauri/Info.ios.plist'), 'utf8')); assert.deepEqual(info.UIApplicationSceneManifest, scene);
});
