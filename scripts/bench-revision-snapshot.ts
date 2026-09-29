// SPDX-License-Identifier: MPL-2.0
/**
 * bench-revision-snapshot - what one automatic-history write costs on the main
 * thread, against the budget plan 277 P4 sets: 10 ms per MB of canonical JSON.
 *
 *   node scripts/bench-revision-snapshot.ts            # the table
 *   node scripts/bench-revision-snapshot.ts --json     # the same numbers as JSON
 *
 * The budget applies to revisionSnapshot(), as the plan words it: canonicalise,
 * stringify and hash one document. The table also prints the whole write around
 * it, because that is what the main thread pays. Since plan 277 P4 phase 1 the
 * write walks the document once (bridge/revision-capture.ts: pin, canonicalise and
 * copy in one pass, which is also the controller's frozen copy, so there is no
 * structuredClone either), then
 *   - a recovery draft: captureSnapshot hashes that capture, as writeRecovery
 *     does, every few seconds while someone edits;
 *   - a checkpoint: packCapture hashes and deflates it, as commitRevision does, at
 *     most once a minute.
 * The clone and pin columns time the path phase 0 measured (clone, pin, then
 * revisionSnapshot's second canonicalisation), for comparison.
 * Each figure is the median of repeated runs after a warm-up. Every checkpoint run
 * changes one key, so the packing cache never answers for that run.
 *
 * Documents: the real 22-frame Design deck when the local copy exists
 * (plans/scratch/singapore-rebuild/design-inputs.json, gitignored), a 1,000-box Design
 * document tiled from every Design template with a distinct id, position and text
 * per copy (so deflate is not flattered by repeats), Chart with a 200-row table,
 * and filter, deck-studio, darkroom and diagram-builder at their defaults.
 *
 * The budget is 10 ms per MiB of canonical JSON, with a floor of 1 ms: below
 * about 100 KB the cost is the fixed price of an async SHA-256, not the document.
 * tests/revision-snapshot-bench.test.ts asserts it with BENCH=1, as the repo's
 * other wall-clock guards do, on the fastest of its runs, so a busy machine does
 * not decide the result; the table prints medians. The exit code here follows the
 * same rule.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { snapshotAtDefaults } from './tool-history-audit.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MS_PER_MIB = 10;
export const FLOOR_MS = 1;
export const REAL_DECK = join(ROOT, 'plans/scratch/singapore-rebuild/design-inputs.json');

type Data = Record<string, unknown>;
export interface BenchDocument { name: string; data: Data; local?: boolean }
export interface BenchResult {
  name: string;
  canonicalBytes: number;
  deflatedBytes: number;
  cloneMs: number;
  /** pinRevisionAssets, which canonicalises the document. */
  pinMs: number;
  /** revisionSnapshot on the pinned document, median: what the table prints. */
  snapshotMs: number;
  /** The fastest revisionSnapshot run: what the budget is asserted on, because it
   *  is the run another process on the machine disturbed least. */
  snapshotMinMs: number;
  /** packedRevisionSnapshot on the pinned document: the snapshot plus deflate. */
  packedMs: number;
  /** captureRevision: the one walk (pin, canonicalise, copy) and the stringify. */
  captureMs: number;
  /** capture + captureSnapshot: a recovery draft, the whole write path. */
  draftMs: number;
  /** The fastest draft run: what the whole-write budget is asserted on. */
  draftMinMs: number;
  /** capture + packCapture: a checkpoint, with deflate. */
  checkpointMs: number;
  /** clone + pin + revisionSnapshot: the draft as phase 0 measured it, before the single walk. */
  legacyDraftMs: number;
  budgetMs: number;
  local?: boolean;
}

