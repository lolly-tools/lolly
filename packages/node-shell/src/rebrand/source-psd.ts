// SPDX-License-Identifier: MPL-2.0
/**
 * A Photoshop document as a Rebrand source (plans/289 D2): one slide the size of
 * the canvas, with each layer an object in paint order.
 *
 *   - A type layer is a text object: its paragraphs, and runs that keep their
 *     weight (as bold), italic, underline, strikethrough, size, face and colour.
 *   - A shape drawn with the shape tool is a shape (`rect`, `roundRect`,
 *     `ellipse`) with its fill and line; another vector shape is a custom shape
 *     whose `vectorItems` hold the outline, fill and stroke, dashes included.
 *   - A solid colour layer at the bottom is the slide's background; elsewhere it
 *     is a rectangle the size of the canvas.
 *   - Every other layer is a picture of its own pixels, stored through the sink.
 *
 * What a layer loses on the way (an effect, an adjustment layer, a second type
 * size) is stated, never dropped silently: the object is `approximate` and the
 * slide carries a `feature-dropped` warning naming it, in the same words the
 * Design import shows (engine/src/psd-layer-semantics.ts). The layer reading is
 * shared with that import, so a file reads the same on both routes.
 *
 * Coordinates: a Photoshop pixel is one reference pixel (96 dpi), so type sizes
 * in points are the pixel size x 0.75.
 */

import { readPsd, type PsdReadOptions } from '../../../../engine/src/psd.ts';
import { packPng } from '../../../../engine/src/png.ts';
import { sha256Hex } from '../../../../engine/src/bytes.ts';
import { psdPathData, sameWinding, unionOutline } from '../../../../engine/src/psd-outline.ts';
import type { PsdStroke, PsdSubpath, PsdTextInfo } from '../../../../engine/src/psd-layer-semantics.ts';
import type { InflateFn, RasterLayer, LayeredRasterDoc } from '../../../../engine/src/raster-layers.ts';
import type {
  BoxV1, FidelityV1, SlideSourceV1, SourceColorV1, SourceDeckV1, SourceObjectKindV1, SourceObjectV1,
  SourceParaV1, SourceRunV1, SourceWarningV1, VectorPathItemV1,
} from '@lolly-tools/core';
import type { MediaSinkV1 } from './source-pptx.ts';

