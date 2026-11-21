// SPDX-License-Identifier: MPL-2.0
/**
 * The comparator `scripts/tool-browser-free.ts` judges a case with: the browser-free PNG
 * (resvg) against the browser tier's PNG, with the plan 326 release bands as the plan 371
 * measurements applied them.
 *
 *   - both PNGs flattened over a 1 px black and white checkerboard;
 *   - shape regions (element box plus 8 px x scale): at most 0.5% of pixels over 24
 *     levels, filled outlines (paths, strokes, clusters of elements under 12 px) over 72;
 *   - words: ink within 25% of the browser's, ink centroid within 1.5 px x scale, ink
 *     measured against the page drawn by resvg without its words;
 *   - gradient interiors (inset 8 px x scale): within 2 levels;
 *   - the same size; PNG chunk order and every chunk but IDAT and caBX byte-equal (iCCP
 *     compared decompressed) are reported beside the bands.
 *
 * Regions come from the elements of the SVG resvg was handed (`regions.ts`).
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import type { Region } from './regions.ts';
import type { SvgPlacement } from '../../../packages/node-shell/src/resvg-admission.ts';

export const BANDS = { threshold: 24, fillThreshold: 72, regionShare: 0.005, inkShare: 0.25, inkShift: 1.5, gradientLevels: 2, small: 12 } as const;

export interface Fault { kind: 'region' | 'word' | 'gradient' | 'size'; detail: string }
export interface CaseComparison {
  sizeMatch: boolean;
  browserSize: [number, number];
  resvgSize: [number, number];
  over24: number;
  maxChannel: number;
  metadataEqual: boolean;
  metadataDiffers: string[];
  faults: Fault[];
  inBands: boolean;
}

type Sharp = (input: Buffer | string, opts?: { raw: { width: number; height: number; channels: number } }) => {
  ensureAlpha(): { raw(): { toBuffer(o: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }> } };
};

interface Flat { rgb: Uint8Array; width: number; height: number }

function flatten(data: Uint8Array, width: number, height: number): Flat {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3]! / 255, bg = ((p % width) + Math.floor(p / width)) % 2 ? 255 : 0;
    for (let k = 0; k < 3; k++) rgb[p * 3 + k] = Math.round(data[i + k]! * a + bg * (1 - a));
  }
  return { rgb, width, height };
}

async function flatFile(sharp: Sharp, file: string): Promise<Flat> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return flatten(new Uint8Array(data), info.width, info.height);
}

function chunks(png: Uint8Array): Array<[string, Uint8Array]> {
  const out: Array<[string, Uint8Array]> = [];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 8 <= png.length;) {
    const len = view.getUint32(at);
    out.push([String.fromCharCode(...png.subarray(at + 4, at + 8)), png.subarray(at + 8, at + 8 + len)]);
    at += 12 + len;
  }
  return out;
}
const chunkOrder = (png: Uint8Array): string[] => chunks(png).map(([t]) => t).filter((t, i, all) => t !== 'IDAT' || all[i - 1] !== 'IDAT');
const metadataOf = (png: Uint8Array): string[] => chunks(png).filter(([t]) => t !== 'IDAT' && t !== 'caBX').map(([t, d]) => {
  if (t === 'iCCP') { const nul = d.indexOf(0); return `iCCP:${Buffer.from(d.subarray(0, nul)).toString()}:${inflateSync(d.subarray(nul + 2)).toString('base64')}`; }
  return `${t}:${Buffer.from(d).toString('base64')}`;
});
const lum = (p: Uint8Array, i: number): number => 0.2126 * p[i * 3]! + 0.7152 * p[i * 3 + 1]! + 0.0722 * p[i * 3 + 2]!;

interface Box { x0: number; y0: number; x1: number; y1: number }

/**
 * Compare one case. `drawWithoutWords` draws the case's SVG with its words taken out, at
 * the output size and placement, for the word ink measurement.
 */
