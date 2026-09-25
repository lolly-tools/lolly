// SPDX-License-Identifier: MPL-2.0
/**
 * Outlined labels as live text (plan 275 section 9.3).
 *
 * A chart tool that outlines its text writes every label as filled glyph outlines,
 * so a drawing read into items (`svg-items.ts`) holds its axis ticks, category names
 * and data labels as paths: the words cannot be edited or set in another face, and
 * the outlines are most of the drawing's path data. `glyphRunsOf` finds those runs;
 * this module turns each run, once a recogniser has read it, into one `text` item
 * with its size, anchor and ink, in place of the paths it covered.
 *
 * The recogniser is injected (`VectorLabelReaderV1`, a frame in and a line of text
 * out) and fed a picture this module draws itself: `glyphRunFrame` fills the run's
 * outlines black on white at a height a text recogniser reads well. A reading is
 * then checked against what the drawing states about itself (`svgLabelHintsOf`):
 *
 *   - a category or series name (`data-recolor`, `data-series`, `data-name`), the
 *     title or a phrase of the description that a run, or a stack of wrapped runs,
 *     reads close to is taken as the drawing states it, split across the stack at
 *     word boundaries so the lines joined give the name exactly;
 *   - the numbers of an axis are fitted as one even sequence against where their
 *     runs stand, and a tick read wrongly or not at all takes the fitted value.
 *
 * A run is written as text when a hint confirms it, or when the recogniser's own
 * confidence is at or above the floor and its reading has about as many characters
 * as the run has glyphs. Every other run keeps its paths, and the result says how
 * many stayed drawn.
 *
 * A text item carries no face: the compile sets it in the design system's face
 * (section 9.2). Its size comes from the run's ascent and the characters read (a
 * run of lowercase letters with no ascender reaches x-height, not cap height). Its
 * anchor comes from its neighbours: runs whose right edges line up are set from the
 * right, a run centred on a grid line, a bar or other runs is centred, and the rest
 * start at their left edge. Weight is not read; every run is written regular.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness. The recogniser is
 * the one asynchronous part, and it arrives injected.
 */

import type { OcrFrame } from '@lolly-tools/core/host-v1';
import type { VectorItemsV1, VectorItemV1, VectorTextItemV1 } from '@lolly-tools/core';

import { glyphRunsOf, type GlyphRunV1, type SvgLabelHintsV1 } from './svg-items.ts';
import { parseSvgPath } from './svg-path.ts';

/** What a recogniser read from one run's picture: one line of text and its own 0 to 1 confidence. */
export interface VectorLabelReadingV1 {
  text: string;
  confidence: number;
}

/** Reads one run's picture. Null when it read nothing. */
export type VectorLabelReaderV1 = (frame: OcrFrame) => Promise<VectorLabelReadingV1 | null>;

/** A recogniser confidence under this, with nothing in the drawing to confirm the reading, keeps the paths. */
export const VECTOR_LABEL_MIN_CONFIDENCE = 0.8;
/** A reading a hint confirms still needs this much confidence, so a guess is not dressed as the drawing's own words. */
const CONFIRMED_MIN_CONFIDENCE = 0.4;
/** Normalised edit distance under which a reading is taken as a stated name or phrase. */
const HINT_DISTANCE = 0.34;
/** Runs one drawing reads at most. Past it the rest stay drawn. */
export const MAX_LABEL_RUNS_PER_DRAWING = 400;
/** Height of the glyphs' ink in a frame, in pixels. */
const FRAME_INK_HEIGHT = 32;
const FRAME_PAD = 12;
const FRAME_MAX_WIDTH = 2400;
/** Vertical samples per pixel row. Horizontal coverage is exact. */
const SUBSAMPLES = 4;

// ─── the picture a recogniser reads ─────────────────────────────────────────

interface Edge {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** +1 going down, -1 going up. */
  dir: number;
}

