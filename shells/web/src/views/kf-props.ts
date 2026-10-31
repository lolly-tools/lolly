// SPDX-License-Identifier: MPL-2.0
/**
 * Per-property keyframing (plans/328): the arithmetic behind a diamond on ONE field.
 *
 * The `kf` wire has always been sparse per channel - a channel interpolates only between
 * the keyframes that mention it - so keying one property at the playhead is a track edit
 * that touches that property's channels and nothing else. This module is that edit, plus
 * the reading a diamond shows, plus the rules for which properties a box can key. It is
 * pure (no DOM, no panel state) so the Keyframes popup, the Design inspector and the
 * timeline's property filter all ask the same questions and get the same answers.
 *
 * A PROPERTY is what a person keys: Scale is one channel, Fill colour is three (OKLab
 * L, a and b, written together so a colour is never half keyed). A GROUP is what the
 * timeline's filter shows: Position is `x` and `y`, Stroke is its colour and its width.
 */
import { kfChannelsUsed, KF_DEFAULT_EASE, type KfChannel, type KfKey, type KfPose, type KfTrack } from '../../../../engine/src/keyframes.ts';
import { KF_FILL_CHANNELS, KF_STROKE_CHANNELS, kfColourKey } from '../../../../engine/src/kf-look.ts';

/** The properties a field diamond keys. */
export type KfProp = 'z' | 'rx' | 'ry' | 's' | 'o' | 'b' | 'fill' | 'stroke' | 'lw' | 'cr' | 'ts' | 'te';

/** The channels each property writes, in wire order. */
export const KF_PROP_CHANNELS: Readonly<Record<KfProp, readonly KfChannel[]>> = Object.freeze({
  z: ['z'], rx: ['rx'], ry: ['ry'], s: ['s'], o: ['o'], b: ['b'],
  fill: KF_FILL_CHANNELS, stroke: KF_STROKE_CHANNELS, lw: ['lw'], cr: ['cr'], ts: ['ts'], te: ['te'],
});

/** The appearance properties, which only a box that has the matching paint can key. */
export const KF_LOOK_PROPS: readonly KfProp[] = Object.freeze(['fill', 'stroke', 'lw', 'cr', 'ts', 'te'] as const);

/** The timeline's property filter, in the order its menu lists them. */
export const KF_GROUPS = [
  'position', 'size', 'scale', 'rotation', 'opacity', 'depth', 'tilt', 'blur', 'fill', 'stroke', 'corner', 'trim', 'volume',
] as const;
export type KfGroup = (typeof KF_GROUPS)[number];
/** A filter choice: one group, or every keyframe. */
export type KfFilter = KfGroup | 'all';

/** The channels each filter group shows. A camera's focus and lens keys show under All. */
export const KF_GROUP_CHANNELS: Readonly<Record<KfGroup, readonly KfChannel[]>> = Object.freeze({
  position: ['x', 'y'], size: ['w', 'h'], scale: ['s'], rotation: ['r'], opacity: ['o'],
  depth: ['z'], tilt: ['rx', 'ry'], blur: ['b'],
  fill: KF_FILL_CHANNELS, stroke: [...KF_STROKE_CHANNELS, 'lw'], corner: ['cr'], trim: ['ts', 'te'],
  volume: ['v'],
});

export function isKfFilter(v: unknown): v is KfFilter {
  return v === 'all' || (typeof v === 'string' && (KF_GROUPS as readonly string[]).includes(v));
}

/** The channels a filter shows, or null for All. */
export function kfFilterChannels(filter: KfFilter): readonly KfChannel[] | null {
  return filter === 'all' ? null : KF_GROUP_CHANNELS[filter];
}

const mentions = (k: KfKey, chs: readonly KfChannel[]): boolean => chs.some((ch) => typeof k.v[ch] === 'number');

/** The keyframes that mention any of `chs` (all of them when `chs` is null). */
export function kfKeysMentioning(track: KfTrack, chs: readonly KfChannel[] | null): KfKey[] {
  return chs ? track.filter((k) => mentions(k, chs)) : [...track];
}