/** The budget for a document of `bytes` canonical JSON. */
export function budgetMs(bytes: number): number {
  return Math.max(FLOOR_MS, (MS_PER_MIB * bytes) / 1_048_576);
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/** Time one document's write: the single-walk draft and checkpoint, and the
 * stages of the path phase 0 measured, for comparison. */
export async function measure(doc: BenchDocument, opts: { runs?: number; warmup?: number } = {}): Promise<BenchResult> {
  const { pinRevisionAssets } = await import('../shells/web/src/bridge/revision-asset-pins.ts');
  const { captureRevision } = await import('../shells/web/src/bridge/revision-capture.ts');
  const { revisionSnapshot, captureSnapshot, packCapture } = await import('../shells/web/src/bridge/revision-snapshot.ts');
  const runs = opts.runs ?? 15, warmup = opts.warmup ?? 3;
  const clone: number[] = [], pin: number[] = [], snapshot: number[] = [], packed: number[] = [], capture: number[] = [], draft: number[] = [], checkpoint: number[] = [];
  let canonicalBytes = 0, deflatedBytes = 0;
  for (let i = 0; i < warmup + runs; i++) {
    const keep = i >= warmup;
    // The path phase 0 measured: clone, pin (a first canonicalisation), snapshot (a second).
    let t = performance.now();
    const copy = structuredClone(doc.data);
    const cloned = performance.now() - t;
    t = performance.now();
    const pinned = pinRevisionAssets(copy as never);
    const pinnedMs = performance.now() - t;
    t = performance.now();
    const snap = await revisionSnapshot(pinned);
    const snapMs = performance.now() - t;
    // The write path now: one walk, then the hash (a draft) or the hash and deflate (a checkpoint).
    t = performance.now();
    const captured = captureRevision(doc.data as never);
    const captureMs = performance.now() - t;
    await captureSnapshot(captured);
    const draftMs = performance.now() - t;
    // A key that changes every run, so the last-packing cache never answers.
    t = performance.now();
    const pack = await packCapture(captureRevision({ ...doc.data, __bench: i } as never));
    const packMs = performance.now() - t;
    if (keep) { clone.push(cloned); pin.push(pinnedMs); snapshot.push(snapMs); packed.push(packMs); capture.push(captureMs); draft.push(draftMs); checkpoint.push(packMs); }
    canonicalBytes = snap.bytes; deflatedBytes = pack.stored;
  }
  const c = median(clone), p = median(pin), sn = median(snapshot);
  return {
    name: doc.name, canonicalBytes, deflatedBytes, cloneMs: c, pinMs: p, snapshotMs: sn, snapshotMinMs: Math.min(...snapshot), packedMs: median(packed),
    captureMs: median(capture), draftMs: median(draft), draftMinMs: Math.min(...draft), checkpointMs: median(checkpoint), legacyDraftMs: c + p + sn,
    budgetMs: budgetMs(canonicalBytes), ...(doc.local ? { local: true } : {}),
  };
}

/** Deterministic words for the tiled Design document's text. */
const WORDS = ['harbour', 'lantern', 'meridian', 'copper', 'orchard', 'signal', 'tidewater', 'granite', 'saffron', 'canopy', 'ember', 'quarry', 'willow', 'atlas', 'juniper', 'cobalt'];

/** A Design document of `count` boxes, tiled from every Design template. */
export function tiledDesignDocument(count = 1000): Data {
  const dir = join(ROOT, 'community/design/templates');
  const templates = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as { values?: { boxes?: Record<string, unknown>[] } })
    .map(t => t.values?.boxes ?? []).filter(b => b.length);
  const boxes: Record<string, unknown>[] = [];
  for (let copy = 0; boxes.length < count; copy++) {
    const source = templates[copy % templates.length]!;
    const suffix = `-c${copy}`;
    for (const box of source) {
      if (boxes.length >= count) break;
      const next: Record<string, unknown> = structuredClone(box);
      next.id = `${String(box.id)}${suffix}`;
      if (typeof box.frame === 'string') next.frame = `${box.frame}${suffix}`;
      if (typeof box.x === 'number') next.x = box.x + (copy % 7) * 13;
      if (typeof box.y === 'number') next.y = box.y + (copy % 5) * 11;
      if (typeof box.text === 'string') next.text = `${box.text} ${WORDS[(copy * 7 + boxes.length) % WORDS.length]} ${copy}`;
      boxes.push(next);
    }
  }
  return { __toolId: 'design', __toolVersion: '1', __workspace_intent: 'general', background: 'transparent', boxes };
}

/** Chart's `data` as a 200-row table, in the CSV form the input stores. */
export function chartTable(rows = 200): string {
  const lines = ['Week,Revenue,Cost,Visitors'];
  for (let i = 1; i <= rows; i++) lines.push(`W${i},${(1200 + ((i * 7919) % 900)).toString()},${(700 + ((i * 104729) % 500)).toString()},${(3000 + ((i * 1299709) % 4000)).toString()}`);
  return lines.join('\n');
}