/** Straight edges of a path, cubics cut into short chords, every subpath closed. */
function edgesOf(d: string, map: (x: number, y: number) => [number, number]): Edge[] {
  const edges: Edge[] = [];
  const add = (ax: number, ay: number, bx: number, by: number): void => {
    if (ay === by) return;
    edges.push(ay < by ? { x0: ax, y0: ay, x1: bx, y1: by, dir: 1 } : { x0: bx, y0: by, x1: ax, y1: ay, dir: -1 });
  };
  for (const sub of parseSvgPath(d)) {
    let sx = 0; let sy = 0; let px = 0; let py = 0;
    for (const seg of sub.segments) {
      if (seg.op === 'M') {
        if (px !== sx || py !== sy) add(px, py, sx, sy);
        [sx, sy] = map(seg.x, seg.y);
        px = sx; py = sy;
        continue;
      }
      if (seg.op === 'L') {
        const [x, y] = map(seg.x, seg.y);
        add(px, py, x, y);
        px = x; py = y;
        continue;
      }
      const [c1x, c1y] = map(seg.x1, seg.y1);
      const [c2x, c2y] = map(seg.x2, seg.y2);
      const [ex, ey] = map(seg.x, seg.y);
      const len = Math.hypot(c1x - px, c1y - py) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y);
      const n = Math.max(2, Math.min(32, Math.ceil(len / 2)));
      let lx = px; let ly = py;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        const x = u * u * u * px + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex;
        const y = u * u * u * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey;
        add(lx, ly, x, y);
        lx = x; ly = y;
      }
      px = ex; py = ey;
    }
    if (px !== sx || py !== sy) add(px, py, sx, sy);
  }
  return edges;
}

