// SPDX-License-Identifier: MPL-2.0
/**
 * tool-browser-free - decide, from evidence, which tools the Node shells may draw as a
 * PNG with resvg and no browser, and write the manifest `render.browserFree` flag.
 *
 *   node scripts/tool-browser-free.ts                    # report: each tool's flag and its cases
 *   node scripts/tool-browser-free.ts --verify           # + draw every case through both tiers and compare
 *   node scripts/tool-browser-free.ts --verify --write   # + set or clear the flag where the evidence says
 *   node scripts/tool-browser-free.ts --write --from=<dir>   # reuse a finished --verify run's results.json
 *
 *   --tools=a,b   only these tools      --out=<dir>   where the run's files go (default: a temp folder)
 *
 * The same shape as scripts/tool-isolation.ts, which writes `isolate`. A tool is flagged
 * only when it has at least one case the per-render checks admit, and every such case is
 * inside every plan 326 band against the browser tier (scripts/lib/browser-free/compare.ts).
 * The cases live in scripts/data/browser-free-cases.json. The flag admits a tool; each
 * render is still judged by packages/node-shell/src/resvg-admission.ts.
 *
 * Needs a built web shell (LOLLY_WEB_DIST, or shells/web/dist), a Chromium the node shell
 * can launch, and sharp. Without them it says so by name and writes nothing. Each case
 * runs the real CLI twice (about a second for resvg, about seven for the browser tier), so
 * this is a maintainer's job after a change to a tool's drawing or to the route, and is
 * never part of ordinary CI. The cases use the lolly-demo pictures, so run it with
 * LOLLY_PROFILE=lolly-demo; a case whose picture the active profile lacks is reported.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compareVersions, rangeFloor } from './tool-requires.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOTS = ['community', 'brands/suse/tools', 'brands/lolly-start/tools', 'brands/lolly-demo/tools'];
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

/** The engine that admits `render.browserFree`: an older one's schema refuses the key, so a flagged tool requires this one. */
export const BROWSER_FREE_SINCE = '1.350.0';

/** Raise a manifest's `engineVersion` floor to `floor` when it states a lower one, keeping the file's formatting. */
export function withEngineFloor(raw: string, floor: string): string {
  const line = /("engineVersion"\s*:\s*")([^"]*)(")/.exec(raw);
  if (!line) throw new Error('manifest has no engineVersion');
  const current = rangeFloor(line[2]);
  return current && compareVersions(current, floor) >= 0 ? raw : raw.replace(line[0], `${line[1]}^${floor}${line[3]}`);
}

/**
 * Set or clear `render.browserFree` textually, keeping the file's formatting: an existing
 * key takes the new value or is removed with its comma, and a new one goes first in the
 * render block. The result is parsed back and must say what was asked.
 */
export function rewriteBrowserFree(raw: string, on: boolean): string {
  const key = /"browserFree"\s*:\s*(?:true|false)/;
  let out: string;
  if (on && key.test(raw)) out = raw.replace(key, '"browserFree": true');
  else if (on) {
    const render = /("render"\s*:\s*\{)(\n?)([ \t]*)/.exec(raw);
    if (!render) throw new Error('manifest declares no render block');
    const [whole, open, newline, indent] = render;
    const empty = /^\s*\}/.test(raw.slice(render.index + whole.length));
    out = raw.replace(whole, newline ? `${open}\n${indent}"browserFree": true${empty ? '' : ','}\n${indent}` : `${open}"browserFree": true${empty ? '' : ','}`);
  } else {
    out = raw
      .replace(/\n[ \t]*"browserFree"\s*:\s*(?:true|false)[ \t]*,/, '')
      .replace(/"browserFree"\s*:\s*(?:true|false)\s*,\s*/, '')
      .replace(/,\s*"browserFree"\s*:\s*(?:true|false)/, '')
      .replace(/"browserFree"\s*:\s*(?:true|false)/, '');
  }
  const parsed = JSON.parse(out) as { render?: { browserFree?: unknown } };
  if ((parsed.render?.browserFree === true) !== on || (!on && parsed.render && 'browserFree' in parsed.render)) throw new Error('could not rewrite render.browserFree');
  return out;
}

