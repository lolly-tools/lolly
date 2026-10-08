// SPDX-License-Identifier: MPL-2.0
/**
 * The WebGPU startup requirement may be on main, but a release may not ship it before
 * the supported-environment table is published (plan 295 P0b, decided 2026-10-08).
 * Ordinary CI runs `release-checklist --check`, which must stay green without the
 * table; release mode (`pnpm run check:release`) must refuse.
 *
 * The gate covers the web shell and the Tauri apps only (Andy, 2026-10-08: "Gate only
 * the web shell"). The MCP, CA and Penpot images and the /info docs do not require
 * WebGPU, so they must never call the gate or wait for a job that does. The last tests
 * here read the workflows, Dockerfiles, package scripts and import graphs to hold both
 * sides of that line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  REQUIRED_WEBGPU_TARGETS, SUPPORTED_ENVIRONMENTS_PATH, assertWebGpuReleaseAllowed,
  supportedEnvironmentProblems, webGpuReleaseProblems, webGpuStartupGatePresent,
} from '../scripts/webgpu-release-gate.ts';
import { main as releaseChecklist } from '../scripts/release-checklist.ts';

const COMPLETE = [
  '| Environment | WebGPU result | Versions | Adapter and backend | Evidence |',
  '|---|---|---|---|---|',
  '| Chrome and Edge (Chromium) | Supported | 153 | Metal, SwiftShader | run 1 |',
  '| Firefox | Not supported: no adapter | 155 | none | run 2 |',
  '| Safari (WebKit) | Supported | 26 | Metal | run 3 |',
  '| macOS app (WKWebView) | Supported | 26 | Metal | run 4 |',
  '| iOS and iPadOS app (WKWebView) | Supported | 26 | Metal | run 5 |',
  '| Windows app (WebView2) | Supported | 141 | D3D12 | run 6 |',
  '| Linux app (WebKitGTK) | Not supported | 2.50 | none | run 7 |',
  '| Android app (WebView) | Supported | 153 | Vulkan | run 8 |',
].join('\n');

/** A scratch tree with the shell's main.ts and, optionally, the published table. */
function tree(mainSource: string, table?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-webgpu-gate-'));
  mkdirSync(join(root, 'shells', 'web', 'src'), { recursive: true });
  writeFileSync(join(root, 'shells', 'web', 'src', 'main.ts'), mainSource);
  if (table !== undefined) {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, SUPPORTED_ENVIRONMENTS_PATH), table);
  }
  return root;
}
const GATED_MAIN = "import { startWebGpuCheck, webGpuChecked } from './lib/webgpu/device.ts';\nvoid startWebGpuCheck().then(() => {}, () => {});\n";

test('the current shell makes WebGPU a startup requirement, so the gate applies to it', () => {
  // If this fails after a refactor, update webGpuStartupGatePresent: a detector that
  // stops recognising the requirement would let a release through silently.
  assert.equal(webGpuStartupGatePresent(), true);
});

test('the table needs a published result for every required environment', () => {
  assert.deepEqual(supportedEnvironmentProblems(COMPLETE), []);
  const missing = supportedEnvironmentProblems(COMPLETE.split('\n').filter(line => !/Firefox|WebKitGTK/.test(line)).join('\n'));
  assert.deepEqual(missing, ['no row for Firefox', 'no row for Linux app (WebKitGTK)']);
  const pending = supportedEnvironmentProblems(COMPLETE.replace('| Supported | 141 | D3D12', '| pending | 141 | D3D12'));
  assert.equal(pending.length, 1);
  assert.match(pending[0]!, /Windows app \(WebView2\): the result column says "pending"/);
  assert.equal(supportedEnvironmentProblems('').length, REQUIRED_WEBGPU_TARGETS.length);
});