/** Add one path's filled coverage into `cov`, `w` by `h` pixels, by its own fill rule, between `clipL` and `clipR` across. */
function fillCoverage(cov: Float32Array, w: number, h: number, edges: Edge[], evenOdd: boolean, clipL: number, clipR: number): void {
  const hits: Array<[number, number]> = [];
  for (let row = 0; row < h; row++) {
    for (let k = 0; k < SUBSAMPLES; k++) {
      const y = row + (k + 0.5) / SUBSAMPLES;
      hits.length = 0;
      for (const e of edges) {
        if (y < e.y0 || y >= e.y1) continue;
        hits.push([e.x0 + ((y - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0), e.dir]);
      }
      if (hits.length < 2) continue;
      hits.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      for (let i = 0; i < hits.length - 1; i++) {
        winding += hits[i]![1];
        const inside = evenOdd ? (winding & 1) !== 0 : winding !== 0;
        if (!inside) continue;
        const xa = Math.max(clipL, hits[i]![0]);
        const xb = Math.min(clipR, hits[i + 1]![0]);
        if (xb <= xa) continue;
        const base = row * w;
        const ia = Math.floor(xa);
        const ib = Math.floor(xb);
        const share = 1 / SUBSAMPLES;
        if (ia === ib) {
          cov[base + ia] = cov[base + ia]! + (xb - xa) * share;
          continue;
        }
        cov[base + ia] = cov[base + ia]! + (ia + 1 - xa) * share;
        for (let x = ia + 1; x < ib; x++) cov[base + x] = cov[base + x]! + share;
        if (ib < w) cov[base + ib] = cov[base + ib]! + (xb - ib) * share;
      }
    }
  }
}

/**
 * A run's glyphs filled black on white, their ink scaled to `FRAME_INK_HEIGHT` pixels
 * (narrower when a long run would pass `FRAME_MAX_WIDTH`) with a margin all round: the
 * picture a line recogniser reads. The run's own colour is not used, so pale ink on
 * a tinted chart reads as well as black. `span` draws only the glyphs between two
 * points across (a few words of a long run), with nothing of their neighbours.
 */
export function glyphRunFrame(items: VectorItemsV1, run: GlyphRunV1, span?: { x: number; w: number }): OcrFrame {
  const box = span ? { x: span.x, y: run.box.y, w: span.w, h: run.box.h } : run.box;
  let scale = FRAME_INK_HEIGHT / Math.max(box.h, 1e-6);
  if (box.w * scale + 2 * FRAME_PAD > FRAME_MAX_WIDTH) scale = (FRAME_MAX_WIDTH - 2 * FRAME_PAD) / Math.max(box.w, 1e-6);
  const w = Math.max(1, Math.ceil(box.w * scale + 2 * FRAME_PAD));
  const h = Math.max(1, Math.ceil(box.h * scale + 2 * FRAME_PAD));
  const map = (x: number, y: number): [number, number] => [(x - box.x) * scale + FRAME_PAD, (y - box.y) * scale + FRAME_PAD];
  const cov = new Float32Array(w * h);
  for (const index of run.items) {
    const item = items.items[index];
    if (item?.kind !== 'path') continue;
    fillCoverage(cov, w, h, edgesOf(item.d, map), item.fillRule === 'evenodd', Math.max(0, FRAME_PAD - 2), Math.min(w, w - FRAME_PAD + 2));
  }
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(255 * (1 - Math.min(1, cov[i]!)));
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

/**
 * A key for a run's glyphs wherever they stand: the same label drawn at another
 * place (the same tick on every chart of a deck) keys alike, so a caller reads it
 * once. Built from the outlines moved to the run's own corner, hashed.
 */
export function glyphRunKey(items: VectorItemsV1, run: GlyphRunV1): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let n = 0;
  const feed = (value: number): void => {
    const v = Math.round(value * 20);
    h1 = Math.imul(h1 ^ v, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (v + n), 0x5bd1e995) >>> 0;
    n += 1;
  };
  for (const index of run.items) {
    const item = items.items[index];
    if (item?.kind !== 'path') continue;
    for (const sub of parseSvgPath(item.d)) {
      for (const seg of sub.segments) {
        if (seg.op === 'C') { feed(seg.x1 - run.box.x); feed(seg.y1 - run.box.y); feed(seg.x2 - run.box.x); feed(seg.y2 - run.box.y); }
        feed(seg.x - run.box.x);
        feed(seg.y - run.box.y);
      }
      feed(sub.closed ? -1e6 : -2e6);
    }
  }
  return `${h1.toString(36)}.${h2.toString(36)}.${n}.${run.glyphs}`;
}

// ─── checking a reading against the drawing's own words ─────────────────────

/** Case and spacing folded, so a comparison reads letters only as a person would. */
function fold(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Edit distance between two strings, capped work: both are label length. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let next = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    next[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      next[j] = Math.min(prev[j]! + 1, next[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, next] = [next, prev];
  }
  return prev[b.length]!;
}

/** Edit distance over the longer length, 0 the same and 1 nothing alike. */
function distance(a: string, b: string): number {
  const fa = fold(a);
  const fb = fold(b);
  const longest = Math.max(fa.length, fb.length);
  return longest ? editDistance(fa, fb) / longest : 0;
}

/** Words of a phrase, split on spaces. */
function wordsOf(text: string): string[] {
  return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
}

/**
 * The phrases a drawing states: its names, its title and the parts of its description
 * (split at a middle dot, a bullet or a sentence end), each once, 200 characters at most.
 */
function phrasesOf(hints: SvgLabelHintsV1 | undefined, items: VectorItemsV1): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined): void => {
    const text = raw?.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 300 || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  for (const name of hints?.names ?? []) add(name);
  for (const item of items.items) add(item.series);
  add(hints?.title ?? items.title);
  // The description's sentences whole (a chart's source line is often its first
  // sentence, drawn as one label) and the parts they are made of.
  for (const sentence of (hints?.desc ?? items.desc ?? '').split(/(?<=[.!?])\s+/)) {
    add(sentence.replace(/[.]$/, ''));
    for (const part of sentence.split(/\s+[\u00b7\u2022|]\s+/)) add(part.replace(/[.]$/, ''));
  }
  return out;
}

/** Word sets for a cheap first look, so the edit distance runs on a few phrases only. */
function overlapShare(reading: string, phrase: string): number {
  const read = wordsOf(fold(reading));
  if (!read.length) return 0;
  const have = new Set(wordsOf(fold(phrase)));
  let hit = 0;
  for (const w of read) if (have.has(w)) hit += 1;
  return hit / read.length;
}

/**
 * The phrase split into `k` runs of words, each as close as it can be to its line's
 * reading, and the summed distance. The parts joined with spaces are the phrase.
 */
function splitPhrase(phrase: string, lines: string[]): { parts: string[]; cost: number } | null {
  const words = wordsOf(phrase);
  const k = lines.length;
  if (k === 1) return { parts: [phrase.replace(/\s+/g, ' ').trim()], cost: distance(lines[0]!, phrase) };
  if (k > 8 || words.length < k || words.length > 60) return null;
  // best[j][i]: least cost putting words[0..i) on lines[0..j).
  const best: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(words.length + 1).fill(Infinity));
  const from: number[][] = Array.from({ length: k + 1 }, () => new Array<number>(words.length + 1).fill(-1));
  best[0]![0] = 0;
  for (let j = 1; j <= k; j++) {
    for (let i = j; i <= words.length - (k - j); i++) {
      for (let s = j - 1; s < i; s++) {
        const before = best[j - 1]![s]!;
        if (!Number.isFinite(before)) continue;
        const cost = before + distance(lines[j - 1]!, words.slice(s, i).join(' '));
        if (cost < best[j]![i]!) {
          best[j]![i] = cost;
          from[j]![i] = s;
        }
      }
    }
  }
  const total = best[k]![words.length]!;
  if (!Number.isFinite(total)) return null;
  const parts: string[] = [];
  let i = words.length;
  for (let j = k; j > 0; j--) {
    const s = from[j]![i]!;
    parts.unshift(words.slice(s, i).join(' '));
    i = s;
  }
  return { parts, cost: total / k };
}

