// SPDX-License-Identifier: MPL-2.0
/**
 * tool-browser-free - decide, from evidence, which tools the Node shells may draw as a
 * PNG with resvg and no browser, and write each tool's `browser-free.json` record.
 *
 *   node scripts/tool-browser-free.ts                    # report: each measured tool's record and whether it admits
 *   node scripts/tool-browser-free.ts --verify           # + draw every case through both tiers and compare
 *   node scripts/tool-browser-free.ts --verify --write   # + write each tool's record from the evidence
 *   node scripts/tool-browser-free.ts --write --from=<dir>   # reuse a finished --verify run's results.json
 *
 *   --tools=a,b   only these tools      --out=<dir>   where the run's files go (default: a temp folder)
 *   --web-commit=<sha>   the commit the compared web shell was built from (default: this checkout's HEAD)
 *
 * The same shape as scripts/tool-isolation.ts, which writes `isolate` from evidence, but the
 * evidence goes beside `tool.json` rather than into it (packages/node-shell/src/
 * browser-free-record.ts), so no engine or app ever reads it. A record's verdict is `resvg`
 * only when the tool has at least one case the per-render checks admit and every such case
 * is inside every plan 326 band against the browser tier (scripts/lib/browser-free/
 * compare.ts); otherwise `browser`. The cases live in scripts/data/browser-free-cases.json.
 * The record admits a tool; each render is still judged by packages/node-shell/src/
 * resvg-admission.ts.
 *
 * Needs a built web shell (LOLLY_WEB_DIST, or shells/web/dist), a Chromium the node shell
 * can launch, and sharp. Without them it says so by name and writes nothing. Each case
 * runs the real CLI twice (about a second for resvg, about seven for the browser tier), so
 * this is a maintainer's job after a change to a tool's drawing or to the route, and is
 * never part of ordinary CI. The cases use the lolly-demo pictures, so run it with
 * LOLLY_PROFILE=lolly-demo; a case whose picture the active profile lacks is reported.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BANDS } from './lib/browser-free/compare.ts';
import { BROWSER_FREE_FILE, BROWSER_FREE_RECORD_VERSION, browserFreeStatus, readBrowserFreeRecord, toolSourceDigest, type BrowserFreeRecordV1 } from '../packages/node-shell/src/browser-free-record.ts';
import { toolFile } from '../packages/node-shell/src/content-roots.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CASES_FILE = join(ROOT, 'scripts', 'data', 'browser-free-cases.json');
const HOOK = join(ROOT, 'scripts', 'lib', 'browser-free', 'tier-hook.ts');

export interface BrowserFreeCase { name: string; tool: string; aim: string; args: string[] }

/** One case's outcome: drawn by resvg and compared, or refused by the per-render checks. */
export interface CaseOutcome {
  name: string;
  tool: string;
  /** The case's arguments and the tool's files (`toolDigest`) when it was measured. */
  args?: string[];
  digest?: string;
  drawn: boolean;
  inBands?: boolean;
  faults?: string[];
  refusal?: string;
  error?: string;
}

/** The verdict for one tool: flagged only with at least one drawn case and none outside a band. */
export function browserFreeVerdict(outcomes: readonly CaseOutcome[]): { eligible: boolean; drawn: number; inside: number; outside: string[]; refused: number; errors: string[] } {
  const drawn = outcomes.filter((o) => o.drawn);
  const outside = drawn.filter((o) => !o.inBands).map((o) => o.name);
  const errors = outcomes.filter((o) => o.error).map((o) => `${o.name}: ${o.error}`);
  return { eligible: drawn.length > 0 && outside.length === 0 && errors.length === 0, drawn: drawn.length, inside: drawn.length - outside.length, outside, refused: outcomes.filter((o) => !o.drawn && !o.error).length, errors };
}

/**
 * Outcomes reused with `--from` count only when they cover every current case of the tool,
 * with the same arguments, over the same tool files. Anything else is reported as missing
 * evidence and the flag is left as it is.
 */
export function staleEvidence(outcomes: readonly CaseOutcome[], cases: readonly BrowserFreeCase[], tool: string, digest: string): string | null {
  const mine = outcomes.filter((o) => o.tool === tool);
  for (const c of cases.filter((x) => x.tool === tool)) {
    const o = mine.find((m) => m.name === c.name);
    if (!o) return `no result for ${c.name}`;
    if (JSON.stringify(o.args ?? null) !== JSON.stringify(c.args)) return `${c.name} was measured with other arguments`;
  }
  if (mine.some((o) => o.digest !== digest)) return 'the tool\'s files changed since it was measured';
  return null;
}

