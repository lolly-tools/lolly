// SPDX-License-Identifier: MPL-2.0
/**
 * Run the gates GitHub CI runs for a pull request, on this machine, in the
 * order the workflows list them. Use it before pushing so a red run on a
 * hosted runner is the exception.
 *
 *   pnpm run ci:local                  every lane this machine can run
 *   pnpm run ci:local --changed        only lanes the diff against origin/main touches
 *   pnpm run ci:local --changed --with-build   also run lanes that build the web shell
 *   pnpm run ci:local --list           print the lanes and the commands, run nothing
 *   pnpm run ci:local --only=typecheck,docs --skip=build
 *   pnpm run ci:local --strict         exit non-zero when a lane could not run
 *
 * The lane list below mirrors .github/workflows/ci.yml and fast-lanes.yml, and
 * tests/ci-local.test.ts fails when the two drift (a job added, removed or
 * reordered, a shard changed, a path filter edited, a gate command reworded).
 *
 * Honesty rules. A lane that needs something hosted (a secret, another OS,
 * Android or iOS, the approval of a GitHub environment) is listed as SKIPPED
 * with its reason. A step that needs a tool this machine lacks (Chromium, a
 * WebGPU adapter, ffmpeg, gitleaks) is reported NOT RUN. A lane is PASSED only
 * when every step in it ran and succeeded, so a missing browser can never read
 * as a pass.
 *
 * --changed leaves out every lane that runs build:web (the build rewrites tracked
 * files such as the brand OG images) and lists it as skipped; --with-build runs
 * them. Plain ci:local with no --changed runs them as before.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyDocsAndTests, touchesDependencies, type Change } from './ci-qualification.ts';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export type Requirement = 'chromium' | 'firefox' | 'webkit' | 'ffmpeg' | 'gitleaks' | 'qpdf' | 'c2patool' | 'caddy'
  | 'cargo' | 'cargo-audit' | 'opengrep' | 'webgpu' | 'journey-shell';

export interface Step {
  name: string;
  /** Shell command, run from the repository root. */
  cmd: string;
  /** The text of the workflow's run script this step copies. Defaults to cmd. */
  ci?: string;
  env?: Record<string, string>;
  requires?: Requirement[];
  /** A failure here is reported but does not fail the lane: it means this machine differs from CI. */
  advisory?: boolean;
}

export interface Lane {
  /** Stable id used by --only and --skip. */
  id: string;
  workflow: 'ci.yml' | 'fast-lanes.yml';
  /** The job id in the workflow file. */
  job: string;
  title: string;
  /** Hosted-only: why this machine runs nothing for the lane. */
  skip?: string;
  /** Heavy tier: CI leaves it out of a docs-and-tests pull request. */
  heavy?: boolean;
  /**
   * fast-lanes.yml lanes: the workflow's own pull_request path filter.
   * ci.yml lanes: the paths that make the lane relevant to --changed. ci.yml has
   * no path filter (it runs every job on every pull request), so these are a
   * local narrowing, not a copy of CI. '**' means always.
   */
  paths: string[];
  steps: Step[];
}

const ALWAYS = ['**'];
const CODE = ['engine/**', 'packages/**', 'services/**', 'shells/**', 'community/**', 'brands/**', 'tests/**', 'scripts/**',
  'api/**', 'action/**', 'tools/**', 'catalog/**', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'biome.json', 'profiles.json'];
const CATALOG = ['community/**', 'brands/**', 'catalog/**', 'engine/**', 'packages/**', 'shells/cli/**', 'scripts/**', 'profiles.json'];
const FAST_LANE_PATHS = ['docs/**', 'shells/web/**', 'README.md', 'engine/text-composition.md', '.github/workflows/fast-lanes.yml',
  'scripts/deploy-lane.ts', 'scripts/fast-lane-tests.ts', 'scripts/web-lane-check.ts'];

const hosted = (reason: string) => reason;
/** A GitHub Actions expression, written the way the workflow files write one. */
const X = (expression: string): string => `$\x7b{ ${expression} }}`;
const CONCURRENCY = { ONNXRUNTIME_NODE_INSTALL_CUDA: 'skip' };
const SKIP_REPORT = 'artifacts/ci-local/test-skips.json';

