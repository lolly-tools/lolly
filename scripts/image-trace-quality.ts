// SPDX-License-Identifier: MPL-2.0
/**
 * Image Trace quality harness (plan 342, K5), in the spirit of VectorCraft's
 * docs/image-trace-quality.md: what the tracer makes of images whose right answer is known.
 * Inputs are drawn in code (tests/helpers/image-trace-fixtures.ts), so nothing is committed
 * or fetched. For each input it prints the mean and 95th percentile of the rendered colour
 * difference (CIEDE2000) against the input, the anchor count, the path count and the specks
 * (fills under 8 square pixels), plus the trace time.
 *
 * The rendering is a plain nonzero fill at pixel centres over white, so the error includes
 * about half a pixel of edge aliasing. Centre-line traces are strokes and are not rendered.
 *
 * Run with: node scripts/image-trace-quality.ts [--json]
 */
import { loadImageTraceKernel } from '../packages/node-shell/src/image-trace-node.ts';
import { SMALL_FIXTURES, illustrationFixture, photoFixture, type Fixture } from '../tests/helpers/image-trace-fixtures.ts';

type Lab = [number, number, number];
const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export function rgbToLab(r: number, g: number, b: number): Lab {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047, Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B, Z = (0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** CIEDE2000 (Sharma, Wu and Dalal 2005). */
export function deltaE00(p: Lab, q: Lab): number {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const c1 = Math.hypot(p[1], p[2]), c2 = Math.hypot(q[1], q[2]), cb = (c1 + c2) / 2;
  const g = 0.5 * (1 - Math.sqrt(cb ** 7 / (cb ** 7 + 25 ** 7)));
  const a1 = (1 + g) * p[1], a2 = (1 + g) * q[1];
  const C1 = Math.hypot(a1, p[2]), C2 = Math.hypot(a2, q[2]);
  const h = (b: number, a: number) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * deg) + 360) % 360);
  const h1 = h(p[2], a1), h2 = h(q[2], a2);
  const dL = q[0] - p[0], dC = C2 - C1;
  let dh = 0;
  if (C1 * C2 !== 0) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh * rad / 2);
  const Lb = (p[0] + q[0]) / 2, Cb = (C1 + C2) / 2;
  let hb = h1 + h2;
  if (C1 * C2 !== 0) hb = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cb, Sh = 1 + 0.015 * Cb * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

type Poly = [number, number][];
function flatten(curves: number[][]): Poly {
  const pts: Poly = [];
  for (const c of curves) {
    pts.push([c[0]!, c[1]!]);
    if (c[2] !== c[0] || c[3] !== c[1] || c[4] !== c[6] || c[5] !== c[7]) {
      for (let i = 1; i < 8; i++) {
        const t = i / 8, u = 1 - t;
        pts.push([u ** 3 * c[0]! + 3 * u * u * t * c[2]! + 3 * u * t * t * c[4]! + t ** 3 * c[6]!, u ** 3 * c[1]! + 3 * u * u * t * c[3]! + 3 * u * t * t * c[5]! + t ** 3 * c[7]!]);
      }
    }
  }
  return pts;
}
const area = (p: Poly) => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i]!, b = p[(i + 1) % p.length]!; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

/** Paint the fills over white, in order, nonzero rule, sampled at pixel centres. */
function render(fixture: Fixture, shapes: { color: readonly number[]; polys: Poly[] }[]): Uint8Array {
  const { width: w, height: h } = fixture;
  const out = new Uint8Array(w * h * 3).fill(255);
  for (const s of shapes) {
    for (let y = 0; y < h; y++) {
      const cy = y + 0.5, hits: [number, number][] = [];
      for (const poly of s.polys) for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
        if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) hits.push([a[0] + ((cy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), b[1] > a[1] ? 1 : -1]);
      }
      hits.sort((p, q) => p[0] - q[0]);
      let wind = 0;
      for (let i = 0; i < hits.length - 1; i++) {
        wind += hits[i]![1];
        if (wind === 0) continue;
        for (let x = Math.ceil(hits[i]![0] - 0.5); x < Math.ceil(hits[i + 1]![0] - 0.5); x++) if (x >= 0 && x < w) { const o = (y * w + x) * 3; out[o] = s.color[0]!; out[o + 1] = s.color[1]!; out[o + 2] = s.color[2]!; }
      }
    }
  }
  return out;
}

export interface Row { input: string; preset: string; size: string; ms: number; paths: number; anchors: number; specks: number; meanDE: number | null; p95DE: number | null }

export async function measure(fixtures: Fixture[]): Promise<Row[]> {
  const kernel = await loadImageTraceKernel();
  const rows: Row[] = [];
  for (const f of fixtures) {
    const t0 = performance.now();
    const result = kernel.trace(f.rgba, f.width, f.height, f.preset);
    const ms = Math.round(performance.now() - t0);
    const anchors = result.shapes.reduce((n, sh) => n + sh.subpaths.reduce((m, sp) => m + sp.anchors.length / 6, 0), 0);
    const filled = result.shapes.map(s => ({ s, polys: s.subpaths.map(sp => { const a = sp.anchors, n = a.length / 6; const curves: number[][] = []; for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (j === 0 && !sp.closed) break; curves.push([a[i * 6]!, a[i * 6 + 1]!, a[i * 6 + 4]!, a[i * 6 + 5]!, a[j * 6 + 2]!, a[j * 6 + 3]!, a[j * 6]!, a[j * 6 + 1]!]); } return flatten(curves); }) }));
    const fills = filled.filter(x => x.s.stroke === undefined);
    const specks = fills.filter(x => Math.abs(x.polys.reduce((n, p) => n + area(p), 0)) < 8).length;
    let meanDE: number | null = null, p95DE: number | null = null;
    if (fills.length === result.shapes.length) {
      const img = render(f, fills.map(x => ({ color: x.s.color, polys: x.polys })));
      const des: number[] = [];
      const cache = new Map<number, Lab>();
      const lab = (r: number, g: number, b: number) => { const k = (r << 16) | (g << 8) | b; let v = cache.get(k); if (!v) { v = rgbToLab(r, g, b); cache.set(k, v); } return v; };
      for (let i = 0; i < f.width * f.height; i++) {
        const a = f.rgba[i * 4 + 3]! / 255;
        const src = [0, 1, 2].map(c => Math.round(f.rgba[i * 4 + c]! * a + 255 * (1 - a)));
        des.push(deltaE00(lab(src[0]!, src[1]!, src[2]!), lab(img[i * 3]!, img[i * 3 + 1]!, img[i * 3 + 2]!)));
      }
      des.sort((p, q) => p - q);
      meanDE = des.reduce((p, q) => p + q, 0) / des.length;
      p95DE = des[Math.floor(des.length * 0.95)]!;
    }
    rows.push({ input: f.name, preset: f.preset, size: `${f.width}x${f.height}`, ms, paths: result.shapes.length, anchors, specks, meanDE, p95DE });
  }
  return rows;
}

if (import.meta.main) {
  const rows = await measure([...SMALL_FIXTURES(), illustrationFixture(1500, 1000), photoFixture(1500, 1500)]);
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const f = (v: number | null) => (v === null ? '-' : v.toFixed(2));
    console.log('| input | preset | size | ms | paths | anchors | specks | mean dE00 | p95 dE00 |\n|:--|:--|:--|--:|--:|--:|--:|--:|--:|');
    for (const r of rows) console.log(`| ${r.input} | ${r.preset} | ${r.size} | ${r.ms} | ${r.paths} | ${r.anchors} | ${r.specks} | ${f(r.meanDE)} | ${f(r.p95DE)} |`);
  }
}
