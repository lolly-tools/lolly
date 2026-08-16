// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas performance baseline (plans/98 §9) - the NODE half of the harness.
 *
 * Measures the editor's pure, DOM-free hot paths against document size, so Phase A
 * has a hard number to beat and the plan's "document size must never set the ceiling"
 * claim is falsifiable. It compares TODAY's linear paths (free-canvas-math.ts) with
 * the Phase-A primitives (canvas-scene.ts):
 *
 *   hit-test     linear hitTest()  vs  grid hitGrid()          (per pointer event)
 *   marquee      linear marqueeHit() vs grid hitGridMarquee()
 *   paint proxy  full-array re-serialize (the "re-marshal the world" cost per edit)
 *                vs  diffBoxes() damage (the Phase-A per-edit cost)
 *
 * This is deliberately NOT the browser half: it does not measure real DOM paint,
 * reflow, or style recalc (that needs the built shell + Chromium - the interaction
 * harness, plans/98 §9 fixtures (a)-(e), tracked separately). What it DOES measure is
 * exactly the algorithmic cliff Phase A removes: an O(n) scan per pointer event and an
 * O(n) re-marshal per edit, both independent of how much actually changed.
 *
 * Usage:  node scripts/bench-canvas.ts [--iters=40] [--json=<path>]
 * Record the JSON as the plans/98 Phase-A baseline and diff against it after Phase A.
 */
import { writeFileSync } from 'node:fs';
import {
  hitTest, marqueeHit, type Box, type BoxFieldConfig,
} from '../shells/web/src/views/free-canvas-math.ts';
import {
  diffBoxes, buildHitGrid, hitGrid, hitGridMarquee, LAYOUT_STUDIO_CFG,
} from '../shells/web/src/views/canvas-scene.ts';

const args = new Map(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] as const : [a.replace(/^--/, ''), 'true'] as const;
}));
const ITERS = Number(args.get('iters') ?? 40);
const JSON_OUT = args.get('json');
const cfg: BoxFieldConfig = LAYOUT_STUDIO_CFG;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBoxes(n: number, seed = 1, spread = 6000): Box[] {
  const r = rng(seed);
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: `b${i}`, kind: r() < 0.1 ? 'frame' : r() < 0.5 ? 'text' : 'box',
      x: Math.round(r() * spread), y: Math.round(r() * spread),
      w: 20 + Math.round(r() * 300), h: 20 + Math.round(r() * 300),
      rot: r() < 0.4 ? Math.round(r() * 360) : 0,
      bg: '#ff0000', fg: '#111', text: `label ${i}`, fontSize: 24,
      opacity: 1, shape: 'rect', frame: '', order: i,
    });
  }
  return out;
}

/** Median + p95 (ms) of `fn` over ITERS runs, after a warmup. */
function timeMs(fn: () => void): { median: number; p95: number } {
  fn(); fn(); // warm
  const samples: number[] = [];
  for (let i = 0; i < ITERS; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[samples.length >> 1]!, p95: samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.95))]! };
}

const SIZES = [1000, 5000, 10000, 20000];
const QUERIES = 2000; // pointer events per timed run

interface Row {
  n: number;
  hitLinearNs: number; hitGridNs: number; gridBuildMs: number;
  marqueeLinearMs: number; marqueeGridMs: number;
  reserializeMs: number; diffUs: number;
}
const rows: Row[] = [];