/** Runs stacked as the wrapped lines of one label: same group, one under the next, overlapping across. */
function stacksOf(runs: GlyphRunV1[], order: number[]): number[][] {
  const stacks: number[][] = [];
  const byGroup = new Map<string, number[]>();
  for (const i of order) {
    const key = (runs[i]!.groups ?? []).join('\u001f');
    const list = byGroup.get(key) ?? [];
    list.push(i);
    byGroup.set(key, list);
  }
  for (const list of byGroup.values()) {
    const sorted = [...list].sort((a, b) => runs[a]!.baseline - runs[b]!.baseline || runs[a]!.box.x - runs[b]!.box.x);
    const used = new Set<number>();
    for (const start of sorted) {
      if (used.has(start)) continue;
      const stack = [start];
      used.add(start);
      let last = runs[start]!;
      for (const next of sorted) {
        if (used.has(next)) continue;
        const r = runs[next]!;
        const step = r.baseline - last.baseline;
        const across = Math.min(last.box.x + last.box.w, r.box.x + r.box.w) - Math.max(last.box.x, r.box.x);
        const tol = 0.2 * last.ascent;
        const aligned = across > 0 || Math.abs(r.box.x - last.box.x) < tol || Math.abs(r.box.x + r.box.w - (last.box.x + last.box.w)) < tol;
        if (step >= 1.1 * last.ascent && step <= 3 * last.ascent && Math.abs(r.ascent - last.ascent) <= 0.25 * last.ascent && aligned) {
          stack.push(next);
          used.add(next);
          last = r;
        }
      }
      stacks.push(stack);
    }
  }
  return stacks;
}

/** What the hints settled for one run: its text, and whether the drawing's own words confirm it. */
interface Settled {
  text: string;
  confirmed: boolean;
}

/**
 * Stacks of runs matched to the drawing's phrases. A stack is cut into consecutive
 * pieces, each one phrase split across its lines or one line on its own, whichever
 * costs least; a piece of more than one line must match a phrase.
 */
function settleByPhrases(runs: GlyphRunV1[], texts: Array<string | null>, phrases: string[], out: Map<number, Settled>): void {
  if (!phrases.length) return;
  const order = runs.map((_, i) => i).filter((i) => texts[i]);
  for (const stack of stacksOf(runs, order)) {
    const n = stack.length;
    // cost[a][b]: the best phrase for lines a..b, and its split.
    const pieceCost = (a: number, b: number): { cost: number; phrase?: string; parts?: string[] } => {
      const lines = stack.slice(a, b + 1).map((i) => texts[i]!);
      const joined = lines.join(' ');
      let best: { cost: number; phrase?: string; parts?: string[] } = { cost: a === b ? HINT_DISTANCE : Infinity };
      const ranked = phrases
        .map((p) => ({ p, share: overlapShare(joined, p) }))
        .filter((x) => x.share > 0 || fold(x.p).length <= 12)
        .sort((x, y) => y.share - x.share)
        .slice(0, 6);
      for (const { p } of ranked) {
        const split = splitPhrase(p, lines);
        if (!split) continue;
        const whole = distance(joined, p);
        // Weighed by lines, so one phrase over two lines costs what two lines on their own would.
        const cost = whole * lines.length;
        if (whole <= HINT_DISTANCE && cost < best.cost) best = { cost, phrase: p, parts: split.parts };
      }
      return best;
    };
    const dp = new Array<number>(n + 1).fill(Infinity);
    const cut = new Array<{ from: number; phrase?: string; parts?: string[] }>(n + 1);
    dp[0] = 0;
    for (let b = 1; b <= n; b++) {
      for (let a = Math.max(0, b - 8); a < b; a++) {
        if (!Number.isFinite(dp[a]!)) continue;
        const piece = pieceCost(a, b - 1);
        const total = dp[a]! + piece.cost;
        if (total < dp[b]!) {
          dp[b] = total;
          cut[b] = { from: a, ...(piece.phrase ? { phrase: piece.phrase } : {}), ...(piece.parts ? { parts: piece.parts } : {}) };
        }
      }
    }
    for (let b = n; b > 0;) {
      const piece = cut[b]!;
      for (const [k, text] of (piece.parts ?? []).entries()) out.set(stack[piece.from + k]!, { text, confirmed: true });
      b = piece.from;
    }
  }
}