/** What a diamond on one property shows. */
export type KfPropState = 'none' | 'animated' | 'key';

/**
 * `none` when no keyframe mentions the property, `key` when the keyframe at `localMs`
 * does, `animated` otherwise (keyed elsewhere, so the value here is a blend).
 */
export function kfPropState(track: KfTrack, localMs: number | null, chs: readonly KfChannel[]): KfPropState {
  let any = false;
  for (const k of track) {
    if (!mentions(k, chs)) continue;
    any = true;
    if (localMs !== null && k.t === localMs) return 'key';
  }
  return any ? 'animated' : 'none';
}

/** The ease a NEW keyframe at `t` inherits: that of the segment around `t`, which leaves the curve unchanged. */
function inheritedEase(track: KfTrack, t: number): string {
  let ease = KF_DEFAULT_EASE;
  for (const k of track) if (k.t < t) ease = k.ease;
  return ease;
}

/**
 * Write `values` into the keyframe at `atMs`, creating one when there is none. Every
 * other channel of that keyframe, and every other keyframe, is left as it was.
 */
export function kfTrackPutChannels(track: KfTrack, atMs: number, values: KfPose, ease?: string): KfKey[] {
  const t = Math.round(atMs);
  const out: KfKey[] = [];
  let done = false;
  for (const k of track) {
    if (k.t === t) { out.push({ t, ease: ease ?? k.ease, v: { ...k.v, ...values } }); done = true; } else out.push(k);
  }
  if (!done) out.push({ t, ease: ease ?? inheritedEase(track, t), v: { ...values } });
  return out;
}

/** Remove `chs` from the keyframe at `atMs`; a keyframe left with no channel goes too. */
export function kfTrackDropChannels(track: KfTrack, atMs: number, chs: readonly KfChannel[]): KfKey[] {
  const t = Math.round(atMs);
  const out: KfKey[] = [];
  for (const k of track) {
    if (k.t !== t) { out.push(k); continue; }
    const v: KfPose = { ...k.v };
    for (const ch of chs) delete v[ch];
    if (Object.keys(v).length) out.push({ t: k.t, ease: k.ease, v });
  }
  return out;
}

/**
 * Move (or, with `copy`, duplicate) ONE property group's part of the keyframe at
 * `fromMs` to `toMs`. The rest of the source keyframe stays where it is. Landing on an
 * existing keyframe merges into it and keeps that keyframe's curve; landing on empty
 * time makes a keyframe with the source's curve, so the moved channels keep their form.
 */
export function kfTrackMoveChannels(
  track: KfTrack, fromMs: number, toMs: number, chs: readonly KfChannel[], copy = false,
): KfKey[] {
  const from = Math.round(fromMs), to = Math.round(toMs);
  const src = track.find((k) => k.t === from);
  if (!src || from === to) return [...track];
  const moved: KfPose = {};
  for (const ch of chs) if (typeof src.v[ch] === 'number') moved[ch] = src.v[ch];
  if (!Object.keys(moved).length) return [...track];
  const left = copy ? [...track] : kfTrackDropChannels(track, from, chs);
  const landing = left.find((k) => k.t === to);
  return kfTrackPutChannels(left, to, moved, landing ? undefined : src.ease);
}

/** Which fields hold a box's appearance (the tool's canvas declaration). */
export interface KfLookFields {
  kind?: string;
  fill?: string;
  stroke?: string;
  strokeW?: string;
  radius?: string;
  shape?: string;
}

/** Why a box cannot key an appearance property, as a code the UI words. Null: it can. */
export type KfLookRefusal = 'no-field' | 'no-fill' | 'no-stroke' | 'placement' | 'shape' | 'arrowheads' | 'sides' | 'picture';

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

/**
 * Can this box key `prop`, and if not, why not. The rules are the renderer's: what the
 * Design hook draws for a keyed channel (community/_shared/design-renderer.js, plans/328).
 * Pose properties are always keyable here; this only refuses appearance ones.
 */