const shard = (name: string, extra: Partial<Step> = {}): Step => ({
  name: `Run test shard ${name}`,
  cmd: `pnpm run test:${name}`,
  ci: `pnpm run "test:${X('matrix.shard')}"`,
  env: { LOLLY_SKIP_REPORT: SKIP_REPORT },
  ...extra,
});
const skipCheck = (name: string): Step => ({
  name: `Skips match CI identities (${name})`,
  cmd: `pnpm run check:skip-identities --report=${SKIP_REPORT} --shard=${name}`,
  ci: `pnpm run check:skip-identities --report=artifacts/test-skips.json --shard="${X('matrix.shard')}"`,
  // A skip here usually means a tool CI installs is missing on this machine.
  advisory: true,
});

const BROWSER_PARTITIONS = 8;
const browserSteps = (): Step[] => [
  { name: 'WebGPU conformance', cmd: 'pnpm run test:webgpu', requires: ['chromium', 'webgpu'],
    env: { LOLLY_WEBGPU_TEST_ADAPTER: 'swiftshader', LOLLY_WEBGPU_REQUIRED: '1' } },
  { name: 'Geometry conformance', cmd: 'pnpm run test:geometry', requires: ['chromium', 'webgpu'] },
  { name: 'One geometry answer in Chromium, Firefox and WebKit', cmd: 'pnpm run test:geometry:engines --output=artifacts/geometry-engines',
    requires: ['chromium', 'firefox', 'webkit'] },
  { name: 'Drawing fidelity against the Design renderer', cmd: 'pnpm run test:drawing', requires: ['chromium', 'webgpu'] },
  ...Array.from({ length: BROWSER_PARTITIONS }, (_, i): Step => ({
    name: `Browser tests, partition ${i + 1}/${BROWSER_PARTITIONS}`,
    cmd: `pnpm run test:browser --partition=${i + 1}/${BROWSER_PARTITIONS}`,
    ci: `pnpm run "test:${X('matrix.shard')}" ${X("matrix.partition && format('--partition={0}', matrix.partition) || ''")}`,
    requires: ['chromium', 'webgpu', 'ffmpeg', 'qpdf', 'journey-shell'],
    env: { LOLLY_SKIP_REPORT: SKIP_REPORT, LOLLY_WEBGPU_TEST_ADAPTER: 'swiftshader', LOLLY_BROWSER_CHANNEL: 'chromium', LOLLY_TEST_CONCURRENCY: '1' },
  })),
];