/** A number as a label writes it: what comes before, the digits, what comes after. */
function numberOf(text: string): { prefix: string; value: number; decimals: number; suffix: string; grouped: boolean } | null {
  const m = /^([^\d\-\u2212+.]*)([-\u2212+]?)(\d[\d,]*)(\.\d+)?(\D*)$/.exec(text.trim());
  if (!m) return null;
  const digits = m[3]!.replace(/,/g, '');
  const value = Number(`${m[2] === '\u2212' ? '-' : m[2]}${digits}${m[4] ?? ''}`);
  if (!Number.isFinite(value)) return null;
  return { prefix: m[1]!, value, decimals: m[4] ? m[4].length - 1 : 0, suffix: m[5]!, grouped: m[3]!.includes(',') };
}

/** A magnitude with fixed decimals and, when the axis groups its thousands, commas. No locale is read. */
function formatMagnitude(value: number, decimals: number, grouped: boolean): string {
  const [whole, frac] = value.toFixed(decimals).split('.');
  const digits = grouped ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole!;
  return frac ? `${digits}.${frac}` : digits;
}

function mode<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  let best: T | undefined;
  let top = 0;
  for (const v of values) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > top) { top = c; best = v; }
  }
  return best;
}

/**
 * The numbered runs of each label group fitted as one even sequence against where
 * they stand (across for a row of ticks, down for a column). When most of them agree
 * on one line, every run of the group takes its value on that line, written the way
 * the agreeing ones are written, so a tick the recogniser misread or could not read
 * is put right. Three agreeing ticks at least; an axis of two proves nothing.
 */
function settleByAxis(runs: GlyphRunV1[], texts: Array<string | null>, out: Map<number, Settled>): void {
  const byGroup = new Map<string, number[]>();
  runs.forEach((run, i) => {
    if (!run.labelGroup) return;
    const key = (run.groups ?? []).join('\u001f');
    const list = byGroup.get(key) ?? [];
    list.push(i);
    byGroup.set(key, list);
  });
  for (const members of byGroup.values()) {
    if (members.length < 3) continue;
    const parsed = members.map((i) => ({ i, n: texts[i] ? numberOf(texts[i]!) : null }));
    const numbered = parsed.filter((p): p is { i: number; n: NonNullable<ReturnType<typeof numberOf>> } => p.n !== null);
    if (numbered.length < 3 || numbered.length * 2 < members.length) continue;
    const xs = members.map((i) => runs[i]!.box.x + runs[i]!.box.w / 2);
    const ys = members.map((i) => runs[i]!.baseline);
    const spread = (v: number[]): number => Math.max(...v) - Math.min(...v);
    const across = spread(xs) >= spread(ys);
    const pos = (i: number): number => (across ? runs[i]!.box.x + runs[i]!.box.w / 2 : runs[i]!.baseline);
    const values = numbered.map((p) => p.n.value);
    const range = Math.max(...values) - Math.min(...values);
    if (!(range > 0)) continue;
    let best: { a: number; b: number; inliers: typeof numbered } | null = null;
    for (let p = 0; p < numbered.length; p++) {
      for (let q = p + 1; q < numbered.length; q++) {
        const P = numbered[p]!;
        const Q = numbered[q]!;
        const dp = pos(Q.i) - pos(P.i);
        if (Math.abs(dp) < 1e-6) continue;
        const b = (Q.n.value - P.n.value) / dp;
        const a = P.n.value - b * pos(P.i);
        const inliers = numbered.filter((r) => Math.abs(a + b * pos(r.i) - r.n.value) <= 0.02 * range);
        if (!best || inliers.length > best.inliers.length) best = { a, b, inliers };
      }
    }
    if (!best || best.inliers.length < 3 || best.inliers.length * 5 < numbered.length * 3) continue;
    // Least squares over the agreeing ticks.
    const pts = best.inliers.map((r) => [pos(r.i), r.n.value] as const);
    const mx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
    const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
    const sxx = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
    const sxy = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0);
    const b = sxx > 0 ? sxy / sxx : best.b;
    const a = my - b * mx;
    const decimals = Math.max(...best.inliers.map((r) => r.n.decimals));
    const prefix = mode(best.inliers.map((r) => r.n.prefix)) ?? '';
    const suffix = mode(best.inliers.map((r) => r.n.suffix)) ?? '';
    const grouped = best.inliers.some((r) => r.n.grouped);
    const negative = best.inliers.find((r) => r.n.value < 0 && texts[r.i]!.includes('\u2212')) ? '\u2212' : '-';
    for (const i of members) {
      const raw = a + b * pos(i);
      const rounded = Number(raw.toFixed(decimals));
      const magnitude = formatMagnitude(Math.abs(rounded), decimals, grouped);
      const text = `${rounded < 0 ? negative : ''}${prefix}${magnitude}${suffix}`;
      out.set(i, { text, confirmed: true });
    }
  }
}

