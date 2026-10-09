// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
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
import { archiveProvenance, guardedXcodeArgs, iosArchiveEnvironment, compilerMetadata, compilerProvenance, prepareIosObjectCopyTools, verifyIosObjectCopyTools, type IosBuildGuard } from '../scripts/lib/webgpu-ios-build.ts';
import { collectOwnedProcesses, sameProcess, stopOwnedBuild, runOwnedBuild, processFacts, IOS_BUILD_MS, type ProcessFact } from '../scripts/lib/webgpu-ios-process.ts';
import { expectedAppleProject, expectedAppleInfo, validateAppleDerivatives, validateIosSourceChanges, IOS_APPLE_INPUTS } from '../scripts/lib/webgpu-ios-generated.ts';

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

const archiveGuard = { workspace: '/owned/apple/lolly-mobile.xcodeproj/project.xcworkspace/', archive: '/owned/apple/build/lolly-mobile_iOS' };
const archiveArgs = () => ['CODE_SIGNING_REQUIRED=NO', 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGN_IDENTITY=""', 'CODE_SIGN_ENTITLEMENTS=""',
  '-scheme', 'lolly-mobile_iOS', '-workspace', archiveGuard.workspace, '-sdk', 'iphoneos', '-configuration', 'release', 'archive', '-archivePath', archiveGuard.archive];

const executableIdentity = async (path: string) => {
  const row = await stat(path);
  return { path, sha256: sha256(await readFile(path)), size: row.size, mtimeMs: row.mtimeMs, inode: row.ino, device: row.dev };
};
async function fakeObjectCopyTools(sysroot: string, host: string, alias = true): Promise<{ llvm: string; rust: string }> {
  const bin = join(sysroot, 'lib/rustlib', host, 'bin'); await mkdir(bin, { recursive: true });
  const llvm = join(bin, 'llvm-objcopy'), rust = join(bin, 'rust-objcopy');
  const text = '#!/bin/sh\nprintf "LLVM version 23.1.1\\n"\n';
  await writeFile(llvm, text, { mode: 0o700 });
  if (alias) await symlink('llvm-objcopy', rust); else await writeFile(rust, text, { mode: 0o700 });
  return { llvm, rust };
}
async function fakeObjectCopyCompiler(sysroot: string, host: string): Promise<string> {
  const bin = join(sysroot, 'bin'); await mkdir(bin, { recursive: true });
  const rustc = join(bin, 'rustc');
  await writeFile(rustc, `#!${process.execPath}\nconst args = process.argv.slice(2);\n` +
    `if (args.join(' ') === '--print sysroot') console.log(${JSON.stringify(sysroot)});\n` +
    `else if (args.join(' ') === '--version --verbose') console.log(${JSON.stringify('rustc 1.99.0\nhost: ' + host)});\n` +
    `else process.exit(9);\n`, { mode: 0o700 });
  return rustc;
}

