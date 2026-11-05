// SPDX-License-Identifier: MPL-2.0
/**
 * dotLottie for the appearance keyframes (plans/328): a Design shape layer's keyed fill
 * colour, stroke colour, stroke width, corner radius and trim written as NATIVE animated
 * Lottie properties - `fl.c`, `st.c`, `st.w`, `rc.r`/`rc.s` and a `tm` trim modifier - on
 * the shapes `designDrawLottie` built, so the file plays in any Lottie player.
 *
 * Two kinds of key, chosen by what Lottie can say exactly:
 *
 * - stroke width and trim interpolate the way the editor does (a number along the
 *   keyframe's own curve), so their keys are written one for one, curves and holds kept;
 * - a colour does not: Lottie blends colours in sRGB and the editor blends them in OKLab.
 *   So a colour is sampled once per output frame (linear between samples, a run of equal
 *   samples kept as one) and every frame of the file carries the editor's colour. The
 *   same is done for a rectangle's radius and size, which follow its stroke width and its
 *   corner radius together.
 *
 * A trim reaches the stroke only, as on the canvas: the fill and the stroke go into
 * groups of their own and the `tm` sits in the stroke's group. A box shape's outline is
 * written as an explicit path that starts where the editor's does (the end of the
 * top-left corner, an ellipse at its rightmost point) and runs clockwise, so a trim of a
 * quarter draws the same quarter.
 *
 * What Lottie cannot carry is refused with the feature's name, as the rest of this
 * export does: a colour key on a shape with no fill or stroke to colour, and a trimmed box
 * shape whose stroke width or corner radius is animated (its outline would have to change
 * shape every frame).
 */
import { evaluateKf, kfChannelsUsed, kfEasePoints, KF_HOLD_EASE, type KfChannel, type KfTrack } from './keyframes.ts';
import { kfOklabToSrgb8, KF_FILL_CHANNELS, KF_STROKE_CHANNELS } from './kf-look.ts';
import { kfExportKeys } from './kf-bake.ts';
import type { LottieObject } from './lottie-model.ts';

/** What `animateLottieLook` needs to know about the layer it decorates. */
export interface LottieLookLayer {
  name: string;
  track: KfTrack;
  /** The layer's window on the sequence, ms, and the output rate. */
  startMs: number;
  durationMs: number;
  fps: number;
  /** The box, layer-local px. */
  w: number;
  h: number;
  /** The Design shape: '' / rect / rounded / pill / ellipse / circle, or 'path' for a pen path. */
  shape: string;
  /** The box's own corner radius and stroke width (the values a key replaces). */
  radius: number;
  strokeWidth: number;
}

const fixed = (k: unknown): LottieObject => ({ a: 0, k: k as LottieObject['k'] });

/** Plain-language names for the appearance channels, for a refusal. */
export function lookFeatureName(ch: KfChannel): string {
  if (ch === 'cl' || ch === 'ca' || ch === 'cb') return 'fill colour';
  if (ch === 'll' || ch === 'la' || ch === 'lb') return 'stroke colour';
  if (ch === 'lw') return 'stroke width';
  if (ch === 'cr') return 'corner radius';
  if (ch === 'ts' || ch === 'te') return 'trim';
  return ch;
}

/** One channel's keys, written one for one: the editor's own curve between each pair. */
function channelKeys(track: KfTrack, ch: KfChannel, fps: number, startMs: number, map: (v: number) => number): LottieObject {
  // A spring segment arrives baked into frame keys and a design-system ease resolved
  // (plans/329); every other key is the authored one.
  const keys = kfExportKeys(track, ch, fps, startMs);
  if (keys.length === 1) return fixed(map(keys[0]!.v));
  return {
    a: 1,
    k: keys.map((key, i) => {
      const next = keys[i + 1];
      const pts = kfEasePoints(key.ease) ?? [0, 0, 1, 1];
      return {
        t: key.f,
        s: [map(key.v)],
        ...(next
          ? { e: [map(next.v)], ...(key.ease === KF_HOLD_EASE ? { h: 1 } : { o: { x: pts[0], y: pts[1] }, i: { x: pts[2], y: pts[3] } }) }
          : {}),
      };
    }),
  };
}

/**
 * A value sampled once per output frame across the span the given channels are keyed
 * over (constant outside it), linear between samples, with runs of equal samples kept
 * as their two ends. `value` turns the evaluated pose at a local time into the property.
 */