export function loadCases(file = CASES_FILE): BrowserFreeCase[] {
  return (JSON.parse(readFileSync(file, 'utf8')) as { cases: BrowserFreeCase[] }).cases;
}

/** Why the measurement cannot run here, or null when it can. */
function missingPrerequisite(): string | null {
  const dist = process.env.LOLLY_WEB_DIST || join(ROOT, 'shells', 'web', 'dist');
  if (!existsSync(join(dist, 'index.html'))) return `no built web shell at ${dist} (run \`pnpm run build:web\`, or set LOLLY_WEB_DIST)`;
  try { createRequire(join(ROOT, 'packages', 'node-shell', 'package.json')).resolve('sharp'); } catch { return 'sharp is not installed'; }
  return null;
}

/** Run one case through the real CLI on one tier; the stderr says which tier wrote the file. */
function runCli(tier: 'A' | 'B', c: BrowserFreeCase, args: string[], out: string, env: Record<string, string>, noWeb: string): { status: number | null; stderr: string; tier: 'A' | 'B' | null } {
  const r = spawnSync(process.execPath, ['--import', HOOK, 'shells/cli/bin/lolly.ts', c.tool, ...args, '--export=png', '--no-provenance', `--output=${out}`], {
    cwd: ROOT, encoding: 'utf8', timeout: 300_000, maxBuffer: 64 << 20,
    env: {
      ...process.env, NO_COLOR: '1', LOLLY_RENDERER: 'chromium', BROWSER_FREE_ALL: '1', BROWSER_FREE_TIER: tier,
      ...(tier === 'A' ? { LOLLY_WEB_DIST: noWeb } : {}), ...env,
    },
  });
  const stderr = r.stderr ?? '';
  return { status: r.status, stderr, tier: /BROWSER_FREE tierA/.test(stderr) ? 'A' : /BROWSER_FREE tierB/.test(stderr) || tier === 'B' && r.status === 0 ? 'B' : null };
}

