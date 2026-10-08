// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { productProbeIdentity, productProbeOptions, productProbeSource, webGpuProductProbe } from '../shells/tauri-desktop/webgpu-product-probe.mjs';
import { assertProductBuildSource, assertProductCsp, assertProductSourcesUnchanged, isGeneratedInfoCss, markProductBundleRoot, productConfig, productEnvironment, productExecutableName, productSourceReceipt } from '../scripts/verify-webgpu-product.ts';
import { assertNoMarkedBuild, MARKER_FILE } from '../scripts/webgpu-qualification.ts';
import { PRODUCT_COMMAND_LIMIT, PRODUCT_REPLY_LIMIT, ProductProbeProtocol, decodeProductMessage, isProductUrl } from './helpers/webgpu-product-receiver.ts';
import { TAURI_CSP, tauriCspMeta } from '../shells/tauri-shared/vite-csp.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = '4c3d9db0-f06e-4870-a75f-c4a2a1502bad';
const env = { LOLLY_WEBGPU_PRODUCT_PROBE: runId, LOLLY_WEBGPU_QUALIFICATION_BUILD: '1' };
const ready = { event: 'ready', runId, url: 'tauri://localhost/index.html', nativeUrl: 'tauri://localhost/',
  identifier: productProbeIdentity(runId), runtime: '622.1', secureContext: true, os: 'macos', architecture: 'aarch64' };
const line = (value: unknown) => 'LOLLY_WEBGPU_PRODUCT ' + JSON.stringify(value);

test('ordinary builds have no qualification plugin or module', () => {
  assert.equal(productProbeOptions({}), null);
  assert.equal(webGpuProductProbe({ root, env: {} }), null);
  assert.equal(productProbeOptions({ LOLLY_WEBGPU_PRODUCT_PROBE: '' }), null);
});

test('qualification activation refuses ambiguous IDs, release tags and signing inputs', () => {
  assert.deepEqual(productProbeOptions(env), { id: runId, identifier: productProbeIdentity(runId) });
  assert.throws(() => productProbeIdentity('not-an-id'), /UUID v4/);
  for (const overrides of [
    { LOLLY_WEBGPU_QUALIFICATION_BUILD: '0' }, { GITHUB_REF_TYPE: 'tag' }, { GITHUB_REF: 'refs/tags/v1.2.3' },
    { LOLLY_RELEASE_BUILD: '1' }, { LOLLY_CATALOG_SIGNING_KEY: 'test-only-value' },
    { VITE_CATALOG_PUBLIC_KEY_JWK: '{}' }, { VITE_CATALOG_TRUST_MODE: 'verified' },
  ]) assert.throws(() => productProbeOptions({ ...env, ...overrides }));
});

test('qualification configuration preserves runtime settings and excludes registration/extension packaging', () => {
  assert.deepEqual(productConfig(runId), { identifier: productProbeIdentity(runId), productName: 'Lolly WebGPU Product Qualification',
    bundle: { createUpdaterArtifacts: false, fileAssociations: [], macOS: { files: null } } });
  assert.equal(productExecutableName('lolly-desktop'), 'lolly-desktop');
  for (const name of ['../../Lolly', '.', '..', '/Applications/Lolly.app', 'a\nother']) assert.throws(() => productExecutableName(name));
  const configured = productEnvironment({ PATH: '/bin', LOLLY_CATALOG_SIGNING_KEY: 'test-only-value', LOLLY_RELEASE_BUILD: '1' }, runId);
  assert.equal(configured.PATH, '/bin'); assert.equal(configured.LOLLY_WEBGPU_QUALIFICATION_BUILD, '1');
  assert.equal(configured.LOLLY_CATALOG_SIGNING_KEY, undefined); assert.equal(configured.LOLLY_RELEASE_BUILD, undefined);
  const nativeKeys = ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY', 'APPLE_API_KEY', 'APPLE_API_ISSUER',
    'APPLE_API_KEY_PATH', 'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID', 'TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD'];
  const unsigned = productEnvironment(Object.fromEntries(nativeKeys.map(key => [key, 'test-only-value'])), runId);
  for (const key of nativeKeys) assert.equal(unsigned[key], undefined);
  for (const value of [{ WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--enable-unsafe-webgpu' }, { WEBKIT_DISABLE_DMABUF_RENDERER: '1' },
    { MESA_LOADER_DRIVER_OVERRIDE: 'zink' }, { LOLLY_WEBGPU_TEST_ADAPTER: 'swiftshader' }]) assert.throws(() => productEnvironment(value, runId));
});