for (const n of SIZES) {
  const boxes = makeBoxes(n);
  const q = rng(n ^ 0x5eed);
  const pts: [number, number][] = [];
  for (let i = 0; i < QUERIES; i++) pts.push([Math.round(q() * 6300) - 150, Math.round(q() * 6300) - 150]);

  // hit-test: ns per call
  const hitLinear = timeMs(() => { for (const [px, py] of pts) hitTest(boxes, px, py, cfg); });
  const grid = buildHitGrid(boxes, cfg);
  const gridBuild = timeMs(() => { buildHitGrid(boxes, cfg); });
  const hitGridT = timeMs(() => { for (const [px, py] of pts) hitGrid(grid, px, py); });

  // marquee: ms per full-document query (a mid-size rect)
  const rect = { x: 1000, y: 1000, w: 2500, h: 2500 };
  const marLinear = timeMs(() => { marqueeHit(boxes, rect, cfg); });
  const marGrid = timeMs(() => { hitGridMarquee(grid, rect); });

  // paint proxy: full re-serialize vs single-edit damage diff
  const reserialize = timeMs(() => { JSON.stringify(boxes); });
  const next = boxes.map((b) => ({ ...b }));
  const mid = (n / 2) | 0;
  next[mid] = { ...next[mid]!, x: (next[mid]!.x as number) + 3 };
  const REPS = 50;
  const diff = timeMs(() => { for (let i = 0; i < REPS; i++) diffBoxes(boxes, next, cfg); });

  rows.push({
    n,
    hitLinearNs: (hitLinear.median / QUERIES) * 1e6,
    hitGridNs: (hitGridT.median / QUERIES) * 1e6,
    gridBuildMs: gridBuild.median,
    marqueeLinearMs: marLinear.median,
    marqueeGridMs: marGrid.median,
    reserializeMs: reserialize.median,
    diffUs: (diff.median / REPS) * 1000,
  });
}

const f = (x: number, d = 1) => x.toFixed(d);
const pad = (s: string, w: number) => s.padStart(w);

console.log(`\ncanvas perf baseline — ${ITERS} iters, ${QUERIES} pointer events/run  (node ${process.version})\n`);
console.log('              hit-test (per pointer event)      │  per-edit cost                     │');
console.log('  boxes │   linear     grid    speedup  build   │  re-marshal floor   damage detect  │ marquee L→G');
console.log('  ──────┼─────────────────────────────────────────┼────────────────────────────────────┼────────────');
for (const r of rows) {
  const hitSpeed = r.hitLinearNs / r.hitGridNs;
  console.log(
    `  ${pad(String(r.n), 5)} │ ${pad(f(r.hitLinearNs, 0) + 'ns', 9)} ${pad(f(r.hitGridNs, 0) + 'ns', 8)} ${pad(f(hitSpeed, 0) + '×', 7)} ${pad(f(r.gridBuildMs, 1) + 'ms', 7)} │ ` +
    `${pad(f(r.reserializeMs, 2) + 'ms', 14)} ${pad(f(r.diffUs / 1000, 2) + 'ms', 15)} │ ${pad(f(r.marqueeLinearMs, 2) + '→' + f(r.marqueeGridMs, 2) + 'ms', 11)}`,
  );
}

// Interpretation against a 60fps (16.7ms) frame budget.
const worst = rows[rows.length - 1]!;
console.log('\ninterpretation (largest fixture, 20k boxes):');
console.log(`  • HIT-TEST: linear is ${f(worst.hitLinearNs / 1000, 1)}µs/event and grows with the document; the grid holds ${f(worst.hitGridNs, 0)}ns (${f(worst.hitLinearNs / worst.hitGridNs, 0)}× less) — picking stops scaling with box count. Grid (re)build is ${f(worst.gridBuildMs, 1)}ms, done once per geometry-damage batch, not per event.`);
console.log(`  • PER-EDIT: today every change re-marshals + re-renders ALL ${worst.n} boxes. Just the re-marshal FLOOR is ${f(worst.reserializeMs, 2)}ms (${f((worst.reserializeMs / 16.7) * 100, 0)}% of a 16.7ms frame) — the real innerHTML swap + style/layout in the browser is strictly worse. Phase A instead pays a ${f(worst.diffUs / 1000, 2)}ms damage diff, then patches only the |damage| node(s) that changed — O(edit), not O(document).`);
console.log(`  • the damage diff here is the UPPER BOUND (full per-field compare). The shipping design (plans/98 §5) caches a contentVersion per box in the hook worker, so the diff becomes an O(n) integer compare — cheaper still. The browser paint win (|damage| vs ${worst.n} nodes) is measured by the interaction harness, plans/98 §9 (a)-(e).\n`);

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify({ node: process.version, iters: ITERS, queries: QUERIES, rows }, null, 2));
  console.log(`baseline written → ${JSON_OUT}\n`);
}