/** Draw every case through both tiers and compare. Writes results.json into `out`. */
export async function verifyCases(cases: readonly BrowserFreeCase[], out: string): Promise<CaseOutcome[]> {
  const require = createRequire(join(ROOT, 'packages', 'node-shell', 'package.json'));
  const sharp = require('sharp');
  const { compareCase } = await import('./lib/browser-free/compare.ts');
  const { layoutRegions } = await import('./lib/browser-free/regions.ts');
  const { getBrowser, closeBrowser } = await import('../packages/node-shell/src/browsers.ts');
  const { rasterizeSvgToRgba } = await import('../packages/node-shell/src/raster.ts');
  const { readAssetIndex, contentUrlFile } = await import('../packages/node-shell/src/content-roots.ts');
  for (const d of ['resvg', 'browser', 'svg', 'tagged', 'no-web']) mkdirSync(join(out, d), { recursive: true });

  // {alphaPng}: the demo's wide picture as a PNG with transparency, 1075 x 656.
  const alphaPng = join(out, 'alpha.png');
  const wide = (readAssetIndex() as { assets?: Array<{ id?: string; formats?: Array<{ url?: string }> }> }).assets?.find((a) => a.id === 'lolly/demo/sample-wide')?.formats?.[0]?.url;
  const wideFile = wide ? contentUrlFile(wide) : null;
  if (wideFile) {
    const { width = 1075, height = 656 } = await sharp(wideFile).metadata();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width * 0.48}" ry="${height * 0.46}" fill="#fff"/></svg>`);
    await sharp(wideFile).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toFile(alphaPng);
  }

  const outcomes: CaseOutcome[] = [];
  const stamp = (o: CaseOutcome, c: BrowserFreeCase): void => {
    outcomes.push({ ...o, args: c.args, ...(toolFile(c.tool, 'tool.json') ? { digest: toolSourceDigest(c.tool) } : {}) });
  };
  const browser = await getBrowser();
  chromiumVersion = browser.version();
  const page = await browser.newPage();
  try {
    for (const c of cases) {
      if (!toolFile(c.tool, 'tool.json')) { stamp({ name: c.name, tool: c.tool, drawn: false, error: 'tool not in this profile' }, c); continue; }
      if (c.args.some((a) => a.includes('{alphaPng}')) && !existsSync(alphaPng)) { stamp({ name: c.name, tool: c.tool, drawn: false, error: 'the lolly/demo/sample-wide picture is not in this profile' }, c); continue; }
      const args = c.args.map((a) => a.split('{alphaPng}').join(alphaPng));
      const resvgPng = join(out, 'resvg', `${c.name}.png`), browserPng = join(out, 'browser', `${c.name}.png`), svgFile = join(out, 'svg', `${c.name}.svg`);
      const a = runCli('A', c, args, resvgPng, {}, join(out, 'no-web'));
      if (a.tier !== 'A' || a.status !== 0) {
        const refusal = /not used because ([\s\S]*?)\. (?:Drawing|Taking)/.exec(a.stderr)?.[1]?.replace(/\s+/g, ' ');
        stamp(refusal ? { name: c.name, tool: c.tool, drawn: false, refusal } : { name: c.name, tool: c.tool, drawn: false, error: a.stderr.split('\n').filter(Boolean).slice(-1)[0] ?? `exit ${a.status}` }, c);
        console.log(`  ${c.name.padEnd(44)} refused: ${refusal ?? 'error'}`);
        continue;
      }
      // The region run: the same render with each outlined word tagged, and the SVG written out.
      runCli('A', c, args, join(out, 'tagged', `${c.name}.png`), { BROWSER_FREE_TAG_TEXT: '1', BROWSER_FREE_SVG_OUT: svgFile }, join(out, 'no-web'));
      const b = runCli('B', c, args, browserPng, {}, join(out, 'no-web'));
      if (b.status !== 0 || !existsSync(browserPng)) { stamp({ name: c.name, tool: c.tool, drawn: true, inBands: false, error: `browser tier: ${b.stderr.split('\n').filter(Boolean).slice(-1)[0] ?? b.status}` }, c); continue; }
      const placement = existsSync(`${svgFile}.placement.json`) ? JSON.parse(readFileSync(`${svgFile}.placement.json`, 'utf8')) : { kind: 'fill' };
      const { width, height } = await sharp(resvgPng).metadata();
      const regions = existsSync(svgFile) ? await layoutRegions(page, readFileSync(svgFile, 'utf8'), width, height, placement, join(out, 'svg', `${c.name}.sized.svg`)) : null;
      const manifest = JSON.parse(readFileSync(toolFile(c.tool, 'tool.json')!, 'utf8')) as { render?: { width?: number } };
      const result = await compareCase({
        sharp, browserPng, resvgPng, regions, svgFile: existsSync(svgFile) ? svgFile : null, placement, renderWidth: manifest.render?.width ?? width,
        drawWithoutWords: (svg, w, h, p) => rasterizeSvgToRgba(svg, w, h, p),
      });
      stamp({ name: c.name, tool: c.tool, drawn: true, inBands: result.inBands, faults: result.faults.map((f) => f.detail) }, c);
      console.log(`  ${c.name.padEnd(44)} ${result.inBands ? 'inside' : `OUTSIDE: ${result.faults.slice(0, 2).map((f) => f.detail).join('; ')}`}${result.metadataEqual ? '' : ` (metadata differs: ${result.metadataDiffers.join(', ')})`}`);
    }
  } finally {
    await page.close().catch(() => {});
    await closeBrowser();
  }
  writeFileSync(join(out, 'results.json'), JSON.stringify(outcomes, null, 2));
  writeFileSync(join(out, 'run.json'), JSON.stringify({ chromium: chromiumVersion }, null, 2));
  return outcomes;
}

let chromiumVersion = 'unknown';

/** The record a run writes for one tool. `run` holds what the whole run compared. */
export function recordFor(tool: { id: string; version: string; digest: string }, outcomes: readonly CaseOutcome[], run: BrowserFreeRecordV1['measured']): BrowserFreeRecordV1 {
  return {
    version: BROWSER_FREE_RECORD_VERSION,
    tool,
    verdict: browserFreeVerdict(outcomes).eligible ? 'resvg' : 'browser',
    measured: run,
    cases: outcomes.map((o) => ({
      name: o.name, args: o.args ?? [],
      result: o.error ? 'error' : !o.drawn ? 'refused' : o.inBands ? 'inside' : 'outside',
      ...(o.error ? { detail: o.error } : o.refusal ? { detail: o.refusal } : o.faults?.length ? { detail: o.faults.join('; ') } : {}),
    })),
  };
}