export async function compareCase(args: {
  sharp: Sharp;
  browserPng: string;
  resvgPng: string;
  regions: Region[] | null;
  svgFile: string | null;
  placement: SvgPlacement;
  renderWidth: number;
  drawWithoutWords: (svg: string, width: number, height: number, placement: SvgPlacement) => Promise<{ data: Uint8Array; width: number; height: number }>;
}): Promise<CaseComparison> {
  const { sharp } = args;
  const [pa, pb] = [await flatFile(sharp, args.browserPng), await flatFile(sharp, args.resvgPng)];
  const ab = new Uint8Array(readFileSync(args.browserPng)), bb = new Uint8Array(readFileSync(args.resvgPng));
  const ma = metadataOf(ab), mb = metadataOf(bb);
  const metadataEqual = JSON.stringify(chunkOrder(ab)) === JSON.stringify(chunkOrder(bb)) && JSON.stringify(ma) === JSON.stringify(mb);
  const metadataDiffers = [...new Set([...ma.filter((x) => !mb.includes(x)), ...mb.filter((x) => !ma.includes(x))].map((x) => x.split(':')[0]!))];
  const base = { browserSize: [pa.width, pa.height] as [number, number], resvgSize: [pb.width, pb.height] as [number, number], metadataEqual, metadataDiffers };
  if (pa.width !== pb.width || pa.height !== pb.height) {
    return { ...base, sizeMatch: false, over24: 100, maxChannel: 255, faults: [{ kind: 'size', detail: `${pb.width} x ${pb.height} against ${pa.width} x ${pa.height}` }], inBands: false };
  }
  const { width, height } = pa, N = width * height;
  const step = new Uint8Array(N);
  let d24 = 0, max = 0;
  for (let i = 0; i < N; i++) {
    const m = Math.max(Math.abs(pa.rgb[i * 3]! - pb.rgb[i * 3]!), Math.abs(pa.rgb[i * 3 + 1]! - pb.rgb[i * 3 + 1]!), Math.abs(pa.rgb[i * 3 + 2]! - pb.rgb[i * 3 + 2]!));
    step[i] = m; if (m > BANDS.threshold) d24++; if (m > max) max = m;
  }
  const scale = width / (args.renderWidth || width);
  const faults: Fault[] = [];
  const clip = <T extends { x: number; y: number; w: number; h: number }>(r: T): (T & Box) | null => {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(width, Math.ceil(r.x + r.w)), y1 = Math.min(height, Math.ceil(r.y + r.h));
    return x1 > x0 && y1 > y0 ? { ...r, x0, y0, x1, y1 } : null;
  };
  const pad = <T extends { x: number; y: number; w: number; h: number }>(it: T, p: number): T => ({ ...it, x: it.x - p, y: it.y - p, w: it.w + 2 * p, h: it.h + 2 * p });
  const items = args.regions ?? [];
  const words = items.filter((i) => i.text !== null).map((i) => clip(pad(i, Math.max(2, 2 * scale)))).filter((r): r is Region & Box => !!r);
  const wordMask = new Uint8Array(N);
  for (const r of words) for (let y = r.y0; y < r.y1; y++) wordMask.fill(1, y * width + r.x0, y * width + r.x1);
  // Every shape is judged, the page's own ground (a full-bleed picture or rect) included,
  // so a difference anywhere outside the words counts against a region.
  const shapes = items.filter((i) => i.text === null);
  const small = shapes.filter((i) => i.w < BANDS.small || i.h < BANDS.small);
  const big = shapes.filter((i) => !small.includes(i));
  const clusters = new Map<number, { x: number; y: number; x2: number; y2: number }>();
  for (const i of small) {
    const c = clusters.get(i.parent);
    if (!c) clusters.set(i.parent, { x: i.x, y: i.y, x2: i.x + i.w, y2: i.y + i.h });
    else { c.x = Math.min(c.x, i.x); c.y = Math.min(c.y, i.y); c.x2 = Math.max(c.x2, i.x + i.w); c.y2 = Math.max(c.y2, i.y + i.h); }
  }
  type Judged = Box & { id: string; threshold: number; x: number; y: number; w: number; h: number };
  const regions: Judged[] = [
    ...big.map((i, k) => { const p = pad(i, 8 * scale); return { id: `${i.tag}#${k}`, threshold: ['rect', 'circle', 'ellipse', 'image', 'use'].includes(i.tag) && !i.stroked ? BANDS.threshold : BANDS.fillThreshold, x: p.x, y: p.y, w: p.w, h: p.h }; }),
    ...[...clusters.entries()].map(([k, c]) => ({ id: `cluster#${k}`, threshold: BANDS.fillThreshold, x: c.x - 2, y: c.y - 2, w: c.x2 - c.x + 4, h: c.y2 - c.y + 4 })),
  ].map(clip).filter((r): r is NonNullable<typeof r> => !!r);
  if (!regions.length && !words.length) regions.push({ id: 'page', threshold: BANDS.threshold, x: 0, y: 0, w: width, h: height, x0: 0, y0: 0, x1: width, y1: height });
  for (const r of regions) {
    let n = 0, d = 0;
    for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) { const i = y * width + x; if (wordMask[i]) continue; n++; if (step[i]! > r.threshold) d++; }
    if (n && d / n > BANDS.regionShare) faults.push({ kind: 'region', detail: `${r.id} ${(100 * d / n).toFixed(2)}% over ${r.threshold}` });
  }
  if (words.length && args.svgFile) {
    const bare = readFileSync(args.svgFile, 'utf8').replace(/<path\b[^>]*\bdata-measure-text="[^"]*"[^>]*\/>/g, '').replace(/<text\b[\s\S]*?<\/text>/g, '');
    const drawn = await args.drawWithoutWords(bare, width, height, args.placement);
    const bg = flatten(drawn.data, drawn.width, drawn.height);
    for (const r of words) {
      let ia = 0, ib = 0, ax = 0, ay = 0, bx = 0, by = 0;
      for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
        const i = y * width + x, g = lum(bg.rgb, i), wa = Math.abs(lum(pa.rgb, i) - g), wb = Math.abs(lum(pb.rgb, i) - g);
        ia += wa; ib += wb; ax += wa * x; ay += wa * y; bx += wb * x; by += wb * y;
      }
      // A word drawn in its ground's own colour has no ink on either side, and is not measured.
      const floor = 2 * (r.x1 - r.x0) * (r.y1 - r.y0);
      if (ia < floor && ib < floor) continue;
      const share = Math.abs(ia - ib) / Math.max(ia, floor);
      const shift = ia >= floor && ib >= floor ? Math.hypot(ax / ia - bx / ib, ay / ia - by / ib) : 0;
      if (share > BANDS.inkShare || shift > BANDS.inkShift * scale) faults.push({ kind: 'word', detail: `"${r.text}" ink ${(100 * share).toFixed(1)}% shift ${shift.toFixed(2)} px` });
    }
  }
  for (const [k, i] of items.filter((i) => i.text === null && i.grad && !i.rotated && i.w > 24 * scale && i.h > 24 * scale).entries()) {
    const inset = 8 * scale;
    let m = 0;
    for (let y = Math.max(0, Math.ceil(i.y + inset)); y < Math.min(height, Math.floor(i.y + i.h - inset)); y++) {
      for (let x = Math.max(0, Math.ceil(i.x + inset)); x < Math.min(width, Math.floor(i.x + i.w - inset)); x++) { const p = y * width + x; if (!wordMask[p] && step[p]! > m) m = step[p]!; }
    }
    if (m > BANDS.gradientLevels) faults.push({ kind: 'gradient', detail: `${i.grad}#${k} ${m} levels` });
  }
  return { ...base, sizeMatch: true, over24: +(100 * d24 / N).toFixed(3), maxChannel: max, faults, inBands: faults.length === 0 };
}
