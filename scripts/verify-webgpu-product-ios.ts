// SPDX-License-Identifier: MPL-2.0
/** Prepare/build locally; only explicit --run may install the owned physical-iPhone app. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productProbeIdentity } from '../shells/tauri-shared/webgpu-product-probe.mjs';
import { assertProductCsp, assertProductSourcesUnchanged, productEnvironment, productSourceReceipt } from './verify-webgpu-product.ts';
import { MARKER_FILE, writeMarker } from './webgpu-qualification.ts';
import { installJournal, OwnedIosDevice } from './lib/webgpu-ios-device.ts';
import { waitOwnedCorpus } from './lib/webgpu-product-corpus.ts';
import { appDigest, completeIosRuntime, ownedAppName, parseApplePlist, requireSourceSha, sanitizeIosInfo, sha256, validateIosInfo, validateProfile,
  validateReceiptFiles, validateSignedEntitlements, type IosProductReceipt } from './lib/webgpu-ios-product.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const mobile = join(repo, 'shells/tauri-mobile');
export const IOS_PRODUCT_SOURCES = [
  'scripts/verify-webgpu-product-ios.ts', 'scripts/verify-webgpu-product.ts', 'scripts/build-native.ts', 'scripts/build-release-web.ts',
  'scripts/lib/webgpu-ios-product.ts', 'scripts/lib/webgpu-ios-device.ts', 'scripts/lib/webgpu-product-corpus.ts', 'scripts/webgpu-qualification.ts',
  'tests/helpers/webgpu-product-receiver.ts', 'tests/helpers/webgpu-product-ios-receiver.ts', 'tests/helpers/webgpu-browser.ts',
  'tests/helpers/lut-cases.ts', 'tests/helpers/webgpu-probe-entry.ts', 'tests/webgpu-lut.browser.test.ts',
  'shells/tauri-shared/embedded-js-mime.rs', 'shells/tauri-shared/tauri-embedded-assets.rs',
  'shells/tauri-shared/webgpu-product-probe.mjs', 'shells/tauri-shared/webgpu-product-broker.rs', 'shells/tauri-shared/vite-csp.mjs',
  'shells/tauri-mobile/vite.config.js', 'shells/tauri-mobile/package.json', 'shells/tauri-mobile/pnpm-lock.yaml',
  'shells/tauri-mobile/src-tauri/Cargo.toml', 'shells/tauri-mobile/src-tauri/Cargo.lock', 'shells/tauri-mobile/src-tauri/src/lib.rs',
  'shells/tauri-mobile/src-tauri/tauri.conf.json', 'shells/tauri-mobile/src-tauri/Info.ios.plist',
  'shells/tauri-mobile/src-tauri/gen/apple/project.yml', 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile.xcodeproj/project.pbxproj',
  'shells/tauri-mobile/src-tauri/gen/apple/Sources/lolly-mobile/main.mm', 'shells/tauri-mobile/src-tauri/gen/apple/lolly-mobile_iOS/PrivacyInfo.xcprivacy',
  'shells/tauri-mobile/bridge-overrides/state.ts', 'shells/tauri-mobile/bridge-overrides/assets.ts',
  'shells/web/src/main.ts', 'shells/web/src/lib/webgpu/device.ts', 'shells/web/src/lib/webgpu/lut.ts', 'shells/web/src/lib/webgpu/workspace.ts',
  'shells/web/src/bridge/photo-look-bake.ts', 'shells/web/src/bridge/photo-look.worker.ts', 'package.json', 'pnpm-lock.yaml',
] as const;

export function iosProbeConfig(runId: string): Record<string, unknown> {
  return { identifier: productProbeIdentity(runId), productName: 'Lolly WebGPU Product Qualification',
    bundle: { createUpdaterArtifacts: false, fileAssociations: [] } };
}

function local(command: string, args: string[], input?: string): string {
  const result = spawnSync(command, args, { encoding: 'utf8', input, timeout: 20_000, maxBuffer: 4 * 1024 * 1024 });
  assert.ok(!result.error && result.status === 0, 'Local iOS artifact or signing verification failed.');
  return result.stdout;
}
function plistXml(xml: string): Record<string, unknown> {
  return parseApplePlist(xml);
}
function plistFile(path: string): Record<string, unknown> {
  return parseApplePlist(local('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', path]));
}
function profileFile(path: string): Record<string, unknown> {
  return plistXml(local('/usr/bin/security', ['cms', '-D', '-i', path]));
}

async function signedAppChecks(receipt: IosProductReceipt, udid?: string): Promise<void> {
  const normalScene = plistFile(join(mobile, 'src-tauri/Info.ios.plist')).UIApplicationSceneManifest;
  validateIosInfo(plistFile(join(receipt.app, 'Info.plist')), receipt.runId, normalScene);
  const profile = profileFile(join(receipt.app, 'embedded.mobileprovision'));
  validateSignedEntitlements(plistXml(local('/usr/bin/codesign', ['-d', '--entitlements', ':-', receipt.app])), profile, receipt.runId, udid);
  assert.equal(sha256(await readFile(join(receipt.app, 'embedded.mobileprovision'))), receipt.signing.profileSha256);
  local('/usr/bin/codesign', ['--verify', '--deep', '--strict', receipt.app]);
}

async function archiveApp(started: number): Promise<string> {
  const archives: string[] = [];
  const walk = async (dir: string, depth = 0): Promise<void> => {
    if (depth > 6) return;
    for (const item of await readdir(dir, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const path = join(dir, item.name);
      if (item.name.endsWith('.xcarchive')) {
        if ((await stat(path)).mtimeMs >= started) archives.push(path);
      } else await walk(path, depth + 1);
    }
  };
  await walk(join(mobile, 'src-tauri/gen/apple/build'));
  assert.equal(archives.length, 1, 'The build must produce exactly one new owned archive.');
  const apps = join(archives[0]!, 'Products/Applications');
  const names = (await readdir(apps)).filter(name => name.endsWith('.app'));
  assert.equal(names.length, 1, 'The archive must contain exactly one app.');
  return join(apps, names[0]!);
}

async function signOwnedApp(app: string, output: string, runId: string, profilePath: string, identity: string): Promise<IosProductReceipt['signing']> {
  assert.match(identity, /^[A-Fa-f0-9]{40}$/, 'Choose one existing Apple Development certificate fingerprint.');
  const identities = local('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
  assert.ok(new RegExp(`${identity}\\s+"Apple Development:`, 'i').test(identities), 'The selected valid Apple Development identity is unavailable.');
  const profile = profileFile(profilePath), entitlements = validateProfile(profile, productProbeIdentity(runId));
  assert.ok((profile.DeveloperCertificates as string[]).some(cert => createHash('sha1').update(Buffer.from(cert, 'base64')).digest('hex') === identity.toLowerCase()), 'The selected identity is absent from the profile.');
  const info = plistFile(join(app, 'Info.plist'));
  const sanitized = sanitizeIosInfo(info, runId);
  const normalScene = plistFile(join(mobile, 'src-tauri/Info.ios.plist')).UIApplicationSceneManifest;
  validateIosInfo(sanitized, runId, normalScene);
  await writeFile(join(app, 'Info.plist'), JSON.stringify(sanitized));
  local('/usr/bin/plutil', ['-convert', 'xml1', join(app, 'Info.plist')]);
  await cp(profilePath, join(app, 'embedded.mobileprovision'));
  const path = join(output, 'development-entitlements.plist');
  await writeFile(path, JSON.stringify(entitlements), { flag: 'wx', mode: 0o600 });
  local('/usr/bin/plutil', ['-convert', 'xml1', path]);
  let frameworks: string[] = [];
  try { frameworks = await readdir(join(app, 'Frameworks')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  for (const name of frameworks.filter(name => name.endsWith('.framework') || name.endsWith('.dylib')).sort()) {
    local('/usr/bin/codesign', ['--force', '--sign', identity, '--timestamp=none', join(app, 'Frameworks', name)]);
  }
  local('/usr/bin/codesign', ['--force', '--sign', identity, '--timestamp=none', '--entitlements', path, app]);
  return { profileSha256: sha256(await readFile(profilePath)), identitySha1: identity.toLowerCase(), expires: String(profile.ExpirationDate), development: true };
}

function argument(argv: string[], name: string): string | undefined { return argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3); }

async function prepare(output: string, sourceSha: string): Promise<void> {
  const sources = await productSourceReceipt(repo, IOS_PRODUCT_SOURCES);
  requireSourceSha(sourceSha, String(sources.sourceSha)); assert.equal(sources.sourceDirty, '', 'Prepare from a clean reviewed source tree.');
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const runId = randomUUID(), config = iosProbeConfig(runId);
  writeMarker(output); await writeFile(join(output, 'probe-config.json'), JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(output, 'environment.json'), JSON.stringify({ version: 1, platform: 'ios', runId, identifier: config.identifier,
    date: new Date().toISOString(), status: 'prepared; no build, device install or launch', release: false, sources, sourceSha,
    scope: 'Instrumented mobile product with normal scene, custom protocol, shared CSP, startup, storage and default GPU preferences. Device use needs explicit --run. Catalog/release signing remains disabled; local development signing is required for a physical device.' }, null, 2) + '\n', { flag: 'wx' });
}

async function buildProduct(output: string, receipt: IosProductReceipt & Record<string, unknown>, argv: string[]): Promise<void> {
  assert.equal(receipt.status, 'prepared; no build, device install or launch', 'Build only an unused prepared qualification.');
  const profile = argument(argv, 'profile'), identity = argument(argv, 'identity');
  assert.ok(profile && identity, '--build requires an existing --profile file and --identity fingerprint; no provisioning is performed.');
  assert.ok(process.env.CI === undefined || process.env.CI === 'true' || process.env.CI === 'false', 'Tauri requires CI to be absent or the literal true or false.');
  await stat(join(mobile, 'node_modules/@tauri-apps/cli/tauri.js'));
  receipt.buildTools = { node: process.version, xcode: local('xcodebuild', ['-version']).trim(),
    iphoneSdk: local('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']).trim(),
    rustc: local('rustc', ['--version', '--verbose']).trim(), cargo: local('cargo', ['--version']).trim(),
    rustupToolchain: process.env.RUSTUP_TOOLCHAIN ?? null,
    tauriCli: JSON.parse(await readFile(join(mobile, 'node_modules/@tauri-apps/cli/package.json'), 'utf8')).version };
  const config = join(output, 'probe-config.json');
  assert.deepEqual(JSON.parse(await readFile(config, 'utf8')), iosProbeConfig(receipt.runId));
  const before = await productSourceReceipt(repo, IOS_PRODUCT_SOURCES); assertProductSourcesUnchanged(receipt.sources, before);
  const env = { ...productEnvironment(process.env, receipt.runId), CARGO_TARGET_DIR: join(output, 'target'), LOLLY_KEEP_NATIVE_CACHE: '1' };
  const started = Date.now(), log = openSync(join(output, 'build.log'), 'wx');
  try {
    const run = spawnSync(process.execPath, ['scripts/build-native.ts', 'mobile', 'ios', '--target', 'aarch64', '--features', 'webgpu-probe', '--no-sign', '--archive-only', '--config', config],
      { cwd: repo, env, stdio: ['ignore', log, log], timeout: 1_800_000 });
    assert.ok(!run.error && run.status === 0, 'The archive build failed; inspect the owned build log.');
  } finally { closeSync(log); }
  const after = await productSourceReceipt(repo, IOS_PRODUCT_SOURCES); assertProductSourcesUnchanged(before, after);
  const frontend = join(mobile, 'dist'); assertProductCsp(await readFile(join(frontend, 'index.html'), 'utf8'));
  const marker = JSON.parse(await readFile(join(frontend, 'webgpu-product-probe.json'), 'utf8'));
  assert.equal(marker.runId, receipt.runId); assert.equal(marker.identifier, receipt.identifier);
  assert.ok((await readFile(join(frontend, MARKER_FILE), 'utf8')).includes('Not for release'));
  const app = join(output, ownedAppName(receipt.runId)); await cp(await archiveApp(started), app, { recursive: true, errorOnExist: true, force: false });
  writeMarker(app);
  const signing = await signOwnedApp(app, output, receipt.runId, resolve(profile), identity);
  const binary = join(app, String(plistFile(join(app, 'Info.plist')).CFBundleExecutable));
  Object.assign(receipt, { app, binary, binarySha256: sha256(await readFile(binary)), appSha256: await appDigest(app), signing,
    status: 'built and development signed; not installed or launched', sources: { ...after, compiledAssetsSha256: await appDigest(frontend) } });
  await signedAppChecks(receipt);
}

async function runProduct(output: string, receipt: IosProductReceipt & Record<string, unknown>, argv: string[]): Promise<number> {
  assert.equal(receipt.status, 'built and development signed; not installed or launched');
  const deviceId = argument(argv, 'device'); assert.ok(deviceId, '--run requires one exact --device identifier.');
  const env = productEnvironment(process.env, receipt.runId);
  await validateReceiptFiles(receipt, output); await signedAppChecks(receipt);
  const sources = await productSourceReceipt(repo, IOS_PRODUCT_SOURCES); assertProductSourcesUnchanged(receipt.sources, sources);
  const owned = new OwnedIosDevice(receipt, deviceId), device = owned.preflight();
  await signedAppChecks(receipt, device.udid); await validateReceiptFiles(receipt, output);
  const lease = join(output, 'owned-install.json');
  owned.observeOwnership(installJournal(lease, receipt, device, owned));
  let code = 1;
  try {
    owned.install();
    const log = openSync(join(output, 'conformance.log'), 'wx');
    try {
      const child = spawn(process.execPath, ['--test', 'tests/webgpu-lut.browser.test.ts'], { cwd: repo, detached: true, stdio: ['ignore', log, log],
        env: { ...env, LOLLY_WEBGPU_BROWSER: 'tauri-product-ios', LOLLY_WEBGPU_SOURCE_SHA: String(sources.sourceSha),
          LOLLY_WEBGPU_PRODUCT_BINARY: receipt.binary, LOLLY_WEBGPU_PRODUCT_RECEIPT: join(output, 'environment.json'), LOLLY_WEBGPU_IOS_LEASE: lease,
          LOLLY_WEBGPU_REQUIRED: '1', LOLLY_WEBGPU_REPORT: join(output, 'conformance.json') } });
      code = await waitOwnedCorpus(child);
    } finally { closeSync(log); }
  } finally {
    try { owned.cleanup(); } finally { receipt.installOwnership = owned.ownership; }
  }
  receipt.status = code === 0 ? 'physical product corpus passed; owned app removed' : 'physical product corpus failed; owned app removed';
  receipt.device = { physical: true, productType: device.productType, osVersion: device.osVersion, osBuild: device.osBuild, identifierSha256: sha256(device.identifier) };
  if (code === 0) {
    const report = JSON.parse(await readFile(join(output, 'conformance.json'), 'utf8'));
    receipt.runtimeProvenanceComplete = completeIosRuntime(report);
    if (!receipt.runtimeProvenanceComplete) { receipt.status = 'physical corpus passed; runtime provenance incomplete; owned app removed'; return 1; }
  }
  return code;
}

export async function verifyIosProduct(argv = process.argv.slice(2)): Promise<number> {
  assert.equal(process.platform, 'darwin', 'Physical iPhone qualification requires this Mac and its existing Apple tooling.');
  const modes = argv.filter(value => ['--prepare', '--build', '--run'].includes(value));
  assert.equal(modes.length, 1, 'Choose exactly one explicit prepare, build or run step.');
  for (const value of argv) assert.ok(['--prepare', '--build', '--run'].includes(value) || /^--(output|profile|identity|device)=.+$/.test(value), 'Unknown physical-product argument.');
  const requested = argument(argv, 'output'); assert.ok(requested, 'Select the exact owned --output directory.');
  const output = resolve(repo, requested), sourceSha = process.env.LOLLY_WEBGPU_SOURCE_SHA ?? '';
  assert.equal(process.env.LOLLY_RELEASE_BUILD, undefined, 'Use a qualification invocation, not a release build.');
  requireSourceSha(sourceSha, local('git', ['-C', repo, 'rev-parse', 'HEAD']).trim());
  if (modes[0] === '--prepare') { await prepare(output, sourceSha); return 0; }
  const path = join(output, 'environment.json'), receipt = JSON.parse(await readFile(path, 'utf8')) as IosProductReceipt & Record<string, unknown>;
  assert.equal(receipt.identifier, productProbeIdentity(receipt.runId)); assert.equal(receipt.platform, 'ios');
  requireSourceSha(sourceSha, String(receipt.sources.sourceSha));
  let code = 0;
  try { if (modes[0] === '--build') await buildProduct(output, receipt, argv); else code = await runProduct(output, receipt, argv); }
  catch (error) { receipt.error = String(error); receipt.status = 'qualification failed; inspect evidence and cleanup status'; throw error; }
  finally { await writeFile(path, JSON.stringify(receipt, null, 2) + '\n'); }
  return code;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await verifyIosProduct(); } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
