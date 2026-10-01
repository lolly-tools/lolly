// SPDX-License-Identifier: MPL-2.0
/**
 * edge-trace.ts - the edges in a picture as polylines, so whoever draws by hand
 * (an agent placing a path box, a person tracing a subject) knows where the lines
 * really are (plans/289 sections 6 and 10).
 *
 * It is Canny's detector: a light Gaussian blur, Sobel gradients, only the ridge
 * of each gradient kept, then a high threshold that starts an edge and a lower
 * one that lets it continue. The edge pixels are linked into chains, followed
 * from their loose ends first so a line runs end to end, each chain simplified
 * to the points that matter (Douglas-Peucker), and the short scraps dropped.
 *
 * Adapted from Composa's Painting/EdgeTracer.cs (MIT, Copyright (c) 2026
 * Dennis van der Stelt): the thresholds, the chain following with its one-pixel
 * gap bridge and the simplification are its design, translated into this
 * engine's own code. Two additions: transparent pixels are read over white,
 * so a cut-out's outline is an edge, and a chain that ends beside where it
 * began is reported as closed.
 *
 * DOM-free and deterministic: the same pixels give the same lines in every
 * shell. The caller bounds the image (the MCP server traces at most a 1024 px
 * view); everything here is linear in the pixel count.
 */

import { encodeAuthoredPath } from './geom/authored-url.ts';
import type { PixelImage } from './agent-view.ts';

export interface EdgeTraceOptions {
  /** 0..100: how faint an edge may be. 50 starts an edge at a step of about 50 grey levels. */
  detail?: number;
  /** The shortest chain kept, in pixels. */
  minLength?: number;
  /** How far a simplified line may stray from the edge, in pixels. */
  simplify?: number;
  /** At most this many lines, longest first. */
  maxLines?: number;
}

export interface TracedEdge {
  /** Points in pixel coordinates (pixel centres). */
  points: [number, number][];
  /** Length of the unsimplified chain, in pixels. */
  length: number;
  /** True when the chain ends beside where it began: an outline, not a stroke. */
  closed: boolean;
}

/** Luminance 0..255 of each pixel, read over white where it is transparent. */
function luminance(img: PixelImage): Float32Array {
  const { width: w, height: h, data } = img;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3]! / 255;
    const k = img.premultiplied ? 1 : a;
    const y = 0.2126 * data[i * 4]! * k + 0.7152 * data[i * 4 + 1]! * k + 0.0722 * data[i * 4 + 2]! * k;
    out[i] = y + 255 * (1 - a);
  }
  return out;
}

/** Separable Gaussian blur of a plane, edges clamped. */
function blur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); k.push(v); sum += v; }
  for (let i = 0; i < k.length; i++) k[i]! /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += k[i + r]! * src[y * w + Math.min(w - 1, Math.max(0, x + i))]!;
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += k[i + r]! * tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x]!;
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** The edge pixels: Sobel, non-maximum suppression and hysteresis. */
function edgeMap(img: PixelImage, detail: number): Uint8Array {
  const { width: w, height: h } = img;
  const lum = blur(luminance(img), w, h, 1.4);
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const at = (px: number, py: number) => lum[py * w + px]!;
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const i = y * w + x;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      let angle = (Math.atan2(gy, gx) * 180) / Math.PI;
      if (angle < 0) angle += 180;
      dir[i] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
    }
  }
  // Only the ridge stays. A tie with the pixel before loses and with the one
  // after wins, so a step that straddles two equal pixels keeps one ridge.
  const ridge = new Float32Array(w * h);
  const OFF = [[1, 0], [1, 1], [0, 1], [-1, 1]] as const;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, m = mag[i]!;
      if (m <= 0) continue;
      const [dx, dy] = OFF[dir[i]!]!;
      if (m > mag[(y - dy) * w + x - dx]! && m >= mag[(y + dy) * w + x + dx]!) ridge[i] = m;
    }
  }
  // A Sobel step of one grey level measures 4, so the thresholds are levels x 4.
  const high = (0.02 + ((100 - Math.max(0, Math.min(100, detail))) / 100) * 0.28) * 1020;
  const low = high * 0.4;
  const edge = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < ridge.length; i++) {
    if (ridge[i]! < high || edge[i]) continue;
    edge[i] = 1;
    stack.push(i);
    while (stack.length) {
      const at = stack.pop()!;
      const ax = at % w, ay = (at - ax) / w;
      for (let ny = Math.max(0, ay - 1); ny <= Math.min(h - 1, ay + 1); ny++) {
        for (let nx = Math.max(0, ax - 1); nx <= Math.min(w - 1, ax + 1); nx++) {
          const n = ny * w + nx;
          if (edge[n] || ridge[n]! < low) continue;
          edge[n] = 1;
          stack.push(n);
        }
      }
    }
  }
  return edge;
}

function looseNeighbours(edge: Uint8Array, seen: Uint8Array, w: number, h: number, i: number): number {
  const x = i % w, y = (i - x) / w;
  let count = 0;
  for (let ny = Math.max(0, y - 1); ny <= Math.min(h - 1, y + 1); ny++) {
    for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) {
      const n = ny * w + nx;
      if (n !== i && edge[n] && !seen[n]) count++;
    }
  }
  return count;
}

/** Walk from a pixel along unvisited edge pixels, straight on before turning.
 *  A one-pixel gap is stepped over, because thinning drops the very pixel at a
 *  sharp corner and an outline would otherwise come back as four sides. */