test('a row answers only for the environment it names exactly, whatever the order of the rows', () => {
  // The old matcher took the first row containing a word: "Chrome on Android" answered
  // for the Android app, and "Android app (WebView, Chromium)" for Chrome and Edge.
  const borrowed = [
    '| Environment | WebGPU result |',
    '|---|---|',
    '| Android app (WebView, Chromium) | Supported |',
    '| Chrome on Android | Supported |',
    '| Safari 26 (WebKit) | Supported |',
    ...COMPLETE.split('\n').slice(2).filter(line => !/Chrome and Edge|Android app|Safari/.test(line)),
  ].join('\n');
  assert.deepEqual(supportedEnvironmentProblems(borrowed), [
    'no row for Chrome and Edge (Chromium)', 'no row for Safari (WebKit)', 'no row for Android app (WebView)',
  ]);
  // Case, spacing and emphasis do not change the name; extra rows are ignored.
  const styled = COMPLETE.replace('| Firefox |', '| **firefox** |').replace('| Windows app (WebView2) |', '|  Windows  app (WebView2) |')
    + '\n| Chrome on Android | Supported | 153 | Vulkan | run 9 |';
  assert.deepEqual(supportedEnvironmentProblems(styled), []);
  const twice = `${COMPLETE}\n| Firefox | Supported | 156 | Metal | run 10 |`;
  assert.deepEqual(supportedEnvironmentProblems(twice), ['2 rows for Firefox; publish one']);
});

test('a release is refused without the table, allowed with it, and not gated once the requirement is gone', () => {
  const roots = [tree(GATED_MAIN), tree(GATED_MAIN, COMPLETE), tree('void boot();\n'), tree(GATED_MAIN, COMPLETE.replace(/\| Android.*$/m, ''))];
  try {
    const [absent, published, ungated, partial] = roots as [string, string, string, string];
    assert.deepEqual(webGpuReleaseProblems(absent), [`${SUPPORTED_ENVIRONMENTS_PATH} does not exist`]);
    assert.throws(() => assertWebGpuReleaseAllowed(absent), /Release refused[\s\S]*Windows app \(WebView2\)[\s\S]*Android app \(WebView\)/);
    assert.deepEqual(webGpuReleaseProblems(published), []);
    assert.doesNotThrow(() => assertWebGpuReleaseAllowed(published));
    assert.deepEqual(webGpuReleaseProblems(ungated), []);
    assert.deepEqual(webGpuReleaseProblems(partial), ['no row for Android app (WebView)']);
  } finally { for (const root of roots) rmSync(root, { recursive: true, force: true }); }
});