test('generated app handoffs carry the qualification marker within publisher search depth', async () => {
  const parent = resolve(root, 'plans/295-validation/product-probe-development'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(resolve(parent, 'bundle-marker-'));
  try {
    const appRoot = resolve(fixture, 'target/release/bundle/macos');
    const marker = await markProductBundleRoot(appRoot);
    assert.equal(marker.path, resolve(appRoot, MARKER_FILE));
    assert.match(marker.sha256, /^[a-f0-9]{64}$/);
    assert.match(await readFile(marker.path, 'utf8'), /Not for release/);
    await mkdir(resolve(appRoot, 'Lolly WebGPU Product Qualification.app/Contents'), { recursive: true });
    assert.throws(() => assertNoMarkedBuild(appRoot, 'app handoff'), /Qualification builds are unsigned and never published/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test('product CSP verification compares the decoded effective policy exactly', () => {
  const policy = TAURI_CSP.replaceAll('&', '&amp;').replaceAll("'", '&#39;').replaceAll('"', '&quot;');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  assertProductCsp(`<!doctype html><html><head>${meta}</head><body></body></html>`);
  assertProductCsp(`<!doctype html><head>${meta.replace('Content-Security-Policy', 'CONTENT-SECURITY-POLICY')}</head>`);
  for (const html of [
    '<html><head></head></html>', `<html><head>${meta}${meta}</head></html>`,
    `<html><head>${meta.replace('default-src', 'unknown-src')}</head></html>`,
    `<html><head></head><body>${meta}</body></html>`,
    `<html><head><!-- ${meta} --></head></html>`,
    `<html><head><script>${JSON.stringify(meta)}</script></head></html>`,
  ]) assert.throws(() => assertProductCsp(html));
});

test('source drift excludes only recorded fingerprinted documentation CSS outputs', () => {
  assert.equal(isGeneratedInfoCss('shells/web/public/info/docs.E2-5K81LvdRXRXyK.css'), true);
  for (const path of ['shells/web/public/info/docs.css', 'shells/web/public/info/docs.changed.css',
    'shells/web/public/info/docs.E2-5K81LvdRXRXyK.js', 'shells/web/src/docs.E2-5K81LvdRXRXyK.css',
    'shells/web/public/info/nested/docs.E2-5K81LvdRXRXyK.css', 'docs/build.ts']) assert.equal(isGeneratedInfoCss(path), false);
  const before = { sourceSha: 'owned-source', sourceFiles: { 'shells/web/src/main.ts': 'original' },
    workingDiffSha256: 'source-only-diff', untrackedSourceFiles: {}, sourceDirty: '',
    fullWorkingDiffSha256: 'clean', generatedInfoCss: { 'shells/web/public/info/docs.E2-5K81LvdRXRXyK.css': { sha256: 'old' } } };
  const after = { ...before, sourceDirty: ' D shells/web/public/info/docs.E2-5K81LvdRXRXyK.css\n?? shells/web/public/info/docs.ElA_4wbeXo5YqvEN.css',
    fullWorkingDiffSha256: 'generated-output-diff', generatedInfoCss: { 'shells/web/public/info/docs.E2-5K81LvdRXRXyK.css': null,
      'shells/web/public/info/docs.ElA_4wbeXo5YqvEN.css': { sha256: 'new' } } };
  assertProductSourcesUnchanged(before, after);
  for (const patch of [{ sourceSha: 'different-source' }, { sourceFiles: { 'shells/web/src/main.ts': 'edited' } },
    { workingDiffSha256: 'different-input-diff' }, { untrackedSourceFiles: { 'shells/web/src/new-runtime.ts': 'added' } }]) {
    assert.throws(() => assertProductSourcesUnchanged(before, { ...after, ...patch }));
  }
});

test('real Git inventory separates generated CSS while refusing runtime and untracked source edits', async () => {
  const parent = resolve(root, 'plans/295-validation/product-probe-development'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(resolve(parent, 'source-inventory-'));
  const gitEnv: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete gitEnv[key];
  const git = (args: string[]) => {
    const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8', env: gitEnv });
    assert.equal(result.status, 0, result.stderr); return result.stdout;
  };
  const cssPath = (css: string) => `shells/web/public/info/docs.${createHash('sha256').update(css).digest('base64url').slice(0, 16)}.css`;
  const oldCss = ':root { color: green; }', newCss = ':root { color: blue; }';
  const oldPath = cssPath(oldCss), newPath = cssPath(newCss);
  const runtimePath = 'shells/web/src/main.ts', addedPath = 'shells/web/src/arbitrary.ts';
  try {
    await mkdir(resolve(fixture, 'shells/web/public/info'), { recursive: true });
    await mkdir(resolve(fixture, 'shells/web/src'), { recursive: true });
    await mkdir(resolve(fixture, 'shells/tauri-desktop/src-tauri'), { recursive: true });
    await writeFile(resolve(fixture, oldPath), oldCss);
    await writeFile(resolve(fixture, runtimePath), 'export const runtime = 1;\n');
    await writeFile(resolve(fixture, 'shells/tauri-desktop/src-tauri/Cargo.lock'), '# owned inventory fixture\n');
    git(['init', '--quiet']); git(['add', '.']);
    git(['-c', 'user.name=Lolly Test', '-c', 'user.email=test@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '--no-gpg-sign', '--quiet', '-m', 'Owned inventory fixture']);
    const before = await productSourceReceipt(fixture, [runtimePath]);
    assert.equal(before.sourceDirty, ''); assertProductBuildSource(before.sourceDirty, false);
    await rm(resolve(fixture, oldPath)); await writeFile(resolve(fixture, newPath), newCss);
    const generated = await productSourceReceipt(fixture, [runtimePath]);
    assertProductSourcesUnchanged(before, generated);
    assert.notEqual(generated.fullWorkingDiffSha256, before.fullWorkingDiffSha256);
    assert.equal(generated.workingDiffSha256, before.workingDiffSha256);
    assert.match(String(generated.sourceDirty), / D .*docs\..*\.css/);
    assert.match(String(generated.sourceDirty), /\?\? .*docs\..*\.css/);
    const css = generated.generatedInfoCss as Record<string, { sha256: string; bytes: number } | null>;
    assert.equal(css[oldPath], null); assert.equal(css[newPath]?.sha256, createHash('sha256').update(newCss).digest('hex'));
    assert.throws(() => assertProductBuildSource(generated.sourceDirty, false), /clean isolated source/);
    assertProductBuildSource(generated.sourceDirty, true);
    await writeFile(resolve(fixture, runtimePath), 'export const runtime = 2;\n');
    const edited = await productSourceReceipt(fixture, [runtimePath]);
    assert.notEqual(edited.workingDiffSha256, generated.workingDiffSha256);
    assert.throws(() => assertProductSourcesUnchanged(generated, edited), /inputs changed/);
    await writeFile(resolve(fixture, runtimePath), 'export const runtime = 1;\n');
    await writeFile(resolve(fixture, addedPath), 'export const injected = true;\n');
    const untracked = await productSourceReceipt(fixture, [runtimePath]);
    assert.ok(Object.hasOwn(untracked.untrackedSourceFiles as object, addedPath));
    assert.throws(() => assertProductSourcesUnchanged(generated, untracked), /Untracked source changed/);
    await rm(resolve(fixture, addedPath)); await writeFile(resolve(fixture, newPath), 'mismatched CSS');
    await assert.rejects(productSourceReceipt(fixture, [runtimePath]), /content fingerprint/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

test('native handshake accepts only the exact run, identifier and bundled origin', () => {
  assert.deepEqual(decodeProductMessage(line(ready), runId), ready);
  for (const url of ['http://127.0.0.1:9000/', 'https://localhost/', 'tauri://remote/', 'tauri://user@localhost/', 'tauri://localhost:80/']) {
    assert.equal(isProductUrl(url), false);
    assert.throws(() => decodeProductMessage(line({ ...ready, url }), runId));
    assert.throws(() => decodeProductMessage(line({ ...ready, nativeUrl: url }), runId));
  }
  for (const patch of [{ runId: 'different' }, { identifier: 'tools.lolly.Desktop' }, { runtime: 'unavailable: missing' },
    { event: 'unknown' }, { os: 'windows' }, { extra: true }]) assert.throws(() => decodeProductMessage(line({ ...ready, ...patch }), runId));
});

test('reply frames refuse malformed JSON, unknown fields and oversized values', () => {
  assert.throws(() => decodeProductMessage('LOLLY_WEBGPU_PRODUCT {', runId));
  assert.throws(() => decodeProductMessage(line({ event: 'reply', runId, reply: { id: 1, value: true, unknown: true } }), runId));
  assert.throws(() => decodeProductMessage(line({ event: 'reply', runId, reply: { id: 1, value: 'x'.repeat(PRODUCT_REPLY_LIMIT + 1) } }), runId));
});

test('protocol preserves ordering, rejects overlap and permits a later command after a page error', async () => {
  const writes: string[] = [], protocol = new ProductProbeProtocol(runId, value => writes.push(value), () => {});
  await assert.rejects(protocol.request('() => true'), /not ready/);
  protocol.receive(line(ready));
  const first = protocol.request('value => value + 1', 2);
  await assert.rejects(protocol.request('() => 9'), /pending/);
  assert.deepEqual(JSON.parse(writes[0]!), { id: 1, source: 'value => value + 1', arg: 2, close: false });
  protocol.receive(line({ event: 'reply', runId, reply: { id: 1, value: 3 } })); assert.equal(await first, 3);
  const second = protocol.request('() => { throw new Error("refused") }');
  protocol.receive(line({ event: 'reply', runId, reply: { id: 2, error: 'refused', stack: 'owned stack' } }));
  await assert.rejects(second, /refused/);
  const third = protocol.request('() => true');
  protocol.receive(line({ event: 'reply', runId, reply: { id: 3, value: true } })); assert.equal(await third, true);
});

test('protocol rejects source/byte budgets before consuming sequence IDs', async () => {
  const writes: string[] = [], protocol = new ProductProbeProtocol(runId, value => writes.push(value), () => {});
  protocol.receive(line(ready));
  await assert.rejects(protocol.request('x'.repeat(65537)), /source/);
  await assert.rejects(protocol.request('value => value', 'x'.repeat(PRODUCT_COMMAND_LIMIT)), /byte/);
  const valid = protocol.request('() => 1');
  assert.equal(JSON.parse(writes[0]!).id, 1);
  protocol.receive(line({ event: 'reply', runId, reply: { id: 1, value: 1 } })); assert.equal(await valid, 1);
});

test('a replay, malformed reply or native failure closes the protocol', async () => {
  for (const reply of [
    { event: 'reply', runId, reply: { id: 2, value: true } },
    { event: 'reply', runId, reply: { id: 1, unknown: true } },
    { event: 'failure', runId, error: 'native refusal' },
    { ...ready },
  ]) {
    let failed = 0;
    const protocol = new ProductProbeProtocol(runId, () => {}, () => {}, () => { failed++; });
    protocol.receive(line(ready)); const pending = protocol.request('() => true');
    protocol.receive(line(reply)); await assert.rejects(pending);
    await assert.rejects(protocol.request('() => true')); assert.equal(failed, 1);
  }
});

test('preload diagnostics preserve the original exception even when the normal handler suppresses it', async () => {
  const errors: string[] = [], window = Object.assign(new EventTarget(), {
    __TAURI_INTERNALS__: { async invoke(name: string, body: { error?: string }) {
      if (name === 'webgpu_qualification_failure') errors.push(body.error!);
      if (name === 'webgpu_qualification_next') return { id: 1, source: '() => true', close: true };
      return null;
    } },
  });
  window.addEventListener('vite:preloadError', event => event.preventDefault());
  runInNewContext(productProbeSource(runId, '/not-loaded-by-this-test.ts'), { window, location: { href: 'tauri://localhost/' },
    document: { documentElement: { dataset: { webgpu: 'ready' } } }, isSecureContext: true, console, TextEncoder, TextDecoder, setTimeout });
  const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: new Error('Original failed import: /_app/route.js') });
  window.dispatchEvent(event);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(event.defaultPrevented, true);
  assert.equal(errors.length, 1); assert.match(errors[0]!, /Original failed import: \/_app\/route\.js/);
  assert.match(errors[0]!, /Error/);
});

test('feature routing retains the main window guard and normal native configuration', async () => {
  const [lib, windows, cargo, csp, acl] = await Promise.all([
    readFile(resolve(root, 'shells/tauri-desktop/src-tauri/src/lib.rs'), 'utf8'),
    readFile(resolve(root, 'shells/tauri-desktop/src-tauri/src/presentation_windows.rs'), 'utf8'),
    readFile(resolve(root, 'shells/tauri-desktop/src-tauri/Cargo.toml'), 'utf8'),
    readFile(resolve(root, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8'),
    readFile(resolve(root, 'shells/tauri-desktop/src-tauri/capabilities/default.json'), 'utf8'),
  ]);
  assert.match(lib, /#\[cfg\(feature = "webgpu-probe"\)\]\s*mod webgpu_qualification/);
  assert.match(cargo, /webgpu-probe = \[\]/);
  assert.ok(windows.indexOf('label() != "main"') < windows.indexOf('webgpu_qualification::route'));
  assert.match(windows, /WebviewWindowBuilder::from_config\(app, config\)/);
  assert.doesNotMatch(windows, /incognito\(|background_throttling\(|use_https_scheme\(/);
  assert.doesNotMatch(acl, /webgpu_qualification|probe/);
  const config = JSON.parse(csp) as { app: { security: { csp: unknown; devCsp: unknown } } };
  assert.equal(config.app.security.csp, null); assert.equal(config.app.security.devCsp, null);
  assert.ok(!TAURI_CSP.split(';').find(row => row.trim().startsWith('connect-src'))!.includes('127.0.0.1'));
});

test('actual Vite graph omits the default module and bundles shared GPU modules/worker for qualification', { timeout: 60_000 }, async () => {
  const parent = resolve(root, 'plans/295-validation/product-probe-development'); await mkdir(parent, { recursive: true });
  const fixture = await mkdtemp(resolve(parent, 'vite-graph-'));
  try {
    await writeFile(resolve(fixture, 'index.html'), '<!doctype html><script type="module" src="/main.ts"></script>');
    await writeFile(resolve(fixture, 'main.ts'), `import { startWebGpuCheck } from ${JSON.stringify(resolve(root, 'shells/web/src/lib/webgpu/device.ts'))}; window.productDevice = startWebGpuCheck;`);
    const compile = async (configured: boolean) => {
      const plugin = webGpuProductProbe({ root, env: configured ? env : {} });
      const result = await build({ configFile: false, root: fixture, publicDir: false, logLevel: 'silent', plugins: [tauriCspMeta(), ...(plugin ? [plugin] : [])],
        build: { write: false, minify: false, target: 'esnext', outDir: resolve(fixture, 'dist') }, worker: { format: 'es' } });
      assert.ok(!Array.isArray(result) && 'output' in result);
      return result.output;
    };
    const ordinary = await compile(false);
    const ordinaryHtml = ordinary.find(row => row.type === 'asset' && row.fileName === 'index.html');
    assert.ok(ordinaryHtml?.type === 'asset'); assertProductCsp(String(ordinaryHtml.source));
    assert.ok(ordinary.every(row => !row.fileName.includes('webgpu-product')));
    const normalText = ordinary.map(row => row.type === 'chunk' ? row.code : String(row.source)).join('\n');
    assert.doesNotMatch(normalText, /webgpu_qualification_|__lollyProductQualification|window\.lutProbe/);
    const qualified = await compile(true);
    const qualifiedHtml = qualified.find(row => row.type === 'asset' && row.fileName === 'index.html');
    assert.ok(qualifiedHtml?.type === 'asset'); assertProductCsp(String(qualifiedHtml.source));
    const qualifiedText = qualified.map(row => row.type === 'chunk' ? row.code : String(row.source)).join('\n');
    assert.match(qualifiedText, /webgpu_qualification_ready/);
    assert.match(qualifiedText, /dataset\.webgpu !== "ready"/);
    assert.match(qualifiedText, /photo-look\.worker-/);
    const marker = qualified.find(row => row.fileName === 'webgpu-product-probe.json');
    assert.ok(marker?.type === 'asset'); assert.equal(JSON.parse(String(marker.source)).identifier, productProbeIdentity(runId));
    const owners = qualified.filter(row => row.type === 'chunk' && Object.keys(row.modules).some(path => path.endsWith('/lib/webgpu/device.ts')));
    assert.equal(owners.length, 1, 'the product and qualification exports share one main-realm device module');
    await writeFile(resolve(parent, 'vite-graph.json'), JSON.stringify({ date: new Date().toISOString(), nativeProductLaunched: false,
      ordinaryAssets: ordinary.map(row => row.fileName), qualifiedAssets: qualified.map(row => row.fileName), sharedMainDeviceChunks: owners.length }, null, 2) + '\n');
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