/** The lanes, in the order the workflows list their jobs. */
export const LANES: Lane[] = [
  { id: 'deployment-scope', workflow: 'ci.yml', job: 'deployment-scope', title: 'deployment scope', paths: ALWAYS, steps: [],
    skip: hosted('Classifies the pull request against the trusted base commit on the runner. --changed makes the same decision locally.') },
  { id: 'public-ready-ui', workflow: 'ci.yml', job: 'public-ready-ui', title: 'test (public-ready UI)',
    paths: ['shells/web/**', 'tests/**', 'scripts/run-public-ready-ui.ts', 'packages/**'],
    steps: [{ name: 'Focused UI and canonical token contracts', cmd: 'node scripts/run-public-ready-ui.ts' }] },
  { id: 'secrets', workflow: 'ci.yml', job: 'secrets', title: 'secret history scan', paths: ALWAYS, steps: [
    { name: 'Verify scanner contract', cmd: 'node --test tests/scan-secrets-runner.test.ts' },
    { name: 'Verify workflow supply-chain pins', cmd: 'pnpm run check:workflow-pins' },
    { name: 'Scan tracked Git history (redacted output)', cmd: 'pnpm run secrets:scan', requires: ['gitleaks'] },
  ] },
  { id: 'test:contracts', workflow: 'ci.yml', job: 'test-fast', title: 'test (contracts)', paths: CODE,
    steps: [shard('contracts', { requires: ['ffmpeg'] }), skipCheck('contracts')] },
  { id: 'test:security', workflow: 'ci.yml', job: 'test-fast', title: 'test (security)', paths: CODE,
    steps: [shard('security', { requires: ['chromium'], env: { LOLLY_SKIP_REPORT: SKIP_REPORT, LOLLY_WEBGPU_TEST_ADAPTER: 'swiftshader' } }), skipCheck('security')] },
  { id: 'test:unit:engine', workflow: 'ci.yml', job: 'test', title: 'test (unit:engine)', paths: CODE,
    steps: [shard('unit:engine', { requires: ['caddy', 'qpdf'] }), skipCheck('unit:engine')] },
  { id: 'test:unit:web', workflow: 'ci.yml', job: 'test', title: 'test (unit:web)', paths: CODE,
    steps: [shard('unit:web'), skipCheck('unit:web')] },
  { id: 'test:tools', workflow: 'ci.yml', job: 'test', title: 'test (tools)', paths: CODE,
    steps: [shard('tools'), skipCheck('tools')] },
  { id: 'test:browser', workflow: 'ci.yml', job: 'test', title: 'test (browser, 8 partitions)', heavy: true, paths: CODE,
    steps: browserSteps() },
  { id: 'test:tauri', workflow: 'ci.yml', job: 'test', title: 'test (tauri)', heavy: true, paths: CODE,
    skip: hosted('Needs the Linux WebKitGTK and system libraries CI installs with apt, and a wasm32 Rust target.'), steps: [] },
  { id: 'test:conformance', workflow: 'ci.yml', job: 'test', title: 'test (conformance)', heavy: true, paths: CODE,
    steps: [shard('conformance', { requires: ['qpdf', 'c2patool'] }), skipCheck('conformance')] },
  { id: 'test:fuzz:regression', workflow: 'ci.yml', job: 'test', title: 'test (fuzz:regression)', heavy: true, paths: CODE,
    steps: [shard('fuzz:regression'), skipCheck('fuzz:regression')] },
  { id: 'browser-gate', workflow: 'ci.yml', job: 'browser-gate', title: 'test (browser)', paths: ALWAYS, steps: [],
    skip: hosted('Aggregates the eight hosted browser partitions and their uploaded coverage reports. The browser lane above is the local equivalent.') },
  { id: 'typecheck', workflow: 'ci.yml', job: 'typecheck', title: 'typecheck', paths: ALWAYS, steps: [
    { name: 'Install the Tauri shells (types only)', cmd: 'pnpm -C shells/tauri-desktop install --frozen-lockfile --prod && pnpm -C shells/tauri-mobile install --frozen-lockfile --prod',
      ci: 'pnpm -C shells/tauri-desktop install --frozen-lockfile --prod' },
    { name: 'Typecheck (tsc -p, every project)', cmd: 'pnpm run typecheck' },
    { name: 'Typecheck must not have skipped the Tauri shells', cmd: 'pnpm run typecheck:tauri --strict' },
    { name: 'Engine module map builds', cmd: 'node scripts/gen-engine-modules.ts --check --allow-drift' },
    { name: 'Rondocode bundles drift', cmd: 'pnpm run check:rondo' },
    { name: 'Rondocode editor drift', cmd: 'pnpm run check:rondo-editor' },
    { name: 'Engine purity', cmd: 'pnpm run check:engine-purity' },
    { name: 'Docs nav completeness', cmd: 'pnpm run check:docs-nav' },
    { name: 'Web shell code-map stats build', cmd: 'node scripts/gen-web-src-readme.ts --check --allow-drift' },
    { name: 'Web shell maintainability no-growth ratchet', cmd: 'pnpm run check:maintainability' },
    { name: 'CSS house rules ratchet', cmd: 'pnpm run check:house-rules' },
    { name: 'No new first-party Biome diagnostics', cmd: 'pnpm run lint:changed --all' },
    { name: 'Repository and release inventory closure', cmd: 'pnpm run check:release-checklist && pnpm run check:host-v1-api' },
    { name: 'Locale innerHTML markup allowlist', cmd: 'pnpm run check:locale-markup' },
    { name: 'Parser inventory fuzz coverage and waiver expiry', cmd: 'pnpm run check:parser-inventory && pnpm run check:parser-assurance' },
  ] },
  { id: 'validate-catalog', workflow: 'ci.yml', job: 'validate-catalog', title: 'validate catalog', paths: CATALOG, steps: [
    { name: 'Validate catalog', cmd: 'pnpm run validate:catalog' },
    { name: 'Validate the lolly-demo catalog', cmd: 'node scripts/validate-catalog.ts --profile=lolly-demo' },
  ] },
  { id: 'smoke', workflow: 'ci.yml', job: 'smoke', title: 'smoke (render every tool)', paths: CATALOG,
    steps: [{ name: 'Smoke-render the catalog', cmd: 'pnpm run smoke' }] },
  { id: 'instance-shell', workflow: 'ci.yml', job: 'instance-shell', title: 'verified instance shell', paths: ['shells/web/**'], steps: [],
    skip: hosted('Runs only on a pull request labelled instance-release, with the release public key from a repository variable.') },
  { id: 'build', workflow: 'ci.yml', job: 'build', title: 'build + bundle budget',
    paths: ['shells/web/**', 'docs/**', 'engine/**', 'packages/**', 'community/**', 'brands/**', 'scripts/**', 'package.json', 'pnpm-lock.yaml'], steps: [
    { name: 'Production build (info site, OG cards, web shell)', cmd: 'pnpm run build:web' },
    { name: 'Bundle budget', cmd: 'pnpm run check:bundle' },
    { name: 'Docs size budget', cmd: 'pnpm run check:docs-size' },
  ] },
  { id: 'api-bundles', workflow: 'ci.yml', job: 'api-bundles', title: 'api bundle drift',
    paths: ['services/**', 'api/**', 'packages/**', 'engine/**', 'scripts/**', 'package.json', 'pnpm-lock.yaml'], steps: [
    { name: 'Rebuild the api/ function bundles', cmd: 'pnpm run build:mcp-fn && pnpm run build:ca-fn && pnpm run build:penpot-fn' },
    { name: 'No drift', cmd: 'node scripts/check-api-bundles.ts' },
  ] },
  { id: 'render-action', workflow: 'ci.yml', job: 'render-action', title: 'render-action self-test', paths: ['action/**'], steps: [
    { name: 'Action input boundary tests', cmd: 'node --test action/test/*.test.mjs' },
  ] },
  { id: 'audit', workflow: 'ci.yml', job: 'audit', title: 'npm audit (high+critical)',
    paths: ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '**/Cargo.lock', '**/Cargo.toml', 'scripts/audit-*', 'security/**'], steps: [
    { name: 'Audit every npm and Cargo dependency root against current advisories', cmd: 'pnpm run audit:all', requires: ['cargo-audit'] },
    { name: 'Dependency lock inventory stays complete', cmd: 'pnpm run audit:all --check' },
    { name: 'SBOM up to date', cmd: 'pnpm run build:sbom && git diff --quiet -- sbom.cdx.json', ci: 'pnpm run build:sbom' },
    { name: 'Third-party notices complete and up to date', cmd: 'pnpm run build:licenses && git diff --quiet -- THIRD-PARTY-NOTICES.md shells/web/public/THIRD-PARTY-LICENSES.txt',
      ci: 'pnpm run build:licenses' },
    { name: 'Cargo license map covers the crate graph', cmd: 'pnpm run check:cargo-licenses' },
  ] },
  { id: 'sast', workflow: 'ci.yml', job: 'sast', title: 'opengrep (custom rules + new findings)',
    paths: ['shells/**', 'community/**', 'brands/**', 'engine/**', 'packages/**', 'services/**', 'scripts/**', '.github/opengrep/**'], steps: [
    { name: 'Lolly custom rules (full tree)', requires: ['opengrep'],
      cmd: "opengrep scan --error --no-git-ignore --config .github/opengrep/lolly-rules.yml --exclude node_modules --exclude dist --exclude '.claude' --exclude vendor --exclude '*.min.js' --exclude '*.test.ts' shells/ community/ brands/ engine/ packages/ services/ scripts/" },
  ] },
  { id: 'public-ready', workflow: 'ci.yml', job: 'public-ready', title: 'public-ready', paths: ALWAYS, steps: [],
    skip: hosted('Qualifies the exact hosted attempt through the GitHub API with the trusted base policy.') },
  { id: 'release-ready', workflow: 'ci.yml', job: 'release-ready', title: 'release-ready', paths: ALWAYS, steps: [],
    skip: hosted('Qualifies the exact hosted attempt through the GitHub API with the trusted base policy.') },
  { id: 'qualification', workflow: 'ci.yml', job: 'qualification', title: 'qualification', paths: ALWAYS, steps: [],
    skip: hosted('The required status check; it reads the other hosted jobs and cannot run anywhere else.') },
  // fast-lanes.yml
  { id: 'docs', workflow: 'fast-lanes.yml', job: 'docs', title: 'docs lane', paths: FAST_LANE_PATHS, steps: [
    { name: 'Tests that read the docs', cmd: 'node scripts/fast-lane-tests.ts docs' },
    { name: 'Docs nav completeness', cmd: 'pnpm run check:docs-nav' },
    { name: 'Build the /info site', cmd: 'pnpm run build:info' },
    { name: 'Docs wording gate (sources and built pages)', cmd: 'node scripts/check-docs-vernacular.ts' },
  ] },
  { id: 'web-checks', workflow: 'fast-lanes.yml', job: 'web-checks', title: 'web lane checks', paths: FAST_LANE_PATHS, steps: [
    { name: 'Typecheck the web shell and its tests', cmd: 'pnpm exec tsc -p shells/web && pnpm exec tsc -p shells/web/tsconfig.tests.json' },
    { name: 'No new first-party Biome diagnostics', cmd: 'pnpm run lint:changed --all' },
    { name: 'UI copy wording gate', cmd: 'pnpm run check:ui-copy' },
    { name: 'Code comment wording gate', cmd: 'pnpm run check:code-comments' },
    { name: 'CSS house rules ratchet', cmd: 'pnpm run check:house-rules' },
    { name: 'Locale innerHTML markup allowlist', cmd: 'pnpm run check:locale-markup' },
    { name: 'Web shell maintainability no-growth ratchet', cmd: 'pnpm run check:maintainability' },
  ] },
  { id: 'web-unit', workflow: 'fast-lanes.yml', job: 'web-unit', title: 'web lane unit (1/2, 2/2)', paths: FAST_LANE_PATHS, steps: [
    { name: 'Web unit tests, part 1/2', cmd: 'node scripts/fast-lane-tests.ts web-unit 1/2', ci: `node scripts/fast-lane-tests.ts web-unit ${X('matrix.part')}` },
    { name: 'Web unit tests, part 2/2', cmd: 'node scripts/fast-lane-tests.ts web-unit 2/2', ci: `node scripts/fast-lane-tests.ts web-unit ${X('matrix.part')}` },
  ] },
  { id: 'web-browser', workflow: 'fast-lanes.yml', job: 'web-browser', title: 'web lane build and browser', paths: FAST_LANE_PATHS, steps: [
    { name: 'Production build (info site, cards and web shell)', cmd: 'pnpm run build:web', env: { LOLLY_PROFILE: 'lolly-demo' } },
    { name: 'Bundle budget', cmd: 'pnpm run check:bundle' },
    { name: 'Docs size budget', cmd: 'pnpm run check:docs-size' },
    { name: 'Security shard (headers, CSP, integrity, sanitising)', cmd: 'pnpm run test:security', requires: ['chromium'] },
    { name: 'Gallery, one tool and one export in Chromium', requires: ['chromium', 'journey-shell'],
      cmd: 'node scripts/web-lane-check.ts "$LOLLY_WEB_BASE" artifacts/web-lane-check', ci: 'node scripts/web-lane-check.ts http://127.0.0.1:4188 artifacts/web-lane-check' },
  ] },
  { id: 'web', workflow: 'fast-lanes.yml', job: 'web', title: 'web lane', paths: FAST_LANE_PATHS, steps: [],
    skip: hosted('Aggregates the four hosted lane jobs; the deploy tooling reads it by name.') },
];