/** What the evidence for one tool was measured over: its own files, with the two fields this script writes left out. */
export function toolDigest(dir: string): string {
  const parts: string[] = [];
  for (const name of ['tool.json', 'template.html', 'styles.css', 'hooks.js']) {
    const file = join(dir, name);
    if (!existsSync(file)) continue;
    let text = readFileSync(file, 'utf8');
    if (name === 'tool.json') {
      const manifest = JSON.parse(text) as { engineVersion?: unknown; render?: { browserFree?: unknown } };
      delete manifest.engineVersion;
      if (manifest.render) delete manifest.render.browserFree;
      text = JSON.stringify(manifest);
    }
    parts.push(`${name}\n${text}`);
  }
  return createHash('sha256').update(parts.join('\n')).digest('hex');
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

function toolDirs(root: string): string[] {
  const abs = resolve(ROOT, root);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((d) => !d.startsWith('_') && !d.startsWith('.') && statSync(join(abs, d)).isDirectory() && existsSync(join(abs, d, 'tool.json')))
    .map((d) => join(abs, d));
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
  const { toolFile, readAssetIndex, contentUrlFile } = await import('../packages/node-shell/src/content-roots.ts');
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
    const file = toolFile(c.tool, 'tool.json');
    outcomes.push({ ...o, args: c.args, ...(file ? { digest: toolDigest(dirname(file)) } : {}) });
  };
  const browser = await getBrowser();
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
  return outcomes;
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const write = argv.includes('--write');
  const fromArg = argv.find((a) => a.startsWith('--from='))?.slice('--from='.length);
  const verify = argv.includes('--verify') || (write && !fromArg);
  const only = argv.find((a) => a.startsWith('--tools='))?.slice('--tools='.length).split(',').filter(Boolean);
  const cases = loadCases().filter((c) => !only || only.includes(c.tool));
  let outcomes: CaseOutcome[] | null = null;
  if (fromArg) outcomes = JSON.parse(readFileSync(join(fromArg, 'results.json'), 'utf8')) as CaseOutcome[];
  else if (verify) {
    const missing = missingPrerequisite();
    if (missing) {
      console.log(`tool-browser-free: skipped, ${missing}. Nothing was measured and no manifest was changed.`);
      return 0;
    }
    const out = argv.find((a) => a.startsWith('--out='))?.slice('--out='.length) ?? mkdtempSync(join(tmpdir(), 'lolly-browser-free-'));
    console.log(`tool-browser-free: ${cases.length} case(s), files in ${out}`);
    outcomes = await verifyCases(cases, out);
  }
  const byTool = new Map<string, CaseOutcome[]>();
  for (const o of outcomes ?? []) byTool.set(o.tool, [...(byTool.get(o.tool) ?? []), o]);
  const measured = new Set(cases.map((c) => c.tool));
  let set = 0, cleared = 0;
  for (const root of DEFAULT_ROOTS) {
    for (const dir of toolDirs(root)) {
      const manifestPath = join(dir, 'tool.json');
      const raw = readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw) as { id: string; render?: { browserFree?: boolean; formats?: string[] } };
      const state = manifest.render?.browserFree === true;
      if (!state && !measured.has(manifest.id)) continue;
      if (only && !only.includes(manifest.id)) continue;
      const results = byTool.get(manifest.id);
      const stale = results ? staleEvidence(results, cases, manifest.id, toolDigest(dir)) : null;
      const verdict = results ? browserFreeVerdict(stale ? [...results, { name: 'evidence', tool: manifest.id, drawn: false, error: stale }] : results) : null;
      const mark = !verdict ? ' ' : verdict.eligible === state ? ' ' : verdict.eligible ? '+' : '-';
      const detail = verdict ? ` drawn ${verdict.drawn}, inside ${verdict.inside}, refused ${verdict.refused}${verdict.outside.length ? `, outside: ${verdict.outside.join(' ')}` : ''}${verdict.errors.length ? `, errors: ${verdict.errors.join('; ')}` : ''}` : '';
      console.log(`${mark} ${manifest.id.padEnd(24)} browserFree=${state}${detail}`);
      // A tool whose cases could not all run is left as it is: missing evidence is not evidence.
      if (write && verdict && !verdict.errors.length && verdict.eligible !== state) {
        const next = verdict.eligible ? withEngineFloor(rewriteBrowserFree(raw, true), BROWSER_FREE_SINCE) : rewriteBrowserFree(raw, false);
        writeFileSync(manifestPath, next);
        if (verdict.eligible) set++; else cleared++;
      }
    }
  }
  if (write) console.log(`${set} tool(s) flagged, ${cleared} cleared. Run \`pnpm run build:catalog:all\` and \`pnpm run validate:catalog:all\` next.`);
  return 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) process.exitCode = await run();
