// SPDX-License-Identifier: MPL-2.0
/** Source-bound product qualification. Preparing/building never launches or installs the app. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { productProbeIdentity, productProbeOptions } from '../shells/tauri-desktop/webgpu-product-probe.mjs';
import { TAURI_CSP } from '../shells/tauri-shared/vite-csp.mjs';
import { MARKER_FILE, assertQualificationAllowed, writeMarker } from './webgpu-qualification.ts';
import { runtimeOverrides } from './verify-webgpu-native.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const SOURCE_FILES = [
  'tests/webgpu-lut.browser.test.ts', 'tests/helpers/lut-cases.ts', 'tests/helpers/webgpu-probe-entry.ts',
  'tests/helpers/webgpu-product-receiver.ts', 'tests/helpers/webgpu-browser.ts',
  'shells/tauri-desktop/webgpu-product-probe.mjs', 'shells/tauri-desktop/vite.config.js',
  'shells/tauri-desktop/src-tauri/Cargo.toml', 'shells/tauri-desktop/src-tauri/Cargo.lock',
  'shells/tauri-desktop/src-tauri/src/lib.rs', 'shells/tauri-desktop/src-tauri/src/presentation_windows.rs',
  'shells/tauri-desktop/src-tauri/src/webgpu_qualification.rs', 'shells/tauri-desktop/src-tauri/tauri.conf.json',
  'package.json', 'pnpm-lock.yaml', 'shells/tauri-desktop/package.json', 'shells/tauri-desktop/pnpm-lock.yaml',
  'shells/tauri-desktop/src-tauri/Info.plist', 'scripts/build-native.ts', 'scripts/build-release-web.ts', 'scripts/webgpu-qualification.ts',
  'shells/web/src/main.ts', 'shells/web/src/lib/webgpu/device.ts', 'shells/web/src/lib/webgpu/lut.ts',
  'shells/web/src/lib/webgpu/workspace.ts', 'shells/web/src/bridge/photo-look-bake.ts', 'shells/web/src/bridge/photo-look.worker.ts',
  'shells/tauri-shared/vite-csp.mjs', 'scripts/verify-webgpu-product.ts',
] as const;

export function productEnvironment(env: NodeJS.ProcessEnv, runId: string): NodeJS.ProcessEnv {
  assertQualificationAllowed(env);
  assert.deepEqual(runtimeOverrides(env), {}, 'Product qualification refuses graphics/runtime preference overrides.');
  assert.ok(!env.LOLLY_WEBGPU_TEST_ADAPTER || env.LOLLY_WEBGPU_TEST_ADAPTER === 'default', 'Product qualification requires the default graphics adapter.');
  const result: NodeJS.ProcessEnv = { ...env, LOLLY_WEBGPU_PRODUCT_PROBE: runId, LOLLY_WEBGPU_QUALIFICATION_BUILD: '1', LOLLY_EMBED_CATALOG: 'neutral' };
  for (const key of ['LOLLY_CATALOG_SIGNING_KEY', 'VITE_CATALOG_PUBLIC_KEY_JWK', 'LOLLY_RELEASE_BUILD', 'VITE_CATALOG_TRUST_MODE',
    'APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_API_KEY', 'APPLE_API_ISSUER',
    'APPLE_API_KEY_PATH', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID', 'TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD']) delete result[key];
  productProbeOptions(result);
  return result;
}

export function productConfig(runId: string): Record<string, unknown> {
  return { identifier: productProbeIdentity(runId), productName: 'Lolly WebGPU Product Qualification',
    bundle: { createUpdaterArtifacts: false, fileAssociations: [], macOS: { files: null } } };
}

function git(args: string[], cwd = repo): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Product qualification source inventory failed.');
  return result.stdout;
}

export function isGeneratedInfoCss(path: string): boolean {
  return /^shells\/web\/public\/info\/docs\.[A-Za-z0-9_-]{16}\.css$/.test(path);
}

export function assertProductSourcesUnchanged(before: Record<string, unknown>, after: Record<string, unknown>): void {
  assert.equal(after.sourceSha, before.sourceSha, 'The product source commit changed.');
  assert.deepEqual(after.sourceFiles, before.sourceFiles, 'Product qualification inputs changed.');
  assert.equal(after.workingDiffSha256, before.workingDiffSha256, 'Working source changed.');
  assert.deepEqual(after.untrackedSourceFiles, before.untrackedSourceFiles, 'Untracked source changed.');
}

export function assertProductBuildSource(sourceDirty: unknown, workingTree: boolean): void {
  if (sourceDirty && !workingTree) throw new Error('Use a clean isolated source tree or explicitly record --working-tree for a development qualification build.');
}

export async function productSourceReceipt(sourceRoot = repo, sourceFiles: readonly string[] = SOURCE_FILES): Promise<Record<string, unknown>> {
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], sourceRoot).split('\0').filter(Boolean).sort();
  const tracked = git(['ls-files', '-z'], sourceRoot).split('\0').filter(Boolean);
  const generated = [...new Set([...tracked, ...untracked].filter(isGeneratedInfoCss))].sort();
  const generatedInfoCss: Record<string, { sha256: string; bytes: number } | null> = {};
  for (const path of generated) {
    try {
      const bytes = await readFile(join(sourceRoot, path));
      const fingerprint = createHash('sha256').update(bytes).digest('base64url').slice(0, 16);
      assert.ok(path.endsWith(`/docs.${fingerprint}.css`), 'A generated documentation CSS name must match its content fingerprint.');
      generatedInfoCss[path] = { sha256: hash(bytes), bytes: bytes.length };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      generatedInfoCss[path] = null;
    }
  }
  const fullDiff = git(['diff', '--binary', 'HEAD'], sourceRoot);
  const inputDiff = git(['diff', '--binary', 'HEAD', '--', '.', ...generated.map(path => `:(exclude,literal)${path}`)], sourceRoot);
  return { sourceSha: git(['rev-parse', 'HEAD'], sourceRoot).trim(), sourceDirty: git(['status', '--porcelain'], sourceRoot).trimEnd(),
    fullWorkingDiffSha256: hash(fullDiff), workingDiffSha256: hash(inputDiff), generatedInfoCss,
    untrackedSourceFiles: Object.fromEntries(await Promise.all(untracked.filter(path => !isGeneratedInfoCss(path))
      .map(async path => [path, hash(await readFile(join(sourceRoot, path)))]))),
    sourceFiles: Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, hash(await readFile(join(sourceRoot, path)))]))),
    cspSha256: hash(TAURI_CSP), desktopLockSha256: hash(await readFile(join(sourceRoot, 'shells/tauri-desktop/src-tauri/Cargo.lock'))) };
}

export function assertProductCsp(html: string): void {
  const dom = new JSDOM(html);
  try {
    const policies = [...dom.window.document.querySelectorAll('meta[http-equiv]')]
      .filter(meta => meta.getAttribute('http-equiv')?.toLowerCase() === 'content-security-policy');
    assert.equal(policies.length, 1, 'The product must embed exactly one CSP meta policy.');
    assert.ok(dom.window.document.head.contains(policies[0]!), 'The product CSP must be in its effective document head.');
    assert.equal(policies[0]!.getAttribute('content'), TAURI_CSP, 'The exact shared CSP must be embedded in the product.');
  } finally { dom.window.close(); }
}

async function frontendReceipt(dir: string): Promise<Record<string, { sha256: string; bytes: number }>> {
  const assets: Record<string, { sha256: string; bytes: number }> = {};
  const walk = async (prefix: string): Promise<void> => {
    for (const item of await readdir(join(dir, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) await walk(path);
      else if (item.isFile()) {
        const bytes = await readFile(join(dir, path)); assets[path] = { sha256: hash(bytes), bytes: bytes.length };
      }
    }
  };
  await walk('');
  return assets;
}

export function productExecutableName(value: string): string {
  if (!/^[A-Za-z0-9_. -]+$/.test(value) || value === '.' || value === '..') throw new Error('The owned product executable name is invalid.');
  return value;
}

export async function markProductBundleRoot(appRoot: string): Promise<{ path: string; sha256: string }> {
  const path = writeMarker(appRoot);
  return { path, sha256: hash(await readFile(path)) };
}

function plist(args: string[]): string {
  const result = spawnSync('/usr/bin/plutil', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Owned unsigned product plist verification failed.');
  return result.stdout.trim();
}

async function removeRegistrations(app: string, identifier: string): Promise<Record<string, unknown>> {
  const path = join(app, 'Contents/Info.plist'), before = await readFile(path);
  assert.equal(plist(['-extract', 'CFBundleIdentifier', 'raw', path]), identifier, 'Only the owned qualification bundle may lose registrations.');
  const values = JSON.parse(plist(['-convert', 'json', '-o', '-', path])) as Record<string, unknown>;
  const removed: Record<string, unknown> = {};
  for (const key of ['CFBundleDocumentTypes', 'UTExportedTypeDeclarations', 'UTImportedTypeDeclarations', 'CFBundleURLTypes']) {
    if (Object.hasOwn(values, key)) { removed[key] = values[key]; plist(['-remove', key, path]); }
  }
  assert.equal(plist(['-extract', 'CFBundleIdentifier', 'raw', path]), identifier);
  return { infoPlistBeforeSha256: hash(before), infoPlistAfterSha256: hash(await readFile(path)), removed,
    scope: 'Registration metadata removed only from this generated unsigned test bundle; source/default bundles remain unchanged.' };
}

export async function verifyProduct(argv: string[] = process.argv.slice(2)): Promise<number> {
  const mode = argv.includes('--run') ? 'run' : argv.includes('--build') ? 'build' : 'prepare';
  assert.ok(!(argv.includes('--run') && argv.includes('--build')), 'Build and native launch are separate explicit steps.');
  for (const arg of argv) assert.ok(['--prepare', '--build', '--run', '--working-tree'].includes(arg) || arg.startsWith('--output='), `Unknown product qualification argument: ${arg}`);
  if (process.platform !== 'darwin') throw new Error('This bundled product qualification currently targets macOS.');
  const requested = argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length);
  if (mode === 'run' && !requested) throw new Error('--run requires the exact prepared --output directory.');
  const output = resolve(repo, requested ?? `plans/295-validation/product-probe-development/${randomUUID()}`);
  await mkdir(output, { recursive: true });
  const receiptPath = join(output, 'environment.json');
  const before = await productSourceReceipt();
  if (mode === 'run') {
    const receipt = JSON.parse(await readFile(receiptPath, 'utf8')) as {
      runId: string; binary: string; binarySha256: string; sources: Record<string, unknown>; status: string; sourceBeforeRun?: Record<string, unknown>;
    };
    assert.equal(receipt.binarySha256, hash(await readFile(receipt.binary)), 'The source-bound product binary changed.');
    receipt.sourceBeforeRun = before;
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    assertProductSourcesUnchanged(receipt.sources, before);
    const env = { ...productEnvironment(process.env, receipt.runId), LOLLY_WEBGPU_BROWSER: 'tauri-product-macos',
      LOLLY_WEBGPU_PRODUCT_BINARY: receipt.binary, LOLLY_WEBGPU_PRODUCT_RECEIPT: receiptPath,
      LOLLY_WEBGPU_REQUIRED: '1', LOLLY_WEBGPU_REPORT: join(output, 'conformance.json') };
    const log = openSync(join(output, 'conformance.log'), 'w');
    let result: ReturnType<typeof spawnSync>;
    try {
      result = spawnSync(process.execPath, ['--test', 'tests/webgpu-lut.browser.test.ts'], { cwd: repo, env,
        stdio: ['ignore', log, log], timeout: 120_000 });
    } finally { closeSync(log); }
    receipt.status = result.status === 0 ? 'conformance passed' : 'conformance failed';
    await writeFile(receiptPath, JSON.stringify({ ...receipt, corpusExitCode: result.status,
      ...(result.error ? { error: String(result.error) } : {}) }, null, 2) + '\n');
    if (result.error) throw result.error;
    return result.status ?? 1;
  }
  const runId = randomUUID(), env = productEnvironment(process.env, runId), config = productConfig(runId);
  const configPath = join(output, 'probe-config.json'), target = join(output, 'target');
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
  const outputMarker = writeMarker(output);
  const toolVersions: Record<string, unknown> = { node: process.version };
  for (const [tool, args] of [['rustc', ['--version']], ['cargo', ['--version']], ['pnpm', ['--version']]] as const) {
    const version = spawnSync(tool, [...args], { encoding: 'utf8', timeout: 10_000 });
    toolVersions[tool] = { status: version.status, version: version.stdout?.trim() ?? '', ...(version.error ? { error: String(version.error) } : {}) };
  }
  const receipt: Record<string, unknown> = { version: 1, date: new Date().toISOString(), runId, identifier: config.identifier, toolVersions,
    qualificationMarkers: { output: { path: outputMarker, sha256: hash(await readFile(outputMarker)) } },
    status: 'prepared; native product not built or launched', release: false, sources: before, sourceBeforeBuild: before, config,
    scope: 'Instrumented source-bound unsigned desktop build with normal GUI startup, window configuration, CSP and default GPU preferences. No installed application or other platform is qualified.',
    commands: { build: ['node', 'scripts/verify-webgpu-product.ts', '--build', `--output=${output}`],
      run: ['node', 'scripts/verify-webgpu-product.ts', '--run', `--output=${output}`] } };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  if (mode === 'prepare') { console.log(`Prepared only; no build or app launch: ${receiptPath}`); return 0; }
  assertProductBuildSource(before.sourceDirty, argv.includes('--working-tree'));
  const log = openSync(join(output, 'build.log'), 'w');
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync(process.execPath, ['scripts/build-native.ts', 'desktop', 'build', '--features', 'webgpu-probe', '--bundles', 'app', '--no-sign', '--config', configPath],
      { cwd: repo, env: { ...env, CARGO_TARGET_DIR: target }, stdio: ['ignore', log, log], timeout: 1_800_000 });
  } finally { closeSync(log); }
  receipt.buildExitCode = result.status;
  const after = await productSourceReceipt();
  receipt.sourceAfterBuild = after;
  if (result.error || result.status !== 0) {
    receipt.status = 'build failed; native product not launched'; receipt.error = String(result.error ?? `exit ${result.status}`);
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
    throw new Error(`Product qualification build failed; see ${join(output, 'build.log')}.`);
  }
  receipt.status = 'built; artifact verification pending; native product not launched';
  const appRoot = join(target, 'release/bundle/macos');
  const bundleMarker = await markProductBundleRoot(appRoot);
  receipt.qualificationMarkers = { ...(receipt.qualificationMarkers as Record<string, unknown>), bundle: bundleMarker };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  assertProductSourcesUnchanged(before, after);
  const apps = (await readdir(appRoot)).filter(name => name.endsWith('.app'));
  assert.equal(apps.length, 1, 'The owned product build must contain exactly one app.');
  const app = join(appRoot, apps[0]!);
  receipt.registrationCleanup = await removeRegistrations(app, String(config.identifier));
  const binary = join(app, 'Contents/MacOS', productExecutableName(plist(['-extract', 'CFBundleExecutable', 'raw', join(app, 'Contents/Info.plist')])));
  const frontend = join(repo, 'shells/tauri-desktop/dist');
  const marker = JSON.parse(await readFile(join(frontend, 'webgpu-product-probe.json'), 'utf8')) as { runId: string; identifier: string };
  assert.equal(marker.runId, runId); assert.equal(marker.identifier, config.identifier);
  const frontendMarker = join(frontend, MARKER_FILE);
  receipt.qualificationMarkers = { ...(receipt.qualificationMarkers as Record<string, unknown>),
    frontend: { path: frontendMarker, sha256: hash(await readFile(frontendMarker)) } };
  const html = await readFile(join(frontend, 'index.html'), 'utf8');
  assertProductCsp(html);
  receipt.status = 'built; native product not launched'; receipt.binary = binary; receipt.binarySha256 = hash(await readFile(binary));
  receipt.sources = { ...after, compiledAssets: await frontendReceipt(frontend) };
  await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Built only; explicit --run is still required: ${receiptPath}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await verifyProduct(); } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