/** The commit this checkout is at, for the record's web shell field when none is given. */
function headCommit(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'unknown';
}

function resvgVersion(): string {
  try { return (createRequire(join(ROOT, 'packages', 'node-shell', 'package.json'))('@resvg/resvg-js/package.json') as { version: string }).version; } catch { return 'unknown'; }
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const write = argv.includes('--write');
  const fromArg = argv.find((a) => a.startsWith('--from='))?.slice('--from='.length);
  const verify = argv.includes('--verify') || (write && !fromArg);
  const only = argv.find((a) => a.startsWith('--tools='))?.slice('--tools='.length).split(',').filter(Boolean);
  const cases = loadCases().filter((c) => !only || only.includes(c.tool));
  let outcomes: CaseOutcome[] | null = null;
  let runDir: string | null = null;
  if (fromArg) { outcomes = JSON.parse(readFileSync(join(fromArg, 'results.json'), 'utf8')) as CaseOutcome[]; runDir = fromArg; }
  else if (verify) {
    const missing = missingPrerequisite();
    if (missing) {
      console.log(`tool-browser-free: skipped, ${missing}. Nothing was measured and no record was written.`);
      return 0;
    }
    runDir = argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? mkdtempSync(join(tmpdir(), 'lolly-browser-free-'));
    console.log(`tool-browser-free: ${cases.length} case(s), files in ${runDir}`);
    outcomes = await verifyCases(cases, runDir);
  }
  const ran = runDir && existsSync(join(runDir, 'run.json')) ? JSON.parse(readFileSync(join(runDir, 'run.json'), 'utf8')) as { chromium?: string } : {};
  const measured: BrowserFreeRecordV1['measured'] = {
    date: new Date().toISOString().slice(0, 10),
    profile: process.env.LOLLY_PROFILE ?? 'default',
    webShell: argv.find((a) => a.startsWith('--web-commit='))?.slice('--web-commit='.length) ?? headCommit(),
    renderers: { resvg: resvgVersion(), engine: (await import('../engine/src/version.ts')).ENGINE_VERSION, chromium: ran.chromium ?? 'unknown' },
    bands: { threshold: BANDS.threshold, fillThreshold: BANDS.fillThreshold, regionShare: BANDS.regionShare, inkShare: BANDS.inkShare, inkShift: BANDS.inkShift, gradientLevels: BANDS.gradientLevels },
  };
  let written = 0;
  for (const id of [...new Set(cases.map((c) => c.tool))].sort()) {
    const manifestPath = toolFile(id, 'tool.json');
    if (!manifestPath) { console.log(`  ${id.padEnd(24)} not in this profile`); continue; }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { id: string; version: string };
    const digest = toolSourceDigest(id);
    const current = readBrowserFreeRecord(id);
    const status = current && 'record' in current ? browserFreeStatus(current.record, { id, version: manifest.version, digest }) : null;
    const now = current === null ? 'no record' : 'problem' in current ? `unreadable record (${current.problem})` : status?.admitted ? 'admitted' : status?.stale ? `stale (${status.stale})` : `verdict ${current.record.verdict}`;
    const results = outcomes?.filter((o) => o.tool === id);
    if (!results?.length) { console.log(`  ${id.padEnd(24)} ${now}`); continue; }
    const stale = staleEvidence(results, cases, id, digest);
    const verdict = browserFreeVerdict(stale ? [...results, { name: 'evidence', tool: id, drawn: false, error: stale }] : results);
    const detail = `drawn ${verdict.drawn}, inside ${verdict.inside}, refused ${verdict.refused}${verdict.outside.length ? `, outside: ${verdict.outside.join(' ')}` : ''}${verdict.errors.length ? `, errors: ${verdict.errors.join('; ')}` : ''}`;
    console.log(`${verdict.eligible ? '+' : '-'} ${id.padEnd(24)} ${now}; evidence: ${verdict.eligible ? 'resvg' : 'browser'} (${detail})`);
    // A tool whose cases could not all run keeps its record: missing evidence is not evidence.
    if (write && !verdict.errors.length) {
      const record = recordFor({ id, version: manifest.version, digest }, results, measured);
      writeFileSync(join(dirname(manifestPath), BROWSER_FREE_FILE), `${JSON.stringify(record, null, 2)}\n`);
      written++;
    }
  }
  if (write) console.log(`${written} record(s) written. Run \`pnpm run build:catalog:all\` and \`pnpm run validate:catalog:all\` next.`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = await run();