// ─── placing the text ────────────────────────────────────────────────────────

/** Cap height, ascender height and x-height as shares of the em, the proportions of a common sans face. */
const CAP_SHARE = 0.72;
const ASCENDER_SHARE = 0.75;
const X_SHARE = 0.53;

/**
 * The font size a run was set at, read off its glyphs. When the reading has one
 * character per glyph, each glyph is matched to its character and the size comes from
 * the capitals and digits (cap height), else the ascenders, else the x-height letters.
 * Otherwise the run's ascent stands for cap height when the reading holds a capital,
 * a digit or an ascender, and for x-height when it does not.
 */
function sizeOf(run: GlyphRunV1, text: string): number {
  const chars = [...text.replace(/\s+/g, '')];
  if (chars.length === run.glyphBoxes.length) {
    const heights = (pattern: RegExp): number[] => run.glyphBoxes
      .filter((g, k) => pattern.test(chars[k]!) && Math.abs(g.y + g.h - run.baseline) <= 0.12 * run.ascent)
      .map((g) => run.baseline - g.y);
    for (const [pattern, share] of [[/[A-PR-Z0-9]/, CAP_SHARE], [/[bdfhkl]/, ASCENDER_SHARE], [/[acemnorsuvwxz]/, X_SHARE]] as const) {
      const found = heights(pattern);
      if (found.length) return medianOf(found) / share;
    }
  }
  return run.ascent / (/[A-Z0-9bdfhklt]/.test(text) ? CAP_SHARE : X_SHARE);
}

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * How a run is anchored, read off its neighbours: set from the right when another
 * run of its kind (its group, its ink, about its size) ends where it ends and starts
 * elsewhere, centred when its middle stands on a vertical rule, the middle of a bar or
 * the middle of another run of its kind, and from the left otherwise.
 */
function anchorOf(run: GlyphRunV1, runs: GlyphRunV1[], items: VectorItemsV1): 'start' | 'middle' | 'end' {
  const tol = Math.max(1, 0.15 * run.ascent);
  const left = run.box.x;
  const right = run.box.x + run.box.w;
  const mid = left + run.box.w / 2;
  // Kin: the runs set alongside it, in its group, its ink and about its size.
  const key = (run.groups ?? []).join('\u001f');
  const kin = runs.filter((r) => r !== run && (r.groups ?? []).join('\u001f') === key && r.fill === run.fill
    && (r.opacity ?? 1) === (run.opacity ?? 1) && Math.abs(r.ascent - run.ascent) <= 0.25 * run.ascent);
  const ends = kin.filter((r) => Math.abs(r.box.x + r.box.w - right) <= tol && Math.abs(r.box.x - left) > tol).length;
  const starts = kin.filter((r) => Math.abs(r.box.x - left) <= tol && Math.abs(r.box.x + r.box.w - right) > tol).length;
  if (ends > starts) return 'end';
  if (starts > 0) return 'start';
  for (const item of items.items) {
    if (item.kind !== 'path') continue;
    const vertical = item.shape === 'line' && item.box.w <= 1e-3;
    const bar = item.shape === 'rect' && item.box.w > 2 * tol;
    if ((vertical || bar) && Math.abs(item.box.x + item.box.w / 2 - mid) <= tol) return 'middle';
  }
  if (kin.some((r) => Math.abs(r.box.x + r.box.w / 2 - mid) <= tol && Math.abs(r.box.x - left) > tol)) return 'middle';
  return 'start';
}