function follow(edge: Uint8Array, seen: Uint8Array, w: number, h: number, start: number): [number, number][] {
  const points: [number, number][] = [];
  let at = start, dx = 0, dy = 0;
  for (;;) {
    seen[at] = 1;
    const x = at % w, y = (at - x) / w;
    points.push([x + 0.5, y + 0.5]);
    let next = -1;
    for (let reach = 1; reach <= 2 && next < 0; reach++) {
      let best = -Infinity;
      for (let ny = Math.max(0, y - reach); ny <= Math.min(h - 1, y + reach); ny++) {
        for (let nx = Math.max(0, x - reach); nx <= Math.min(w - 1, x + reach); nx++) {
          const n = ny * w + nx;
          if (n === at || !edge[n] || seen[n]) continue;
          // Straight on scores highest, a side step next, a step back last; a
          // 4-neighbour beats a diagonal at equal turn.
          const score = (Math.sign(nx - x) * dx + Math.sign(ny - y) * dy) * 4 + (nx === x || ny === y ? 1 : 0);
          if (score > best) { best = score; next = n; }
        }
      }
    }
    if (next < 0) return points;
    dx = Math.sign((next % w) - x);
    dy = Math.sign(Math.floor(next / w) - y);
    at = next;
  }
}

/** Douglas-Peucker: keep the points that pull the line more than `tolerance`
 *  away from the straight line between their neighbours. */
export function simplifyPolyline(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3 || !(tolerance > 0)) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const ranges: [number, number][] = [[0, points.length - 1]];
  while (ranges.length) {
    const [first, last] = ranges.pop()!;
    const a = points[first]!, b = points[last]!;
    const abx = b[0] - a[0], aby = b[1] - a[1], ab = Math.hypot(abx, aby);
    let far = 0, index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i]!;
      const d = ab < 1e-6 ? Math.hypot(p[0] - a[0], p[1] - a[1]) : Math.abs(abx * (a[1] - p[1]) - (a[0] - p[0]) * aby) / ab;
      if (d > far) { far = d; index = i; }
    }
    if (index < 0 || far <= tolerance) continue;
    keep[index] = 1;
    ranges.push([first, index], [index, last]);
  }
  return points.filter((_, i) => keep[i]);
}

/**
 * The edges of `img` as polylines in pixel coordinates, longest first.
 */
export function traceEdges(img: PixelImage, opts: EdgeTraceOptions = {}): TracedEdge[] {
  const { width: w, height: h } = img;
  if (w < 3 || h < 3) return [];
  const detail = Number.isFinite(opts.detail) ? opts.detail! : 50;
  const minLength = Math.max(0, Number.isFinite(opts.minLength) ? opts.minLength! : 20);
  const tolerance = Math.max(0, Number.isFinite(opts.simplify) ? opts.simplify! : 2);
  const maxLines = Math.max(0, Math.floor(Number.isFinite(opts.maxLines) ? opts.maxLines! : 200));
  const edge = edgeMap(img, detail);
  const seen = new Uint8Array(w * h);
  const chains: TracedEdge[] = [];
  // From every loose end first, so a line is followed from one end to the
  // other; whatever is left after that are loops.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < edge.length; i++) {
      if (!edge[i] || seen[i]) continue;
      if (pass === 0 && looseNeighbours(edge, seen, w, h, i) !== 1) continue;
      const chain = follow(edge, seen, w, h, i);
      let len = 0;
      for (let k = 1; k < chain.length; k++) len += Math.hypot(chain[k]![0] - chain[k - 1]![0], chain[k]![1] - chain[k - 1]![1]);
      if (len < minLength) continue;
      const a = chain[0]!, z = chain[chain.length - 1]!;
      // A loop is seldom walked back to its very first pixel: thinning drops a
      // few where the walk began. So the gap that still counts as closed grows
      // with the outline (5% of it, 3 to 8 px). A stroke that nearly meets
      // itself within that is read as an outline, which is what tracing wants.
      const closed = chain.length > 8 && Math.hypot(a[0] - z[0], a[1] - z[1]) <= Math.max(3, Math.min(8, len * 0.05));
      chains.push({ points: simplifyPolyline(chain, tolerance), length: Math.round(len * 10) / 10, closed });
    }
  }
  return chains.sort((p, q) => q.length - p.length).slice(0, maxLines);
}

export interface DesignPathLayer {
  kind: 'path';
  x: number; y: number; w: number; h: number;
  /** The Design `path` field: an authored straight-segment path, nodes as fractions of the box. */
  path: string;
  stroke: string;
  strokeW: number;
  bg: string;
}

/**
 * A polyline in document units as a Design path layer, ready for a
 * `layerOperations` add once the caller gives it an id. Nodes are stored as
 * fractions of the box, which is how Design keeps a path editable when the box
 * is resized; a flat line gets a box one unit deep so the fractions stay finite.
 */
export function polylineToDesignLayer(points: [number, number][], closed: boolean, style: { stroke?: string; strokeW?: number } = {}): DesignPathLayer {
  if (points.length < 2) throw new Error('A path needs at least two points.');
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  let w = x1 - x0, h = y1 - y0;
  if (w < 1) { x0 -= (1 - w) / 2; w = 1; }
  if (h < 1) { y0 -= (1 - h) / 2; h = 1; }
  const r = (v: number) => Math.round(v * 100) / 100;
  const path = encodeAuthoredPath({ kind: 'line', closed, nodes: points.map(([x, y]) => ({ x: (x - x0) / w, y: (y - y0) / h })) });
  return { kind: 'path', x: r(x0), y: r(y0), w: r(w), h: r(h), path, stroke: style.stroke ?? '#e0457b', strokeW: style.strokeW ?? 2, bg: '' };
}
