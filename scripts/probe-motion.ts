#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Motion probe (plans/155 Task 5.1) - which tools have content that GENUINELY animates.
 *
 * Run as: npm run previews:motion-probe -- --url=http://localhost:5199 [--only=id1,id2]
 * (needs a running web shell, same as the other capture scripts).
 *
 * Scope: the tool's DEFAULT state, which is the state build-previews.ts captures a card
 * from, so a verdict here is about the tile the gallery would show. A blank default falls
 * back to an example look over there (Task 4.4.2) and would want the same seeding here, but
 * build-previews.ts runs its `main()` at import and exports neither `lookQuery` nor
 * `captureSeeded`, so there is nothing to import yet. The report flags a tool whose default
 * canvas is empty rather than quietly probing something else.
 *
 * Andy's eligibility rule, which this mechanises and must not soften: a tool earns an
 * animated preview ONLY if its content is still changing past 700 ms AND is still changing
 * at the END of the probe window. A settle-in or entrance transition that finishes on a
 * still frame is not animated content - it gets the static SVG like everything else. Motion
 * in a tile is a truthful sample of what the tool makes, never decoration.
 *
 * How it decides. Each tool is mounted at its defaults, given the same settle the preview
 * generator gives it, then screenshotted at settle, +0.7 s, +1.7 s, +2.7 s and +3.7 s.
 * Consecutive frames are pixel-diffed, which gives four numbers per tool:
 *
 *   d0 = settle → 0.7 s   d1 = 0.7 → 1.7 s   d2 = 1.7 → 2.7 s   d3 = 2.7 → 3.7 s
 *
 *   still     no diff clears the threshold. Static SVG (the default).
 *   settles   d0 or d1 moved but the TAIL (d2, d3) did not: the tool has an entrance, then
 *             stops. Static SVG, captured after the settle - which build-previews does.
 *   animates  d2 or d3 clears the threshold: the content is still changing through the last
 *             two seconds, ending at the final frame. The only tier eligible for motion.
 *
 * The tail is a two-second SPAN, not the single last frame pair, and that is a measurement
 * result rather than a preference. `digi-ad` cycles its scenes about every two seconds and
 * holds each one still in between, so a one-second end test falls inside a hold about half
 * the time: measured 2026-08-26, consecutive runs of the same tool gave d2 = 99.74% and then
 * d2 = 0.00%, i.e. `animates` or `settles` depending on nothing but phase. A verdict that
 * flips between runs is not a verdict. Two seconds catches any cycle up to that period.
 *
 * A slideshow slower than that holds one still frame through the whole window, so it reads
 * `settles` on the short pass. `lottie-digi-ad` turns its scene over about every 4 to 5 s and
 * does exactly this. So a `settles` verdict is never final: that bucket alone is re-probed
 * over an 8 s window with a 5 s tail, and only if the tool is still holding still there does
 * `settles` stand. Nothing else pays those seconds, and the rule does not move - only the
 * window it is measured over, which was always a probe parameter and not part of the rule.
 *
 * THE PROBE PROPOSES, A HUMAN CURATES. It writes catalog/previews/motion-report.json and
 * prints the `animates` list with its measured diffs as the candidate list for a curation
 * pass; it never edits the JOBS list in build-animated-previews.ts, and nothing it writes
 * ships. Same doctrine as the raster allowlist: an entry ships only with a written reason.
 *
 * Nothing here is a second definition of "these pixels differ". The frame diff is
 * `pixelDiffFraction` from scripts/lib/shot-compare.ts (the docs-shot comparator, unit-tested
 * in tests/docs-shots-compare.test.ts) and the per-frame content measure is `measureImage`
 * from scripts/check-blank-previews.ts (the probe that writes blank-report.json), read at the
 * same PROBE_DIM. One measurement vocabulary across the preview pipeline.
 *
 * Frames are compared at tile scale (PROBE_DIM on the long edge), which is the honest test:
 * motion too small to survive the downscale is motion a 164 px gallery tile would not show,
 * so it must not buy a tool a motion preview.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserContext, Page } from 'playwright';