/** The documents the plan asks for, in the order the table prints them. */
export async function benchDocuments(opts: { local?: boolean } = {}): Promise<BenchDocument[]> {
  const docs: BenchDocument[] = [];
  if (opts.local !== false && existsSync(REAL_DECK)) {
    const deck = JSON.parse(readFileSync(REAL_DECK, 'utf8')) as Data;
    docs.push({ name: 'Design, the real 22-frame deck', data: { __toolId: 'design', __toolVersion: '1', __workspace_intent: 'general', ...deck }, local: true });
  }
  docs.push({ name: 'Design, 1,000 boxes tiled from the templates', data: tiledDesignDocument(1000) });
  const chart = await snapshotAtDefaults('chart');
  docs.push({ name: 'Chart with a 200-row table', data: { ...chart, data: chartTable(200) } });
  for (const id of ['filter', 'deck-studio', 'darkroom', 'diagram-builder']) docs.push({ name: `${id} at defaults`, data: await snapshotAtDefaults(id) });
  return docs;
}

export async function run(argv = process.argv.slice(2)): Promise<number> {
  const json = argv.includes('--json');
  const results: BenchResult[] = [];
  for (const doc of await benchDocuments()) results.push(await measure(doc));
  if (json) { process.stdout.write(`${JSON.stringify(results, null, 2)}\n`); return 0; }
  const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;
  const ms = (n: number): string => n.toFixed(2);
  const perMiB = (n: number, bytes: number): string => (n / (bytes / 1_048_576)).toFixed(1);
  console.log(`${'document'.padEnd(46)} ${'canonical'.padStart(9)} ${'deflated'.padStart(8)} ${'ratio'.padStart(5)} | ${'snapshot'.padStart(8)} ${'fastest'.padStart(7)} ${'budget'.padStart(6)} | ${'draft'.padStart(5)} ${'fastest'.padStart(7)} ${'ms/MiB'.padStart(6)} ${'chkpt'.padStart(5)} ${'ms/MiB'.padStart(6)} | ${'before'.padStart(6)} ${'clone'.padStart(5)} ${'pin'.padStart(5)}`);
  let over = 0;
  for (const r of results) {
    const within = r.snapshotMinMs <= r.budgetMs && r.draftMinMs <= r.budgetMs;
    if (!within) over++;
    console.log(`${(r.name + (r.local ? ' (local)' : '')).padEnd(46)} ${kb(r.canonicalBytes).padStart(9)} ${kb(r.deflatedBytes).padStart(8)} ${(r.canonicalBytes / r.deflatedBytes).toFixed(1).padStart(4)}x | ${ms(r.snapshotMs).padStart(8)} ${ms(r.snapshotMinMs).padStart(7)} ${ms(r.budgetMs).padStart(6)} | ${ms(r.draftMs).padStart(5)} ${ms(r.draftMinMs).padStart(7)} ${perMiB(r.draftMs, r.canonicalBytes).padStart(6)} ${ms(r.checkpointMs).padStart(5)} ${perMiB(r.checkpointMs, r.canonicalBytes).padStart(6)} | ${ms(r.legacyDraftMs).padStart(6)} ${ms(r.cloneMs).padStart(5)} ${ms(r.pinMs).padStart(5)}${within ? '' : '  over budget'}`);
  }
  console.log(`\nTimes in ms, medians except "fastest". snapshot = revisionSnapshot() alone; budget = ${MS_PER_MIB} ms per MiB of canonical JSON, at least ${FLOOR_MS} ms, held by the fastest run of the snapshot and of the draft.`);
  console.log('draft = the whole recovery-draft write: one walk (pin, canonicalise, copy), stringify, hash. chkpt = the same plus deflate.');
  console.log('before = the draft as phase 0 measured it: clone + pin (a first canonicalisation) + snapshot (a second).');
  console.log(over ? `${over} document(s) over budget.` : 'Every snapshot and every draft write is within budget.');
  return over ? 1 : 0;
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invoked) run().then(code => process.exit(code), error => { console.error(error); process.exit(2); });
