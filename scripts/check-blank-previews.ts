#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Blank-preview detector (plans/155 Task 4.4.1).
 *
 * A gallery tile is supposed to be a truthful sample of what a tool makes. Some of them
 * have never been one: `design.png` as committed measured a per-channel stddev of 0.0 -
 * a completely blank white card - and had been blank for as long as the file existed.
 * Nobody noticed because at 164,894 bytes it LOOKED like a real preview; only measuring
 * the pixels reveals it. `asset-export`, `screencap` and `signature` were blank the same
 * way, and nothing had ever measured the rest, so the true population was unknown.
 *
 * The cause is not per-tool: `build-previews.ts` captures a tool's CARD from the tool's
 * DEFAULT state, and plenty of tools legitimately open on an empty canvas (the template
 * presets that would seed them aren't baked yet). The generator has no notion of "this
 * capture came out empty", so a blank tile is written, committed and shipped exactly like
 * a good one.
 *
 * This script measures, it does not fix - publish the real list BEFORE changing any
 * capture, because the four known blanks are the ones somebody happened to look at, not
 * the population. It rasterises every preview to a small bitmap and reports two numbers:
 *
 *   stddev   - per-channel standard deviation across the whole image. 0 means every pixel
 *              is identical: a flat card with nothing on it. This is the `blank` verdict,
 *              and it is the only one a build may fail on.
 *   inkRatio - fraction of pixels differing from the dominant (background) colour. This
 *              catches the case stddev alone would pass: a tile that is 99.9% empty with
 *              one small mark in a corner. It is reported as `sparse` - a REVIEW list, not
 *              a verdict, because the same shape describes a tool that is minimal on
 *              purpose (see BLANK_INK_RATIO for the measurements that forced that split).
 *
 * Both are measured on MORE THAN ONE GROUND, and that is not a refinement - it is the
 * difference between a probe that works and one that condemns good art. The look3 previews
 * of `brand-lockup` and `wordmark` are the negative/mono variants: white artwork on a
 * TRANSPARENT ground. Flattened on white they measure stddev 0.000, inkRatio 0.000 - the
 * exact signature of an empty card - while on black they measure 108.1 / 0.278 and 58.7 /
 * 0.087, which is a full lockup. So a tile counts as blank only when it is blank against
 * EVERY ground; anything that shows on one of them is real art the viewer will see on the
 * surface that suits it.
 *
 * Writes catalog/previews/blank-report.json (consumed by the validate-catalog gate in
 * Task 4.4.4) and prints a summary. Read-only over the previews; BUILD-TIME ONLY
 * (sharp / native libvips - loaded lazily, because validate-catalog.ts imports the
 * thresholds from this module and must not need a native build to do it).
 *
 * Usage: node scripts/check-blank-previews.ts [--json] [--only=id1,id2]
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PREVIEWS_DIR = join(ROOT, 'catalog/previews');

/** File name of the report, exported so the validate-catalog gate names one string. */
export const REPORT_FILE = 'blank-report.json';
const REPORT_PATH = join(PREVIEWS_DIR, REPORT_FILE);

/** Longest edge the probe rasterises to. Small on purpose: blankness is a global property,
 *  and a 256 px probe measures it as well as a full-size render for a fraction of the time. */
export const PROBE_DIM = 256;

/** At or below this per-channel stddev the image carries no variation worth showing. Not
 *  hard zero: a lossy WebP of a flat card dithers by a fraction of a level, and an SVG
 *  rasterised through libvips can leave sub-1.0 noise at the edges of a full-bleed rect.
 *  Measured 2026-08-26 across both brand packs: the blanks sit at exactly 0.000 and the
 *  weakest real tile at 10.2, so anywhere in that gap is the same verdict. */
export const BLANK_STDDEV = 1.0;

/**
 * Below this fraction of non-background pixels a tile is almost all one colour - the "one
 * small mark on an otherwise empty card" shape, which is what an unseeded tool's
 * placeholder text looks like from a distance.
 *
 * This is a SUSPICION, not a verdict, and the measurements are why. Rendered and looked at,
 * 2026-08-26 (suse pack): `run-web-code.svg` at 0.0096 is a bare editor showing its own
 * "Paste your code here" prompt, `print-sheet.svg` at 0.0077 is an empty sheet of crop
 * marks, `logo-wall.svg` at 0.019 is a "Drop your logos here" drop zone - all empty states.
 * But `countdown-timer.svg` at 0.0083 sits between two of them and is a perfectly good
 * tile: a deep green card reading "5:00 / START", which is exactly what that tool makes.
 * A timer, a print sheet and a code editor are all mostly empty field by design, so no
 * ink threshold can separate "nothing here" from "minimal on purpose" - that judgement is
 * semantic and needs eyes.
 *
 * So ink drives a REVIEW list, never an error: `sparse` rows are printed for a human, and
 * only `blank` (flat on every ground - see BLANK_STDDEV) is allowed to fail a build.
 */
export const BLANK_INK_RATIO = 0.02;

/**
 * The grounds a preview is composited onto before measuring. White is the gallery's own
 * light surface; black stands in for the dark theme and is what rescues the mono/negative
 * lockups from reading as empty. Two opposite extremes are enough - artwork invisible
 * against both is invisible, full stop.
 */
export const GROUNDS: ReadonlyArray<{ name: string; rgb: [number, number, number] }> = [
  { name: 'white', rgb: [255, 255, 255] },
  { name: 'black', rgb: [0, 0, 0] },
];

export interface GroundMeasure { stddev: number; inkRatio: number }

/**
 * One image, measured. Exported because `build-previews.ts` measures a capture the instant
 * it is taken (plans/155 Task 4.4.2) and must reach the SAME verdict this report does - two
 * hand-written definitions of "blank" would drift, and then the generator and the gate would
 * disagree about the same file.
 */
export interface Measured {
  /** The kindest ground's numbers - the tile at its most visible. */
  stddev: number;
  inkRatio: number;
  ground: string;
  grounds: Record<string, GroundMeasure>;
  /** Flat on every ground: provably nothing to see. The only verdict a gate may fail on. */
  blank: boolean;
  /** Not flat, but almost all one colour on every ground. A review list - see BLANK_INK_RATIO. */
  sparse: boolean;
}

export interface Row extends Measured {
  file: string;
  bytes: number;
  /** Short SHA-256 of the file's bytes. The gate's freshness token: re-capturing a preview
   *  changes its hash, so a report measured before that capture is provably stale and must
   *  not be allowed to speak for the file that is there now. */
  sha: string;
  reason?: string;
}

interface Opts { json: boolean; only: string[] }

function parseOpts(argv: string[]): Opts {
  const o: Opts = { json: false, only: [] };
  for (const a of argv) {
    if (a === '--json') o.json = true;
    else if (a.startsWith('--only=')) o.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
  }
  return o;
}

/**
 * Composite one RGBA probe onto a ground and measure it in a single pass.
 *
 * stddev is computed here rather than through sharp's `stats()` because `stats()` reads the
 * INPUT image and does not honour a `flatten()` in the pipeline: measured 2026-08-26, it
 * returned stddev 111.3 for `brand-lockup.look3.svg` while the flattened pixels the same
 * pipeline produced were uniformly white - one number describing the composited tile and
 * one describing something the viewer never sees, in the same verdict.
 *
 * inkRatio quantises to 4 bits per channel so anti-aliasing and WebP ringing around a flat
 * field don't read as content.
 */
function measureGround(data: Buffer, channels: number, ground: [number, number, number]): GroundMeasure {
  const total = data.length / channels;
  if (!total) return { stddev: 0, inkRatio: 0 };
  const counts = new Map<number, number>();
  const sum = [0, 0, 0];
  const sumSq = [0, 0, 0];
  for (let i = 0; i < data.length; i += channels) {
    const alpha = channels === 4 ? data[i + 3]! / 255 : 1;
    let key = 0;
    for (let k = 0; k < 3; k++) {
      const v = data[i + k]! * alpha + ground[k]! * (1 - alpha);
      sum[k]! += v;
      sumSq[k]! += v * v;
      key = (key << 4) | (v >> 4);
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let dominant = 0;
  for (const n of counts.values()) if (n > dominant) dominant = n;
  let stddev = 0;
  for (let k = 0; k < 3; k++) {
    const mean = sum[k]! / total;
    stddev = Math.max(stddev, Math.sqrt(Math.max(0, sumSq[k]! / total - mean * mean)));
  }
  return { stddev, inkRatio: (total - dominant) / total };
}

/**
 * Measure one encoded image (SVG, PNG, WebP - anything sharp decodes) against every ground.
 *
 * The generator calls this on a capture it has just taken, so the "is this tile blank"
 * question is answered by ONE implementation for both the report and the fallback decision.
 */
export async function measureImage(buf: Buffer): Promise<Measured> {
  const { default: sharp } = await import('sharp');
  // One rasterisation, composited in JS per ground: decoding an SVG at density 150 is by
  // far the expensive half, and doing it once per ground would double a 60 s sweep.
  const { data, info } = await sharp(buf, { density: 150 })
    .resize({ width: PROBE_DIM, height: PROBE_DIM, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const grounds: Record<string, GroundMeasure> = {};
  for (const g of GROUNDS) {
    const m = measureGround(data, info.channels, g.rgb);
    grounds[g.name] = { stddev: Number(m.stddev.toFixed(3)), inkRatio: Number(m.inkRatio.toFixed(5)) };
  }
  // A verdict only holds if it holds on EVERY ground - artwork that shows on one of them is
  // art. The headline numbers report the ground that shows the tile best, so a report row
  // reads as "this is the most there is to see".
  const blank = GROUNDS.every((g) => isFlatOn(grounds[g.name]!));
  const sparse = !blank && GROUNDS.every((g) => isSparseOn(grounds[g.name]!));
  const best = GROUNDS.map((g) => g.name).sort((a, b) =>
    (grounds[b]!.inkRatio - grounds[a]!.inkRatio) || (grounds[b]!.stddev - grounds[a]!.stddev))[0]!;

  return { stddev: grounds[best]!.stddev, inkRatio: grounds[best]!.inkRatio, ground: best, grounds, blank, sparse };
}

/** The one-line human reading of a verdict, so the report and the generator's log agree. */
export function verdictReason(m: Measured): string | undefined {
  if (m.blank) return 'flat on every ground: no pixel variation';
  if (m.sparse) return `near-empty: only ${(m.inkRatio * 100).toFixed(2)}% of pixels differ from the background`;
  return undefined;
}

async function measure(file: string): Promise<Row> {
  const buf = readFileSync(join(PREVIEWS_DIR, file));
  const m = await measureImage(buf);
  return {
    file,
    bytes: buf.length,
    sha: createHash('sha256').update(buf).digest('hex').slice(0, 16),
    ...m,
    reason: verdictReason(m),
  };
}

// Both verdicts are exported so the validate-catalog gate reads a report row exactly the way
// the probe wrote it, rather than re-deriving the thresholds and drifting from them.

/** Nothing to see on this ground: every pixel the same. */
export function isFlatOn(m: GroundMeasure): boolean {
  return m.stddev <= BLANK_STDDEV;
}

/** Almost all one colour on this ground - suspicious, not conclusive. */
export function isSparseOn(m: GroundMeasure): boolean {
  return m.inkRatio < BLANK_INK_RATIO;
}

async function run(): Promise<void> {
  const opts = parseOpts(process.argv.slice(2));
  let files: string[];
  try {
    files = readdirSync(PREVIEWS_DIR).filter((f) => /\.(svg|png|webp|jpg|jpeg|avif)$/i.test(f));
  } catch {
    console.log('· No catalog/previews/ dir yet (run `npm run previews` first) - nothing to measure.');
    return;
  }
  if (opts.only.length) {
    files = files.filter((f) => opts.only.some((id) => f === `${id}` || f.startsWith(`${id}.`)));
  }
  files.sort();

  const rows: Row[] = [];
  for (const f of files) {
    try {
      rows.push(await measure(f));
    } catch (e) {
      // An unreadable preview is a different problem (validate-catalog owns file integrity);
      // record it rather than aborting the sweep so one bad file can't hide the rest.
      rows.push({
        file: f, bytes: 0, sha: '', stddev: -1, inkRatio: -1, ground: '', grounds: {},
        blank: false, sparse: false, reason: `unreadable: ${(e as Error).message}`,
      });
    }
  }

  const blanks = rows.filter((r) => r.blank);
  const sparses = rows.filter((r) => r.sparse);
  // Group by tool id so the report reads as "which TOOLS have a blank tile", which is the
  // question Task 4.4.2/4.4.3 actually branch on (fall back to a look, or report a content gap).
  const groupByTool = (list: Row[]): Map<string, string[]> => {
    const m = new Map<string, string[]>();
    for (const r of list) {
      const id = r.file.replace(/\.look\d+/, '').replace(/\.[a-z0-9]+$/i, '');
      m.set(id, [...(m.get(id) ?? []), r.file]);
    }
    return m;
  };
  const byTool = groupByTool(blanks);

  // `--only` measures a slice, so it must never overwrite the report: validate-catalog
  // reads that file as a statement about EVERY preview in the pack and would take the
  // absent ones for deleted files.
  if (opts.only.length) {
    console.log(`· --only=${opts.only.join(',')}: measuring a slice, so ${REPORT_FILE} is left alone.`);
  } else {
    writeFileSync(REPORT_PATH, `${JSON.stringify({
      thresholds: { stddev: BLANK_STDDEV, inkRatio: BLANK_INK_RATIO, probeDim: PROBE_DIM, grounds: GROUNDS.map((g) => g.name) },
      rows,
    }, null, 2)}\n`);
  }

  if (opts.json) { console.log(JSON.stringify(rows, null, 2)); return; }

  const line = (f: string): void => {
    const r = rows.find((x) => x.file === f)!;
    console.log(`    ${f}  stddev=${r.stddev}  ink=${r.inkRatio}  on ${r.ground}  (${r.reason})  ${Math.round(r.bytes / 1024)} KB`);
  };

  console.log(`\nMeasured ${rows.length} preview${rows.length === 1 ? '' : 's'} (probe ${PROBE_DIM}px, on ${GROUNDS.map((g) => g.name).join(' + ')}).`);
  if (!blanks.length) {
    console.log('✓ No blank previews.');
  } else {
    console.log(`\n✗ ${blanks.length} blank preview${blanks.length === 1 ? '' : 's'} across ${byTool.size} tool${byTool.size === 1 ? '' : 's'}:\n`);
    for (const [id, list] of [...byTool].sort()) {
      console.log(`  ${id}`);
      for (const f of list) line(f);
    }
    console.log('\n  A blank tile is not a truthful sample of what the tool makes. Per plans/155');
    console.log('  Task 4.4: capture the card from a declared example look instead of the empty');
    console.log('  default; a tool with no look to fall back on is a CONTENT gap (bake a preset),');
    console.log('  not something to fabricate art for.');
  }
  if (sparses.length) {
    const bySparse = groupByTool(sparses);
    console.log(`\n· ${sparses.length} near-empty preview${sparses.length === 1 ? '' : 's'} across ${bySparse.size} tool${bySparse.size === 1 ? '' : 's'} - FOR REVIEW, not a verdict:\n`);
    for (const [id, list] of [...bySparse].sort()) {
      console.log(`  ${id}`);
      for (const f of list) line(f);
    }
    console.log('\n  Almost all one colour. Some of these are empty states (a drop zone, a bare');
    console.log('  editor, a sheet of crop marks); some are simply minimal tools whose tile is');
    console.log('  honest as it stands (countdown-timer is "5:00 / START" and nothing else). No');
    console.log('  measurement can tell those apart - look at each one before changing it.');
  }
  if (!opts.only.length) console.log(`\n· Report written: catalog/previews/${REPORT_FILE}`);
}

// Import-without-side-effect: validate-catalog.ts imports the thresholds and the verdicts
// from here so the gate and the report can never disagree about what "blank" means.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => { console.error(e); process.exit(1); });
}