// The frame diff, from the docs-shot comparator that already owns "these pixels differ".
import { pixelDiffFraction, DEFAULT_THRESHOLDS, type RawImage } from './lib/shot-compare.ts';
// The content measure + probe size, from the blank-preview probe, so a `still` verdict on a
// tool that renders nothing reads differently from one on a tool that renders a full tile.
import { measureImage, PROBE_DIM, type Measured } from './check-blank-previews.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEWS_DIR = join(ROOT, 'catalog', 'previews');
const REPORT_FILE = 'motion-report.json';
const REPORT_PATH = join(PREVIEWS_DIR, REPORT_FILE);

// Sidebar tools render into #tool-canvas; full-bleed/display tools into #tool-content.
// Mirrors CANVAS_SEL in build-previews.ts and build-animated-previews.ts.
const CANVAS_SEL = '#tool-canvas, #tool-content';

/** Settle before the first frame. The same 900 ms build-previews.ts waits before it captures,
 *  so "t=0" here is the moment the still generator would have taken its picture. */
const SETTLE_MS = 900;

/** One sampling plan: when to take frames (offsets from settle, in ms) and how many trailing
 *  gaps count as "the end of the window". */
interface Plan { name: string; frameMs: readonly number[]; tailGaps: number }

/** The rule's own window. The 700 ms in the eligibility rule is the first gap, and the tail
 *  spans the last two seconds (see the header for why it is a span and not one pair). */
const SHORT: Plan = { name: 'short', frameMs: [0, 700, 1700, 2700, 3700], tailGaps: 2 };

/** The re-check for a `settles` verdict only. A tool whose scenes turn over slower than the
 *  short window holds a still frame right through it, so the short pass calls it settled:
 *  measured 2026-08-26, lottie-digi-ad changes scene about every 4 to 5 s and reads `settles`,
 *  while the same frames at 6 s and 9 s are two completely different ads. Re-probing only the
 *  `settles` bucket over a 5 s tail catches those without making every tool pay the seconds. */
const LONG: Plan = { name: 'long', frameMs: [0, 700, 1700, 2700, 3700, 4700, 5700, 6700, 7700], tailGaps: 5 };

/** Fraction of tile pixels that must change for a frame pair to count as different.
 *  1% of a 256 px probe is ~650 px, which is a visible moving element rather than a
 *  compression wobble; the per-pixel tolerance below absorbs anti-aliasing jitter. */
const MOTION_DIFF_FRAC = 0.01;

/** Per-channel difference a pixel must exceed to count as changed - the docs-shot
 *  comparator's own tolerance, so both probes call a pixel "different" at the same point. */
const PIXEL_TOL = DEFAULT_THRESHOLDS.pixelTol;

type Verdict = 'still' | 'settles' | 'animates' | 'skipped' | 'error';

/** Raw tool row from catalog/tools/index.json (only the fields this script reads). */
interface RawToolEntry {
  id: string;
  capabilities?: unknown;
  status?: string;
}

interface Tool {
  id: string;
  capabilities: string[];
  status: string;
  /** A committed authored card (tools/<id>/card.*) already overrides the generated tile.
   *  Reported, not skipped: the verdict is about the TOOL's content, and an authored card
   *  is one of the things a curation pass has to weigh. */
  hasCard: boolean;
  /** Set when the tool cannot be probed at all - it still gets a row, so the report is a
   *  statement about every visible tool rather than only the ones that answered. */
  skip?: string;
}

interface Row {
  id: string;
  verdict: Verdict;
  /** One per consecutive frame pair (d0 first), as a fraction of changed pixels. null = the
   *  frames were not comparable (different sizes), which counts as a change; the fixed clip
   *  makes that a backstop rather than an expected value. */
  diffs: Array<number | null>;
  /** The settle frame, measured by the blank-preview probe. A `still` verdict here means
   *  "renders nothing and does not move", which is a content gap, not a motion verdict. */
  content: Pick<Measured, 'stddev' | 'inkRatio' | 'ground' | 'blank' | 'sparse'> | null;
  hasCard: boolean;
  status: string;
  /** Which sampling plan produced this verdict (`long` means the settles re-check overturned
   *  the short pass, so the tool cycles slower than the rule's own window). */
  window: string;
  note?: string;
}