test('ordinary CI keeps passing release-checklist --check; release mode refuses until the table exists', () => {
  const quiet = console.error;
  console.error = () => {};
  const roots = [tree(GATED_MAIN), tree(GATED_MAIN, COMPLETE)];
  try {
    assert.equal(releaseChecklist(['--check']), 0, 'the per-PR check does not run the release gate');
    assert.equal(releaseChecklist(['--check', '--release'], roots[0]), 1);
    assert.equal(releaseChecklist(['--check', '--release'], roots[1]), 0);
  } finally {
    console.error = quiet;
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Scope: the web shell and the Tauri apps are gated; MCP, CA, Penpot and docs are not.
// ---------------------------------------------------------------------------

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoFile = (path: string): string => readFileSync(join(REPO, path), 'utf8');
const GATE_STEP = 'node scripts/webgpu-release-gate.ts';
/** Anything that runs the gate, directly or through the signed frontend wrapper. */
const GATED_BUILD = /webgpu-release-gate|build-release-web|build:(?:web|desktop:frontend|mobile:frontend):release|web\.Dockerfile|check:release(?![-\w])/;

interface WorkflowStep { name?: string; if?: string; run?: string; uses?: string; with?: Record<string, unknown>; env?: Record<string, unknown> }
interface WorkflowJob { name?: string; if?: string; needs?: string | string[]; env?: Record<string, unknown>; outputs?: Record<string, string>; steps: WorkflowStep[] }

function workflowJobs(file: string): Record<string, WorkflowJob> {
  return (parseYaml(repoFile(`.github/workflows/${file}`)) as { jobs: Record<string, WorkflowJob> }).jobs;
}
const needsOf = (job: WorkflowJob): string[] => [job.needs ?? []].flat();
/** Everything a job executes or hands to a step, as one string to search. */
const jobText = (job: WorkflowJob): string => JSON.stringify({ env: job.env, steps: job.steps });
const scriptsOf = (path: string): Record<string, string> =>
  (JSON.parse(repoFile(path)) as { scripts: Record<string, string> }).scripts;

test('the deployment workflow gates the web shell image and no other image or the docs', () => {
  const jobs = workflowJobs('deployment-suse.yml');
  const gate = jobs['web-release-gate'];
  const web = jobs['web-image'];
  assert.ok(gate && web, 'the gate job and the web image job exist');
  assert.ok(gate.steps.some((step) => step.run?.includes(GATE_STEP)), 'the gate job runs the gate');
  assert.match(gate.outputs?.allowed ?? '', /^\$\{\{ steps\.gate\.outputs\.allowed \}\}$/);

  // The web image waits for the gate, then refuses again on its own checkout before
  // it builds, and the image build itself runs the gated wrapper.
  assert.ok(needsOf(web).includes('web-release-gate'));
  assert.match(web.if ?? '', /needs\.web-release-gate\.outputs\.allowed == 'true'/);
  const refuse = web.steps.findIndex((step) => step.run?.trim() === GATE_STEP);
  const build = web.steps.findIndex((step) => step.run?.includes('-f deploy/docker/web.Dockerfile'));
  assert.ok(refuse >= 0 && build > refuse, 'the web job refuses before it builds');
  assert.match(repoFile('deploy/docker/web.Dockerfile'), /^\s+pnpm run build:web:release$/m);

  // Every other job: no gate, no gated build, and no dependency on either web job.
  for (const [id, job] of Object.entries(jobs)) {
    if (id === 'web-release-gate' || id === 'web-image') continue;
    assert.doesNotMatch(jobText(job), GATED_BUILD, `${id} must not run the WebGPU gate or a gated build`);
    assert.ok(!needsOf(job).some((need) => need === 'web-release-gate' || need === 'web-image'), `${id} must not wait for the web image`);
  }

  // The services and the docs are actually built there.
  const services = jobText(jobs['service-images']!);
  assert.match(services, /for service in mcp-browser ca penpot; do/);
  assert.match(services, /deploy\/docker\/\$\{service\}\.Dockerfile/);
  assert.match(jobText(jobs['info-docs']!), /pnpm run build:info/);
  assert.match(jobText(jobs['probe-web-shell']!), /"run":"pnpm run build:web"/);
});

/** Relative imports a module makes: static, re-exports, dynamic and require, literal specifiers only. */
function relativeImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const specifiers = new Set<string>();
  for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) specifiers.add(match[1]!);
  const resolved: string[] = [];
  for (const specifier of specifiers) {
    const base = resolve(dirname(file), specifier);
    const found = [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts')]
      .find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    if (found && /\.(?:ts|mjs|js)$/.test(found)) resolved.push(found);
  }
  return resolved;
}

/** Every first-party module an entry point reaches through relative imports. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [join(REPO, entry)];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file) || file.includes('/node_modules/')) continue;
    seen.add(file);
    queue.push(...relativeImports(file));
  }
  return new Set([...seen].map((file) => relative(REPO, file)));
}

/** The modules that import the gate. A new one has to be placed on one side of the line here. */
const GATE_IMPORTERS = [
  'scripts/build-release-web.ts',
  'scripts/release-checklist.ts',
  'scripts/yunohost-release.ts',
  'shells/tauri-desktop/release/build-latest-json.ts',
];

/** First-party .ts/.mjs/.js files under a directory, skipping dependencies, tests and wasm builds. */
function sourceFiles(directory: string): string[] {
  const absolute = join(REPO, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|mjs|js)$/.test(entry.name))
    .map((entry) => relative(REPO, join(entry.parentPath, entry.name)))
    .filter((path) => !/(?:^|\/)(?:node_modules|test|wasm|dist)\//.test(path));
}

test('only the web shell and app release tools import the gate', () => {
  const gate = join(REPO, 'scripts', 'webgpu-release-gate.ts');
  const importers = ['scripts', 'shells/tauri-desktop/release', 'shells/tauri-mobile', 'services', 'docs', 'packages', 'deploy']
    .flatMap(sourceFiles)
    .filter((path) => relativeImports(join(REPO, path)).includes(gate))
    .sort();
  assert.deepEqual(importers, [...GATE_IMPORTERS].sort());
});

test('the MCP, CA and Penpot images, their function bundles and the /info docs never reach the gate', () => {
  // What each artefact runs: the container entry points, the Dockerfile build
  // steps, the bundlers of the hosted functions, and the docs build.
  const entries = [
    'services/mcp/src/http.ts', 'services/mcp/scripts/install-browser.ts',
    'packages/node-shell/src/content-roots.ts', 'services/ca/server.mjs',
    'services/penpot/http.ts', 'scripts/build-mcp-fn.ts', 'scripts/build-ca-fn.ts',
    'scripts/build-penpot-fn.ts', 'services/mcp/src/vercel-entry.ts',
    'services/ca/vercel-entry.mjs', 'services/penpot/vercel-entry.ts', 'docs/build.ts',
  ];
  for (const entry of entries) {
    assert.ok(existsSync(join(REPO, entry)), `${entry} exists`);
    const graph = reachable(entry);
    for (const gated of ['scripts/webgpu-release-gate.ts', ...GATE_IMPORTERS]) {
      assert.ok(!graph.has(gated), `${entry} reaches ${gated}`);
    }
  }
  for (const dockerfile of ['mcp', 'mcp-browser', 'ca', 'penpot']) {
    assert.doesNotMatch(repoFile(`deploy/docker/${dockerfile}.Dockerfile`), GATED_BUILD, `${dockerfile}.Dockerfile`);
  }
  const scripts = scriptsOf('package.json');
  for (const name of ['build:info', 'build:mcp-fn', 'build:ca-fn', 'build:penpot-fn', 'mcp:http']) {
    assert.ok(scripts[name], `${name} exists`);
    assert.doesNotMatch(scripts[name]!, GATED_BUILD, name);
  }
});

test('the web shell and every Tauri app build still go through the gate', () => {
  const scripts = scriptsOf('package.json');
  assert.equal(scripts['build:web:release'], 'node scripts/build-release-web.ts web');
  assert.equal(scripts['build:desktop:frontend:release'], 'node scripts/build-release-web.ts tauri-desktop');
  assert.equal(scripts['build:mobile:frontend:release'], 'node scripts/build-release-web.ts tauri-mobile');
  // The wrapper asks the gate before it validates or signs anything (its behaviour is
  // exercised in catalog-release.test.ts; this pins the order of the calls).
  const wrapper = repoFile('scripts/build-release-web.ts');
  const main = wrapper.slice(wrapper.indexOf('export function main(): void {'));
  const body = main.slice(0, main.indexOf('\n}\n'));
  const asked = body.indexOf('  assertWebGpuReleaseAllowed();');
  assert.ok(asked > 0 && asked < body.indexOf('validateReleaseEnvironment(') && asked < body.indexOf('sign(env)'));
  for (const [shell, root] of [['tauri-desktop', 'build:desktop:frontend:release'], ['tauri-mobile', 'build:mobile:frontend:release']] as const) {
    const config = JSON.parse(repoFile(`shells/${shell}/src-tauri/tauri.conf.json`)) as { build: { beforeBuildCommand: string } };
    assert.match(config.build.beforeBuildCommand, /^pnpm run build:frontend:release(?: &&|$)/, `${shell}: tauri build runs the gated wrapper`);
    assert.equal(scriptsOf(`shells/${shell}/package.json`)['build:frontend:release'], `pnpm -C ../.. run ${root}`);
  }
  // A version tag refuses early in the two Linux workflows that build on tags.
  for (const file of ['flatpak.yml', 'linux-arm64.yml']) {
    const steps = Object.values(workflowJobs(file)).flatMap((job) => job.steps);
    assert.ok(steps.some((step) => step.run?.trim() === GATE_STEP && /startsWith\(github\.ref, 'refs\/tags\/v'\)/.test(step.if ?? '')), file);
  }
  // Each packaging workflow builds the app through tauri (whose beforeBuildCommand is
  // the wrapper) or runs the wrapper itself, and none empties beforeBuildCommand.
  for (const file of ['flatpak.yml', 'linux-arm64.yml', 'linux-rpm.yml', 'desktop-extra.yml', 'macos-intel.yml', 'ios-release.yml']) {
    const text = Object.values(workflowJobs(file)).map(jobText).join('\n');
    assert.match(text, /tauri (?:ios )?build|build:frontend:release/, file);
    assert.doesNotMatch(text, /beforeBuildCommand/, `${file} must not replace the gated beforeBuildCommand`);
  }
});
