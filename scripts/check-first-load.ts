// SPDX-License-Identifier: MPL-2.0
/**
 * Cold-load smoke gate: headless Lighthouse (mobile) against a deployed URL.
 *
 * WHY THIS EXISTS
 * The first-use audit behind plans/155-first-use-quality.md measured lolly.tools at a
 * 0.36 mobile performance score, and every regression that got it there was invisible to
 * the existing gates: `check:bundle` only weighs boot JS from a local dist, and nothing at
 * all looked at what a phone actually downloads on a cold visit. The most embarrassing
 * findings were not "too big" but "twice" - index.html fetched 3x, the variable font 2x,
 * `catalog/assets/index.json` 2x, `bundle.json` 2x - bytes paid for nothing, produced by
 * a rewrite rule and a service-worker precache list rather than by any code anyone read.
 *
 * So this measures the deployed thing, and the duplicate-fetch assertion below is the one
 * that would have caught all four. It is the gate `loldev ship` runs between the preview
 * deploy and the promote (plan 155 Task 6.3): a regression stops at the preview URL
 * instead of landing on production.
 *
 * Usage: node scripts/check-first-load.ts <url> [--json=<path>]
 *
 * LIGHTHOUSE IS DELIBERATELY NOT A REPO DEPENDENCY. It pulls a Chrome-driving toolchain
 * (~50 MB) into every `npm install` for a check that only runs on a deploy, so this script
 * finds whatever copy is already resolvable - a local bin, a global install, or the npx
 * cache - and only fetches one as a last resort. When none of that works it says what to
 * install, rather than dying in a spawn ENOENT stack.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- Thresholds (tune here) --------------------------------------------------
// Phase-1 numbers from plan 155: they are set just under what a fixed Phase-1 deploy
// measures, so they ratify the repair and stop the next slide - they are NOT the target.
// RATCHET THEM ONCE PHASE 2 IS DEPLOYED (WP-3 + WP-4, the boot-JS diet): score 0.80,
// LCP 3000 ms, TBT 400 ms. Moving a number the other way - loosening one so a red run
// goes green - defeats the whole file; fix the deploy instead.
const MIN_PERFORMANCE_SCORE = 0.6; // ratchet to 0.80
const MAX_LCP_MS = 4000; // ratchet to 3000
const MAX_TBT_MS = 800; // ratchet to 400
// Transfer + request ceilings for the whole cold load, counted off the same
// `network-requests` audit as the duplicate check so every number here has one source.
const MAX_TRANSFER_BYTES = 2.0 * 1024 * 1024;
const MAX_REQUESTS = 250;
// Every <link rel="modulepreload"> in the served HTML is a connection the browser opens
// before it paints. The boot-JS budget (check-bundle-budget.ts) weighs those files; this
// counts them, because 100+ preloads costs scheduling and connection time that no byte
// budget can see.
const MAX_MODULEPRELOADS = 95;
// -----------------------------------------------------------------------------

// Lighthouse's DEFAULT preset is mobile (Moto G Power, 4x CPU throttle, slow 4G) - that is
// the measurement the plan's targets are stated in, so this passes no --preset at all.
// Do not "fix" a red run by adding --preset=desktop; it measures a different thing.
const CHROME_FLAGS = process.env.LOLLY_LH_CHROME_FLAGS ?? '--headless=new --no-sandbox';
const LH_TIMEOUT_MS = 5 * 60 * 1000;
// Only used when NO lighthouse is resolvable and one has to be fetched. Pinned to a major
// because Lighthouse's scoring curves move between majors - an unpinned fetch could flip
// MIN_PERFORMANCE_SCORE without a line of this repo changing.
const LIGHTHOUSE_PIN = 'lighthouse@12';

const USAGE = `Usage: node scripts/check-first-load.ts <url> [--json=<path>]

  <url>          the deployment to measure - a preview URL before promoting it,
                 or https://lolly.tools to check production for drift
  --json=<path>  keep the full Lighthouse report at this path (it is kept in a
                 temp file and its location printed whenever a check fails)`;

const args = process.argv.slice(2);
const jsonArg = args.find((a) => a.startsWith('--json='));
const keepReportAt = jsonArg ? path.resolve(jsonArg.slice('--json='.length)) : null;
const urlArg = args.find((a) => !a.startsWith('-'));

// Exit 2 for "you called it wrong", so a caller can tell misuse from a budget failure (1).
function usageError(msg: string): never {
  console.error(`✗ first-load smoke: ${msg}\n\n${USAGE}`);
  process.exit(2);
}

if (!urlArg) usageError('no URL given');
let target: URL;
try {
  target = new URL(urlArg!);
} catch {
  usageError(`\`${urlArg}\` is not a URL`);
}
if (target!.protocol !== 'http:' && target!.protocol !== 'https:') {
  usageError(`\`${urlArg}\` is not an http(s) URL - this measures a deployed site`);
}

function fail(msg: string): never {
  console.error(`✗ first-load smoke FAILED: ${msg}`);
  process.exit(1);
}

let failures = 0;
function report(name: string, ok: boolean, detail: string, lines: string[] = []): void {
  console.log(`${ok ? '✓' : '✗'} ${name} - ${detail}`);
  for (const line of lines) console.log(`    ${line}`);
  if (!ok) failures++;
}

const mb = (n: number) => (n / 1024 / 1024).toFixed(2);
const kb = (n: number) => (n / 1024).toFixed(1);
const secs = (ms: number) => (ms / 1000).toFixed(2);

// --- Find a Lighthouse to run ------------------------------------------------
// In preference order; each candidate but the last is probed with --version, which is
// cheap. The last one FETCHES, so it is never probed - it is only reached when nothing
// is installed, and its own failure produces the install message below.
interface Runner {
  cmd: string;
  pre: string[];
  label: string;
}
const localBin = path.join(root, 'node_modules/.bin/lighthouse');
const candidates: Runner[] = [
  ...(existsSync(localBin) ? [{ cmd: localBin, pre: [], label: 'node_modules/.bin/lighthouse' }] : []),
  { cmd: 'lighthouse', pre: [], label: 'lighthouse (PATH)' },
  { cmd: 'npx', pre: ['--no', 'lighthouse'], label: 'npx lighthouse (cached)' },
];

let runner: Runner | null = null;
let lhVersion = '';
for (const c of candidates) {
  const probe = spawnSync(c.cmd, [...c.pre, '--version'], { encoding: 'utf8', timeout: 60_000 });
  if (probe.status === 0 && probe.stdout.trim()) {
    runner = c;
    lhVersion = probe.stdout.trim().split('\n').pop() ?? '';
    break;
  }
}
if (!runner) {
  console.log(`• no Lighthouse installed - fetching ${LIGHTHOUSE_PIN} via npx (one-off, ~50 MB)`);
  runner = { cmd: 'npx', pre: ['--yes', LIGHTHOUSE_PIN], label: `npx ${LIGHTHOUSE_PIN}` };
} else {
  console.log(`• lighthouse ${lhVersion} via ${runner.label}`);
}

// --- Run it ------------------------------------------------------------------
const tmp = mkdtempSync(path.join(tmpdir(), 'lolly-first-load-'));
const reportPath = path.join(tmp, 'lighthouse.json');
console.log(`• measuring ${target!.href} (mobile preset, cold load - this takes a minute)`);
const run = spawnSync(
  runner.cmd,
  [
    ...runner.pre,
    target!.href,
    '--only-categories=performance',
    '--output=json',
    `--output-path=${reportPath}`,
    `--chrome-flags=${CHROME_FLAGS}`,
    '--quiet',
  ],
  { cwd: root, encoding: 'utf8', timeout: LH_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
);

const stderrTail = (run.stderr ?? '').trim().split('\n').slice(-12).join('\n');
if (run.error || !existsSync(reportPath)) {
  const why = run.error ? String(run.error) : `exited ${run.status}`;
  if (/ENOENT|could not determine executable|npm error 404|not found/i.test(`${why}\n${stderrTail}`)) {
    fail(
      `could not run Lighthouse (${why}).\n` +
        '  Lighthouse is deliberately not a repo dependency. Install it once with\n' +
        `  \`npm i -g ${LIGHTHOUSE_PIN}\`, or let npx fetch it (\`npx --yes ${LIGHTHOUSE_PIN} --version\`),\n` +
        '  then re-run. A Chrome/Chromium the launcher can find must be installed too.',
    );
  }
  if (/No Chrome installations|CHROME_PATH|ChromeLauncher/i.test(stderrTail)) {
    fail(
      `Lighthouse found no Chrome to drive (${why}).\n` +
        '  Install Chrome/Chromium, or point CHROME_PATH at one.\n' +
        `  Lighthouse said:\n${stderrTail}`,
    );
  }
  fail(`Lighthouse ${why} and wrote no report.\n${stderrTail}`);
}

interface NetworkRequest {
  url: string;
  transferSize?: number;
}
interface Lhr {
  runtimeError?: { code?: string; message?: string };
  categories?: { performance?: { score?: number | null } };
  audits?: Record<string, { numericValue?: number; details?: { items?: NetworkRequest[] } }>;
}
let lhr: Lhr;
try {
  lhr = JSON.parse(readFileSync(reportPath, 'utf8')) as Lhr;
} catch (err) {
  fail(`Lighthouse report at ${reportPath} is not readable JSON: ${(err as Error).message}`);
}
// A page that never loaded still produces a report - with every metric null and a score of
// 0. Without this the run would read as "all budgets blown" instead of "the URL is down",
// which is exactly the wrong thing to tell someone mid-ship.
if (lhr!.runtimeError?.code) {
  fail(
    `Lighthouse could not load the page (${lhr!.runtimeError.code}): ` +
      `${lhr!.runtimeError.message ?? 'no message'}\n  Is ${target!.href} deployed and public?`,
  );
}

// --- Assertions --------------------------------------------------------------
const audits = lhr!.audits ?? {};
const score = lhr!.categories?.performance?.score;
if (typeof score !== 'number') {
  fail('the report carries no performance score - did the run only produce partial results?');
}
report(
  'performance score',
  score >= MIN_PERFORMANCE_SCORE,
  `${score.toFixed(2)} (min ${MIN_PERFORMANCE_SCORE.toFixed(2)})`,
);

const metric = (id: string): number | undefined => audits[id]?.numericValue;
const fcp = metric('first-contentful-paint');
if (typeof fcp === 'number') console.log(`• first-contentful-paint ${secs(fcp)} s (not gated here)`);

const lcp = metric('largest-contentful-paint');
report(
  'largest-contentful-paint',
  typeof lcp === 'number' && lcp <= MAX_LCP_MS,
  typeof lcp === 'number' ? `${secs(lcp)} s (max ${secs(MAX_LCP_MS)} s)` : 'not measured',
);

const tbt = metric('total-blocking-time');
report(
  'total-blocking-time',
  typeof tbt === 'number' && tbt <= MAX_TBT_MS,
  typeof tbt === 'number' ? `${Math.round(tbt)} ms (max ${MAX_TBT_MS} ms)` : 'not measured',
);

// One pass over `network-requests` feeds the next three checks. Only http(s) entries
// count: data:/blob: rows are inlined bytes the browser never fetched, and a service
// worker's own requests DO count - a URL the page loads and the SW precaches separately
// is downloaded twice for real, which is precisely the bundle.json regression this catches.
const requests = (audits['network-requests']?.details?.items ?? []).filter((r) =>
  /^https?:/i.test(r.url ?? ''),
);
if (requests.length === 0) {
  fail('the network-requests audit listed nothing - the page loaded no resources at all?');
}
const transferTotal = requests.reduce((sum, r) => sum + (r.transferSize ?? 0), 0);
report(
  'total transfer',
  transferTotal <= MAX_TRANSFER_BYTES,
  `${mb(transferTotal)} MB (max ${mb(MAX_TRANSFER_BYTES)} MB)`,
);
report('request count', requests.length <= MAX_REQUESTS, `${requests.length} (max ${MAX_REQUESTS})`);

const byUrl = new Map<string, { count: number; bytes: number }>();
for (const r of requests) {
  const seen = byUrl.get(r.url) ?? { count: 0, bytes: 0 };
  seen.count++;
  seen.bytes += r.transferSize ?? 0;
  byUrl.set(r.url, seen);
}
const dupes = [...byUrl.entries()]
  .filter(([, v]) => v.count > 1)
  .sort((a, b) => b[1].count - a[1].count || b[1].bytes - a[1].bytes);
const dupeBytes = dupes.reduce((sum, [, v]) => sum + v.bytes - v.bytes / v.count, 0);
report(
  'no duplicate fetches',
  dupes.length === 0,
  dupes.length === 0
    ? `${byUrl.size} unique URLs, each fetched once`
    : `${dupes.length} URL(s) fetched more than once, ~${kb(dupeBytes)} KB re-downloaded`,
  dupes.map(([url, v]) => `${v.count}x  ${kb(v.bytes)} KB  ${url}`),
);

// The served HTML, not the built dist: a rewrite, an edge transform or a stale deploy can
// all make what ships differ from what `npm run build:web` produced. Same regex shape as
// check-bundle-budget.ts, which counts the same links against the local build.
try {
  const res = await fetch(target!.href, { headers: { accept: 'text/html' } });
  const html = await res.text();
  if (!res.ok) {
    report('modulepreload count', false, `HTTP ${res.status} fetching the HTML`);
  } else {
    const preloads = [...html.matchAll(/<link[^>]*\brel=["']modulepreload["'][^>]*>/gi)].length;
    report(
      'modulepreload count',
      preloads <= MAX_MODULEPRELOADS,
      `${preloads} in the served HTML (max ${MAX_MODULEPRELOADS})`,
    );
  }
} catch (err) {
  report('modulepreload count', false, `could not fetch the HTML: ${(err as Error).message}`);
}

// --- Report file + verdict ---------------------------------------------------
if (keepReportAt) {
  writeFileSync(keepReportAt, readFileSync(reportPath));
  console.log(`• full Lighthouse report written to ${keepReportAt}`);
}
if (failures > 0) {
  // Keep the temp report on failure - the numbers above say WHAT blew, the report says why.
  console.error(
    `\n${failures} first-load check(s) failed against ${target!.href}\n` +
      `Full Lighthouse report: ${reportPath}`,
  );
  process.exit(1);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`\n✓ first-load smoke passed against ${target!.href}`);