interface Opts { url: string; only: string[]; json: boolean }

function parseOpts(argv: string[]): Opts {
  const o: Opts = { url: 'http://localhost:5173', only: [], json: false };
  for (const a of argv) {
    if (a === '--json') o.json = true;
    else if (a.startsWith('--url=')) o.url = a.slice(6).replace(/\/$/, '');
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

const opts = parseOpts(process.argv.slice(2));

main().catch((e) => {
  console.error(`\n✗ ${e.message}`);
  if (process.env.DEBUG) console.error(e.stack);
  process.exit(1);
});

async function main(): Promise<void> {
  const tools = await toolList();
  if (!tools.length) throw new Error('No tools to probe in catalog/tools/index.json.');

  const { chromium } = await loadPlaywright();
  await waitForServer(opts.url);
  console.log(`Probing ${tools.length} tool${tools.length === 1 ? '' : 's'} for motion against ${opts.url}`);
  console.log(`  settle ${SETTLE_MS} ms, frames at +${SHORT.frameMs.join(' / +')} ms, threshold ${(MOTION_DIFF_FRAC * 100).toFixed(1)}% of ${PROBE_DIM}px probe pixels (tol ${PIXEL_TOL})`);
  console.log(`  a \`settles\` verdict is re-probed over +${LONG.frameMs[LONG.frameMs.length - 1]} ms before it stands\n`);

  // Rendering-intent pins matching packages/node-shell/src/browsers.ts: a verdict must not
  // depend on the host's display profile or font hinting.
  const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  const context = await browser.newContext({
    serviceWorkers: 'block',
    // deviceScaleFactor 1: the frames are diffed at PROBE_DIM, never written, so retina
    // capture would only cost time.
    deviceScaleFactor: 1,
    // Pinned, not inherited. The app honours prefers-reduced-motion, so a probe host with
    // that OS setting on would report every tool as `still` and quietly retire the whole
    // motion tier.
    reducedMotion: 'no-preference',
  });

  const rows: Row[] = [];
  try {
    for (const tool of tools) {
      const row = await probeTool(context, tool);
      rows.push(row);
      console.log(`  ${mark(row.verdict)} ${tool.id.padEnd(22)} ${row.verdict.padEnd(9)} ${fmtDiffs(row.diffs)}${row.note ? `  (${row.note})` : ''}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  await writeReport(rows);
  if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }
  summarize(rows);
}

// ── Probe one tool ──────────────────────────────────────────────────────────

/**
 * Probe one tool, retrying once if the page reloaded underneath the frames.
 *
 * The retry is not defensive padding. This runs against a DEV server, and vite reloads every
 * connected client when any watched file changes - including the /info pages another session
 * may be editing while this runs. A reload between two frames repaints the whole canvas, and
 * a whole-canvas repaint is indistinguishable from motion, so the verdict would be a false
 * `animates` with no sign of it in the numbers. The in-page mark below is the detector.
 */
async function probeTool(context: BrowserContext, tool: Tool): Promise<Row> {
  const base: Row = {
    id: tool.id, verdict: 'error', diffs: [], content: null,
    hasCard: tool.hasCard, status: tool.status, window: SHORT.name,
  };
  if (tool.skip) return { ...base, verdict: 'skipped', note: tool.skip };
  let row = await probeOnce(context, tool, base, SHORT);
  if (row.note === RELOADED) row = await probeOnce(context, tool, base, SHORT);
  // A settled tool gets the long window before the verdict stands: see LONG.
  if (row.verdict === 'settles') {
    const long = await probeOnce(context, tool, { ...base, window: LONG.name }, LONG);
    if (long.verdict === 'animates') {
      return { ...long, note: `cycles slower than the ${SHORT.frameMs[SHORT.frameMs.length - 1]!} ms window` };
    }
  }
  return row;
}

const RELOADED = 'page reloaded mid-probe (dev server reload) - frames not comparable';

async function probeOnce(context: BrowserContext, tool: Tool, base: Row, plan: Plan): Promise<Row> {
  const page = await context.newPage();
  try {
    await page.goto(`${opts.url}/#/tool/${tool.id}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForSelector(CANVAS_SEL, { timeout: 30000 });
    await page.waitForFunction(
      () => {
        const c = document.querySelector('#tool-canvas') || document.querySelector('#tool-content');
        return !!c && (c.children.length > 0 || c.textContent!.trim().length > 0);
      },
      { timeout: 30000 },
    );
    // Hide the app chrome painted over the canvas box (the still capture's own list, plus
    // the template chooser). A screenshot of an element includes anything drawn on top of
    // it, and app chrome moving is not the tool's content moving.
    //
    // The chooser is the one that matters, and it was measured: a tool that opens with the
    // template modal over its canvas (qr-code, design, most studios) was scoring 6-10% frame
    // diffs for the whole window, because the modal's tiles carry `loading="lazy"` thumbs
    // that hydrate one after another. That is a false `animates` on nearly every templated
    // tool, and it hides the canvas the verdict is supposed to be about: with the modal
    // hidden, qr-code's frames are the QR itself and it measures `still`.
    await page.addStyleTag({
      content:
        '.tools-home,.render-fab,.fullscreen-toggle,.fullscreen-toggle-float,.on-device-badge,' +
        '.export-overlay,.tmpl-chooser-modal{display:none !important}',
    });
    await page.waitForTimeout(SETTLE_MS);
    // Survives no reload, so its absence at the end proves the frames came from two documents.
    await page.evaluate(() => { (globalThis as { __lollyMotionProbe?: boolean }).__lollyMotionProbe = true; });

    const clip = await canvasClip(page);
    if (!clip) return { ...base, verdict: 'error', note: 'canvas has no visible box to probe' };

    const frames: RawImage[] = [];
    for (let i = 0; i < plan.frameMs.length; i++) {
      if (i > 0) await page.waitForTimeout(plan.frameMs[i]! - plan.frameMs[i - 1]!);
      frames.push(await decodeProbe(await shoot(page, clip)));
    }
    const same = await page.evaluate(() => !!(globalThis as { __lollyMotionProbe?: boolean }).__lollyMotionProbe);
    if (!same) return { ...base, verdict: 'error', note: RELOADED };

    const diffs = frames.slice(1).map((f, i) => pixelDiffFraction(frames[i]!, f, PIXEL_TOL));
    const content = await measureFrame(page, clip);
    return { ...base, verdict: verdictFor(diffs, plan), diffs, content, note: contentNote(content) };
  } catch (e) {
    return { ...base, verdict: 'error', note: (e as Error).message.split('\n')[0] };
  } finally {
    page.close().catch(() => {});
  }
}

/**
 * The verdict for one tool's consecutive-frame diffs.
 *
 * A null diff means the canvas RESIZED between two frames, so the pixels are not comparable.
 * That is a change either way (the tile is not holding still), so it counts as motion rather
 * than being dropped - a reflow that never stops is exactly what the tail tests.
 */
function verdictFor(diffs: Array<number | null>, plan: Plan): Verdict {
  const moved = (d: number | null | undefined): boolean => d === null || (d ?? 0) >= MOTION_DIFF_FRAC;
  if (diffs.slice(-plan.tailGaps).some(moved)) return 'animates';
  return diffs.some(moved) ? 'settles' : 'still';
}

interface Clip { x: number; y: number; width: number; height: number }

/**
 * The fixed page region every frame of this tool is captured from: the canvas box clipped to
 * the viewport, resolved ONCE after settle.
 *
 * Not an element screenshot, and that is a measured correction. Playwright captures an
 * element taller than the viewport by growing the viewport to the element's height, and the
 * web shell is responsive, so the capture itself re-lays-out the app. On `multi-page-pdf`
 * (a 794x3435 canvas) that produced a steady 3.8% diff on every frame pair, and the changed
 * pixels were confined to the top 720 px band - the app's own chrome reflowing under the
 * capture, not the document moving. `deck-studio` (912x2097) did the same. A constant clip
 * inside the real viewport removes the artifact: nothing about the page changes because we
 * took a picture of it.
 *
 * The trade is that a canvas taller than the viewport is judged on its visible part. That is
 * the part a viewer is looking at, and a tile is one small still of it either way.
 */
async function canvasClip(page: Page): Promise<Clip | null> {
  const el = await page.$(CANVAS_SEL);
  if (!el) return null;
  const box = await el.boundingBox();
  const view = page.viewportSize();
  if (!box || !view) return null;
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.floor(Math.min(box.x + box.width, view.width)) - x;
  const height = Math.floor(Math.min(box.y + box.height, view.height)) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/** Screenshot the probed region as it is right now. */
async function shoot(page: Page, clip: Clip): Promise<Buffer> {
  // animations:'allow' is Playwright's default and is pinned here because the opposite
  // setting freezes CSS animation, which would make every tool measure `still`.
  // caret:'hide' keeps a blinking text caret (an editor tool's chrome) out of the diff.
  return await page.screenshot({ type: 'png', clip, animations: 'allow', caret: 'hide', timeout: 20000 });
}

/** Measure the settle frame with the blank-preview probe, for the report's content column. */
async function measureFrame(page: Page, clip: Clip): Promise<Row['content']> {
  try {
    const m = await measureImage(await shoot(page, clip));
    return { stddev: m.stddev, inkRatio: m.inkRatio, ground: m.ground, blank: m.blank, sparse: m.sparse };
  } catch {
    return null;
  }
}

/** Why a verdict may be about an empty canvas rather than about motion (Task 4.4's split). */
function contentNote(content: Row['content']): string | undefined {
  if (content?.blank) return 'canvas renders nothing at defaults';
  if (content?.sparse) return 'canvas is near-empty at defaults';
  return undefined;
}

/**
 * Decode one PNG frame to raw RGBA at tile scale.
 *
 * Same decode the blank probe uses (sharp, PROBE_DIM on the long edge, alpha kept) so the
 * two probes look at the same pixels. Downscaling first is also what makes the diff cheap
 * enough to run four frames across every tool in one pass.
 */
async function decodeProbe(png: Buffer): Promise<RawImage> {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(png)
    .resize({ width: PROBE_DIM, height: PROBE_DIM, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

// ── Report + summary ────────────────────────────────────────────────────────

async function writeReport(rows: Row[]): Promise<void> {
  // A slice must never overwrite the report: it is a statement about EVERY tool in the pack,
  // and a partial one would read as "the rest have no motion". Mirrors check-blank-previews.
  if (opts.only.length) {
    console.log(`\n· --only=${opts.only.join(',')}: probing a slice, so ${REPORT_FILE} is left alone.`);
    return;
  }
  const report = {
    rule:
      'A tool earns an animated preview only if its content is still changing past 700 ms and ' +
      'still changing at the end of the probe window. A settle-in transition that ends on a ' +
      'still frame is not animated content: it gets the static SVG.',
    probedAt: new Date().toISOString(),
    probe: {
      settleMs: SETTLE_MS, plans: [SHORT, LONG],
      probeDim: PROBE_DIM, diffFrac: MOTION_DIFF_FRAC, pixelTol: PIXEL_TOL,
    },
    curation: 'Proposal only. An `animates` row is a CANDIDATE; a job in build-animated-previews.ts needs a human and a written reason.',
    rows,
  };
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n· Report written: catalog/previews/${REPORT_FILE}`);
}

function summarize(rows: Row[]): void {
  const of = (v: Verdict): Row[] => rows.filter((r) => r.verdict === v);
  const animates = of('animates');
  console.log(
    `\nProbed ${rows.length}: ${of('animates').length} animates, ${of('settles').length} settles, ` +
      `${of('still').length} still, ${of('skipped').length} skipped, ${of('error').length} error.`,
  );

  if (animates.length) {
    console.log('\nCURATION CANDIDATES (verdict `animates` - still moving at the end of the window):\n');
    const tail = (r: Row): number =>
      Math.max(...r.diffs.slice(-(r.window === LONG.name ? LONG : SHORT).tailGaps).map((d) => d ?? 1));
    for (const r of [...animates].sort((a, b) => tail(b) - tail(a))) {
      const flags = [r.window === LONG.name ? `${LONG.name} window` : '', r.hasCard ? 'has authored card' : ''].filter(Boolean);
      console.log(`  ${r.id.padEnd(22)} ${fmtDiffs(r.diffs)}  ${flags.join(', ')}`);
    }
    console.log('\n  These are PROPOSALS. Look at each one before it becomes a job in');
    console.log('  build-animated-previews.ts, and write the reason next to it. Motion in a tile');
    console.log('  is a sample of what the tool makes; a tool that merely has a moving decoration');
    console.log('  is still a static-SVG tool.');
  } else {
    console.log('\nNo tool measured as still moving at the end of the window - nothing to curate.');
  }

  const errs = of('error');
  if (errs.length) {
    console.log(`\n· ${errs.length} tool${errs.length === 1 ? '' : 's'} could not be probed:`);
    for (const r of errs) console.log(`    ${r.id.padEnd(22)} ${r.note ?? ''}`);
  }
  const blanks = rows.filter((r) => r.content?.blank);
  if (blanks.length) {
    const one = blanks.length === 1;
    console.log(`\n· ${blanks.length} probed tool${one ? '' : 's'} render${one ? 's' : ''} nothing at defaults, so ${one ? 'its' : 'their'} verdict is about an empty canvas:`);
    console.log(`    ${blanks.map((r) => r.id).join(', ')}`);
    console.log('  That is the Task 4.4 content gap, not a motion result.');
  }
}

const fmtDiffs = (d: Array<number | null>): string =>
  d.length ? d.map((v) => (v === null ? 'resize' : `${(v * 100).toFixed(2)}%`)).join('  ') : '-';

function mark(v: Verdict): string {
  if (v === 'animates') return '▶';
  if (v === 'error') return '✗';
  return '·';
}

// ── Tool list + plumbing ────────────────────────────────────────────────────

async function toolList(): Promise<Tool[]> {
  const index = JSON.parse(await readFile(join(ROOT, 'catalog', 'tools', 'index.json'), 'utf8')) as { tools: RawToolEntry[] };
  let tools: Tool[] = index.tools.map((t) => ({
    id: t.id,
    capabilities: Array.isArray(t.capabilities) ? t.capabilities : [],
    status: t.status ?? '',
    hasCard: ['svg', 'png', 'html', 'webm'].some((ext) => existsSync(join(ROOT, 'tools', t.id, `card.${ext}`))),
  }));
  if (opts.only.length) {
    const want = new Set(opts.only);
    tools = tools.filter((t) => want.has(t.id));
  }
  // Capture-gated tools rasterise a live URL through a bridge this headless path does not
  // provide, so they never render anything to probe (build-previews.ts skips them for the
  // same reason). They keep a row, marked skipped, because the report has to account for
  // every visible tool. Camera/mic-gated tools are NOT skipped: they mount and render their
  // idle state, and that state is what a tile shows.
  for (const t of tools) {
    if (t.capabilities.includes('capture')) t.skip = 'capture-gated: nothing renders headlessly';
  }
  return tools;
}

async function loadPlaywright(): Promise<typeof import('playwright')> {
  try {
    return await import('playwright');
  } catch {
    throw new Error('playwright is not installed. Run `npm install`, then `npx playwright install chromium`.');
  }
}

async function waitForServer(baseUrl: string, { tries = 30, delayMs = 1000 } = {}): Promise<void> {
  const { get } = await import('node:http');
  for (let i = 0; i < tries; i++) {
    const ok = await new Promise<boolean>((res) => {
      const req = get(baseUrl, (r) => { r.resume(); res((r.statusCode ?? 500) < 500); });
      req.on('error', () => res(false));
      req.setTimeout(2000, () => { req.destroy(); res(false); });
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r as () => void, delayMs));
  }
  throw new Error(`No web shell reachable at ${baseUrl}. Start one with \`npm run dev:web\` or pass --url=<server>.`);
}