function r3(n: number): number {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

/** Non-space characters of a reading. */
function inkChars(text: string): number {
  return text.replace(/\s+/g, '').length;
}

// ─── the whole pass ──────────────────────────────────────────────────────────

export interface VectorTextResultV1 {
  /** The drawing with every run read into text in place of its paths; the same object when none was. */
  items: VectorItemsV1;
  /** Runs found. */
  runs: number;
  /** Runs written as text. */
  text: number;
  /** Runs that kept their paths: read below the floor, not read, or past the per-drawing limit. */
  drawn: number;
}

export interface VectorTextOptsV1 {
  /** The drawing's own words, from `svgLabelHintsOf`. Its items' series, title and description stand in when absent. */
  hints?: SvgLabelHintsV1;
  /** Confidence a reading nothing confirms needs. Defaults to `VECTOR_LABEL_MIN_CONFIDENCE`. */
  minConfidence?: number;
  /** Readings by `glyphRunKey`, shared across drawings so a label repeated over a deck is read once. */
  cache?: Map<string, VectorLabelReadingV1 | null>;
  /** Checked between readings. */
  signal?: AbortSignal;
}

/**
 * Runs and their readings as a drawing with text items. `readings[i]` belongs to
 * `runs[i]`; a null reading keeps the run drawn unless an axis fit supplies its value.
 */
export function vectorTextOf(
  items: VectorItemsV1,
  runs: GlyphRunV1[],
  readings: Array<VectorLabelReadingV1 | null>,
  opts: Pick<VectorTextOptsV1, 'hints' | 'minConfidence'> = {},
): VectorTextResultV1 {
  if (!runs.length) return { items, runs: 0, text: 0, drawn: 0 };
  const floor = opts.minConfidence ?? VECTOR_LABEL_MIN_CONFIDENCE;
  const texts = readings.map((r) => {
    const text = r?.text.replace(/\s+/g, ' ').trim();
    return text ? text : null;
  });
  const settled = new Map<number, Settled>();
  settleByPhrases(runs, texts, phrasesOf(opts.hints, items), settled);
  settleByAxis(runs, texts, settled);

  const chosen: Array<{ run: GlyphRunV1; value: string; size: number }> = [];
  runs.forEach((run, i) => {
    const reading = readings[i];
    const hint = settled.get(i);
    let value: string | null = null;
    if (hint && (reading === null || reading === undefined ? !texts[i] : reading.confidence >= CONFIRMED_MIN_CONFIDENCE)) value = hint.text;
    else if (reading && texts[i] && reading.confidence >= floor) {
      const chars = inkChars(texts[i]!);
      if (Math.abs(chars - run.glyphs) <= Math.max(1, Math.round(0.25 * run.glyphs))) value = texts[i]!;
    }
    if (!value || value.length > 2000) return;
    const size = sizeOf(run, value);
    if (size > 0) chosen.push({ run, value, size });
  });
  // Runs of one group in one ink were set at one size: each takes the middle of the
  // sizes its group read, unless its own is far from it (a heading beside its notes).
  const buckets = new Map<string, number[]>();
  const bucketOf = (run: GlyphRunV1): string => `${(run.groups ?? []).join('\u001f')}|${run.fill}|${run.opacity ?? 1}`;
  for (const c of chosen) {
    const list = buckets.get(bucketOf(c.run)) ?? [];
    list.push(c.size);
    buckets.set(bucketOf(c.run), list);
  }
  const replace = new Map<number, VectorTextItemV1>();
  const covered = new Set<number>();
  let text = 0;
  for (const { run, value, size: own } of chosen) {
    const group = medianOf(buckets.get(bucketOf(run))!);
    const size = Math.abs(own - group) <= 0.3 * group ? group : own;
    const anchor = anchorOf(run, runs, items);
    const x = anchor === 'end' ? run.box.x + run.box.w : anchor === 'middle' ? run.box.x + run.box.w / 2 : run.box.x;
    const item: VectorTextItemV1 = { kind: 'text', text: value, x: r3(x), y: r3(run.baseline), size: r3(size), fill: { hex: run.fill } };
    if (anchor !== 'start') item.anchor = anchor;
    if (run.opacity !== undefined && run.opacity < 1) item.opacity = run.opacity;
    if (run.groups?.length) item.groups = [...run.groups];
    replace.set(run.items[0]!, item);
    for (const index of run.items) covered.add(index);
    text += 1;
  }
  if (!text) return { items, runs: runs.length, text: 0, drawn: runs.length };
  const next: VectorItemV1[] = [];
  items.items.forEach((item, index) => {
    const swapped = replace.get(index);
    if (swapped) next.push(swapped);
    else if (!covered.has(index)) next.push(item);
  });
  return { items: { ...items, items: next }, runs: runs.length, text, drawn: runs.length - text };
}

/** Words a line recogniser reads in one go: its input is about ten times as wide as it is tall. */
const MAX_CHUNK_ASPECT = 12;

/** A run's words cut into pieces a line recogniser takes whole, each no wider than `MAX_CHUNK_ASPECT` heights. */
export function glyphRunChunks(run: GlyphRunV1): Array<{ x: number; w: number }> {
  const limit = MAX_CHUNK_ASPECT * Math.max(run.box.h, 1e-6);
  if (run.box.w <= limit || run.words.length < 2) return [{ x: run.box.x, w: run.box.w }];
  const chunks: Array<{ x: number; w: number }> = [];
  for (const word of run.words) {
    const last = chunks[chunks.length - 1];
    if (last && word.x + word.w - last.x <= limit) last.w = word.x + word.w - last.x;
    else chunks.push({ ...word });
  }
  return chunks;
}

/** One run read, a piece at a time when it is long: the pieces joined with spaces, at the lowest confidence of its pieces. */
async function readRun(items: VectorItemsV1, run: GlyphRunV1, reader: VectorLabelReaderV1, signal?: AbortSignal): Promise<VectorLabelReadingV1 | null> {
  const chunks = glyphRunChunks(run);
  if (chunks.length === 1) return reader(glyphRunFrame(items, run));
  const texts: string[] = [];
  let confidence = 1;
  for (const chunk of chunks) {
    signal?.throwIfAborted();
    const part = await reader(glyphRunFrame(items, run, chunk));
    const text = part?.text.trim();
    if (!part || !text) return null;
    texts.push(text);
    confidence = Math.min(confidence, part.confidence);
  }
  return { text: texts.join(' '), confidence };
}

/**
 * Find a drawing's outlined labels, read each once with `reader` (a reading the cache
 * already holds is not asked for again), and write the ones that read well as text.
 * At most `MAX_LABEL_RUNS_PER_DRAWING` runs are read; the rest stay drawn. A reader
 * that throws is treated as having read nothing, except for an abort, which ends the
 * pass with the signal's own reason.
 */
export async function readVectorLabels(items: VectorItemsV1, reader: VectorLabelReaderV1, opts: VectorTextOptsV1 = {}): Promise<VectorTextResultV1> {
  const runs = glyphRunsOf(items);
  if (!runs.length) return { items, runs: 0, text: 0, drawn: 0 };
  const readings: Array<VectorLabelReadingV1 | null> = [];
  for (const [i, run] of runs.entries()) {
    opts.signal?.throwIfAborted();
    if (i >= MAX_LABEL_RUNS_PER_DRAWING) {
      readings.push(null);
      continue;
    }
    const key = glyphRunKey(items, run);
    if (opts.cache?.has(key)) {
      readings.push(opts.cache.get(key) ?? null);
      continue;
    }
    let reading: VectorLabelReadingV1 | null;
    try {
      reading = await readRun(items, run, reader, opts.signal);
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      reading = null;
    }
    opts.cache?.set(key, reading);
    readings.push(reading);
  }
  const limited = runs.slice(0, MAX_LABEL_RUNS_PER_DRAWING);
  const result = vectorTextOf(items, limited, readings.slice(0, limited.length), opts);
  return { ...result, runs: runs.length, drawn: runs.length - result.text };
}