test('object-copy preflight binds selected Apple host tools and aliases without changing process defaults', async () => {
  const parent = join(root, 'plans/295-validation/ios-object-copy-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'selected-')), env = { ...process.env };
  try {
    for (const host of ['aarch64-apple-darwin', 'x86_64-apple-darwin']) {
      const sysroot = join(output, host), rustc = await fakeObjectCopyCompiler(sysroot, host);
      const paths = await fakeObjectCopyTools(sysroot, host);
      const tools = await prepareIosObjectCopyTools(await executableIdentity(rustc));
      assert.equal(tools.sysroot, sysroot); assert.equal(tools.host, host);
      assert.equal(tools.llvmObjcopy.requestedPath, paths.llvm); assert.equal(tools.rustObjcopy.requestedPath, paths.rust);
      assert.equal(tools.rustObjcopy.executable.path, paths.llvm);
      assert.equal(tools.llvmObjcopy.executable.sha256, sha256(await readFile(paths.llvm)));
      assert.match(tools.rustObjcopy.version, /LLVM version 23\.1\.1/);
      await verifyIosObjectCopyTools(tools);
    }
    assert.ok(JSON.stringify({ ...process.env }) === JSON.stringify(env), 'The preflight changed process defaults.');
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('object-copy preflight refuses missing, nonexecutable, failed and unbounded tools before archive', async () => {
  const parent = join(root, 'plans/295-validation/ios-object-copy-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'refused-'));
  try {
    for (const name of ['llvm', 'rust'] as const) for (const fault of ['missing', 'nonexecutable', 'failed', 'unbounded', 'nonprintable']) {
      const sysroot = join(output, name + '-' + fault), rustc = await fakeObjectCopyCompiler(sysroot, 'aarch64-apple-darwin');
      const paths = await fakeObjectCopyTools(sysroot, 'aarch64-apple-darwin', false);
      if (fault === 'missing') await rm(paths[name]);
      else if (fault === 'nonexecutable') await chmod(paths[name], 0o600);
      else if (fault === 'failed') await writeFile(paths[name], '#!/bin/sh\nexit 7\n');
      else if (fault === 'unbounded') await writeFile(paths[name], '#!/bin/sh\nprintf "LLVM ' + 'x'.repeat(1025) + '"\n');
      else await writeFile(paths[name], '#!/bin/sh\nprintf "LLVM \\033bad"\n');
      await assert.rejects(prepareIosObjectCopyTools(await executableIdentity(rustc)));
    }
    const sysroot = join(output, 'nonapple'), rustc = await fakeObjectCopyCompiler(sysroot, 'x86_64-unknown-linux-gnu');
    await assert.rejects(prepareIosObjectCopyTools(await executableIdentity(rustc)), /Apple compiler host/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('object-copy identity recheck rejects replaced aliases and changed bytes despite a retained receipt', async () => {
  const parent = join(root, 'plans/295-validation/ios-object-copy-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'changed-'));
  try {
    const rustc = await fakeObjectCopyCompiler(output, 'aarch64-apple-darwin');
    const paths = await fakeObjectCopyTools(output, 'aarch64-apple-darwin');
    const tools = await prepareIosObjectCopyTools(await executableIdentity(rustc));
    await assert.rejects(verifyIosObjectCopyTools({ ...tools, llvmObjcopy: { ...tools.llvmObjcopy, executable: { ...tools.llvmObjcopy.executable, sha256: '0'.repeat(64) } } }), /executable changed/);
    await rm(paths.rust); await symlink(rustc, paths.rust);
    await assert.rejects(verifyIosObjectCopyTools(tools), /executable changed/);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('archive guard removes only the pinned provisioning flags and preserves every other argument', () => {
  const authored = archiveArgs();
  const guarded = guardedXcodeArgs([...authored.slice(0, 4), '-allowProvisioningUpdates', '-quiet', ...authored.slice(4, 12), '-allowProvisioningUpdates', ...authored.slice(12)], archiveGuard);
  assert.equal(guarded.removed, 2); assert.deepEqual(guarded.args, [...authored.slice(0, 4), '-quiet', ...authored.slice(4)]);
  assert.deepEqual(guardedXcodeArgs(authored, archiveGuard), { args: authored, removed: 0 });
  for (const bad of [authored.filter(arg => arg !== 'CODE_SIGNING_ALLOWED=NO'), authored.map(arg => arg === 'iphoneos' ? 'iphonesimulator' : arg),
    authored.map(arg => arg === 'archive' ? 'build' : arg), authored.map(arg => arg === archiveGuard.workspace ? '/another/workspace/' : arg),
    authored.map(arg => arg === archiveGuard.archive ? '/another/archive' : arg), authored.map(arg => arg === 'release' ? 'debug' : arg),
    [...authored, '-exportArchive'], [...authored, '-allowProvisioningDeviceRegistration'], [...authored, '-authenticationKeyPath', 'private-key'],
    [...authored, 'CODE_SIGNING_ALLOWED=YES'], [...authored, '-destination', 'physical-device']]) assert.throws(() => guardedXcodeArgs(bad, archiveGuard));
});

test('process-local compiler choice survives the pinned CLI CARGO/PATH filter without importing signing credentials', () => {
  const guard = { toolchain: '1.99.0', path: '/owned/wrappers:/installed/1.99/bin:/shims', target: '/owned/target',
    compilerWrapper: '/owned/wrappers/observe-rustc', rustc: { path: '/installed/1.99/bin/rustc' }, rustdoc: { path: '/installed/1.99/bin/rustdoc' } } as IosBuildGuard;
  const outer = { PATH: '/shims', RUSTUP_TOOLCHAIN: '1.96.0', RUSTC: '/shims/rustc', RUSTC_WRAPPER: '/unreviewed',
    IOS_CERTIFICATE: 'secret', IOS_CERTIFICATE_PASSWORD: 'secret', IOS_MOBILE_PROVISION: 'secret', APPLE_DEVELOPMENT_TEAM: 'other', TAURI_SIGNING_PRIVATE_KEY: undefined };
  const env = iosArchiveEnvironment(outer, guard, 'bound-source');
  assert.equal(outer.IOS_CERTIFICATE, 'secret', 'The user environment is not modified.');
  assert.equal(env.RUSTC, undefined); assert.equal(env.RUSTC_WRAPPER, undefined);
  for (const key of ['IOS_CERTIFICATE', 'IOS_CERTIFICATE_PASSWORD', 'IOS_MOBILE_PROVISION', 'APPLE_DEVELOPMENT_TEAM']) assert.equal(env[key], undefined);
  const nested = Object.fromEntries(Object.entries(env).filter(([key]) => /^(?:CARGO_|RUST_|TAURI_|WRY_)/.test(key) || key === 'PATH'));
  assert.equal(nested.RUSTUP_TOOLCHAIN, undefined, 'The primary-source CLI filter drops this variable.');
  assert.equal(nested.CARGO_BUILD_RUSTC, guard.rustc.path); assert.equal(nested.CARGO_BUILD_RUSTC_WRAPPER, guard.compilerWrapper);
  assert.equal(nested.CARGO_BUILD_RUSTC_WORKSPACE_WRAPPER, ''); assert.equal(nested.CARGO_LOLLY_IOS_BUILD_BINDING, 'bound-source');
  assert.equal(nested.PATH, guard.path);
});

test('compiler metadata is bounded and excludes argument values while protecting output scope', () => {
  const guard = { target: '/owned/target' };
  const args = ['--crate-name', 'lolly_mobile_lib', '--target', 'aarch64-apple-ios', '--out-dir', '/owned/target/dep', '--cfg', 'private-argument'];
  const row = compilerMetadata(args, guard);
  assert.equal(row.crate, 'lolly_mobile_lib'); assert.equal(row.target, 'aarch64-apple-ios'); assert.equal(row.operation, 'compile');
  assert.equal(row.argvSha256, sha256(JSON.stringify(args))); assert.equal(row.argumentCount, args.length); assert.equal(row.ownedOutputCount, 1);
  assert.equal(row.inputCount, 0, 'A private cfg value is not a source input.');
  assert.ok(!JSON.stringify(row).includes('private-argument')); assert.ok(!JSON.stringify(row).includes('/owned/target/dep'));
  assert.equal(compilerMetadata(['-vV'], guard).operation, 'information');
  for (const bad of [['--crate-name', 'a'.repeat(129)], ['--target', 'ios-simulator'], ['--out-dir', '/owned/target-other'], ['-o', '/outside/product'], ['--crate-name']]) assert.throws(() => compilerMetadata(bad, guard));
});

test('compiler identity and output flags accept attached forms and refuse ambiguity or output escapes', () => {
  const guard = { target: '/owned/target' };
  for (const args of [['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps'],
    ['--crate-name', 'lolly_mobile_lib', '--target', 'aarch64-apple-ios', '-o/owned/target/product'],
    ['--crate-name=lolly_mobile_lib', '--emit=link,dep-info=/owned/target/deps/product.d']]) {
    const row = compilerMetadata(args, guard); assert.equal(row.crate, 'lolly_mobile_lib'); assert.equal(row.operation, 'compile');
    assert.equal(row.ownedOutputCount, 1); assert.equal(row.argvSha256, sha256(JSON.stringify(args)));
  }
  for (const args of [['--crate-name=x', '--crate-name', 'x'], ['--target=aarch64-apple-ios', '--target', 'aarch64-apple-ios'],
    ['--out-dir=/owned/target/a', '--out-dir', '/owned/target/b'], ['-o/owned/target/a', '-o', '/owned/target/b'],
    ['--crate-name='], ['--out-dir', '--target=aarch64-apple-ios'], ['-o=/owned/target/x'], ['--out-dir=../escape'],
    ['--out-dir=/owned/target/../escape'], ['-o/owned/target-other/x'], ['-o/owned/target/\0x'], ['--emit=dep-info=/outside/x'],
    ['--emit=link,link'], ['--emit=link=/owned/target/x=extra'], ['--emit=llvm-ir=-'], ['@private-response'],
    ['--cfg', '@private-response'], ['--', 'private.rs'], ['--print=sysroot=/owned/target/x'], ['--print', 'cfg=/outside/x'],
    ['--print=cfg', '--print', 'cfg'], ['--version', '-V'], ['-vV', '--verbose'], ['--version=private'], ['--version', 'private.rs'],
    ['--help', '--out-dir=/owned/target/x'], ['--version', '--print=cfg']]) assert.throws(() => compilerMetadata(args, guard));
});

test('only an exact input-free compiler information grammar permits nonzero query roles', () => {
  const guard = { target: '/owned/target' };
  for (const args of [['--version'], ['-V'], ['-vV'], ['--version', '--verbose'], ['-v', '-V'], ['--help'], ['-h'],
    ['--print=sysroot'], ['--print', 'cfg', '--target=aarch64-apple-ios'], ['--print=host-tuple', '--print', 'target-list'],
    ['--print=split-debuginfo'], ['--print=deployment-target']]) assert.equal(compilerMetadata(args, guard).operation, 'information');
  for (const args of [['--print=native-static-libs'], ['--print=link-args'], ['--print=file-names'], ['--print=crate-name'],
    ['--print=target-spec-json'], ['--print=all-target-specs-json'], ['--print=cfg', 'private.rs'],
    ['--print=cfg', '--crate-name=___', '-'], ['--print=cfg', '--emit=metadata'], ['--print=cfg', '-Copt-level=3'],
    ['--print=private-selector'], ['--print=cfg', '--private-option=secret'], ['--verbose']]) {
    const row = compilerMetadata(args, guard); assert.notEqual(row.operation, 'information');
    assert.ok(!JSON.stringify(row).includes('private-selector')); assert.ok(!JSON.stringify(row).includes('secret'));
  }
  for (const args of [[], Array.from({ length: 4097 }, () => 'x'), ['x'.repeat(16385)]]) assert.throws(() => compilerMetadata(args, guard));
});

test('compiler provenance retains nonzero pure queries but refuses failed, unclassified and incomplete compilation', async () => {
  const parent = join(root, 'plans/295-validation/ios-compiler-provenance-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'metadata-'));
  try {
    const compilerRecords = join(output, 'records'); await mkdir(compilerRecords);
    const rustc = join(output, 'compiler-witness'); await writeFile(rustc, 'not executed');
    const guard = { compilerRecords, sourceSha: 'a'.repeat(40), rustc: { path: rustc, sha256: sha256(await readFile(rustc)) } } as IosBuildGuard;
    const binding = 'source-bound-test', target = { target: '/owned/target' };
    const base = { binding, sourceSha: guard.sourceSha, executable: rustc, executableSha256: guard.rustc.sha256, status: 'completed' };
    const product = { ...base, ...compilerMetadata(['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps', 'product.rs'], target), exit: 0 };
    const query = { ...base, ...compilerMetadata(['--print=cfg', '--target=aarch64-apple-ios'], target), exit: 1 };
    const productPath = join(compilerRecords, '11111111-1111-4111-8111-111111111111.json'), queryName = '22222222-2222-4222-8222-222222222222.json';
    const queryPath = join(compilerRecords, queryName); await writeFile(productPath, JSON.stringify(product)); await writeFile(queryPath, JSON.stringify(query));
    const accepted = await compilerProvenance(guard, binding); assert.equal(accepted.invocationCount, 2); assert.equal(accepted.nonzeroInformationQueries, 1);
    assert.equal(JSON.parse(await readFile(queryPath, 'utf8')).exit, 1, 'The observed nonzero outcome is preserved.');
    for (const patch of [{ operation: 'unclassified' }, { status: 'started' }, { argvSha256: 'missing' }, { argumentCount: 4096 },
      { querySelectors: ['native-static-libs'] }, { flags: ['--print'] }, { exit: -1 }, { metadataVersion: undefined },
      { flags: ['--print', 'private-argument'] }]) {
      await writeFile(queryPath, JSON.stringify({ ...query, ...patch })); await assert.rejects(compilerProvenance(guard, binding));
    }
    const unknown = { ...base, ...compilerMetadata(['--print=private-selector'], target), exit: 1 };
    await writeFile(queryPath, JSON.stringify(unknown));
    await assert.rejects(compilerProvenance(guard, binding), error => {
      assert.ok(error instanceof Error); assert.ok(error.message.includes(queryName)); assert.ok(error.message.includes('unclassified'));
      assert.ok(error.message.includes('unknown')); assert.ok(!error.message.includes('private-selector')); return true;
    });
    await writeFile(queryPath, JSON.stringify(query));
    for (const patch of [{ exit: 1 }, { status: 'started' }, { operation: 'information' }, { ownedOutputCount: 0 }, { crate: null }]) {
      await writeFile(productPath, JSON.stringify({ ...product, ...patch })); await assert.rejects(compilerProvenance(guard, binding));
    }
    for (const args of [['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps', '--print=cfg', 'product.rs'],
      ['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps', '--explain', 'E0123', 'product.rs'],
      ['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps', '-Chelp', 'product.rs'],
      ['--crate-name=lolly_mobile_lib', '--target=aarch64-apple-ios', '--out-dir=/owned/target/deps', '--cfg', 'private.rs']]) {
      await writeFile(productPath, JSON.stringify({ ...base, ...compilerMetadata(args, target), exit: 0 }));
      await assert.rejects(compilerProvenance(guard, binding), /No completed physical-product compiler invocation/);
    }
  } finally { await rm(output, { recursive: true, force: true }); }
});

const projectIds = ['A'.repeat(24), 'B'.repeat(24)];
const projectModel = { objects: { target: { isa: 'PBXNativeTarget', name: 'lolly-mobile_iOS', buildConfigurationList: 'configs' },
  configs: { isa: 'XCConfigurationList', buildConfigurations: projectIds },
  [projectIds[0]!]: { isa: 'XCBuildConfiguration', name: 'debug' }, [projectIds[1]!]: { isa: 'XCBuildConfiguration', name: 'release' } } };
const projectText = () => projectIds.map((id, i) => `\t\t${id} /* ${i ? 'release' : 'debug'} */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = tools.lolly.mobile;\n\t\t\t\tPRODUCT_NAME = "Lolly";\n\t\t\t\tDEVELOPMENT_TEAM = EXISTING00;\n\t\t\t};\n\t\t};`).join('\n') + '\n// ordinary build script and other settings\n';

test('Apple generated project permits exactly app-target identity assignments, preserving all other bytes', () => {
  const original = { project: projectText(), info: 'original plist bytes' };
  const expected = expectedAppleProject(original.project, projectModel, runId);
  const info = { CFBundleShortVersionString: '1.1.0', CFBundleVersion: '1.1.0', UIApplicationSceneManifest: scene };
  const actual = { project: expected, info: 'generated plist bytes' };
  const proof = validateAppleDerivatives(original, actual, projectModel, info, structuredClone(info), runId);
  assert.deepEqual(proof.project, { inputSha256: sha256(original.project), outputSha256: sha256(expected) });
  for (const changed of [expected.replace('EXISTING00', 'REPLACED00'), expected.replace('ordinary build script', 'new script'), expected + '\n',
    expected.replace(identifier, 'tools.lolly.mobile')]) assert.throws(() => validateAppleDerivatives(original, { ...actual, project: changed }, projectModel, info, info, runId));
  assert.throws(() => expectedAppleProject(original.project, { objects: { ...projectModel.objects, other: projectModel.objects.target } }, runId));
  assert.throws(() => expectedAppleProject(original.project, { objects: { ...projectModel.objects, configs: { ...projectModel.objects.configs, buildConfigurations: [projectIds[0]] } } }, runId));
});

test('Info derivation follows the pinned shallow overlay order and agvtool version without weakening the normal scene', () => {
  const baseline = { CFBundleShortVersionString: '1.0.9', CFBundleVersion: '1.0.9', retained: ['normal'], nested: { a: true, b: true }, CFBundleURLTypes: ['normal-link'] };
  const expected = expectedAppleInfo(baseline, '1.1.0', [{ nested: { c: true }, overwritten: 'first' }, { UIApplicationSceneManifest: scene, overwritten: 'last' }]);
  assert.deepEqual(expected.nested, { c: true }); assert.equal(expected.overwritten, 'last'); assert.deepEqual(expected.retained, ['normal']);
  assert.equal(expected.CFBundleVersion, '1.1.0'); assert.equal(expected.CFBundleShortVersionString, '1.1.0'); assert.deepEqual(expected.CFBundleURLTypes, ['normal-link']);
  const original = { project: projectText(), info: 'baseline' }, actual = { project: expectedAppleProject(original.project, projectModel, runId), info: 'output' };
  for (const patch of [{ UIApplicationSceneManifest: {} }, { CFBundleVersion: '2' }, { CFBundleURLTypes: [] }, { extra: true }])
    assert.throws(() => validateAppleDerivatives(original, actual, projectModel, expected, { ...expected, ...patch }, runId));
});

test('two verified generated outputs do not exempt other tracked, untracked, CSP or lock inputs', () => {
  const before = { sourceDirty: '', sourceSha: 'a'.repeat(40), sourceFiles: { [IOS_APPLE_INPUTS.project]: 'original-pbx', [IOS_APPLE_INPUTS.info]: 'original-info', 'normal.rs': 'normal' },
    untrackedSourceFiles: {}, generatedInfoCss: {}, cspSha256: 'csp', desktopLockSha256: 'lock' };
  const after = { ...before, sourceDirty: ' M project', sourceFiles: { ...before.sourceFiles, [IOS_APPLE_INPUTS.project]: 'generated-pbx', [IOS_APPLE_INPUTS.info]: 'generated-info' } };
  validateIosSourceChanges(before, after, Object.values(IOS_APPLE_INPUTS));
  for (const changed of [{ ...after, sourceSha: 'b'.repeat(40) }, { ...after, cspSha256: 'relaxed' }, { ...after, desktopLockSha256: 'other' },
    { ...after, untrackedSourceFiles: { 'new-source.rs': 'new' } }, { ...after, sourceFiles: { ...after.sourceFiles, 'normal.rs': 'modified' } }])
    assert.throws(() => validateIosSourceChanges(before, changed, Object.values(IOS_APPLE_INPUTS)));
  assert.throws(() => validateIosSourceChanges(before, after, [...Object.values(IOS_APPLE_INPUTS), 'another-file.rs']));
});

const actor: ProcessFact = { pid: 3101, parent: 1, group: 3101, born: 'Fri Oct 9 04:00:00 2026', executable: '/owned/builder' };

test('build ownership adopts descendants only from live anchors and refuses a reused PID or foreign group', () => {
  const child = { ...actor, pid: 3102, parent: 3101, group: 3102, executable: '/owned/script' };
  assert.deepEqual(collectOwnedProcesses([actor], [actor, child]), [actor, child]);
  const replacement = { ...actor, born: 'Fri Oct 9 04:00:01 2026' };
  assert.equal(sameProcess(actor, replacement), false);
  assert.deepEqual(collectOwnedProcesses([actor], [replacement, child]), [actor]);
  assert.deepEqual(collectOwnedProcesses([], [replacement, child], [actor]), []);
});

test('build teardown waits for exit after KILL and never signals a replacement process', async () => {
  let now = [actor], killed = false, polls = 0;
  const sent: string[] = [];
  await stopOwnedBuild([actor], () => now, (_pid, signal) => { sent.push(signal); if (signal === 'SIGKILL') killed = true; }, async () => { if (killed && ++polls === 2) now = []; });
  assert.deepEqual(sent, ['SIGTERM', 'SIGKILL']); assert.equal(polls, 2);
  const replacement = { ...actor, born: 'new process' };
  await stopOwnedBuild([actor], () => [replacement], () => { assert.fail('must preserve a replacement'); }, async () => {});
  await assert.rejects(stopOwnedBuild([actor], () => [actor], () => {}, async () => {}), /remains after bounded/);
});

test('owned build supervisor cleans a real detached test process without native build or device use', async () => {
  assert.equal(IOS_BUILD_MS, 1_800_000);
  const parent = join(root, 'plans/295-validation/ios-build-process-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'run-'));
  try {
    const protectedGroup = processFacts().find(row => row.pid === process.pid)!.group;
    const code = await runOwnedBuild({ command: process.execPath, args: ['-e', 'setTimeout(() => process.exit(7), 180)'], cwd: root, env: {}, stdio: ['ignore', 'inherit', 'inherit'],
      leases: output, binding: 'source-test-only', deadline: Date.now() + 5000, supervise: true, protectedGroup });
    assert.equal(code, 7);
    const journals = await Promise.all((await readdir(output)).map(async file => JSON.parse(await readFile(join(output, file), 'utf8'))));
    assert.ok(journals.some(row => row.teardown === 'all observed owned descendants exited'));
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('real observer invocation preserves compiler arguments and records only safe completed metadata', async () => {
  const parent = join(root, 'plans/295-validation/ios-compiler-observer-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'observer-'));
  try {
    const bin = join(output, 'bin'), target = join(output, 'target'), leases = join(output, 'leases'), records = join(output, 'records');
    for (const path of [bin, target, leases, records]) await mkdir(path);
    const rustc = join(bin, 'rustc'), cargo = join(bin, 'cargo'), argvFile = join(output, 'actual-argv.json'), startedFile = join(output, 'started-metadata.json');
    await writeFile(rustc, `#!${process.execPath}\nimport { writeFileSync, readFileSync, readdirSync } from 'node:fs'; const args = process.argv.slice(2);\n` +
      `if (args.join(' ') === '--print sysroot') console.log(${JSON.stringify(output)});\n` +
      `else if (args.join(' ') === '--version --verbose') console.log('rustc 1.99.0\\nhost: aarch64-apple-darwin');\n` +
      `else { writeFileSync(process.env.TEST_ARGV_PATH, JSON.stringify(args));\n` +
      `writeFileSync(process.env.TEST_STARTED_PATH, JSON.stringify(readdirSync(process.env.TEST_RECORDS_PATH).map(name => JSON.parse(readFileSync(process.env.TEST_RECORDS_PATH + '/' + name, 'utf8'))).find(row => row.status === 'started')));\n` +
      `if (args.join(' ') === '--print=cfg') process.exitCode = 1; }\n`, { mode: 0o700 });
    await writeFile(cargo, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    const identity = executableIdentity;
    await fakeObjectCopyTools(output, 'aarch64-apple-darwin');
    const objectCopyTools = await prepareIosObjectCopyTools(await identity(rustc));
    const guard: IosBuildGuard = { version: 1, repo: root, output, runId, sourceSha: spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(),
      toolchain: 'test-observer-only', rustc: await identity(rustc), cargo: await identity(cargo), rustdoc: await identity(rustc), xcode: await identity(process.execPath),
      deadline: Date.now() + 20_000, helperSha256: sha256(await readFile(join(root, 'scripts/lib/webgpu-ios-build.ts'))),
      processHelperSha256: sha256(await readFile(join(root, 'scripts/lib/webgpu-ios-process.ts'))), ...archiveGuard, target,
      wrapperBin: bin, compilerWrapper: join(bin, 'observe-rustc'), leases, compilerRecords: records, path: bin + ':' + process.env.PATH,
      protectedGroup: processFacts().find(row => row.pid === process.pid)!.group, objectCopyTools };
    const bytes = JSON.stringify(guard), binding = sha256(bytes), path = join(output, 'build-guard.json'); await writeFile(path, bytes);
    const env = { ...iosArchiveEnvironment(process.env, guard, binding), TEST_ARGV_PATH: argvFile, TEST_STARTED_PATH: startedFile, TEST_RECORDS_PATH: records };
    const args = ['--crate-name', 'lolly_mobile_lib', '--target', 'aarch64-apple-ios', '--out-dir', join(target, 'deps'), '--cfg', 'private-argument-value', 'product.rs'];
    const run = spawnSync(process.execPath, ['scripts/lib/webgpu-ios-build.ts', '--rustc', path, rustc, ...args], { cwd: root, env, encoding: 'utf8', timeout: 25_000 });
    assert.equal(run.status, 0, run.stderr); assert.deepEqual(JSON.parse(await readFile(argvFile, 'utf8')), args);
    const started = JSON.parse(await readFile(startedFile, 'utf8')); assert.equal(started.status, 'started'); assert.equal(started.operation, 'compile');
    assert.equal(started.argvSha256, sha256(JSON.stringify(args))); assert.ok(!JSON.stringify(started).includes('private-argument-value'));
    const evidence = await compilerProvenance(guard, binding); assert.equal(evidence.invocationCount, 1);
    const archiveRecord = { sourceSha: guard.sourceSha, binding, executable: guard.xcode.path, executableSha256: guard.xcode.sha256,
      status: 'completed', exit: 0, command: archiveArgs(), provisioningFlagsRemoved: 2 };
    await writeFile(join(output, 'xcode-archive-command.json'), JSON.stringify(archiveRecord));
    assert.equal((await archiveProvenance(guard, binding)).completedUnsignedArchive, true);
    await assert.rejects(archiveProvenance({ ...guard, objectCopyTools: { ...objectCopyTools, llvmObjcopy: { ...objectCopyTools.llvmObjcopy,
      executable: { ...objectCopyTools.llvmObjcopy.executable, sha256: '0'.repeat(64) } } } }, binding), /executable changed/);
    await writeFile(path, JSON.stringify({ ...guard, objectCopyTools: { ...objectCopyTools, host: 'x86_64-apple-darwin' } }));
    const rebound = spawnSync(process.execPath, ['scripts/lib/webgpu-ios-build.ts', '--rustc', path, rustc, ...args], { cwd: root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(rebound.status, 1); assert.equal((await readdir(records)).length, 1);
    const changedGuard = { ...guard, objectCopyTools: { ...objectCopyTools, llvmObjcopy: { ...objectCopyTools.llvmObjcopy,
      executable: { ...objectCopyTools.llvmObjcopy.executable, sha256: '0'.repeat(64) } } } };
    const changedBytes = JSON.stringify(changedGuard), changedBinding = sha256(changedBytes);
    await writeFile(path, changedBytes); await rm(join(output, 'xcode-archive-command.json'));
    const refused = spawnSync(process.execPath, ['scripts/lib/webgpu-ios-build.ts', '--xcode', path, ...archiveArgs()], {
      cwd: root, env: iosArchiveEnvironment(process.env, changedGuard, changedBinding), encoding: 'utf8', timeout: 5000 });
    assert.equal(refused.status, 1); assert.ok(!(await readdir(output)).includes('xcode-archive-command.json'), 'Changed tools must fail before the archive starts.');
    await writeFile(join(output, 'xcode-archive-command.json'), JSON.stringify(archiveRecord));
    await writeFile(path, bytes);
    for (const patch of [{ status: 'started' }, { exit: 1 }, { command: [...archiveArgs(), '-allowProvisioningUpdates'] }, { provisioningFlagsRemoved: 3 }]) {
      await writeFile(join(output, 'xcode-archive-command.json'), JSON.stringify({ ...archiveRecord, ...patch })); await assert.rejects(archiveProvenance(guard, binding));
    }
    const recordName = (await readdir(records))[0]!;
    const recordText = await readFile(join(records, recordName), 'utf8'); assert.ok(!recordText.includes('private-argument-value'));
    const row = JSON.parse(recordText); assert.equal(row.exit, 0); assert.equal(row.status, 'completed'); assert.equal(row.target, 'aarch64-apple-ios');
    for (const patch of [{ status: 'started' }, { exit: 1 }, { sourceSha: 'b'.repeat(40) }, { executable: '/unreviewed/rustc' }, { crate: 'other_crate' }]) {
      await writeFile(join(records, recordName), JSON.stringify({ ...row, ...patch })); await assert.rejects(compilerProvenance(guard, binding));
    }
    await writeFile(join(records, recordName), recordText);
    const wrong = spawnSync(process.execPath, ['scripts/lib/webgpu-ios-build.ts', '--rustc', path, cargo, ...args], { cwd: root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(wrong.status, 1); assert.ok(!wrong.stderr.includes('private-argument-value')); assert.equal((await readdir(records)).length, 1);
    const queryArgs = ['--print=cfg'];
    const queryRun = spawnSync(process.execPath, ['scripts/lib/webgpu-ios-build.ts', '--rustc', path, rustc, ...queryArgs], { cwd: root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(queryRun.status, 1, queryRun.stderr); assert.deepEqual(JSON.parse(await readFile(argvFile, 'utf8')), queryArgs);
    const queryStarted = JSON.parse(await readFile(startedFile, 'utf8')); assert.equal(queryStarted.operation, 'information');
    assert.equal(queryStarted.status, 'started'); assert.equal(queryStarted.argvSha256, sha256(JSON.stringify(queryArgs)));
    const queries = await compilerProvenance(guard, binding); assert.equal(queries.invocationCount, 2); assert.equal(queries.nonzeroInformationQueries, 1);
  } finally { await rm(output, { recursive: true, force: true }); }
});

test('build timeout cleans an explicitly leased detached descendant and interruption removes signal listeners', async () => {
  const parent = join(root, 'plans/295-validation/ios-build-abort-tests'); await mkdir(parent, { recursive: true });
  const output = await mkdtemp(join(parent, 'abort-'));
  try {
    const protectedGroup = processFacts().find(row => row.pid === process.pid)!.group, binding = 'owned-abort-test';
    const script = join(output, 'build-fixture.mjs');
    await writeFile(script, `import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';\n` +
      `import { processFacts } from ${JSON.stringify(new URL('../scripts/lib/webgpu-ios-process.ts', import.meta.url).href)};\n` +
      `const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore' });\n` +
      `writeFileSync(${JSON.stringify(join(output, '11111111-1111-4111-8111-111111111111.json'))}, JSON.stringify({ binding: '${binding}', actors: processFacts().filter(row => row.pid === child.pid) }));\n` +
      `setInterval(() => {}, 1000);\n`);
    await assert.rejects(runOwnedBuild({ command: process.execPath, args: [script], cwd: root, env: {}, stdio: ['ignore', 'inherit', 'inherit'],
      leases: output, binding, deadline: Date.now() + 600, supervise: true, protectedGroup }), /deadline expired/);
    const rows = await Promise.all((await readdir(output)).filter(name => name.endsWith('.json')).map(async name => JSON.parse(await readFile(join(output, name), 'utf8'))));
    const known = rows.flatMap(row => row.actors ?? []) as ProcessFact[], current = processFacts();
    assert.ok(known.length >= 2, 'Both the direct builder and detached descendant have ownership evidence.');
    assert.ok(!known.some(row => current.some(now => sameProcess(row, now))));
    const interruptDir = join(output, 'interrupt'); await mkdir(interruptDir);
    const signals = new EventEmitter();
    const stop = setTimeout(() => signals.emit('SIGTERM'), 100);
    await assert.rejects(runOwnedBuild({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'], cwd: root, env: {}, stdio: ['ignore', 'inherit', 'inherit'],
      leases: interruptDir, binding, deadline: Date.now() + 5000, supervise: true, protectedGroup }, signals), /interrupted/);
    clearTimeout(stop); assert.equal(signals.listenerCount('SIGTERM'), 0); assert.equal(signals.listenerCount('SIGINT'), 0);
  } finally { await rm(output, { recursive: true, force: true }); }
});