// ---------------------------------------------------------------------------
// Selection

// Match a path against one workflow-style glob: a lone double star, a directory followed by a double star, a double star followed by a name, a prefix ending in a star, or an exact name.
export function matchesGlob(file: string, glob: string): boolean {
  if (glob === '**') return true;
  if (glob.startsWith('**/')) return file === glob.slice(3) || file.endsWith(`/${glob.slice(3)}`);
  if (glob.endsWith('/**')) return file.startsWith(glob.slice(0, -2));
  if (glob.endsWith('*')) return file.startsWith(glob.slice(0, -1));
  return file === glob;
}

export interface Selection { lane: Lane; selected: boolean; why: string; skipDetail?: string }

export const BUILD_SKIP_REASON = 'skipped: builds the web shell (pass --with-build to run)';
/** A lane builds the web shell when any step runs build:web. That build rewrites tracked files such as the brand OG images. */
export const buildsWebShell = (lane: Lane): boolean => lane.steps.some(step => step.cmd.includes('build:web'));

export function changesFromRaw(raw: string): Change[] {
  const records = raw.split('\0');
  if (records[records.length - 1] === '') records.pop();
  const out: Change[] = [];
  for (let i = 0; i + 1 < records.length; i += 2) {
    const match = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ [A-Z]\d*$/.exec(records[i] ?? '');
    if (match) out.push({ path: records[i + 1]!, beforeMode: match[1]!, afterMode: match[2]! });
  }
  return out;
}