function frameKeys(
  track: KfTrack, chs: readonly KfChannel[], fps: number, startMs: number, value: (localMs: number) => number[],
): LottieObject {
  const times = track.filter((k) => chs.some((ch) => typeof k.v[ch] === 'number')).map((k) => k.t);
  if (!times.length) return fixed(value(0));
  const first = Math.min(...times), last = Math.max(...times);
  if (first === last) return fixed(value(first));
  const f0 = Math.floor(((startMs + first) * fps) / 1000);
  const f1 = Math.ceil(((startMs + last) * fps) / 1000);
  if (f1 - f0 > 100_000) throw new Error('dotLottie: an animated colour spans more than 100 000 frames. Shorten it or export video.');
  const samples: { f: number; v: number[] }[] = [];
  for (let f = f0; f <= f1; f++) {
    const local = Math.min(last, Math.max(first, (f * 1000) / fps - startMs));
    samples.push({ f, v: value(local).map((n) => Math.round(n * 10000) / 10000) });
  }
  const same = (a: number[], b: number[]): boolean => a.length === b.length && a.every((n, i) => n === b[i]);
  const kept = samples.filter((s, i) => i === 0 || i === samples.length - 1
    || !(same(s.v, samples[i - 1]!.v) && same(s.v, samples[i + 1]!.v)));
  if (kept.length === 1) return fixed(kept[0]!.v);
  return {
    a: 1,
    k: kept.map((s, i) => {
      const next = kept[i + 1];
      return { t: s.f, s: s.v, ...(next ? { e: next.v, o: { x: 0, y: 0 }, i: { x: 1, y: 1 } } : {}) };
    }),
  };
}

const K = 0.5522847498;

/**
 * A box shape's outline as a Lottie path, inset by `inset` (half the stroke): the same
 * start point and direction as `kfOutlinePath`, so a trim reads the same on both.
 */
export function lottieOutline(shape: string, w: number, h: number, radius: number, inset: number): LottieObject {
  const i = Math.max(0, inset);
  const W = Math.max(0, w - 2 * i), H = Math.max(0, h - 2 * i);
  const r2 = (n: number): number => Math.round(n * 1000) / 1000;
  const v: number[][] = [], ins: number[][] = [], outs: number[][] = [];
  const add = (x: number, y: number, inT: [number, number], outT: [number, number]): void => {
    v.push([r2(x), r2(y)]); ins.push([r2(inT[0]), r2(inT[1])]); outs.push([r2(outT[0]), r2(outT[1])]);
  };
  if (shape === 'ellipse' || shape === 'circle') {
    const rx = W / 2, ry = H / 2, cx = i + rx, cy = i + ry;
    add(cx + rx, cy, [0, -K * ry], [0, K * ry]);
    add(cx, cy + ry, [K * rx, 0], [-K * rx, 0]);
    add(cx - rx, cy, [0, K * ry], [0, -K * ry]);
    add(cx, cy - ry, [-K * rx, 0], [K * rx, 0]);
  } else {
    const outer = shape === 'pill' ? Math.min(w, h) / 2 : shape === 'rounded' || shape === 'rect' ? Math.max(0, radius) : 0;
    const r = Math.min(Math.max(0, outer - i), W / 2, H / 2);
    const x0 = i, y0 = i, x1 = i + W, y1 = i + H, k = K * r;
    if (r > 0) {
      add(x0 + r, y0, [-k, 0], [0, 0]); add(x1 - r, y0, [0, 0], [k, 0]);
      add(x1, y0 + r, [0, -k], [0, 0]); add(x1, y1 - r, [0, 0], [0, k]);
      add(x1 - r, y1, [k, 0], [0, 0]); add(x0 + r, y1, [0, 0], [-k, 0]);
      add(x0, y1 - r, [0, k], [0, 0]); add(x0, y0 + r, [0, 0], [0, -k]);
    } else {
      add(x0, y0, [0, 0], [0, 0]); add(x1, y0, [0, 0], [0, 0]); add(x1, y1, [0, 0], [0, 0]); add(x0, y1, [0, 0], [0, 0]);
    }
  }
  return { ty: 'sh', ks: fixed({ v, i: ins, o: outs, c: true }) };
}

const GROUP_TRANSFORM: LottieObject = { ty: 'tr', p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0) };

/**
 * Decorate one shape layer's shapes with its keyed appearance. Returns the shapes
 * unchanged (by identity) when the track keys no appearance channel.
 */