export interface SourcePsdOptsV1 {
  /** `sha256:<hex>` of the source bytes. The caller hashes the file it read. */
  hash: string;
  /** Separates two imports of the same bytes. */
  instanceId: string;
  name?: string;
  bytes?: number;
  /** Where pictures go: called at most once per distinct byte sequence. */
  sink: MediaSinkV1;
  reader: { name: string; version: string };
  /** zlib inflater for ZIP-compressed channels. */
  inflate?: InflateFn;
  /** The shell can supply the broader portable decoder without platform imports here. */
  decode?: (bytes: Uint8Array, options: PsdReadOptions) => LayeredRasterDoc | Promise<LayeredRasterDoc>;
  onSlide?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/** The slide's id. A Photoshop document is one canvas, so one slide. */
export const PSD_SLIDE_ID = 'canvas';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const PT_PER_PX = 0.75;

function box(x: number, y: number, w: number, h: number, rot = 0): BoxV1 {
  return { x: round2(x), y: round2(y), w: round2(w), h: round2(h), rot: Math.abs(rot) < 0.5 ? 0 : round2(rot) };
}

function color(hex: string | null | undefined, alpha = 1): SourceColorV1 | undefined {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const out: SourceColorV1 = { hex: hex.toLowerCase() };
  if (alpha < 1) out.alpha = round2(Math.max(0, alpha));
  return out;
}

/** The pptx and PDF adapters' fingerprint: kind, an 8 px grid over the box and the material. */
async function fingerprintOf(kind: SourceObjectKindV1, b: BoxV1, content: string): Promise<string> {
  const grid = (n: number): number => Math.round(n / 8) * 8;
  const material = `${kind}|${grid(b.x)},${grid(b.y)},${grid(b.w)},${grid(b.h)}|${content}`;
  return `${kind}:${(await sha256Hex(new TextEncoder().encode(material))).slice(0, 16)}`;
}

/** A type layer's runs as paragraphs: a new paragraph at each line end. */
function paragraphs(t: PsdTextInfo, alpha: number, fonts: Map<string, number>): SourceParaV1[] {
  const paras: SourceParaV1[] = [{ runs: [], align: t.align }];
  for (const r of t.runs) {
    r.text.split('\n').forEach((piece, i) => {
      if (i > 0) paras.push({ runs: [], align: t.align });
      if (!piece) return;
      const run: SourceRunV1 = { text: piece, sizePt: round2(r.size * PT_PER_PX) };
      if (r.weight >= 600) run.bold = true;
      if (r.italic) run.italic = true;
      if (r.underline) run.underline = true;
      if (r.strike) run.strike = true;
      if (r.family) {
        run.font = r.family.slice(0, 256);
        run.fontProvenance = 'literal';
        fonts.set(run.font, (fonts.get(run.font) ?? 0) + 1);
      }
      const c = color(r.color, alpha);
      if (c) run.color = c;
      paras[paras.length - 1]!.runs.push(run);
    });
  }
  return paras;
}

/** The outline's extent, handles included, as a box in document pixels. */
function outlineBox(subpaths: readonly PsdSubpath[]): BoxV1 | null {
  const xs: number[] = [], ys: number[] = [];
  for (const sp of subpaths) {
    for (const k of sp.knots) {
      xs.push(k.x, k.inX, k.outX);
      ys.push(k.y, k.inY, k.outY);
    }
  }
  if (!xs.length) return null;
  const x = Math.min(...xs), y = Math.min(...ys);
  return box(x, y, Math.max(...xs) - x, Math.max(...ys) - y);
}

function strokeItem(s: PsdStroke | null): VectorPathItemV1['stroke'] | undefined {
  if (!s) return undefined;
  return { color: { hex: s.color }, width: s.width, cap: s.cap, join: s.join, ...(s.dash ? { dash: s.dash } : {}) };
}

/** Group names as ids, outermost first. */
function groupPathOf(l: RasterLayer, doc: { layers: RasterLayer[] }): string[] | undefined {
  const path = l.groupPath;
  if (!path.length) return undefined;
  return path.map((i) => `${PSD_SLIDE_ID}.group-${i}${doc.layers[i]?.name ? `:${doc.layers[i]!.name.slice(0, 64)}` : ''}`);
}

export async function sourceDeckFromPsd(bytes: Uint8Array, opts: SourcePsdOptsV1): Promise<SourceDeckV1> {
  opts.signal?.throwIfAborted();
  const docWarnings: string[] = [];
  const doc = await (opts.decode ?? readPsd)(bytes, { ...(opts.inflate ? { inflate: opts.inflate } : {}), onWarn: (code) => docWarnings.push(code) });
  opts.onSlide?.(0, 1);
  const fonts = new Map<string, number>();
  const stored = new Map<string, string>();
  const warnings: SourceWarningV1[] = [];
  const slide: SlideSourceV1 = {
    id: PSD_SLIDE_ID, index: 0, width: doc.width, height: doc.height, background: {},
    objects: [], readingOrder: [], warnings, origin: { kind: 'psd' },
  };

  /** Store one picture, once per distinct byte sequence. */
  const store = async (png: Uint8Array): Promise<string> => {
    const hash = await sha256Hex(png);
    let ref = stored.get(hash);
    if (!ref) {
      ref = await opts.sink(png, 'image/png', hash);
      stored.set(hash, ref);
    }
    return ref;
  };

  const drawn = doc.layers.map((l, i) => ({ l, i })).filter(({ l }) => !l.isGroup);
  const firstVisible = drawn.find(({ l }) => l.visible);
  for (const { l, i } of drawn) {
    opts.signal?.throwIfAborted();
    const id = `${PSD_SLIDE_ID}.layer-${i}`;
    const s = l.psd;
    const alpha = l.opacity * (s?.fillOpacity ?? 1);
    const notes = s?.notes ?? [];
    const fidelity: FidelityV1 = notes.length ? { state: 'approximate', reason: 'reader-approximation' } : { state: 'editable' };
    const groups = groupPathOf(l, doc);
    const base = {
      id, fingerprint: '', origin: 'slide' as const, fidelity,
      ...(l.visible ? {} : { hidden: true }),
      ...(groups ? { groupPath: groups } : {}),
      ...(l.name ? { alt: l.name.slice(0, 256) } : {}),
    };
    let object: SourceObjectV1 | null = null;

    if (s?.text) {
      const t = s.text;
      const b = box(t.box.x, t.box.y, t.box.w, t.box.h, t.rotation);
      object = { ...base, kind: 'text', box: b, text: { paras: paragraphs(t, alpha, fonts) } };
      object.fingerprint = await fingerprintOf('text', b, t.text);
    } else if (s?.shape) {
      const sh = s.shape;
      const b = box(sh.box.x, sh.box.y, sh.box.w, sh.box.h);
      object = {
        ...base, kind: 'shape', box: b, geom: sh.kind === 'ellipse' ? 'ellipse' : sh.kind === 'rounded' ? 'roundRect' : 'rect',
        ...(color(sh.fill, alpha) ? { fill: color(sh.fill, alpha) } : {}),
        ...(sh.stroke ? { line: { color: color(sh.stroke.color, l.opacity), widthPt: round2(sh.stroke.width * PT_PER_PX) } } : {}),
      };
      object.fingerprint = await fingerprintOf('shape', b, `${sh.kind}|${sh.radius}|${sh.fill ?? ''}|${sh.stroke?.color ?? ''}`);
    } else if (s?.path) {
      // Combined outlines turn one way, and a stroked shape merges into one outline,
      // as the Design import draws them.
      let outline = sameWinding(s.path.subpaths);
      if (outline.length > 1 && s.path.stroke) outline = unionOutline(outline) ?? outline;
      const b = outlineBox(outline);
      if (b && b.w > 0 && b.h > 0) {
        const d = psdPathData(outline);
        const fill = color(s.path.fill, alpha);
        const stroke = strokeItem(s.path.stroke);
        const item: VectorPathItemV1 = {
          kind: 'path', d, box: { x: b.x, y: b.y, w: b.w, h: b.h }, fill: fill ?? { none: true }, fillRule: 'nonzero',
          ...(stroke ? { stroke } : {}), ...(l.opacity < 1 ? { opacity: round2(l.opacity) } : {}),
        };
        object = { ...base, kind: 'shape', box: b, geom: 'custom', ...(fill ? { fill } : {}), vectorItems: { version: 1, viewBox: { x: b.x, y: b.y, w: b.w, h: b.h }, items: [item] } };
        object.fingerprint = await fingerprintOf('shape', b, d);
      }
    } else if (s?.fill) {
      if (firstVisible && firstVisible.i === i && alpha >= 1) {
        slide.background.color = color(s.fill)!;
        continue;
      }
      const b = box(0, 0, doc.width, doc.height);
      object = { ...base, kind: 'shape', box: b, geom: 'rect', fill: color(s.fill, alpha)! };
      object.fingerprint = await fingerprintOf('shape', b, s.fill);
    } else if (s?.adjustment) {
      // An adjustment layer paints nothing of its own here; the slide says it was not
      // applied. A hidden one was not applied in Photoshop either, so it says nothing.
      if (l.visible) warnings.push({ code: 'feature-dropped', message: `${l.name || id}: ${notes.join(' ')}`.slice(0, 1000) });
      continue;
    }

    if (!object && l.width > 0 && l.height > 0 && l.pixels.length === l.width * l.height * 4) {
      const ref = await store(packPng(l.pixels, { width: l.width, height: l.height, channels: 4 }));
      const b = box(l.x, l.y, l.width, l.height);
      object = {
        ...base, kind: 'pic', box: b, media: ref, mediaMime: 'image/png',
        fidelity: notes.length ? { state: 'approximate', reason: 'reader-approximation' } : { state: 'raster-preserved' },
        raster: { width: l.width, height: l.height },
      };
      object.fingerprint = await fingerprintOf('pic', b, ref);
    }
    if (!object) continue;
    if (notes.length && l.visible) warnings.push({ code: 'feature-dropped', message: `${l.name || id}: ${notes.join(' ')}`.slice(0, 1000), objectIds: [object.id] });
    slide.objects.push(object);
  }

  // Reading order: text first, top to bottom, then left to right.
  const order = slide.objects.filter((o) => o.kind === 'text' && !o.hidden)
    .sort((a, b) => (Math.abs(a.box.y - b.box.y) > 8 ? a.box.y - b.box.y : a.box.x - b.box.x));
  order.forEach((o, k) => { o.readingIndex = k; });
  slide.readingOrder = order.map((o) => o.id);
  if (docWarnings.includes('layer.semantics')) {
    warnings.push({ code: 'part-too-large', message: 'Some layer details were too large to read, so those layers stay pictures.' });
  }
  opts.onSlide?.(1, 1);

  const source: SourceDeckV1['source'] = { kind: 'psd', hash: opts.hash, lineageId: opts.hash, instanceId: opts.instanceId, pageCount: 1 };
  if (opts.name) source.name = opts.name;
  if (typeof opts.bytes === 'number') source.bytes = opts.bytes;
  return {
    version: 1,
    source,
    slides: [slide],
    fonts: [...fonts.entries()]
      .map(([family, runs]) => ({ family, provenance: 'literal' as const, runs }))
      .sort((a, b) => b.runs - a.runs || (a.family < b.family ? -1 : a.family > b.family ? 1 : 0)),
    warnings: [],
    reader: { ...opts.reader },
  };
}