export function kfLookRefusal(prop: KfProp, box: Record<string, unknown>, f: KfLookFields): KfLookRefusal | null {
  if (!KF_LOOK_PROPS.includes(prop)) return null;
  const kind = str(box[f.kind ?? 'kind']) || 'box';
  if (['frame', 'audio', 'camera', 'group'].includes(kind)) return 'no-field';
  const path = kind === 'path';
  const shape = str(box[f.shape ?? 'shape']);
  const stroke = f.stroke ? str(box[f.stroke]) : '';
  const align = str(box.strokeAlign);
  if (prop === 'fill') {
    if (!f.fill) return 'no-field';
    return kfColourBase(box[f.fill]) ? null : 'no-fill';
  }
  if (!f.stroke && prop !== 'cr') return 'no-field';
  if (prop === 'cr') {
    if (!f.radius || path) return 'no-field';
    return shape === '' || shape === 'rect' || shape === 'rounded' ? null : 'shape';
  }
  if (!stroke || !kfColourBase(stroke)) return 'no-stroke';
  if (prop === 'stroke') return null;
  // A box stroke placed on or outside its outline grows the box by its width, so its
  // width and its trim stay as drawn.
  if (!path && (align === 'center' || align === 'outside')) return 'placement';
  if (prop === 'lw') return null;
  if (path) {
    const head = (v: unknown): boolean => str(v) !== '' && str(v) !== 'none';
    return head(box.headStart) || head(box.headEnd) ? 'arrowheads' : null;
  }
  const w = Number(box[f.strokeW ?? 'strokeW']) || 0;
  for (const side of ['strokeTop', 'strokeRight', 'strokeBottom', 'strokeLeft']) {
    const v = str(box[side]);
    if (v !== '' && Number(v) !== w) return 'sides';
  }
  const image = box.image;
  if (image != null && image !== '') return 'picture';
  return null;
}

/**
 * A colour field's value as a key, or null when it is not a solid colour. A brand
 * variable with a literal fallback (`var(--brand-primary, #1e293b)`) keys its fallback;
 * `resolve` is the live canvas's computed colour, which is the better answer when the
 * caller has one.
 */
export function kfColourBase(raw: unknown, resolve?: () => string | null): string | null {
  const s = str(raw);
  if (!s || s === 'transparent' || s === 'none') return null;
  if (kfColourKey(s, 'fill')) return s;
  const live = resolve?.() ?? null;
  if (live && kfColourKey(live, 'fill')) return live;
  let rest = s;
  for (let i = 0; i < 4; i++) {
    const m = /^var\(\s*--[\w-]+\s*,\s*(.+)\)$/.exec(rest);
    if (!m) break;
    rest = m[1]!.trim();
    if (kfColourKey(rest, 'fill')) return rest;
  }
  return null;
}

/**
 * The value an appearance property has when no keyframe sets it: the box's own field.
 * Used to seed a property's FIRST key, so keying never changes what the box looks like.
 */
export function kfLookBase(
  prop: KfProp, box: Record<string, unknown>, f: KfLookFields, resolve?: (which: 'fill' | 'stroke') => string | null,
): KfPose | null {
  const num = (v: unknown, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  switch (prop) {
    case 'fill': {
      const c = f.fill ? kfColourBase(box[f.fill], () => resolve?.('fill') ?? null) : null;
      return c ? kfColourKey(c, 'fill') : null;
    }
    case 'stroke': {
      const c = f.stroke ? kfColourBase(box[f.stroke], () => resolve?.('stroke') ?? null) : null;
      return c ? kfColourKey(c, 'stroke') : null;
    }
    case 'lw': return { lw: Math.max(0, num(box[f.strokeW ?? 'strokeW'], 0)) };
    case 'cr': return { cr: str(box[f.shape ?? 'shape']) === 'rounded' ? Math.max(0, num(box[f.radius ?? 'radius'], 0)) : 0 };
    case 'ts': return { ts: 0 };
    case 'te': return { te: 1 };
    default: return null;
  }
}

/** True when the track keys any of the property's channels. */
export function kfPropAnimated(track: KfTrack, prop: KfProp): boolean {
  const used = new Set(kfChannelsUsed(track));
  return KF_PROP_CHANNELS[prop].some((ch) => used.has(ch));
}