export function animateLottieLook(shapes: LottieObject[], layer: LottieLookLayer): LottieObject[] {
  const { track, fps, startMs } = layer;
  const used = new Set(kfChannelsUsed(track));
  const has = (...chs: KfChannel[]): boolean => chs.some((ch) => used.has(ch));
  if (!has('cl', 'ca', 'cb', 'll', 'la', 'lb', 'lw', 'cr', 'ts', 'te')) return shapes;
  const fail = (feature: string): never => {
    throw new Error(`${layer.name}: ${feature} is not supported by dotLottie export. Remove it or export video.`);
  };
  const out = shapes.map((s) => ({ ...s }));
  const fill = out.find((s) => s.ty === 'fl');
  const stroke = out.find((s) => s.ty === 'st');
  const rect = out.find((s) => s.ty === 'rc' || s.ty === 'el');
  const path = layer.shape === 'path';
  const colour = (chs: readonly KfChannel[], alpha: number) => (localMs: number): number[] => {
    const p = evaluateKf(track, localMs, chs);
    const [r, g, b] = kfOklabToSrgb8(p[chs[0]!] ?? 0, p[chs[1]!] ?? 0, p[chs[2]!] ?? 0);
    return [r / 255, g / 255, b / 255, alpha];
  };
  const alphaOf = (paint: LottieObject | undefined): number => {
    const k = (paint?.c as LottieObject | undefined)?.k;
    return Array.isArray(k) && typeof k[3] === 'number' ? k[3] : 1;
  };
  if (has(...KF_FILL_CHANNELS)) {
    if (!fill) fail('a fill colour key on a shape with no fill');
    fill!.c = frameKeys(track, KF_FILL_CHANNELS, fps, startMs, colour(KF_FILL_CHANNELS, alphaOf(fill)));
  }
  if (has(...KF_STROKE_CHANNELS)) {
    if (!stroke) fail('a stroke colour key on a shape with no stroke');
    stroke!.c = frameKeys(track, KF_STROKE_CHANNELS, fps, startMs, colour(KF_STROKE_CHANNELS, alphaOf(stroke)));
  }
  if (has('lw')) {
    if (!stroke) fail('a stroke width key on a shape with no stroke');
    stroke!.w = channelKeys(track, 'lw', fps, startMs, (v) => Math.max(0, v));
  }
  const trimmed = has('ts', 'te');
  if (trimmed && !stroke) fail('a trim on a shape with no stroke');
  if (!path && rect && (has('lw', 'cr')) && !trimmed) {
    // A box's rectangle is inset by half its stroke, so its size and radius follow both.
    const at = (localMs: number): { lw: number; cr: number } => {
      const p = evaluateKf(track, localMs, ['lw', 'cr']);
      return { lw: Math.max(0, p.lw ?? layer.strokeWidth), cr: Math.max(0, p.cr ?? layer.radius) };
    };
    if (has('lw')) rect.s = frameKeys(track, ['lw'], fps, startMs, (t) => { const v = at(t); return [Math.max(0, layer.w - v.lw), Math.max(0, layer.h - v.lw)]; });
    if (rect.ty === 'rc' && (layer.shape === 'rounded' || layer.shape === 'rect' || layer.shape === '')) {
      rect.r = frameKeys(track, ['lw', 'cr'], fps, startMs, (t) => { const v = at(t); return [Math.max(0, v.cr - v.lw / 2)]; });
      // A still rc.r is a bare number; animated, each key carries a one-item array, as
      // every scalar keyframe in a Lottie file does.
      const r = rect.r as LottieObject;
      if (r.a === 0) r.k = (r.k as number[])[0] ?? 0;
    }
  }
  if (!trimmed) return out;
  if (!path && has('lw')) fail('a trimmed shape with an animated stroke width');
  if (!path && has('cr')) fail('a trimmed shape with an animated corner radius');
  const geometry = path ? out.filter((s) => s.ty === 'sh') : [lottieOutline(layer.shape || 'rect', layer.w, layer.h, layer.radius, layer.strokeWidth / 2)];
  const trim: LottieObject = {
    ty: 'tm',
    s: has('ts') ? channelKeys(track, 'ts', fps, startMs, (v) => v * 100) : fixed(0),
    e: has('te') ? channelKeys(track, 'te', fps, startMs, (v) => v * 100) : fixed(100),
    o: fixed(0),
    m: 1,
  };
  const fillShapes = path ? out.filter((s) => s.ty === 'sh') : out.filter((s) => s.ty === 'rc' || s.ty === 'el');
  const groups: LottieObject[] = [];
  if (fill) groups.push({ ty: 'gr', nm: 'Fill', it: [...fillShapes.map((s) => ({ ...s })), fill, { ...GROUP_TRANSFORM }] });
  groups.push({ ty: 'gr', nm: 'Stroke', it: [...geometry.map((s) => ({ ...s })), trim, stroke!, { ...GROUP_TRANSFORM }] });
  return groups;
}