export function changedFiles(base = 'origin/main'): Change[] {
  const result = spawnSync('git', ['diff', '--raw', '-z', '--no-abbrev', '--no-renames', `${base}...HEAD`], { cwd: REPO, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git diff ${base}...HEAD failed: ${String(result.stderr).trim() || 'is origin/main fetched?'}`);
  return changesFromRaw(result.stdout);
}

/** Decide which lanes --changed runs. Pure: the caller supplies the changes. */
export function selectLanes(lanes: readonly Lane[], changes: readonly Change[] | null, withBuild = false): Selection[] {
  if (!changes) return lanes.map(lane => ({ lane, selected: true, why: 'all lanes' }));
  if (!changes.length) return lanes.map(lane => ({ lane, selected: false, why: 'no changes against origin/main' }));
  const docsAndTests = classifyDocsAndTests([...changes]).docsAndTestsEligible;
  const dependencyChange = touchesDependencies([...changes]);
  return lanes.map((lane): Selection => {
    if (!withBuild && buildsWebShell(lane)) return { lane, selected: false, why: BUILD_SKIP_REASON, skipDetail: BUILD_SKIP_REASON };
    if (lane.heavy && docsAndTests) return { lane, selected: false, why: 'docs-and-tests change: CI leaves the heavy tier out' };
    if (lane.id === 'audit' && !dependencyChange) return { lane, selected: false, why: 'no dependency manifest or lockfile changed' };
    const hit = changes.find(change => lane.paths.some(glob => matchesGlob(change.path, glob)));
    return hit ? { lane, selected: true, why: `matches ${hit.path}` } : { lane, selected: false, why: 'no changed path matches' };
  });
}

// ---------------------------------------------------------------------------
// Tool probes

export type Has = (requirement: Requirement) => string | null;

const onPath = (tool: string): boolean => spawnSync('sh', ['-c', `command -v ${tool}`], { stdio: 'ignore' }).status === 0;

function playwrightHas(browser: 'chromium' | 'firefox' | 'webkit'): boolean {
  const script = `import { ${browser} } from 'playwright'; import { existsSync } from 'node:fs'; process.exit(existsSync(${browser}.executablePath()) ? 0 : 1);`;
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: REPO, stdio: 'ignore' }).status === 0;
}

const HINTS: Record<Requirement, string> = {
  chromium: 'Playwright Chromium is not installed (pnpm exec playwright install chromium)',
  firefox: 'Playwright Firefox is not installed',
  webkit: 'Playwright WebKit is not installed',
  ffmpeg: 'ffmpeg and ffprobe are not on PATH',
  gitleaks: 'gitleaks is not installed (CI pins 8.29.1; set GITLEAKS_BIN if it is off PATH)',
  qpdf: 'qpdf is not installed',
  c2patool: 'c2patool is not installed',
  caddy: 'caddy is not installed',
  cargo: 'cargo is not installed',
  'cargo-audit': 'cargo-audit is not installed',
  opengrep: 'opengrep is not installed',
  webgpu: 'no WebGPU adapter is confirmed (the browser lane needs one; Chromium with SwiftShader on Linux, or a real GPU)',
  'journey-shell': 'LOLLY_EXPORT_TEST_URL and LOLLY_WEB_BASE are unset: start a preview of a build on a port other than 5173 and export both',
};

const GITLEAKS_PIN = '8.29.1';

/** Why gitleaks cannot be used, naming the version CI pins, or null when the right one is on PATH. */
function gitleaksProblem(): string | null {
  const bin = process.env.GITLEAKS_BIN?.trim() || 'gitleaks';
  const result = spawnSync(bin, ['version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return HINTS.gitleaks;
  const found = /\d+\.\d+\.\d+/.exec(String(result.stdout))?.[0];
  if (found === GITLEAKS_PIN) return null;
  return `gitleaks ${found ?? 'of unknown version'} is installed but CI pins ${GITLEAKS_PIN}; install ${GITLEAKS_PIN} or point GITLEAKS_BIN at it`;
}

/** The real probe. Returns null when the requirement is met, else the reason it is not. */
export function systemHas(requirement: Requirement): string | null {
  const ok = (() => {
    switch (requirement) {
      case 'chromium': case 'firefox': case 'webkit': return playwrightHas(requirement);
      case 'ffmpeg': return onPath('ffmpeg') && onPath('ffprobe');
      case 'gitleaks': return gitleaksProblem() === null;
      case 'journey-shell': return Boolean(process.env.LOLLY_EXPORT_TEST_URL && process.env.LOLLY_WEB_BASE);
      // Confirmed by the WebGPU conformance step itself, never assumed. Chromium must exist first.
      case 'webgpu': return playwrightHas('chromium') && webgpuConfirmed;
      default: return onPath(requirement);
    }
  })();
  if (ok) return null;
  return requirement === 'gitleaks' ? gitleaksProblem() : HINTS[requirement];
}

/** Set once the WebGPU conformance step has actually passed in this run. */
let webgpuConfirmed = false;

// ---------------------------------------------------------------------------
// Running

export type StepStatus = 'passed' | 'failed' | 'not run' | 'differs';
export type LaneStatus = 'passed' | 'failed' | 'not run' | 'skipped' | 'unselected';
export interface StepResult { step: Step; status: StepStatus; detail?: string; seconds: number }
export interface LaneResult { lane: Lane; status: LaneStatus; detail: string; steps: StepResult[] }

export type Exec = (step: Step) => { status: number | null; error?: string };

const realExec: Exec = (step) => {
  const result = spawnSync('sh', ['-c', step.cmd], {
    cwd: REPO, stdio: 'inherit', env: { ...process.env, ...CONCURRENCY, ...step.env },
  });
  return { status: result.status, ...(result.error ? { error: result.error.message } : {}) };
};

/** Run one lane. A step whose requirement is missing is NOT RUN, and the lane can then never read as passed. */
export function runLane(lane: Lane, selection: Selection, has: Has = systemHas, exec: Exec = realExec): LaneResult {
  if (lane.skip) return { lane, status: 'skipped', detail: lane.skip, steps: [] };
  if (selection.skipDetail) return { lane, status: 'skipped', detail: selection.skipDetail, steps: [] };
  if (!selection.selected) return { lane, status: 'unselected', detail: selection.why, steps: [] };
  const steps: StepResult[] = [];
  let blocked: string | null = null;
  for (const step of lane.steps) {
    const started = Date.now();
    const seconds = () => Math.round((Date.now() - started) / 100) / 10;
    if (step.advisory && steps.at(-1)?.status !== 'passed') {
      steps.push({ step, status: 'not run', detail: 'the step before it did not pass, so there is no skip report to compare', seconds: 0 });
      continue;
    }
    if (blocked && step.requires?.includes('webgpu')) {
      steps.push({ step, status: 'not run', detail: blocked, seconds: 0 });
      continue;
    }
    const missing = (step.requires ?? []).map(has).filter((reason): reason is string => reason !== null);
    if (missing.length) {
      steps.push({ step, status: 'not run', detail: missing.join('; '), seconds: 0 });
      continue;
    }
    console.log(`\n--- ${lane.id}: ${step.name}\n    $ ${step.cmd}`);
    const outcome = exec(step);
    const passed = outcome.status === 0;
    if (step.cmd === 'pnpm run test:webgpu') {
      webgpuConfirmed = passed;
      if (!passed) blocked = 'the WebGPU conformance step did not pass here, so no adapter is confirmed; run pnpm run test:webgpu to see why';
    }
    if (passed) steps.push({ step, status: 'passed', seconds: seconds() });
    else if (step.advisory) steps.push({ step, status: 'differs', detail: 'differs from the CI result, usually a tool CI installs is missing here', seconds: seconds() });
    else steps.push({ step, status: 'failed', detail: outcome.error ?? `exit ${outcome.status}`, seconds: seconds() });
  }
  const failed = steps.filter(s => s.status === 'failed').length;
  const notRun = steps.filter(s => s.status === 'not run').length;
  if (failed) return { lane, status: 'failed', detail: `${failed} step${failed === 1 ? '' : 's'} failed`, steps };
  if (notRun) return { lane, status: 'not run', detail: `${notRun} of ${steps.length} steps could not run on this machine`, steps };
  return { lane, status: 'passed', detail: `${steps.length} step${steps.length === 1 ? '' : 's'}`, steps };
}

// ---------------------------------------------------------------------------
// Output

export function listLanes(selections: readonly Selection[], changed: boolean): string {
  const out: string[] = [];
  for (const { lane, selected, why } of selections) {
    const state = lane.skip ? 'SKIPPED' : changed && !selected ? 'not selected' : 'runs';
    out.push(`${lane.id}  [${lane.workflow} / ${lane.job}]  ${lane.title}  (${state})`);
    if (lane.skip) out.push(`    skipped: ${lane.skip}`);
    else if (changed && !selected) out.push(`    ${why}`);
    for (const step of lane.steps) {
      out.push(`    - ${step.name}`);
      out.push(`        $ ${step.cmd}`);
      if (step.requires?.length) out.push(`        needs: ${step.requires.join(', ')}`);
    }
  }
  return `${out.join('\n')}\n`;
}

export function summary(results: readonly LaneResult[]): string {
  const out = ['', '=== ci:local summary ==='];
  for (const r of results) {
    if (r.status === 'unselected') continue;
    const label = r.status.toUpperCase();
    out.push(`${label.padEnd(8)} ${r.lane.id}: ${r.detail}`);
    for (const s of r.steps) if (s.status !== 'passed') out.push(`           ${s.status.toUpperCase()} ${s.step.name}${s.detail ? `: ${s.detail}` : ''}`);
  }
  const unselected = results.filter(r => r.status === 'unselected');
  if (unselected.length) out.push(`Not selected by --changed: ${unselected.map(r => r.lane.id).join(', ')}`);
  const count = (status: LaneStatus) => results.filter(r => r.status === status).length;
  out.push(`${count('passed')} passed, ${count('failed')} failed, ${count('not run')} not run, ${count('skipped')} skipped (hosted or builds the web shell).`);
  if (count('not run')) out.push('A lane marked NOT RUN has not been checked here. It is not a pass; CI will still run it.');
  return `${out.join('\n')}\n`;
}

export interface Options { list: boolean; changed: boolean; strict: boolean; withBuild: boolean; only: string[] | null; skip: string[]; base: string }

export function parseArgs(argv: readonly string[]): Options {
  const options: Options = { list: false, changed: false, strict: false, withBuild: false, only: null, skip: [], base: 'origin/main' };
  const ids = new Set(LANES.map(lane => lane.id));
  for (const arg of argv) {
    if (arg === '--list') options.list = true;
    else if (arg === '--changed') options.changed = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--with-build') options.withBuild = true;
    else if (arg.startsWith('--only=') || arg.startsWith('--skip=')) {
      const names = arg.slice(arg.indexOf('=') + 1).split(',').map(s => s.trim()).filter(Boolean);
      const unknown = names.filter(name => !ids.has(name));
      if (unknown.length) throw new Error(`Unknown lane: ${unknown.join(', ')}. Run pnpm run ci:local --list for the ids.`);
      if (arg.startsWith('--only=')) options.only = names; else options.skip.push(...names);
    } else throw new Error(`Unknown argument: ${arg}. Use --list, --changed, --only=ids, --skip=ids, --with-build or --strict.`);
  }
  return options;
}

export function main(argv = process.argv.slice(2)): number {
  const options = parseArgs(argv);
  const selections = selectLanes(LANES, options.changed ? changedFiles(options.base) : null, options.withBuild).map((selection): Selection => {
    if (options.only && !options.only.includes(selection.lane.id)) return { ...selection, selected: false, why: 'not named by --only' };
    if (options.skip.includes(selection.lane.id)) return { ...selection, selected: false, why: 'named by --skip' };
    return selection;
  });
  const narrowed = options.changed || options.only !== null || options.skip.length > 0;
  if (options.list) {
    process.stdout.write(listLanes(selections, narrowed));
    return 0;
  }
  mkdirSync(path.join(REPO, 'artifacts/ci-local'), { recursive: true });
  if (!existsSync(path.join(REPO, 'node_modules'))) throw new Error('Run pnpm install --frozen-lockfile first.');
  const results = selections.map(selection => runLane(selection.lane, selection));
  process.stdout.write(summary(results));
  if (results.some(r => r.status === 'failed')) return 1;
  if (options.strict && results.some(r => r.status === 'not run')) return 3;
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(); } catch (error) { console.error(`ci:local: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 2; }
}
