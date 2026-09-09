// SPDX-License-Identifier: MPL-2.0
// timeline-math.ts - DOM-free time math for the timeline panel (Fable timeline, phase 2).
//
// Sibling of free-canvas-math.ts: that module owns the SPATIAL half of a `boxes`
// block input (x/y/w/h/rot in native px), this one owns the TEMPORAL half
// (start/dur/clipIn/speed/lane in seconds). Same contract, same habits - it reads a
// FLAT array of box rows plus a `cfg` naming the sub-fields that carry timing, it is
// pure (returns NEW boxes / arrays, never mutates), and it never touches the DOM, so
// every interaction edge case is unit-testable at the repo root rather than trapped
// inside the panel controller.
//
// Units: SECONDS everywhere in this module's inputs and box fields (that is what the
// manifest's time fields store). The ONE exception is deriveDuration, which returns
// MILLISECONDS because it must return the byte-identical number to the tool hook's
// seqDurationMs - the derived length the hook already stamps on the artboard as
// data-seq-ms. Getting those two to disagree is a real bug we have already hit once,
// so the clamps below are written to mirror the hook's line for line:
//
//   design/hooks.js: num / clamp / isFiniteNum / startSeconds / seqDurationMs
//
// Lanes: a box is on the SEQ lane (the magnetic, gapless row) when lane === 'seq'.
// A box with a finite `start` but no lane is an OVERLAY (free-floating in time). A box
// with neither is SCENERY - always visible, never timed, and invisible to every
// function here.

import { num, type Box } from './free-canvas-math.ts';
// The kf grammar, its evaluator and its ease subdivision come from the engine and
// are never re-derived here: `tests/sequence-plan.test.ts` holds both evaluators to
// the same numbers, and a rebase that re-implemented interpolation would be a third
// reading of the same wire. Deep import rather than the `@lolly/engine` barrel, for
// the reason brand-vars.ts states - the barrel's retained export set is the union
// over every importer, and this module is pure time math the panel loads eagerly.
import {
  DEFAULT_PERSPECTIVE, KF_CAMERA_CHANNELS, KF_CHANNELS, KF_DEFAULT_EASE, KF_MAX_TIME_MS,
  KF_QUANTA, evaluateKf, kfChannelsUsed, kfEaseToken, parseKf, projectLayer, resolveCamera,
  serialiseKf, subdivideKfEase,
} from '../../../../engine/src/keyframes.ts';
import type {
  KfCameraClip, KfCameraView, KfChannel, KfKey, KfPose, KfTrack,
} from '../../../../engine/src/keyframes.ts';
import { clamp } from '@lolly/engine';

export type { Box };

/** Which sub-fields of a box carry its timing (from the input's `canvas` flag). */
export interface TimeCfg {
  startField: string;
  durField: string;
  clipInField: string;
  speedField: string;
  enterField: string;
  exitField: string;
  enterMsField: string;
  exitMsField: string;
  muteField: string;
  laneField: string;
  idField: string;
  /**
   * OPTIONAL. The sub-field carrying an A/V link - the id of the box this one was
   * detached from (or detached into), written on BOTH sides so re-attach works from
   * either. Absent (a tool that declares no such field, e.g. design) means the
   * whole detach/re-attach feature is simply not offered: every writer below returns
   * null rather than inventing a field the manifest never declared.
   */
  linkField?: string;
  /**
   * OPTIONAL, progressive like linkField: the clip-volume sub-field (design's
   * `gain`, plans/165 WP-1). A tool that declares none simply gets no Volume row;
   * every reader treats an absent value as 1 (as recorded).
   */
  gainField?: string;
  panField?: string;
  duckField?: string;
  pitchField?: string;
  varispeedField?: string;
  fxField?: string;
  /** OPTIONAL: the user's own clip name (timeline rename); '' or absent = derived label. */
  labelField?: string;
  /**
   * OPTIONAL, progressive like linkField/gainField (plans/174 section 5.5): the
   * reversible-cut sub-field (design's `ignored`). An `ignored` box keeps its media
   * and its place in the RULER (greyed/struck in the transcript) but is treated as
   * zero-duration by playback and export - the Descript "ignore" gesture, the dual of
   * a hard delete. A tool that declares none simply never offers strikethrough, and
   * every reader treats an absent value as not-ignored. Distinct from `muteField`:
   * mute silences audio yet keeps picture AND time; ignore drops picture+audio AND
   * removes the time. Named through the cfg because every box-field reader must be.
   */
  ignoredField?: string;
  /**
   * OPTIONAL, on the same progressive-capability terms as `linkField`. The sub-fields
   * carrying each preset's authored GEOMETRY curve - a preset name or a CSS
   * cubic-bezier, '' when unauthored, in which case the preset keeps the built-in
   * curve it has always had. A tool that declares neither simply never offers the
   * control; nothing here reads them, but every writer of a box names its fields
   * through a TimeCfg, so they have to be nameable from one.
   *
   * There is deliberately no opacity equivalent: alpha keeps its own fixed ramp
   * because a fade on a slow curve turns to mud through video compression - see the
   * authored-easing section of lib/transitions.ts.
   */
  enterEaseField?: string;
  exitEaseField?: string;
  /**
   * OPTIONAL, same progressive terms (plans/175 WP-A): the split-text sub-fields -
   * the tier the enter/exit runs per unit at ('' whole box / word / line / letter),
   * the start-to-start unit gap in ms, and the dealt order. A tool that declares
   * none simply never offers the text-animation rows; nothing in this module reads
   * them, but every writer of a box names its fields through a TimeCfg.
   */
  splitField?: string;
  staggerField?: string;
  splitOrderField?: string;
  /**
   * OPTIONAL, same terms (plans/175 WP-B): the hold-effect sub-fields - the
   * while-on-screen looping motion ('' still / pulse / bob / sway / flicker)
   * and its rate in cycles/sec. A tool that declares neither never offers the
   * "While on screen" rows.
   */
  holdField?: string;
  holdRateField?: string;
  /**
   * OPTIONAL: the canvas's own text sub-field. Carried for ONE ui gate - the
   * text-animation rows only appear on a box that actually holds text - never
   * read by the maths here.
   */
  textField?: string;
  /**
   * OPTIONAL, same terms again: the sub-field carrying the canvas's own box
   * GROUP (free-canvas's `groupField`, e.g. sequence-studio's `group`). Nothing
   * in this module reads it - grouping is canvas semantics - but the panel's
   * lane collapse (overlay boxes sharing a group share one lane row, e.g. a
   * generated caption set) keys rows by it, and every reader of a box's fields
   * names them through a TimeCfg. Absent means every overlay keeps its own row.
   */
  groupField?: string;
  /**
   * OPTIONAL, same progressive-capability terms again: the sub-field carrying the
   * box's KEYFRAME TRACK (plans/104 section 5.1 - the `kf` wire, poses over the box's own
   * local time). A tool that declares none is not keyframable, and every rebase
   * below is a no-op for it: an edit that would shift a track simply doesn't,
   * because there is no track and no field to write one to.
   *
   * This is the ONE field the section 5.6 rebase rewrites. Everything else a split, trim
   * or join copies stays copied - the detach link, the source ref, the geometry - 
   * so the field-copy contracts those features rest on are untouched.
   */
  kfField?: string;
  /**
   * OPTIONAL, same terms: the box's DEPTH field (plans/104 section 5.3 - px above the
   * surface, `canvas.zField`). Not a timing field at all, and named here for one
   * reason: a keyframe's `z` channel REPLACES this field for its segment (section 5.2), so
   * the pose writer below has to know what the unkeyed value is before it can write
   * an honest full pose. Absent means the box has no authored depth and `z` resolves
   * to 0 - which is exactly what the default camera projects at eff = 1.
   */
  zField?: string;
  /**
   * OPTIONAL, same terms again: the box's own TILT fields in degrees (P2.1 -
   * `canvas.rxField` / `canvas.ryField`). Named here for `zField`'s reason exactly: a
   * keyframe's `rx`/`ry` channel REPLACES the field for its segment, so the pose writer
   * has to know the unkeyed value before it can write an honest full pose. Absent means
   * the box has no authored tilt and `rx`/`ry` resolve to 0 - the flat card.
   */
  rxField?: string;
  ryField?: string;
}

/** A box's timing, resolved. `start`/`dur` stay null when unauthored (scenery / open-ended). */
export interface BoxTiming {
  start: number | null;
  dur: number | null;
  clipIn: number;
  speed: number;
  lane: '' | 'seq';
}

/** Result of {@link snapTime}: the (possibly snapped) time, and which candidate won. */
export interface SnapTimeResult {
  t: number;
  snapped: number | null;
}

/** A box's media length in seconds, when the caller knows it (probe/metadata). */
export type MediaDurFn = (box: Box, index: number) => number | null | undefined;

// ── constants (kept in lockstep with design/hooks.js) ───────────────────

/** Ceiling for every authored time value, seconds. Mirrors the hook's MAX_TIME_S. */
export const MAX_TIME_S = 3600;
/** Floor for a clip's on-timeline duration, seconds. Mirrors the hook's dur clamp. */
export const MIN_DUR = 0.1;
/** Length given to a seq clip that has no duration and no known media length. */
export const DEFAULT_CLIP_S = 3;
/** Fallback sequence length when something is timed but nothing has a duration. */
export const DEFAULT_SEQ_S = 5;
/** Default snap threshold, in SCREEN pixels (the free-canvas SNAP_PX convention). */
export const SNAP_PX = 6;
/**
 * Below this bar width (px) a clip offers NO trim edge zone at all.
 *
 * Two zones of `EDGE_PX` each on a bar narrower than ~3×EDGE_PX would meet in the
 * middle, so every press near the centre would be a trim and the clip could never be
 * moved or reordered again - a bar you cannot grab is worse than one you cannot trim.
 * 28px is the width at which a 10px zone still leaves ~8px of body. See `edgeZonePx`,
 * which is the only place that arithmetic is allowed to live; the panel reads the same
 * constant to mark a bar `.is-tight` (hiding the grips and pointing at the inspector),
 * so the visual affordance and the hit test can never disagree.
 */
export const MIN_TRIM_BAR_PX = 28;
/**
 * Playback-rate range. THE source of truth: the hook clamps to it, sequence-clock
 * re-exports these two (rather than declaring its own pair), and every writer here
 * clamps through them. Two functions that must agree share their clamp helpers.
 */
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;

/** Round to milliseconds. Time fields are authored in seconds; 3dp is the wire's resolution. */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Round to 2dp - the speed field's resolution (mirrors the hook's f2). */
const f2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Does `v` parse to a finite number at all, as opposed to num()'s "finite, or fall
 * back"? This is what distinguishes an authored 0 from an empty field: start:''
 * means scenery, start:0 means "enters at the top". Mirrors the hook's isFiniteNum.
 */
export function isFiniteNum(v: unknown): boolean {
  if (v == null || v === '') return false;
  const x = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(x);
}

// ── readers ───────────────────────────────────────────────────────────────────

/** Read a box's timing, tolerant of stringy/absent/hostile fields. */
export function boxTiming(box: Box | undefined, cfg: TimeCfg): BoxTiming {
  const b = box || {};
  const start = isFiniteNum(b[cfg.startField]) ? clamp(num(b[cfg.startField], 0), 0, MAX_TIME_S) : null;
  const dur = isFiniteNum(b[cfg.durField]) ? clamp(num(b[cfg.durField], 0), MIN_DUR, MAX_TIME_S) : null;
  return {
    start,
    dur,
    clipIn: clamp(num(b[cfg.clipInField], 0), 0, MAX_TIME_S),
    speed: f2(clamp(num(b[cfg.speedField], 1), 0.25, 4)),
    lane: b[cfg.laneField] === 'seq' ? 'seq' : '',
  };
}

/** True when the box participates in the timeline at all (i.e. is not scenery). */
export function isTimed(box: Box | undefined, cfg: TimeCfg): boolean {
  const t = boxTiming(box, cfg);
  return t.lane === 'seq' || t.start !== null;
}

/**
 * The sequence's total derived length in MILLISECONDS - byte-identical to the tool
 * hook's seqDurationMs for the same boxes (the panel's ruler and the artboard's
 * data-seq-ms must agree exactly). `dur` is TIMELINE seconds (the author's own trim,
 * already reflecting any speed change), so it is never multiplied by speed here.
 */
export function deriveDuration(boxes: Box[], cfg: TimeCfg): number {
  const rows = Array.isArray(boxes) ? boxes : [];
  let timed = 0;
  let max = 0;
  let anyDur = false;
  for (const b of rows) {
    if (!b) continue;
    const t = boxTiming(b, cfg);
    if (t.lane !== 'seq' && t.start === null) continue;
    timed++;
    if (t.dur === null) continue;
    anyDur = true;
    const end = ((t.start ?? 0) + t.dur) * 1000;
    if (end > max) max = end;
  }
  if (anyDur) return Math.round(max);
  return timed ? DEFAULT_SEQ_S * 1000 : 0;
}

/** Indices of the seq-lane boxes, in play order: by start, ties broken by array index. */
function seqIndices(boxes: Box[], cfg: TimeCfg): number[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const out: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && boxTiming(rows[i], cfg).lane === 'seq') out.push(i);
  }
  // A seq clip with no authored start has not been packed yet - park it at the end
  // rather than at 0, so an appended clip lands after the existing row.
  const key = (i: number): number => boxTiming(rows[i], cfg).start ?? Number.POSITIVE_INFINITY;
  return out.sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka === kb) return a - b;   // Infinity === Infinity, so ties stay index-ordered
    return ka < kb ? -1 : 1;
  });
}

/** The seq-lane boxes, in play order (by start, ties by array index). */
export function seqBoxes(boxes: Box[], cfg: TimeCfg): Box[] {
  return seqIndices(boxes, cfg).map((i) => boxes[i]!);
}

/** Index of the row carrying `id`, or -1. Matches on the cfg id field only. */
export function indexOfId(boxes: Box[], cfg: TimeCfg, id: string): number {
  const rows = Array.isArray(boxes) ? boxes : [];
  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]?.[cfg.idField];
    if (v != null && v !== '' && String(v) === String(id)) return i;
  }
  return -1;
}

/** Which scenes sit either side of the one on screen - {@link onionNeighbours}' answer. */
export interface OnionNeighbours {
  /** Ids walking BACKWARD from the active scene, nearest first. */
  past: string[];
  /** Ids walking FORWARD from the active scene, nearest first. */
  future: string[];
}

/** How many scenes an onion skin may reach in one direction. Two is Krita's / Animate's
 *  practical ceiling and the point past which stacked ghosts stop being readable. */
export const ONION_MAX_STEPS = 2;

const onionSteps = (v: number): number => {
  const n = Math.floor(num(v, 0));
  return n < 0 ? 0 : n > ONION_MAX_STEPS ? ONION_MAX_STEPS : n;
};

/**
 * The seq clips `before` steps back and `after` steps forward from whichever scene is
 * on screen at `atSec` - the onion skin's model half (views/onion-skin.ts draws it).
 *
 * SEQ LANE ONLY, deliberately. A scene is the animator's unit and the seq row is the
 * only lane with a defined "the one before this one"; an overlay has neighbours in time
 * but not in sequence, and ghosting a lower third either side of a cut would say
 * nothing about what the frame is becoming.
 *
 * The active window is HALF-OPEN `[start, start + dur)`, byte-identical to
 * sequence-dom's `isActiveAt`, so the frame exactly at a cut belongs to the NEXT clip
 * and the ghosts flip on the same frame the picture does. An open-ended clip runs to the
 * derived sequence end, the same reading the panel's `span()` takes.
 *
 * Both counts are clamped to 0…{@link ONION_MAX_STEPS} and honoured INDEPENDENTLY (the
 * Procreate Dreams pattern: "two behind, none ahead" is a real way to work). Nothing
 * active, an empty lane, or 0/0 all return two empty arrays - never null, so the caller
 * never branches on shape.
 */
export function onionNeighbours(
  boxes: Box[], cfg: TimeCfg, atSec: number, before: number, after: number,
): OnionNeighbours {
  const back = onionSteps(before);
  const fwd = onionSteps(after);
  if (!back && !fwd) return { past: [], future: [] };
  const row = seqBoxes(boxes, cfg);
  if (!row.length) return { past: [], future: [] };
  const total = deriveDuration(boxes, cfg) / 1000;
  const at = num(atSec, 0);
  let hit = -1;
  for (let i = 0; i < row.length; i++) {
    const tm = boxTiming(row[i], cfg);
    const start = tm.start ?? 0;
    const dur = tm.dur ?? Math.max(MIN_DUR, total - start);
    if (at >= start && at < start + dur) { hit = i; break; }
  }
  if (hit < 0) return { past: [], future: [] };
  const idAt = (i: number): string => {
    const v = row[i]?.[cfg.idField];
    return v == null ? '' : String(v);
  };
  const past: string[] = [];
  for (let k = 1; k <= back && hit - k >= 0; k++) { const id = idAt(hit - k); if (id) past.push(id); }
  const future: string[] = [];
  for (let k = 1; k <= fwd && hit + k < row.length; k++) { const id = idAt(hit + k); if (id) future.push(id); }
  return { past, future };
}

// ── writers ───────────────────────────────────────────────────────────────────

/** Patch a box, preserving object identity when nothing actually changes. */
function withFields(box: Box, patch: Record<string, Box[string]>): Box {
  let changed = false;
  for (const k of Object.keys(patch)) {
    if (box[k] !== patch[k]) { changed = true; break; }
  }
  return changed ? { ...box, ...patch } : box;
}

// ── keyframe rebase (plans/104 section 5.6) ──────────────────────────────────────────
//
// A keyframe track is authored in the box's OWN LOCAL TIME (ms from the clip's
// start, unscaled - `speed` remaps the MEDIA inside a clip, never the clip's own
// animation, so nothing here touches speed). That timebase is exactly what an edit
// to the clip's HEAD moves: cutting a clip in two gives the second half a new t = 0,
// and trimming the in-edge throws away the first d seconds of it. Without a rebase,
// a split would hand both halves the same track and the second one would replay the
// whole animation from its own start, a trim-in would slide the motion out from under
// the picture, and a join would silently drop the second clip's track.
//
// Three rules, and the reasons they differ:
//   • SPLIT at local `c` - A keeps the keys before `c` plus a synthesised pose key AT
//     `c`; B gets that same pose at t = 0 followed by the later keys shifted −c.
//   • TRIM-IN by `d` - the same thing as B alone: shift −d·1000, synthesise t = 0,
//     drop what went negative. A NEGATIVE trim-in (dragging the edge back out) only
//     shifts, since the newly revealed head is already covered by the track's
//     clamp-hold before its first key.
//   • TRIM-OUT / setDuration - NO rebase. Shortening the tail cannot move local t = 0,
//     and clamp-hold covers everything past the last key; leaving the keys in place is
//     what lets a later re-extension bring the motion back.
//   • JOIN - A's keys, then B's shifted by A's length, one key at the seam.
//
// The subtle half is the EASE. A segment interpolating `av → bv` through eased
// progress `E` that is cut at the time fraction λ does not leave two segments with
// the same ease: the first needs `E(u·λ)/E(λ)` and the second `(E(λ + (1−λ)u) −
// E(λ))/(1 − E(λ))`, the de Casteljau halves of the curve. `subdivideKfEase` is that
// (engine, with goldens); this module only decides WHERE to cut.
//
// Exactness, stated once so the tests can pin it: the halves reproduce the original's
// value at the cut and at every key EXACTLY (to the wire's own quanta), and reproduce
// the whole curve when each keyframe poses the same set of channels - which is what
// the UI writes (section 8: "every diamond is a complete honest pose"). A hand-authored
// SPARSE track, where one channel's segment spans a keyframe that never mentions it,
// can have two different crossing segments at one cut; a keyframe carries ONE ease, so
// the subdivision is applied to the last key before the cut and any channel whose
// segment started earlier keeps the right endpoints but not the exact interior shape.

/** Nothing to rebase. Shared so the "no kf field" path allocates nothing. */
const EMPTY_KF: KfTrack = Object.freeze([]);

/** Local box time in INTEGER ms (the section 4.6 `t` quantum) from an edit measured in seconds. */
function kfMs(sec: number): number {
  return Math.round(num(sec, 0) * 1000);
}

/**
 * `kf` string → its parsed track, memoised - the panel-side twin of the evaluators'
 * own `kfTrackOf` (bridge/sequence-plan.ts), and for the same two reasons.
 *
 * ONE parsed track per string: `parseKf` returns a deep-frozen array, and the engine
 * memoises its 12-channel index in a WeakMap keyed on THAT object, so handing every
 * caller the same array is what keeps the index built once instead of rebuilt on
 * every read. Without it `syncDiamonds` re-parses once per bar per restyle and
 * `syncKfLatch` re-parses four times per tick.
 *
 * Bounded and cleared wholesale on overflow (the `KF_CACHE` posture): the key is
 * untrusted text from a hand-edited URL, so it must not grow without limit. Not
 * imported from sequence-plan.ts on purpose - this module is the panel's eager time
 * math and must not pull the bridge (and the `@lolly/engine` barrel) in behind it.
 */
const KF_PARSE_CACHE = new Map<string, KfTrack>();
const KF_PARSE_CACHE_MAX = 256;

/**
 * A box's parsed keyframe track - empty whenever the tool declares no `kfField`,
 * the box has no track, or the value is junk (`parseKf` never throws).
 */
function boxTrack(box: Box | undefined, cfg: TimeCfg): KfTrack {
  const f = cfg.kfField;
  if (!f || !box) return EMPTY_KF;
  const raw = box[f];
  if (raw == null || raw === '') return EMPTY_KF;
  const key = String(raw);
  const hit = KF_PARSE_CACHE.get(key);
  if (hit) return hit;
  const track = parseKf(key);
  if (KF_PARSE_CACHE.size >= KF_PARSE_CACHE_MAX) KF_PARSE_CACHE.clear();
  KF_PARSE_CACHE.set(key, track);
  return track;
}

/**
 * The eases around a cut at `cutMs`.
 *
 * `left` is what the last key BEFORE the cut must carry so its shortened segment
 * still traces the original curve - null when it must not be touched at all (the
 * cut lands on an existing key, or no segment crosses it). `right` is what the
 * synthesised key AT the cut carries: the continuation of the same curve, which is
 * the ease the second half's opening segment needs.
 */
function seamEases(track: KfTrack, cutMs: number): { left: string | null; right: string } {
  let before = -1;
  let at = -1;
  let after = -1;
  for (let i = 0; i < track.length; i++) {
    const t = (track[i] as KfKey).t;
    if (t < cutMs) before = i;
    else { if (t === cutMs) at = i; else after = i; break; }
  }
  if (at >= 0) return { left: null, right: (track[at] as KfKey).ease };
  if (before >= 0 && after >= 0) {
    const a = track[before] as KfKey;
    const b = track[after] as KfKey;
    const span = b.t - a.t;
    const { left, right } = subdivideKfEase(a.ease, span > 0 ? (cutMs - a.t) / span : 0);
    return { left, right };
  }
  // Nothing crosses: on one side of the cut the track is a clamp-hold, and a
  // constant segment traces the same values under any ease.
  const only = track[before >= 0 ? before : 0];
  return { left: null, right: only ? only.ease : KF_DEFAULT_EASE };
}

/**
 * The part of a track that survives a cut at `cutMs` - the FIRST half of a split.
 *
 * Keys at or after the cut are dropped (the clip ends there, and the second half now
 * owns that motion), replaced by one synthesised key holding the pose the original
 * struck at the cut. That key carries the continuation ease, so re-lengthening the
 * clip later resumes the move it was making rather than snapping flat.
 */
export function kfTrackBefore(track: KfTrack, cutMs: number): KfKey[] {
  if (!track.length) return [];
  const cut = Math.max(0, Math.round(num(cutMs, 0)));
  const { left, right } = seamEases(track, cut);
  const out: KfKey[] = [];
  for (const k of track) {
    if (k.t >= cut) break;
    out.push(k);
  }
  const last = out[out.length - 1];
  if (left !== null && last) out[out.length - 1] = { t: last.t, ease: left, v: last.v };
  out.push({ t: cut, ease: right, v: evaluateKf(track, cut) });
  return out;
}

/**
 * The part of a track that survives a cut at `cutMs`, rebased to a new t = 0 - the
 * SECOND half of a split, and the whole of a trim-in.
 *
 * A negative `cutMs` (a trim-in dragged back out, revealing head that was trimmed
 * away) only shifts: the track already clamp-holds its first key's pose backwards,
 * which is exactly what the revealed head should show.
 */
export function kfTrackAfter(track: KfTrack, cutMs: number): KfKey[] {
  if (!track.length) return [];
  const cut = Math.round(num(cutMs, 0));
  if (cut <= 0) return track.map((k) => ({ t: k.t - cut, ease: k.ease, v: k.v }));
  const { right } = seamEases(track, cut);
  const out: KfKey[] = [{ t: 0, ease: right, v: evaluateKf(track, cut) }];
  for (const k of track) if (k.t > cut) out.push({ t: k.t - cut, ease: k.ease, v: k.v });
  return out;
}

/**
 * Two tracks into one: `a`, then `b` shifted by `offsetMs` (the first clip's length).
 *
 * The seam is ONE key, never two - the grammar has no way to say "these two poses
 * both happen at t = 1500", and the second clip's opening pose is what plays at that
 * instant, so it wins. B's t = 0 pose is synthesised even when B's first key sits
 * later, so A's last pose cannot bleed forward past the seam; where B says nothing at
 * all about a channel A moved, A's value at the seam carries into it.
 *
 * What a join CANNOT preserve, stated rather than hidden: one clip has one track, and
 * a track clamp-holds its first key's pose backwards and its last key's pose forwards.
 * So joining an animated clip to an unanimated one poses the unanimated half with the
 * nearest key - there is no "unposed" token to write, since a channel's neutral value
 * is a composition rule the engine owns, not a value this module may invent. Undoing a
 * split (the case this exists for) is unaffected: both halves carry a key at the seam.
 */
export function kfTrackJoin(a: KfTrack, b: KfTrack, offsetMs: number): KfKey[] {
  const seam = Math.max(0, Math.round(num(offsetMs, 0)));
  if (!b.length) return a.map((k) => k);
  const out: KfKey[] = [];
  let seamPose: KfPose = {};
  for (const k of a) {
    if (k.t < seam) out.push(k);
    else if (k.t === seam) seamPose = { ...k.v };
    // Keys past the seam are dropped: B's track owns that region of the joined clip.
  }
  const opening = b[0] as KfKey;
  out.push({ t: seam, ease: opening.ease, v: { ...seamPose, ...evaluateKf(b, 0) } });
  for (const k of b) if (k.t > 0) out.push({ t: k.t + seam, ease: k.ease, v: k.v });
  return out;
}

// ── keyframe EDITING (plans/104 section 8 - the surface's arithmetic, not the panel's) ─
//
// The panel is editing GLUE: it turns pointers and presses into intents, and every
// number those intents need lives here or in the engine. That split is the panel's
// own header law, and it is what lets a jsdom-free test pin "an on-diamond drag
// updates exactly one keyframe" without driving a pointer at all.
//
// Two timebases meet in this section and they must never be confused:
//   • TIMELINE seconds - what the ruler, the bars and `snapTime` speak.
//   • LOCAL box ms - what a `kf` track is authored in (section 5.1), i.e. ms since the
//     clip's own start, UNSCALED. `speed` remaps the media inside a clip, never the
//     clip's animation, so it appears nowhere below. The DOM evaluator reads exactly
//     this (`evaluateKf(timing.kf, tMs - timing.start)`, sequence-dom.ts) and the
//     trim rebase above moves by exactly this, so all three agree by construction.

/**
 * A channel's value when the wire says nothing about it - the composition-neutral
 * one, read off `foldKfPose` (sequence-plan.ts), which is the single function both
 * evaluators fold a pose through:
 *
 *   dx += pose.x ?? 0            → x, y, b neutral at 0
 *   scale *= pose.s (if present) → s, o neutral at 1
 *   rot  += pose.r (if present)  → r neutral at 0
 *   z     = pose.z ?? zField     → z neutral is the BOX's own field (see kfPoseAt)
 *   rx    = pose.rx ?? rxField   → and so are rx/ry (P2.1), on z's rule verbatim
 *
 * Camera channels take the engine's own documented defaults (`DEFAULT_CAMERA`).
 * Pinned by a test against `foldKfPose`'s behaviour rather than restated in prose:
 * if the fold ever changes what an absent channel means, this table is wrong and a
 * "full pose" written from it would silently move the box.
 */
export const KF_NEUTRAL: Readonly<Record<KfChannel, number>> = Object.freeze({
  x: 0, y: 0, z: 0, s: 1, r: 0, rx: 0, ry: 0, o: 1, b: 0, f: 0, a: 0, p: DEFAULT_PERSPECTIVE,
  // Clip volume is a multiplier over the box's own gain field: neutral 1, and the
  // visual fold never reads it (it is the audio mix's channel - plans/165 WP-3).
  v: 1,
  // `w`/`h` are the `z` case again: their neutral is THE BOX'S OWN SIZE, which is not a
  // number this table can hold, so 0 stands for "unauthored" and the fold reads it as
  // "use `boxW`/`boxH`". Like `z` and `b`, they are deliberately absent from
  // {@link KF_POSE_SEED} - seeding a size into every diamond would freeze a value the
  // user never touched into the wire, and worse, would make every keyed box reflow.
  w: 0, h: 0,
});

/**
 * The channel set a brand-new track is BORN with - the Animate door's t = 0 pose.
 *
 * Deliberately the five the canvas and the pose row drive, and deliberately NOT `z`
 * or `b`: those two have an authored base of their own (the depth field, the blur
 * field), and seeding them into every diamond would write a value the user never
 * touched into the wire of every keyframe from then on. They join the set the moment
 * they are edited, which is exactly what "the box's ACTIVE channel set" means.
 *
 * A camera is born with the camera set instead: a camera exists only to be animated,
 * so its pose IS its channels (section 5.4).
 */
export const KF_POSE_SEED: readonly KfChannel[] = Object.freeze(['x', 'y', 's', 'r', 'o'] as const);

/**
 * One channel's value as a control PRINTS it - at that channel's own section 4.6 quantum.
 *
 * Here rather than in the panel because it is arithmetic, and because the quantum is
 * per channel: `x/y/z/b/r` are hundredths, `s/o/a` thousandths. A hardcoded 1e-3 in
 * the inspector printed five significant decimals for a depth the wire could never
 * hold. `toFixed` rather than `Math.round(v / q) * q`, which reintroduces the binary
 * artefacts (`0.30000000000000004`) the quantum exists to keep out of the field.
 */
export function kfFormatChannel(ch: KfChannel, v: number): string {
  const q = KF_QUANTA[ch];
  const dp = q >= 1 ? 0 : Math.round(-Math.log10(q));
  return String(Number(num(v, 0).toFixed(dp)));
}

/** A box's parsed keyframe track. Exported reader - the panel never splits `*` itself. */
export function kfBoxTrack(box: Box | undefined, cfg: TimeCfg): KfTrack {
  return boxTrack(box, cfg);
}

/** Timeline seconds → the box's own local keyframe time, in integer ms. */
export function kfLocalMs(box: Box | undefined, cfg: TimeCfg, tSec: number): number {
  const start = box ? (boxTiming(box, cfg).start ?? 0) : 0;
  return kfMs(num(tSec, 0) - start);
}

/**
 * Local keyframe ms → seconds FROM THE BAR'S LEFT EDGE - the diamond's own offset
 * along its clip, which is what `timeToPx` turns into a left offset. Trivial by
 * itself; it lives here because the panel's law is that it converts pointers to
 * intents and does no arithmetic, not even the easy kind that later grows a clamp.
 */
export function kfLocalSec(localMs: number): number {
  return num(localMs, 0) / 1000;
}

/**
 * The box's local keyframe time, in integer ms, back to TIMELINE seconds.
 *
 * The EXACT inverse of {@link kfLocalMs}, and it has to be: this is where a diamond's
 * candidate time comes from, and `kfDiamondAt` answers "am I on it?" by rounding back
 * into local ms. Rounding here - to the absolute millisecond grid, which is where an
 * `r3` used to sit - makes the two disagree whenever `start * 1000` is not an integer
 * (an authored, imported or URL-supplied start; nothing in `TimeCfg` or the schema
 * requires one). At start = 0.1235 the candidate came back 0.124, `kfLocalMs` read
 * that as local ms 1, and Alt+→ seeked the playhead exactly onto a diamond the header
 * then denied being on. Unrounded, `Math.round(((start + t/1000) − start) · 1000)` is
 * `t` for every start (the float error is ~1e-8 ms at the worst representable start,
 * eleven orders below the half-millisecond it would take to round wrong), so the
 * latch, the ruler snap and the pose write agree BY CONSTRUCTION.
 */
export function kfTimelineSec(box: Box | undefined, cfg: TimeCfg, localMs: number): number {
  const start = box ? (boxTiming(box, cfg).start ?? 0) : 0;
  return start + num(localMs, 0) / 1000;
}

/**
 * Every diamond of one box, in TIMELINE seconds - the latch's candidate set (section 8).
 *
 * Ascending, because `parseKf` sorts; duplicates are impossible for the same reason
 * (it dedupes at equal `t`).
 */
export function kfDiamondTimes(box: Box | undefined, cfg: TimeCfg): number[] {
  const track = boxTrack(box, cfg);
  if (!track.length) return [];
  // Through kfTimelineSec, never a second copy of the same sum: the candidate the
  // playhead lands on and the time `kfDiamondAt` tests against must be one expression
  // or they drift apart off the millisecond grid (see kfTimelineSec's note).
  return track.map((k) => kfTimelineSec(box, cfg, k.t));
}

/**
 * The keyframe the playhead is parked ON, as its LOCAL ms - or null.
 *
 * EXACT ms equality, never a tolerance: the latch has already snapped the playhead
 * onto the diamond, so "near it" is a state the user cannot be left in by accident,
 * and a tolerance here would make an edit land on a keyframe the header says you are
 * not on. Alt (the snap bypass) is how you deliberately park between two.
 */
export function kfDiamondAt(box: Box | undefined, cfg: TimeCfg, tSec: number): number | null {
  const track = boxTrack(box, cfg);
  if (!track.length) return null;
  const local = kfLocalMs(box, cfg, tSec);
  for (const k of track) if (k.t === local) return k.t;
  return null;
}

/** One keyframe by its local ms, or null. */
export function kfKeyAt(track: KfTrack, atMs: number): KfKey | null {
  const t = Math.round(num(atMs, 0));
  for (const k of track) if (k.t === t) return k;
  return null;
}

/**
 * The pose a diamond WOULD carry if it were written now: every channel in
 * `channels`, resolved at `localMs`.
 *
 * A channel the track already mentions is evaluated (so an existing curve is
 * preserved through the diamond being written); one it does not is the neutral value
 * - except the three channels that HAVE a field of their own. `z`, `rx` and `ry` are
 * box PROPERTIES that a keyed value REPLACES for its segment (section 5.2, P2.1), so
 * their unkeyed value is the field, not the table's 0: a full pose that wrote 0 over an
 * authored depth of 140 would drop the box to the floor the moment it was keyed, and
 * one that wrote 0 over an authored tilt would flatten a card the user had posed.
 */
export function kfPoseAt(
  box: Box | undefined, cfg: TimeCfg, localMs: number, channels: readonly KfChannel[],
): KfPose {
  const track = boxTrack(box, cfg);
  const at = evaluateKf(track, Math.round(num(localMs, 0)), channels);
  // The three channels whose unkeyed value is a FIELD on the box rather than the
  // neutral. A table, not a chain of `ch === '…'` tests, so a fourth one is a line.
  const fields: Partial<Record<KfChannel, string | undefined>> = {
    z: cfg.zField, rx: cfg.rxField, ry: cfg.ryField,
  };
  const out: KfPose = {};
  for (const ch of channels) {
    const v = at[ch];
    if (typeof v === 'number') { out[ch] = v; continue; }
    const field = fields[ch];
    out[ch] = field && box ? num(box[field], 0) : KF_NEUTRAL[ch];
  }
  return out;
}

/**
 * The channel set an edit of `box` writes: everything the track already animates,
 * plus everything this edit touches, plus - on a track that has none of either - the
 * seed (a camera's own channels, else {@link KF_POSE_SEED}).
 *
 * This is the "full pose over the box's active channel set" rule of section 8 spelled as
 * one function, so the button, the shortcut, the canvas gesture and the pose row all
 * write the SAME structure of keyframe. Order follows the engine's canonical channel
 * order, which is the order `serialiseKf` emits in anyway.
 */
export function kfActiveChannels(
  box: Box | undefined, cfg: TimeCfg, edited?: KfPose | null,
): KfChannel[] {
  const used = new Set<KfChannel>(kfChannelsUsed(boxTrack(box, cfg)));
  if (edited) for (const ch of Object.keys(edited) as KfChannel[]) used.add(ch);
  if (used.size === 0) {
    const seed = String(box?.kind ?? '') === 'camera' ? KF_CAMERA_CHANNELS : KF_POSE_SEED;
    for (const ch of seed) used.add(ch);
  }
  return KF_CHANNELS.filter((ch) => used.has(ch));
}

/** Replace / insert one key's whole pose, keeping the rest of the track. */
function upsertKey(track: KfTrack, atMs: number, pose: KfPose, ease?: string): KfKey[] {
  const t = Math.round(clamp(num(atMs, 0), 0, KF_MAX_TIME_MS));
  const out: KfKey[] = [];
  let done = false;
  for (const k of track) {
    if (k.t === t) { out.push({ t, ease: ease ?? k.ease, v: pose }); done = true; }
    else out.push(k);
  }
  // A new diamond inherits the ease of the segment it lands inside, so inserting one
  // mid-move does not change the form of the move it was inserted into. Before the
  // first key there is no segment to inherit from, hence the default.
  if (!done) {
    let inherited = KF_DEFAULT_EASE;
    for (const k of track) if (k.t < t) inherited = k.ease;
    out.push({ t, ease: ease ?? inherited, v: pose });
  }
  return out;
}

/**
 * WHERE a pose written at `tSec` actually lands, in the box's own local ms.
 *
 * Two rules, in this order:
 *
 *   • an EXISTING diamond is written where it is. The latch's whole claim is that the
 *     header names the keyframe a gesture will edit (section 8), so a track carrying a key
 *     past its clip's out-point - reachable by hand-editing a share URL, and by
 *     trimming a clip shorter afterwards - must still be posed at its own time rather
 *     than silently forked into a second key at the edge.
 *   • a NEW diamond lands INSIDE the clip, by the same clamp the drag path uses
 *     (`kfSlideMs`): "a keyframe past the out-point is unreachable without a trim, and
 *     a drag that silently parks one there looks exactly like a drag that did
 *     nothing". Before the in-point the same clamp reads 0.
 *
 * Exported because the announcement has to say where the keyframe LANDED, not where
 * the playhead was - the two differ exactly when the clamp bites.
 */
export function kfWriteMs(box: Box | undefined, cfg: TimeCfg, tSec: number): number {
  const local = kfLocalMs(box, cfg, tSec);
  if (kfKeyAt(boxTrack(box, cfg), local)) return local;
  return kfSlideMs(local, 0, boxTiming(box, cfg).dur);
}

/**
 * THE pose writer: add-or-update one full-pose keyframe on one box, at the playhead.
 *
 * `mode` is the whole difference between the two doors onto it:
 *   • `'add'` - `edit` is a DELTA (a canvas drag's dx/dy, a rotate's degrees). What
 *     the box is doing at this instant plus what the gesture just did. This is the
 *     only honest reading for a gesture, because the channels are relative offsets
 *     and the user dragged from wherever the box already was.
 *   • `'set'` - `edit` is the value itself (a pose field typed into the inspector).
 *
 * Returns the boxes array UNCHANGED (by identity) when the tool declares no `kf`
 * field, so a caller can fold this over a selection without checking first.
 */
export function writeKfPose(
  boxes: Box[], cfg: TimeCfg, id: string, tSec: number, edit: KfPose, mode: 'add' | 'set',
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const field = cfg.kfField;
  if (!field) return rows;
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows;
  const box = rows[i]!;
  const track = boxTrack(box, cfg);
  const localMs = kfWriteMs(box, cfg, tSec);
  const channels = kfActiveChannels(box, cfg, edit);
  const pose = kfPoseAt(box, cfg, localMs, channels);
  for (const ch of Object.keys(edit) as KfChannel[]) {
    const v = edit[ch];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    pose[ch] = mode === 'add' ? num(pose[ch], KF_NEUTRAL[ch]) + v : v;
  }
  const wire = serialiseKf(upsertKey(track, localMs, pose));
  // IDENTITY when nothing actually changed, and it has to be the ARRAY's identity, not
  // the box's: `rows.map` mints a new array even when every element comes back the
  // same, and the caller's "did this write anything?" test is `next === boxes`. Without
  // this, "+Keyframe" on a diamond already holding that exact pose would be a commit
  // and therefore an undo step - a ⌘Z that undoes nothing visible is worse than no
  // shortcut at all.
  if (String(box[field] ?? '') === wire) return rows;
  return rows.map((b, k) => (k === i ? withFields(b!, { [field]: wire }) : b));
}

/** Every keyframe gone, in one write. The destructive half of the Animate door (section 8). */
export function clearKfTrack(boxes: Box[], cfg: TimeCfg, id: string): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const field = cfg.kfField;
  if (!field) return rows;
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows;
  return rows.map((b, k) => (k === i ? withFields(b!, { [field]: '' }) : b));
}

/**
 * Where a diamond dragged by `deltaSec` lands: integer ms, never before the clip's
 * own start, never past its end.
 *
 * The tail clamp is the clip's LENGTH rather than the track's: a keyframe past the
 * out-point is unreachable without a trim, and a drag that silently parks one there
 * looks exactly like a drag that did nothing.
 */
export function kfSlideMs(fromMs: number, deltaSec: number, durSec: number | null): number {
  const hi = durSec != null && Number.isFinite(durSec) && durSec > 0
    ? Math.min(kfMs(durSec), KF_MAX_TIME_MS)
    : KF_MAX_TIME_MS;
  return Math.round(clamp(Math.round(num(fromMs, 0)) + kfMs(deltaSec), 0, hi));
}

/**
 * Move one keyframe from `fromMs` to `toMs`, pose and ease intact.
 *
 * Landing ON another diamond REPLACES it - the wire has no way to say "two poses at
 * one instant" (`normaliseTrack` keeps the last write at a given `t`), so the
 * alternative is an unreachable twin the user cannot see or delete.
 */
export function kfTrackRetime(track: KfTrack, fromMs: number, toMs: number): KfKey[] {
  const from = Math.round(num(fromMs, 0));
  const moved = kfKeyAt(track, from);
  if (!moved) return track.map((k) => k);
  const to = Math.round(clamp(num(toMs, 0), 0, KF_MAX_TIME_MS));
  if (to === from) return track.map((k) => k);
  return [...track.filter((k) => k.t !== from && k.t !== to), { t: to, ease: moved.ease, v: moved.v }];
}

/**
 * Stretch or compress a whole track along time so it spans `targetMs` instead of its
 * authored length - the camera presets (`KF_CAMERA_PRESETS`) are authored at fixed
 * absolute times (4–5.2 s), and applied to a scene of a different length they overran or
 * left the camera parked past the end (audit A1#5). A LINEAR scale maps the last key to
 * `targetMs` and every earlier key by the same factor, so mid-point ratios, the eases,
 * and every pose value are preserved - only the tempo changes. The first key stays at 0.
 *
 * A degenerate input (empty, a single key, a zero/negative natural end, or a non-finite
 * target) is returned unscaled - there is nothing to stretch, and the caller keeps the
 * authored track. Values are untouched; `serialiseKf` re-quantises the scaled times.
 */
export function rescaleKfTrack(track: KfTrack, targetMs: number): KfKey[] {
  const end = track.length ? track[track.length - 1]!.t : 0;
  if (end <= 0 || !Number.isFinite(targetMs) || targetMs <= 0) return track.map((k) => k);
  const scale = targetMs / end;
  return track.map((k) => ({ t: Math.round(k.t * scale), ease: k.ease, v: k.v }));
}

/**
 * Where a DUPLICATE of the keyframe at `atMs` lands when nobody dragged it there - 
 * the CRUD row's Duplicate button, which has no pointer position to read.
 *
 * Halfway to the next diamond, so the copy lands in the gap it was made for and
 * never on top of a keyframe it would replace; past the last one, half a second on,
 * clamped to the clip. A copy that landed exactly where the original sits would look
 * like a button that does nothing while quietly being an edit.
 */
export function kfDuplicateMs(track: KfTrack, atMs: number, durSec: number | null): number {
  const at = Math.round(num(atMs, 0));
  let next: number | null = null;
  for (const k of track) if (k.t > at && (next === null || k.t < next)) next = k.t;
  const want = next === null ? at + 500 : at + Math.round((next - at) / 2);
  const to = kfSlideMs(want, 0, durSec);
  // A gap of one millisecond has no halfway point; step off by one rather than
  // returning the original's own time (which would replace it with itself).
  return to === at ? kfSlideMs(at + 1, 0, durSec) : to;
}

/** Copy one keyframe to `toMs` (alt-drag, and the CRUD row's Duplicate). */
export function kfTrackDuplicate(track: KfTrack, fromMs: number, toMs: number): KfKey[] {
  const src = kfKeyAt(track, Math.round(num(fromMs, 0)));
  if (!src) return track.map((k) => k);
  const to = Math.round(clamp(num(toMs, 0), 0, KF_MAX_TIME_MS));
  return [...track.filter((k) => k.t !== to), { t: to, ease: src.ease, v: { ...src.v } }];
}

/** Drop one keyframe. */
export function kfTrackDelete(track: KfTrack, atMs: number): KfKey[] {
  const t = Math.round(num(atMs, 0));
  return track.filter((k) => k.t !== t).map((k) => k);
}

/**
 * Re-ease ONE keyframe - the segment that STARTS at it.
 *
 * `ease` arrives in the shared editor's vocabulary (a preset name or a CSS
 * `cubic-bezier(...)`, which is what `mountEasingEditor` commits) and goes through
 * the engine's own adapter, because the canonical wire uses commas and the kf
 * charset bans them (section 5.1). Junk normalises to the default rather than throwing.
 */
export function kfTrackSetEase(track: KfTrack, atMs: number, ease: unknown): KfKey[] {
  const t = Math.round(num(atMs, 0));
  const tok = kfEaseToken(ease);
  return track.map((k) => (k.t === t ? { t: k.t, ease: tok, v: k.v } : k));
}

/**
 * One write of a rebuilt track onto one box. The single funnel every CRUD row uses,
 * so a retime, a duplicate, a delete and an ease change are all one `serialiseKf`
 * and one field write - never a read-modify-write spread across the panel.
 */
export function setKfTrack(boxes: Box[], cfg: TimeCfg, id: string, keys: readonly KfKey[]): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const field = cfg.kfField;
  if (!field) return rows;
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows;
  return rows.map((b, k) => (k === i ? withFields(b!, { [field]: serialiseKf(keys) }) : b));
}

/**
 * The next diamond strictly after (`dir > 0`) or before (`dir < 0`) `fromSec`,
 * across every box in `ids` - Alt+←/→ (section 8). Null when there is none, which is what
 * makes the shortcut stop at the ends rather than wrapping into a surprise.
 */
export function kfSeekDiamond(
  boxes: Box[], cfg: TimeCfg, ids: readonly string[], fromSec: number, dir: number,
): number | null {
  const rows = Array.isArray(boxes) ? boxes : [];
  const from = num(fromSec, 0);
  let best: number | null = null;
  for (const id of ids) {
    const i = indexOfId(rows, cfg, id);
    if (i < 0) continue;
    for (const t of kfDiamondTimes(rows[i]!, cfg)) {
      if (dir > 0 ? t <= from : t >= from) continue;
      if (best === null || (dir > 0 ? t < best : t > best)) best = t;
    }
  }
  return best;
}

// ── the motion path (plans/104 section 8's overlay bullet, under section 6.5's projection rule) ─
//
// section 6.5 is the whole reason this is arithmetic and not a `<polyline>` drawn from the
// raw kf offsets: "ghosts + motion-path samples are computed as
// `pose(t) = kf-evaluate + projectLayer(cameraAt(t))` before `nativeToStage`". A path
// drawn flat would be a LIE the moment a camera exists - the parallax it promises is
// exactly what the export would not do. So every number below comes out of the engine
// (`evaluateKf` → `resolveCamera` → `projectLayer`), and the overlay module gets a
// list of native-px points to map through the same `nativeToStage` the selection
// outline uses, and nothing else.

/** One sampled position of a box's centre, in CANVAS-NATIVE px. */
export interface MotionPathPoint {
  /** TIMELINE ms - the instant this sample is the pose at. */
  t: number;
  /** Projected centre x, native px. */
  x: number;
  /** Projected centre y, native px. */
  y: number;
  /**
   * The engine's behind-camera ramp at this instant (`projectDepth().alphaGuard`).
   * 0 means the layer is not on screen at all there, so the overlay BREAKS the
   * polyline rather than drawing a straight line across the gap.
   */
  a: number;
}

/** A box's whole path: the polyline, plus one mark per keyframe inside the window. */
export interface MotionPathSamples {
  pts: MotionPathPoint[];
  keys: MotionPathPoint[];
}

/**
 * The sampling cadence, ms. ~30 Hz: fine enough that an `ev` overshoot reads as a
 * curve rather than a corner, coarse enough that a minute-long clip stays inside
 * {@link MOTION_PATH_MAX_SAMPLES}.
 */
export const MOTION_PATH_STEP_MS = 33;
/**
 * The ceiling on samples per box. A path is a picture of a move, not a plot: past a
 * couple of hundred points the extra vertices are sub-pixel and cost a repaint on
 * every pan. A long clip simply samples coarser.
 */
export const MOTION_PATH_MAX_SAMPLES = 240;
/**
 * Below this much travel (native px, either axis) there is no path to draw - an
 * opacity- or blur-only track would otherwise put a permanent dot on the canvas that
 * says nothing. Half a pixel, i.e. under the smallest visible move.
 */
export const MOTION_PATH_MIN_TRAVEL = 0.5;

const EMPTY_PATH: MotionPathSamples = Object.freeze({ pts: [], keys: [] }) as MotionPathSamples;

/**
 * The camera clips a MODEL carries (section 5.4) - the model-side twin of `stageCameras`
 * (bridge/sequence-plan.ts), which derives the identical list from parsed DOM layers.
 *
 * Two derivations rather than one shared function because the two sides hold
 * different things: the render path has already parsed the artboard into `SeqLayer`s
 * and must not re-query the DOM, while the editor has only the model and no artboard
 * for a camera at all (a camera has no canvas footprint, section 5.4). They agree by reading
 * the same fields in the same order and handing the ENGINE the same shape - which is
 * what `tests/timeline-math.test.ts` pins against `stageCameras`'s own output.
 *
 * Windows are butted and half-open, latest-in-array wins (cuts, not blends), and an
 * untimed camera - the implicit scene camera's "Always on" chip - has no end at all.
 * `base` carries the camera's own `z` FIELD as the scene-default dolly, exactly as
 * `stageCameras` does; every other channel comes from the track, where a `t0` key IS
 * the scene default because evaluation clamp-holds before the first key.
 */
export function kfCameraClips(boxes: Box[], cfg: TimeCfg): KfCameraClip[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const out: KfCameraClip[] = [];
  for (const b of rows) {
    if (!b || String(b.kind ?? '') !== 'camera') continue;
    const timing = boxTiming(b, cfg);
    const startMs = Math.round((timing.start ?? 0) * 1000);
    const track = boxTrack(b, cfg);
    const z = cfg.zField ? num(b[cfg.zField], 0) : 0;
    out.push({
      start: startMs,
      end: timing.dur === null ? null : startMs + Math.round(timing.dur * 1000),
      base: z !== 0 ? { z } : null,
      track: track.length > 0 ? track : null,
    });
  }
  return out;
}

/** What {@link kfMotionPath} needs to know about the world the box moves through. */
export interface MotionPathEnv {
  /** Stage-native width, px. The projection's principal point is the stage centre. */
  stageW: number;
  /** Stage-native height, px. */
  stageH: number;
  /**
   * The camera clips to project through - {@link kfCameraClips}, resolved ONCE for a
   * whole paint rather than per box. Absent/empty means the DEFAULT camera, which
   * projects a z = 0 layer at eff = 1, i.e. exactly nothing.
   */
  cameras?: readonly KfCameraClip[] | null;
  /**
   * The sequence's derived length, ms ({@link deriveDuration}) - the window of an
   * UNTIMED animated box, which has no duration of its own but is on screen for the
   * whole run.
   */
  totalMs?: number;
}

/**
 * One box's projected motion path, in CANVAS-NATIVE px.
 *
 * The window is the box's own: `[start, start + dur]` for a timed clip, `[0, total]`
 * for an untimed one. Keys authored PAST the out-point (reachable by hand-editing a
 * share URL, or by trimming a clip shorter afterwards - M2 decided they stay posed
 * where authored) are outside the window and so get no mark: the path draws what the
 * clip will actually play, and a mark on a diamond the playhead can never reach would
 * point at nothing.
 *
 * Returns an EMPTY path - no points at all - in three cases, each of them "there is
 * no move here to draw":
 *   • the tool declares no `kf` field, or this box has no track;
 *   • the track holds fewer than two keys (one key is a pose, not a move);
 *   • every sample lands within {@link MOTION_PATH_MIN_TRAVEL} of every other, i.e.
 *     the track animates opacity/blur/size and the box never goes anywhere.
 */
export function kfMotionPath(
  boxes: Box[], cfg: TimeCfg, id: string,
  centre: { x: number; y: number },
  env: MotionPathEnv,
): MotionPathSamples {
  const rows = Array.isArray(boxes) ? boxes : [];
  if (!cfg.kfField) return EMPTY_PATH;
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return EMPTY_PATH;
  const box = rows[i]!;
  const track = boxTrack(box, cfg);
  if (track.length < 2) return EMPTY_PATH;

  const timing = boxTiming(box, cfg);
  const startMs = (timing.start ?? 0) * 1000;
  const winMs = timing.dur !== null
    ? timing.dur * 1000
    : Math.max(num(env.totalMs, 0), track[track.length - 1]!.t);
  if (!(winMs > 0)) return EMPTY_PATH;

  const bx = num(centre.x, 0);
  const by = num(centre.y, 0);
  const baseZ = cfg.zField ? num(box[cfg.zField], 0) : 0;
  const cams = env.cameras ?? null;
  const view = { w: num(env.stageW, 0), h: num(env.stageH, 0) };

  /** The section 4.1 fold at one TIMELINE instant - the ONLY place this file makes a point. */
  const at = (tMs: number): MotionPathPoint => {
    const cam = resolveCamera(cams, tMs);
    const pose = evaluateKf(track, tMs - startMs);
    const z = typeof pose.z === 'number' ? pose.z : baseZ;
    const p = projectLayer(
      { ...cam, w: view.w, h: view.h } as KfCameraView,
      { bx, by, dxK: pose.x ?? 0, dyK: pose.y ?? 0, z },
    );
    return { t: tMs, x: bx + p.dx, y: by + p.dy, a: p.alphaGuard };
  };

  const n = clamp(Math.round(winMs / MOTION_PATH_STEP_MS) + 1, 2, MOTION_PATH_MAX_SAMPLES);
  const pts: MotionPathPoint[] = [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let k = 0; k < n; k++) {
    // From the ENDS inwards (`k/(n-1)`), never by accumulating a step: the last sample
    // must land exactly on the out-point or a path that ends on a keyframe would stop
    // a pixel short of its own final diamond.
    const p = at(startMs + (winMs * k) / (n - 1));
    pts.push(p);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (maxX - minX < MOTION_PATH_MIN_TRAVEL && maxY - minY < MOTION_PATH_MIN_TRAVEL) return EMPTY_PATH;

  const keys: MotionPathPoint[] = [];
  for (const k of track) {
    if (k.t < 0 || k.t > winMs) continue;
    keys.push(at(startMs + k.t));
  }
  return { pts, keys };
}

/**
 * The media safety net, shared by every writer that can move an in-point, a length
 * or a rate: each field independently in range, the in-point inside the file, and - 
 * once everything is on the millisecond grid - the out-point inside the file too.
 *
 * Extracted so `trimClip`, `setClipIn` and `setSpeed` cannot drift: the invariant
 * `clipIn + dur * speed <= media` is unrecoverable when violated (the player seeks
 * past the source duration and the bar plays nothing), so exactly one function is
 * allowed to decide what it means.
 *
 * Ordering is deliberate: snap to the grid BEFORE the final room check, because
 * these are the numbers that actually get STORED - checking un-rounded values and
 * rounding afterwards lets a half-millisecond (x speed) overrun back in. clipIn is
 * floored, which can only move the in-point earlier, i.e. always inside the file.
 */
function fitToMedia(
  start: number, dur: number, clipIn: number, speed: number, media: number | null,
): { start: number; dur: number; clipIn: number } {
  let s = clamp(num(start, 0), 0, MAX_TIME_S);
  let c = clamp(num(clipIn, 0), 0, MAX_TIME_S);
  let d = clamp(num(dur, MIN_DUR), MIN_DUR, MAX_TIME_S);
  // Clamping `dur` alone cannot express "clipIn is past the end".
  if (media != null) c = Math.min(c, Math.max(0, media - MIN_DUR * speed));
  s = r3(s);
  c = Math.floor(c * 1000) / 1000;
  d = r3(d);
  if (media != null) {
    // Room left in the file, floored to the grid. The MIN_DUR floor wins when the media
    // is shorter than one minimum-length clip at this speed (a 0.15 s file at 4x cannot
    // fill 0.1 s of timeline) - the clip stays legal and the player simply runs out.
    const room = Math.floor(((media - c) / speed) * 1000) / 1000;
    if (d > room) d = clamp(room, MIN_DUR, MAX_TIME_S);
  }
  return { start: s, dur: d, clipIn: c };
}

/**
 * Lay the given seq order out gapless from 0 (`order` = row indices in play order).
 * A clip with no duration takes its media length when the caller knows it, else
 * DEFAULT_CLIP_S - packing NEVER leaves a null dur on the seq row.
 */
function packOrder(boxes: Box[], cfg: TimeCfg, order: number[], mediaDur?: MediaDurFn): Box[] {
  const starts = new Map<number, number>();
  const durs = new Map<number, number>();
  let cursor = 0;
  for (const i of order) {
    const b = boxes[i];
    if (!b) continue;
    const t = boxTiming(b, cfg);
    let d = t.dur;
    if (d === null) {
      const m = mediaDur?.(b, i);
      d = typeof m === 'number' && Number.isFinite(m) && m > 0 ? clamp(m, MIN_DUR, MAX_TIME_S) : DEFAULT_CLIP_S;
    }
    // ONE rounding grid. The cursor advances by the duration we actually STORE, not
    // by the unrounded one: accumulating `d` while storing r3(d) makes start[i] and
    // start[i-1] + dur[i-1] disagree by up to a millisecond per adjacency, which is a
    // visible gap/overlap on a row whose whole contract is "gapless".
    // The ceiling truncates the last clip instead of letting the cursor saturate and
    // stack every remaining clip at MAX_TIME_S with its full duration.
    const room = MAX_TIME_S - cursor;
    const dr = clamp(r3(Math.min(d, room)), MIN_DUR, MAX_TIME_S);
    starts.set(i, cursor);
    durs.set(i, dr);
    cursor = clamp(r3(cursor + dr), 0, MAX_TIME_S);
  }
  return boxes.map((b, i) => {
    if (!b || !starts.has(i)) return b;
    return withFields(b, { [cfg.startField]: starts.get(i)!, [cfg.durField]: durs.get(i)! });
  });
}

/** Make the seq row gapless from 0. Returns a NEW array; untouched rows keep identity. */
export function packSeq(boxes: Box[], cfg: TimeCfg, mediaDur?: MediaDurFn): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  return packOrder(rows, cfg, seqIndices(rows, cfg), mediaDur);
}

/**
 * Shift overlays that were anchored inside a seq clip's OLD span so they stay with
 * that clip. v1 rule: an overlay whose start fell inside [start, end) of a seq clip
 * in `before` moves by that clip's start delta in `after`. HALF-OPEN - an overlay
 * sitting exactly on a clip's old END belongs to the NEXT clip, not this one.
 *
 * Applied inside moveSeqClip / removeAndRipple / trimClip; callers never call it
 * directly (calling it with a `before` that is not the pre-mutation array would
 * double-apply the shift).
 */
export function rippleOverlays(before: Box[], after: Box[], cfg: TimeCfg): Box[] {
  const prev = Array.isArray(before) ? before : [];
  const next = Array.isArray(after) ? after : [];
  // Old spans, in play order, of every seq clip that has a resolvable extent.
  const spans: { id: string; start: number; end: number }[] = [];
  for (const i of seqIndices(prev, cfg)) {
    const b = prev[i]!;
    const t = boxTiming(b, cfg);
    const id = b[cfg.idField];
    if (id == null || id === '' || t.dur === null) continue;
    spans.push({ id: String(id), start: t.start ?? 0, end: (t.start ?? 0) + t.dur });
  }
  if (!spans.length) return next.map((b) => b);
  // Where those clips ended up.
  const moved = new Map<string, number>();
  for (const i of seqIndices(next, cfg)) {
    const b = next[i]!;
    const id = b[cfg.idField];
    if (id == null || id === '') continue;
    moved.set(String(id), boxTiming(b, cfg).start ?? 0);
  }
  return next.map((b) => {
    if (!b) return b;
    const t = boxTiming(b, cfg);
    if (t.lane === 'seq' || t.start === null) return b;   // seq clips and scenery are not overlays
    const span = spans.find((s) => t.start! >= s.start && t.start! < s.end);
    if (!span) return b;
    const now = moved.get(span.id);
    if (now == null) return b;                             // its anchor clip is gone - stay put
    const delta = now - span.start;
    if (!Number.isFinite(delta) || delta === 0) return b;
    return withFields(b, { [cfg.startField]: clamp(r3(t.start + delta), 0, MAX_TIME_S) });
  });
}

/**
 * Reorder a seq clip to `newIndex` within the seq row (a drag on the magnetic row),
 * then repack and ripple the overlays. Array order (z-order) is untouched - order on
 * the seq row is expressed purely through `start`.
 */
export function moveSeqClip(boxes: Box[], cfg: TimeCfg, id: string, newIndex: number, mediaDur?: MediaDurFn): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const order = seqIndices(rows, cfg);
  const target = indexOfId(rows, cfg, id);
  const from = order.indexOf(target);
  if (target < 0 || from < 0) return rows.map((b) => b);
  const to = clamp(Math.round(num(newIndex, 0)), 0, order.length - 1);
  const next = order.slice();
  next.splice(from, 1);
  next.splice(to, 0, target);
  return rippleOverlays(rows, packOrder(rows, cfg, next, mediaDur), cfg);
}

/**
 * Where a seq clip dragged to `tSec` would land in the row order: past a clip's MIDPOINT
 * means past that clip. The dragged clip does not displace itself, so crossing its own
 * midpoint is not a move.
 *
 * Editing arithmetic, so it lives here with moveSeqClip rather than inline in the drag
 * handler that previews it. The preview and the commit read the same index by construction.
 */
export function dropIndexAt(boxes: Box[], cfg: TimeCfg, tSec: number, draggedId: string): number {
  const order = seqBoxes(Array.isArray(boxes) ? boxes : [], cfg);
  if (!order.length) return 0;
  const at = num(tSec, 0);
  // COUNT the other clips the pointer is now past, rather than reading off a row
  // position: moveSeqClip splices the dragged clip out BEFORE inserting it, so the
  // target index is measured against the row without it. Reading `i + 1` off the
  // current row instead overshoots by one for every rightward drag.
  let idx = 0;
  for (const b of order) {
    if (String(b?.[cfg.idField] ?? '') === String(draggedId)) continue;
    const t = boxTiming(b, cfg);
    if (at >= (t.start ?? 0) + (t.dur ?? 0) / 2) idx++;
  }
  return clamp(idx, 0, order.length - 1);
}

/**
 * Move an OVERLAY (non-magnetic) box to an absolute start time - the plain drag on any
 * lane that is not the seq row. No repack and no ripple: an overlay's start is authored
 * directly, and nothing is anchored to it.
 *
 * This exists so the panel's drag does not hand-roll the clamp and the ms rounding: the
 * inspector's Start field and a pointer drag MUST land on the same value for the same
 * time, and they did not while the drag rounded inline and skipped MAX_TIME_S entirely.
 *
 * A seq-lane box is returned unchanged - its start is derived by the pack, so writing
 * one directly would be overwritten on the next repack (use moveSeqClip instead).
 */
/**
 * Where a vertically-dragged overlay bar was dropped (plans/165 Slice C-tracks).
 * `onto` = dropped ON another overlay's row: the two share that row (the caption
 * rows' own group mechanism) and the moved box stacks directly in front of it.
 * `before` = dropped BETWEEN rows: the box takes its own row directly behind the
 * named overlay (null = in FRONT of every overlay - the new top row), leaving
 * any shared row it was on.
 */
export type LaneDrop = { onto: string } | { before: string | null };

/** An overlay ROW member: timed, and not on the magnetic seq row. */
function isOverlayRow(b: Box | undefined, cfg: TimeCfg): boolean {
  if (!b || !isTimed(b, cfg)) return false;
  return boxTiming(b, cfg).lane !== 'seq';
}

/**
 * Restack an overlay against another - the timeline's vertical drag, writing the
 * SAME order the canvas paints (array order IS z), plus the row-sharing group
 * when the tool declares one. Sharing degrades to plain adjacency on a tool
 * without `groupField` (progressive, like linkField). Seq boxes are never moved
 * relative to each other and a seq target is refused outright: the magnetic row
 * is joined deliberately, never by a stray vertical wobble. Identity when
 * nothing would change, so a no-op drag costs no commit and no undo step.
 */
export function restackOverlay(boxes: Box[], cfg: TimeCfg, id: string, drop: LaneDrop): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows;
  const box = rows[i]!;
  if (!isOverlayRow(box, cfg)) return rows;
  const gf = cfg.groupField ?? '';

  const targetId = 'onto' in drop ? drop.onto : drop.before;
  const ti = targetId == null ? -1 : indexOfId(rows, cfg, targetId);
  if (targetId != null && (ti < 0 || ti === i)) return rows;
  if (targetId != null && !isOverlayRow(rows[ti], cfg)) return rows;

  let moved = box;
  let target = ti >= 0 ? rows[ti]! : null;
  if ('onto' in drop) {
    if (gf) {
      const tGroup = String(target![gf] ?? '') || `share-${String(targetId)}`;
      if (String(target![gf] ?? '') !== tGroup) target = withFields(target!, { [gf]: tGroup });
      if (String(moved[gf] ?? '') !== tGroup) moved = withFields(moved, { [gf]: tGroup });
    }
  } else if (gf && String(box[gf] ?? '') !== '') {
    moved = withFields(moved, { [gf]: '' });
  }

  const without: Box[] = [];
  for (let k = 0; k < rows.length; k++) {
    if (k === i) continue;
    without.push(k === ti && target ? target : rows[k]!);
  }
  let insertAt: number;
  if ('onto' in drop) {
    insertAt = indexOfId(without, cfg, String(targetId)) + 1;   // directly in front of the row anchor
  } else if (drop.before != null) {
    insertAt = indexOfId(without, cfg, drop.before);            // directly behind it
  } else {
    let last = -1;
    for (let k = 0; k < without.length; k++) if (isOverlayRow(without[k], cfg)) last = k;
    insertAt = last + 1;                                        // in front of every overlay
  }
  const next = [...without.slice(0, insertAt), moved, ...without.slice(insertAt)];
  // Identity when the drag changed nothing - same order, same rows.
  if (next.length === rows.length && next.every((b, k) => b === rows[k])) return rows;
  return next;
}

export function moveOverlay(boxes: Box[], cfg: TimeCfg, id: string, atSec: number): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows.map((b) => b);
  if (boxTiming(rows[i], cfg).lane === 'seq') return rows.map((b) => b);
  const at = clamp(r3(num(atSec, 0)), 0, MAX_TIME_S);
  return rows.map((b, k) => (k === i ? withFields(b!, { [cfg.startField]: at }) : b));
}

/**
 * Shift EVERY selected OVERLAY box by the same `deltaSec` (a marquee/multi drag on the
 * overlay lanes). Relative offsets are preserved: the group's delta is clamped once so
 * the EARLIEST moved box's start stays >= 0, rather than each box clamping independently
 * (which would crush the shape against the left wall). Seq-lane and untimed members in
 * `ids` are ignored - a seq clip's start is pack-derived, so it moves via {@link moveSeqClips}.
 * Identity per box when nothing changes, so a no-op group drag costs no undo step.
 */
export function moveOverlays(boxes: Box[], cfg: TimeCfg, ids: readonly string[], deltaSec: number): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const set = new Set(Array.from(ids, String));
  const moving = rows.filter((b) => set.has(String(b?.[cfg.idField] ?? '')) && isOverlayRow(b, cfg));
  if (!moving.length) return rows.map((b) => b);
  let minStart = Number.POSITIVE_INFINITY;
  for (const b of moving) minStart = Math.min(minStart, boxTiming(b, cfg).start ?? 0);
  const eff = Math.max(num(deltaSec, 0), -minStart);   // never push the earliest below 0
  if (eff === 0) return rows.map((b) => b);
  return rows.map((b) => {
    if (!set.has(String(b?.[cfg.idField] ?? '')) || !isOverlayRow(b, cfg)) return b;
    const t = boxTiming(b, cfg);
    return withFields(b!, { [cfg.startField]: clamp(r3((t.start ?? 0) + eff), 0, MAX_TIME_S) });
  });
}

/**
 * Deal the selected OVERLAY boxes a uniform start-to-start gap (plans/175 WP-C -
 * Jitter's right-click Stagger, "a uniform duration of time between the start of
 * each animation"): sorted by their CURRENT starts (row order breaks ties), the
 * earliest keeps its start as the anchor and each later one begins `gapSec` after
 * the one before it. The user's own ordering is respected, only the spacing is
 * dealt - a re-rank would undo whatever they staged by dragging. Seq-lane and
 * untimed members in `ids` are ignored, exactly as {@link moveOverlays} ignores
 * them (a seq clip's start is pack-derived). Fewer than two eligible boxes is a
 * no-op, and identity is preserved per unchanged box so a dealt board that
 * already matches costs no undo step.
 */
export function staggerOverlays(boxes: Box[], cfg: TimeCfg, ids: readonly string[], gapSec: number): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const set = new Set(Array.from(ids, String));
  const eligible = rows
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => set.has(String(b?.[cfg.idField] ?? '')) && isOverlayRow(b, cfg));
  if (eligible.length < 2) return rows.map((b) => b);
  const gap = clamp(r3(num(gapSec, 0)), 0, MAX_TIME_S);
  const dealt = [...eligible].sort((a, z) =>
    (boxTiming(a.b, cfg).start ?? 0) - (boxTiming(z.b, cfg).start ?? 0) || a.i - z.i);
  const base = boxTiming(dealt[0]!.b, cfg).start ?? 0;
  const starts = new Map<number, number>();
  dealt.forEach(({ i }, rank) => starts.set(i, clamp(r3(base + rank * gap), 0, MAX_TIME_S)));
  return rows.map((b, i) => {
    const at = starts.get(i);
    if (at == null || (boxTiming(b, cfg).start ?? 0) === at) return b;
    return withFields(b!, { [cfg.startField]: at });
  });
}

/**
 * Where a GROUP of dragged seq clips would insert in the row order - {@link dropIndexAt}
 * generalised to skip EVERY moving id, not just one. The result indexes the row WITHOUT
 * the moving clips (the range is [0, remainder length]), which is exactly what
 * {@link moveSeqClips} re-inserts against. Preview and commit read the same index.
 */
export function groupDropIndex(boxes: Box[], cfg: TimeCfg, tSec: number, movingIds: readonly string[]): number {
  const order = seqBoxes(Array.isArray(boxes) ? boxes : [], cfg);
  const set = new Set(Array.from(movingIds, String));
  const at = num(tSec, 0);
  let idx = 0;
  let movingCount = 0;
  for (const b of order) {
    if (set.has(String(b?.[cfg.idField] ?? ''))) { movingCount++; continue; }
    const t = boxTiming(b, cfg);
    if (at >= (t.start ?? 0) + (t.dur ?? 0) / 2) idx++;
  }
  return clamp(idx, 0, order.length - movingCount);
}

/**
 * Move SEVERAL seq clips to `newIndex` as one contiguous block, preserving their internal
 * order, then repack + ripple - the magnetic-row multi-drag. A non-contiguous selection
 * is gathered into a block at the drop point (standard NLE behaviour). `newIndex` is
 * measured against the row WITHOUT the moving clips ({@link groupDropIndex}), range
 * [0, remainder length]. Fewer than two moving seq clips defers to the single-clip
 * {@link moveSeqClip} (or is a no-op), so callers can route every seq multi-drag here.
 */
export function moveSeqClips(boxes: Box[], cfg: TimeCfg, ids: readonly string[], newIndex: number, mediaDur?: MediaDurFn): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const order = seqIndices(rows, cfg);   // row indices, in seq order
  const set = new Set(Array.from(ids, String));
  const moving = order.filter((idx) => set.has(String(rows[idx]?.[cfg.idField] ?? '')));
  if (moving.length < 2) {
    if (moving.length === 1) return moveSeqClip(rows, cfg, String(rows[moving[0]!]?.[cfg.idField] ?? ''), newIndex, mediaDur);
    return rows.map((b) => b);
  }
  const remainder = order.filter((idx) => !set.has(String(rows[idx]?.[cfg.idField] ?? '')));
  const to = clamp(Math.round(num(newIndex, 0)), 0, remainder.length);
  const nextOrder = [...remainder.slice(0, to), ...moving, ...remainder.slice(to)];
  return rippleOverlays(rows, packOrder(rows, cfg, nextOrder, mediaDur), cfg);
}

/**
 * Delete a box. Removing a seq clip closes the gap (repack) and ripples the overlays
 * that were anchored to the clips that moved; overlays anchored inside the DELETED
 * clip's span stay where they are (their anchor no longer exists).
 */
export function removeAndRipple(boxes: Box[], cfg: TimeCfg, id: string, mediaDur?: MediaDurFn): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows.map((b) => b);
  const wasSeq = boxTiming(rows[i], cfg).lane === 'seq';
  const culled = rows.filter((_, k) => k !== i);
  if (!wasSeq) return culled;
  return rippleOverlays(rows, packSeq(culled, cfg, mediaDur), cfg);
}

/**
 * Trim one edge of a clip by `deltaSec` (positive = drag right, later in time).
 *
 *   edge 'in' - start += d; dur -= d; clipIn += d * speed  (the media's out point is
 *                invariant under a trim-in, which is exactly why clipIn moves by
 *                d * speed rather than d).
 *   edge 'out' - dur += d.
 *
 * Clamps: clipIn >= 0, start >= 0, dur >= MIN_DUR, and - when the media length is
 * known - clipIn + dur * speed <= mediaDurSec (you cannot trim past the end of the
 * file). On the seq lane the row is repacked afterwards so it stays gapless, and the
 * overlays anchored to the clips that moved ripple with them.
 *
 * A trim of the IN edge also rebases the box's keyframe track by the clamped delta
 * (section 5.6): the head of the clip's own local timeline is what a trim-in removes, so the
 * animation has to travel with it. The OUT edge never does - see {@link kfTrackAfter}.
 */
export function trimClip(
  boxes: Box[],
  cfg: TimeCfg,
  id: string,
  edge: 'in' | 'out',
  deltaSec: number,
  mediaDurSec: number | null,
  mediaDur?: MediaDurFn,
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows.map((b) => b);
  const box = rows[i]!;
  const t = boxTiming(box, cfg);
  const order = seqIndices(rows, cfg);
  const media = typeof mediaDurSec === 'number' && Number.isFinite(mediaDurSec) && mediaDurSec > 0 ? mediaDurSec : null;
  const speed = t.speed;
  const start0 = t.start ?? 0;
  // An open-ended clip still has to trim against something concrete.
  const dur0 = t.dur ?? (media != null ? clamp(media / speed, MIN_DUR, MAX_TIME_S) : DEFAULT_CLIP_S);
  const clipIn0 = t.clipIn;
  const d = num(deltaSec, 0);

  let start = start0;
  let dur = dur0;
  let clipIn = clipIn0;
  // How much of the clip's own local timeline the head lost (seconds) - 0 on an out
  // trim, which cannot move local t = 0 and therefore never rebases keyframes.
  let head = 0;

  if (edge === 'in') {
    // Delta window: can't push past MIN_DUR on the right, can't pull the source's
    // in-point below 0 or the clip before t=0 on the left.
    // The right-hand stop is the smaller of "leave MIN_DUR on the timeline" and - when
    // the media length is known - "leave MIN_DUR of FILE past the new in-point". Without
    // the second term a clip that already overhangs its media (or a big drag on a short
    // file) walks clipIn past the end of the file, and the safety net below can only
    // shrink `dur`, so the violation is unrecoverable: the player then seeks past
    // duration and the bar plays nothing.
    const hiTimeline = dur0 - MIN_DUR;
    const hiMedia = media != null ? (media - clipIn0) / speed - MIN_DUR : Number.POSITIVE_INFINITY;
    const hi = Math.min(hiTimeline, hiMedia);
    // "Can't pull the clip before t=0" is only a real constraint on an OVERLAY, whose
    // start is its own. On the magnetic row `start` is re-derived by packOrder at the
    // bottom of this function, so the term constrains nothing there - except at index
    // 0, where start0 === 0 pinned the bound at 0 and made the first clip's in-point the
    // one head trim in the sequence you could never put back.
    const lo = t.lane === 'seq'
      ? -clipIn0 / speed
      : Math.max(-clipIn0 / speed, -start0);
    const dd = clamp(d, Math.min(lo, hi), Math.max(lo, hi));
    start = start0 + dd;
    dur = dur0 - dd;
    clipIn = clipIn0 + dd * speed;
    // The CLAMPED delta is the one the keyframes move by: whatever the pointer asked
    // for, the head only travelled this far. (fitToMedia below can still pull `clipIn`
    // back on a clip that already overhung its own file - a broken state a trim is
    // repairing - and only there do the two disagree, by that repair.)
    head = dd;
  } else {
    const hi = media != null ? Math.max(MIN_DUR, (media - clipIn0) / speed) : MAX_TIME_S;
    dur = clamp(dur0 + d, Math.min(MIN_DUR, hi), hi);
  }

  // Final safety net - the shared one, so a trim, a Trim-in edit and a speed change
  // all land on identical numbers for identical inputs.
  ({ start, dur, clipIn } = fitToMedia(start, dur, clipIn, speed, media));

  const patch: Record<string, Box[string]> = {
    [cfg.startField]: start, [cfg.durField]: dur, [cfg.clipInField]: clipIn,
  };
  // A head trim moves the clip's own t = 0, so its keyframes travel with it (section 5.6).
  // Nothing is written when the box has no track - a document that uses no keyframes
  // must come out of a trim byte-identical to the way it went in.
  const headMs = kfMs(head);
  if (cfg.kfField && headMs !== 0) {
    const track = boxTrack(box, cfg);
    if (track.length) patch[cfg.kfField] = serialiseKf(kfTrackAfter(track, headMs));
  }

  const patched = rows.map((b, k) => (k === i ? withFields(b!, patch) : b));
  if (t.lane !== 'seq') return patched;
  // Repack against the PRE-trim order: a trim-in moves `start` later, which must not
  // be allowed to reshuffle the magnetic row under the user's pointer. Both edges
  // ripple - trimming either edge of a seq clip shifts every later clip, and an
  // overlay anchored to one of those has to travel with it.
  return rippleOverlays(rows, packOrder(patched, cfg, order, mediaDur), cfg);
}

/**
 * Trim the SAME edge of several clips by the SAME `deltaSec` - a drag on one edge of a
 * multi-selection, or a keyboard nudge with several clips selected. Each clip clamps
 * against its OWN source (`mediaDurOf(id)`) and the MIN_DUR floor, so a clip that runs
 * out of file stops where it must while the others keep going - Premiere's and
 * Resolve's "trim selected edges" rule, and the only one that never invents source.
 *
 * Applied one clip at a time through {@link trimClip}, in row order, so every clamp,
 * the keyframe rebase and the magnetic repack are the single-clip ones: a seq clip's
 * trim ripples the row after each step and an overlay anchored to a moved clip travels
 * with it, exactly as it would have if the user had trimmed the clips one by one. Ids
 * that name no timed row (scenery, an unknown id) are skipped; a single eligible id is
 * simply `trimClip`, so callers can route every trim here.
 */
export function trimClips(
  boxes: Box[],
  cfg: TimeCfg,
  ids: readonly string[],
  edge: 'in' | 'out',
  deltaSec: number,
  mediaDurOf: (id: string) => number | null | undefined,
  mediaDur?: MediaDurFn,
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const set = new Set(Array.from(ids, String));
  const targets: string[] = [];
  for (const b of rows) {
    const id = String(b?.[cfg.idField] ?? '');
    if (id && set.has(id) && isTimed(b, cfg)) targets.push(id);
  }
  if (!targets.length) return rows.map((b) => b);
  let out = rows;
  for (const id of targets) out = trimClip(out, cfg, id, edge, deltaSec, mediaDurOf(id) ?? null, mediaDur);
  return out;
}

/**
 * Set a clip's in-point (Trim in) or its playback rate, holding the media invariant.
 *
 * These exist because the two inspector fields USED to write raw values straight
 * through `patchBox`, which bypassed every clamp `trimClip` exists to hold: setting
 * Trim in to 3.9 s on a 4 s clip, or the rate to x4 on a 4 s clip cut to 4 s, both
 * put the out-point past the end of the file with `dur` never compensated. Same
 * safety net as a trim, same rounding, same repack - one shared helper decides.
 *
 * An OPEN-ENDED clip (no authored dur) keeps its open end: only the field the user
 * touched is written, so "runs to the end of the sequence" is not silently
 * materialised into a fixed length by editing the trim point.
 */
function fitAndPatch(
  boxes: Box[], cfg: TimeCfg, id: string,
  next: { clipIn?: number; speed?: number; dur?: number },
  mediaDurSec: number | null, mediaDur?: MediaDurFn,
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return rows.map((b) => b);
  const box = rows[i]!;
  const t = boxTiming(box, cfg);
  const order = seqIndices(rows, cfg);
  const media = typeof mediaDurSec === 'number' && Number.isFinite(mediaDurSec) && mediaDurSec > 0 ? mediaDurSec : null;
  const speed = next.speed != null ? clamp(f2(num(next.speed, t.speed)), MIN_SPEED, MAX_SPEED) : t.speed;
  const clipIn = next.clipIn != null ? Math.max(0, num(next.clipIn, t.clipIn)) : t.clipIn;
  const dur0 = next.dur != null
    ? clamp(num(next.dur, MIN_DUR), MIN_DUR, MAX_TIME_S)
    : t.dur ?? (media != null ? clamp(media / speed, MIN_DUR, MAX_TIME_S) : DEFAULT_CLIP_S);
  const fit = fitToMedia(t.start ?? 0, dur0, clipIn, speed, media);

  const patch: Record<string, number | string> = {};
  if (next.dur != null) patch[cfg.durField] = fit.dur;
  if (next.clipIn != null) patch[cfg.clipInField] = fit.clipIn;
  else if (fit.clipIn !== t.clipIn) patch[cfg.clipInField] = fit.clipIn;
  if (next.speed != null) patch[cfg.speedField] = speed;
  // Only compensate a length the user actually authored - never invent one.
  if (t.dur != null && fit.dur !== t.dur) patch[cfg.durField] = fit.dur;

  const patched = rows.map((b, k) => (k === i ? withFields(b!, patch) : b));
  if (t.lane !== 'seq') return patched;
  return rippleOverlays(rows, packOrder(patched, cfg, order, mediaDur), cfg);
}

/**
 * Set a clip's on-timeline length ABSOLUTELY, seconds.
 *
 * Absolute rather than a delta on purpose: the inspector's Length field cannot know
 * what basis `trimClip` would pick for an OPEN-ENDED clip (it falls back to the media
 * length, else DEFAULT_CLIP_S), so seeding the field from the visible span and
 * committing `typed - visible` produced a length that was neither. Typing 5 now
 * yields 5 s, clamped against the media exactly like a trim of the out edge.
 *
 * Like that out-edge trim, no keyframe rebase: local t = 0 does not move, and the
 * track's clamp-hold past its last key covers whatever length the clip ends up with.
 */
export function setDuration(
  boxes: Box[], cfg: TimeCfg, id: string, durSec: number,
  mediaDurSec: number | null, mediaDur?: MediaDurFn,
): Box[] {
  return fitAndPatch(boxes, cfg, id, { dur: clamp(num(durSec, MIN_DUR), MIN_DUR, MAX_TIME_S) }, mediaDurSec, mediaDur);
}

/** Set the clip's in-point into its source, seconds. Clamped against the media. */
export function setClipIn(
  boxes: Box[], cfg: TimeCfg, id: string, valueSec: number,
  mediaDurSec: number | null, mediaDur?: MediaDurFn,
): Box[] {
  return fitAndPatch(boxes, cfg, id, { clipIn: clamp(num(valueSec, 0), 0, MAX_TIME_S) }, mediaDurSec, mediaDur);
}

/**
 * Set the clip's playback rate. Clamped to [MIN_SPEED, MAX_SPEED] and to the media.
 *
 * Deliberately NO keyframe rebase (section 5.6): `speed` remaps the MEDIA inside a clip - 
 * which frame of the file plays when - while a keyframe track is authored in the
 * clip's own local timeline, whose length `dur` already states. Halving the rate makes
 * the video play slower; the box's animation is unchanged, because nothing about the
 * clip's position on the timeline moved.
 */
export function setSpeed(
  boxes: Box[], cfg: TimeCfg, id: string, speedRaw: number,
  mediaDurSec: number | null, mediaDur?: MediaDurFn,
): Box[] {
  return fitAndPatch(boxes, cfg, id, { speed: speedRaw }, mediaDurSec, mediaDur);
}

/**
 * Split a clip at `tSec` (absolute timeline seconds). Returns null - no split - when
 * t is not strictly inside (start + MIN_DUR, end - MIN_DUR), so a split can never
 * mint a sub-minimum sliver, and null when the clip has no resolvable end.
 *
 * An OPEN-ENDED clip (no authored dur - it runs to the sequence end) splits too, when
 * the caller supplies `totalSec` to resolve its effective end: the left half gets the
 * authored span up to the cut, and the right half stays OPEN-ENDED - it keeps running
 * to the sequence end, exactly as the whole clip did, so the null-dur contract
 * ("derive from the media / follow the sequence") survives the cut on the half where
 * it still means something. Without `totalSec` an open-ended clip is refused as before.
 *
 * The transitions belong to the OUTER edges of the original clip: A keeps its enter
 * and loses its exit, B keeps its exit and loses its enter. B's source in-point
 * advances by the media time consumed by A - (t - start) * speed. B is inserted
 * immediately after A so z-order is preserved, and its id comes from the injected
 * `mintId` (this module never invents ids).
 *
 * The keyframe track is the one field that is REBASED rather than copied (section 5.6): a
 * verbatim copy would have B replay the whole animation from its own t = 0. Both
 * halves get a keyframe at the cut holding the pose the original struck there, and
 * the crossing segment's ease is subdivided so neither half's motion changes shape.
 * Everything else - the link field, the asset ref, the geometry - is copied exactly
 * as before.
 */
export function splitBox(boxes: Box[], cfg: TimeCfg, id: string, tSec: number, mintId: () => string, totalSec?: number): Box[] | null {
  const rows = Array.isArray(boxes) ? boxes : [];
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return null;
  const box = rows[i]!;
  const t = boxTiming(box, cfg);
  const start = t.start ?? 0;
  // Open-ended: the effective end is the sequence's, when the caller names it.
  const openEnded = t.dur === null;
  const total = num(totalSec ?? NaN, NaN);
  if (openEnded && !(Number.isFinite(total) && total > start)) return null;
  const end = openEnded ? total : start + (t.dur as number);
  const at = num(tSec, NaN);
  if (!Number.isFinite(at)) return null;
  if (!(at > start + MIN_DUR && at < end - MIN_DUR)) return null;

  // Snap the cut to the millisecond grid ONCE and derive both halves from it, so
  // A.dur + B.dur === the original duration exactly. Rounding the two halves
  // independently leaves them summing to ±1 ms of the original, which on the seq lane
  // (never repacked after a split, by contract) is a real gap or overlap against the
  // next clip. The playhead's time is pointer-px ÷ pxPerSec, so a cut that is not
  // already on the grid is the normal case, not the exotic one.
  const aDur = r3(at - start);
  const bStart = r3(start + aDur);
  const bDur = r3(end - bStart);
  // Rounding can shave a hair off a cut made right against the MIN_DUR guard; refuse
  // rather than mint a sub-minimum sliver.
  if (aDur < MIN_DUR || bDur < MIN_DUR) return null;

  // The keyframe rebase (section 5.6). A keeps everything up to the cut plus the pose it was
  // striking there; B replays from that pose at its own t = 0. The cut is measured in
  // the box's LOCAL time, which is exactly A's length - B's start on the timeline has
  // nothing to do with it. An unkeyframed box takes neither branch and both halves
  // stay the verbatim field copies they have always been.
  const track = boxTrack(box, cfg);
  const kf = track.length ? cfg.kfField : '';
  const cutMs = kfMs(aDur);

  const aPatch: Record<string, Box[string]> = { [cfg.durField]: aDur, [cfg.exitField]: 'none' };
  if (kf) aPatch[kf] = serialiseKf(kfTrackBefore(track, cutMs));
  const a = withFields(box, aPatch);
  const b: Box = {
    ...box,
    ...(kf ? { [kf]: serialiseKf(kfTrackAfter(track, cutMs)) } : {}),
    [cfg.idField]: mintId(),
    [cfg.startField]: bStart,
    // An open-ended original leaves its right half open-ended too ('' = unauthored,
    // demote's own convention) - it keeps following the sequence end.
    [cfg.durField]: openEnded ? '' : bDur,
    [cfg.clipInField]: clamp(r3(t.clipIn + aDur * t.speed), 0, MAX_TIME_S),
    [cfg.enterField]: 'none',
  };
  const out = rows.slice();
  out.splice(i, 1, a, b);
  return out;
}

/** Result of {@link splitAll}: the new array plus which ids the cut actually hit. */
export interface SplitAllResult {
  /** The boxes after every successful split. IDENTICAL to the input when none landed. */
  next: Box[];
  /** The ids of the RIGHT halves that were minted, in the order they were made. */
  split: string[];
  /** The requested ids `splitBox` refused (open-ended, or the cut was not strictly inside). */
  skipped: string[];
}

/**
 * Split several clips at the SAME instant, in ONE array.
 *
 * The reason this is a function rather than a loop at the call site: `tool-history`
 * diffs whole input values, so N calls to `write()` are N undo steps and a "split
 * everything at the playhead" would take five presses of ⌘Z to take back. Folding
 * `splitBox` over one intermediate array makes the whole command a single step.
 *
 * `next === boxes` (identity, not deep equality) when nothing split, so the caller can
 * skip the commit entirely and spend no undo entry on a no-op - the same discipline
 * `promote` already uses.
 *
 * A refusal is per-id and never aborts the rest: splitting a selection of five clips
 * where the playhead is outside two of them splits the other three.
 *
 * `mintId` is the caller's - this module still invents no ids. It is called once per
 * split, but a minter that reads a SNAPSHOT (the panel's reads `getBoxes()`, which does
 * not move during this fold) hands back the same id every time, so a collision against
 * the accumulator is disambiguated here with a numeric suffix. That suffix is the one
 * fragment of an id this module ever authors, and it only fires on a minter that has
 * already failed to be unique.
 */
export function splitAll(
  boxes: Box[], cfg: TimeCfg, ids: string[], tSec: number, mintId: () => string, totalSec?: number,
): SplitAllResult {
  const rows = Array.isArray(boxes) ? boxes : [];
  let acc = rows;
  const split: string[] = [];
  const skipped: string[] = [];
  const mint = (): string => {
    const base = String(mintId() ?? '');
    if (base && indexOfId(acc, cfg, base) < 0) return base;
    const stem = base || 'b';
    let n = 2;
    while (indexOfId(acc, cfg, `${stem}-${n}`) >= 0) n++;
    return `${stem}-${n}`;
  };
  for (const raw of Array.isArray(ids) ? ids : []) {
    const id = raw == null ? '' : String(raw);
    if (!id) continue;
    const next = splitBox(acc, cfg, id, tSec, mint, totalSec);
    if (!next) { skipped.push(id); continue; }
    // splitBox inserts B immediately after A, so the minted half is the next row.
    const i = indexOfId(next, cfg, id);
    const b = i >= 0 ? next[i + 1] : null;
    const bId = b ? String(b[cfg.idField] ?? '') : '';
    if (bId) split.push(bId);
    acc = next;
  }
  return { next: acc, split, skipped };
}

/** Does this field value mean "no transition"? Absent, empty and 'none' are one state. */
function isCut(v: Box[string]): boolean {
  return v == null || v === '' || v === 'none';
}

/** Is this box's audio silenced? Both the boolean and the stringy wire form. */
function isMuted(box: Box | undefined, cfg: TimeCfg): boolean {
  const v = box?.[cfg.muteField];
  return v === true || v === 'true';
}

/**
 * Is the cut between A and B a THROUGH EDIT - a split whose two halves are still
 * perfectly contiguous, so joining them would restore the original clip byte for byte?
 *
 * Final Cut draws these as a hairline at the cut, and it is the single mechanism in the
 * whole NLE survey that makes splitting non-frightening: you can always see which cuts
 * are real decisions and which are just "I cut here and then changed nothing".
 *
 * Five conditions, all of them things `splitBox` writes and a later edit would break:
 *   • A and B are ADJACENT on the seq row (B immediately follows A in play order);
 *   • neither side has grown a transition across the cut;
 *   • B's in-point is exactly where A's out-point left off, in MEDIA time - hence
 *     `A.clipIn + A.dur * A.speed`, the same speed-aware arithmetic `splitBox` used;
 *   • the two halves still play at the same rate;
 *   • and they are the same source, which this module cannot decide for itself - an
 *     asset ref is not a timing concern, so the predicate is INJECTED by the caller.
 *
 * The keyframe track is deliberately NOT a sixth condition. A split rebases it (section 5.6),
 * and rejoining restores the MOTION rather than the byte-identical wire - a subdivided
 * ease is a different token for the same curve. Comparing tracks here would hide the
 * hairline behind every keyframed cut, which is the opposite of what it is for.
 */
export function isThroughEdit(
  boxes: Box[], cfg: TimeCfg, aId: string, bId: string,
  sameSource: (a: Box, b: Box) => boolean,
): boolean {
  const rows = Array.isArray(boxes) ? boxes : [];
  if (!aId || !bId || String(aId) === String(bId)) return false;
  const order = seqIndices(rows, cfg);
  const ai = order.findIndex((i) => String(rows[i]?.[cfg.idField] ?? '') === String(aId));
  if (ai < 0 || ai + 1 >= order.length) return false;
  const bi = order[ai + 1]!;
  if (String(rows[bi]?.[cfg.idField] ?? '') !== String(bId)) return false;
  const a = rows[order[ai]!]!;
  const b = rows[bi]!;
  if (!isCut(a[cfg.exitField]) || !isCut(b[cfg.enterField])) return false;
  const ta = boxTiming(a, cfg);
  const tb = boxTiming(b, cfg);
  if (ta.dur === null || tb.dur === null) return false;
  if (ta.speed !== tb.speed) return false;
  if (Math.abs(tb.clipIn - (ta.clipIn + ta.dur * ta.speed)) > 0.001) return false;
  try { return !!sameSource(a, b); } catch { return false; }
}

/**
 * Join two adjacent seq clips back into one - Final Cut's *Trim > Join Clips*, and the
 * real inverse of a split rather than "select both and hope".
 *
 * A absorbs B's length and B's OUTER edge (its exit transition), which is exactly what
 * `splitBox` handed outward; B is removed and the row repacks. The absence of an exit is
 * carried too, by deleting the key rather than writing `undefined` - that is what makes
 * split → join a true round-trip on a clip that never had a transition at all.
 *
 * B's keyframes come too, shifted by A's length onto the merged clip's single local
 * timeline (section 5.6, {@link kfTrackJoin}) - discarding them was the loudest of the three
 * gaps this rebase closes.
 *
 * Deliberately NOT gated on {@link isThroughEdit}: that predicate decides what to OFFER,
 * this one decides what to do. Joining two clips that are no longer contiguous is a
 * legitimate (if lossy) edit, and refusing it here would put the policy in two places.
 * Returns null only when the pair is not two adjacent clips of the seq row.
 */
export function joinClips(
  boxes: Box[], cfg: TimeCfg, aId: string, bId: string, mediaDur?: MediaDurFn,
): Box[] | null {
  const rows = Array.isArray(boxes) ? boxes : [];
  const order = seqIndices(rows, cfg);
  const ai = order.findIndex((i) => String(rows[i]?.[cfg.idField] ?? '') === String(aId));
  if (ai < 0 || ai + 1 >= order.length) return null;
  const bIdx = order[ai + 1]!;
  if (String(rows[bIdx]?.[cfg.idField] ?? '') !== String(bId)) return null;
  const aIdx = order[ai]!;
  const a = rows[aIdx]!;
  const b = rows[bIdx]!;
  const ta = boxTiming(a, cfg);
  const tb = boxTiming(b, cfg);
  if (ta.dur === null || tb.dur === null) return null;

  const merged: Box = { ...a, [cfg.durField]: clamp(r3(ta.dur + tb.dur), MIN_DUR, MAX_TIME_S) };
  for (const f of [cfg.exitField, cfg.exitMsField]) {
    if (Object.prototype.hasOwnProperty.call(b, f)) merged[f] = b[f];
    else delete merged[f];
  }
  // B's keyframes move to where B now plays inside the merged clip (section 5.6). Only B
  // having a track can change anything: with none, A's own track is already correct
  // and is left byte-identical rather than re-serialised.
  const trackB = boxTrack(b, cfg);
  if (cfg.kfField && trackB.length) {
    merged[cfg.kfField] = serialiseKf(kfTrackJoin(boxTrack(a, cfg), trackB, kfMs(ta.dur)));
  }
  const culled = rows.map((row, k) => (k === aIdx ? merged : row)).filter((_, k) => k !== bIdx);
  return rippleOverlays(rows, packSeq(culled, cfg, mediaDur), cfg);
}

/**
 * Detach a clip's audio onto its own lane - REFERENCE, not copy.
 *
 * The new box carries the SAME asset ref, start, length, in-point and rate as its
 * source; nothing is demuxed and no new asset is created, because `sequence-render`
 * decodes the audio track from that identical URL either way. The source is muted, and
 * both boxes are stamped with each other's id.
 *
 * The link is SYMMETRIC on purpose. Final Cut's detach is one-way and it is the single
 * most-cited complaint in the survey ("there's no way to resync a clip, except for
 * Undo"); Premiere and Resolve keep a persistent link that can be undone from either
 * side, and that is what a field on BOTH boxes buys. It also survives a later split:
 * `splitBox` copies fields, so cutting the muted video yields two halves that both name
 * the audio, and {@link reattachAudio} un-mutes both.
 *
 * The detached box lands on the OVERLAY lane (`lane: ''`) so `packSeq` never sees it - 
 * a magnetic row that suddenly gained a silent twin of every clip would double in length.
 * Its transitions are cleared: an animate-in on a thing with no picture is meaningless.
 *
 * `seed` is the tool's own AUDIO add-kind seed, applied over the copy so the box is
 * field-for-field what the rail's "Audio" button would have made (kind, fit, and so on).
 * Returns null when the tool declares no link sub-field, when the box is missing, or
 * when it is already linked.
 */
export function detachAudio(
  boxes: Box[], cfg: TimeCfg, id: string, mintId: () => string, seed?: Box,
): Box[] | null {
  const rows = Array.isArray(boxes) ? boxes : [];
  const link = cfg.linkField;
  if (!link) return null;
  const i = indexOfId(rows, cfg, id);
  if (i < 0) return null;
  const box = rows[i]!;
  const cur = box[link];
  if (cur != null && cur !== '') return null;               // already linked
  const audioId = String(mintId() ?? '');
  if (!audioId || indexOfId(rows, cfg, audioId) >= 0) return null;

  const audio: Box = {
    ...box,
    ...(seed ?? {}),
    [cfg.idField]: audioId,
    [cfg.laneField]: '',
    [cfg.muteField]: '',
    [cfg.enterField]: 'none',
    [cfg.exitField]: 'none',
    [link]: String(id),
  };
  const out = rows.map((b, k) => (k === i
    ? withFields(b!, { [cfg.muteField]: true, [link]: audioId })
    : b));
  out.push(audio);
  return out;
}

/**
 * Put a detached sound back on its clip - the inverse of {@link detachAudio}, reachable
 * from EITHER side (press it on the video or on the sound; both mean the same thing).
 *
 * The link group is resolved by CLOSURE in both directions, because a video that was
 * split after being detached is two boxes both naming the same sound. Partitioning that
 * group by `mute` is what tells the two sides apart without a second field: the muted
 * members are the picture (un-mute them, clear their link), everything else is the
 * detached sound (removed).
 *
 * Returns null - refuses, rather than guessing - when the tool declares no link field,
 * when the group is a singleton (nothing is actually linked), or when the muted side is
 * EMPTY. That last one means the user un-muted the video by hand: re-attaching would
 * have to decide which of two unmuted boxes is the picture, and deleting the wrong one
 * is unrecoverable. Dangling ids (a partner that has since been deleted) are ignored.
 */
export function reattachAudio(
  boxes: Box[], cfg: TimeCfg, id: string, mediaDur?: MediaDurFn,
): Box[] | null {
  const rows = Array.isArray(boxes) ? boxes : [];
  const link = cfg.linkField;
  if (!link) return null;
  if (!id || indexOfId(rows, cfg, id) < 0) return null;

  const idOf = (b: Box | undefined): string => {
    const v = b?.[cfg.idField];
    return v == null ? '' : String(v);
  };
  const partnerOf = (b: Box | undefined): string => {
    const v = b?.[link];
    return v == null ? '' : String(v);
  };
  const group = new Set<string>([String(id)]);
  for (let grew = true; grew;) {
    grew = false;
    for (const b of rows) {
      if (!b) continue;
      const me = idOf(b);
      const other = partnerOf(b);
      if (!me || !other || indexOfId(rows, cfg, other) < 0) continue;
      if (group.has(me) && !group.has(other)) { group.add(other); grew = true; }
      else if (group.has(other) && !group.has(me)) { group.add(me); grew = true; }
    }
  }
  if (group.size < 2) return null;

  const video: number[] = [];
  const audio: number[] = [];
  for (let k = 0; k < rows.length; k++) {
    if (!rows[k] || !group.has(idOf(rows[k]))) continue;
    (isMuted(rows[k], cfg) ? video : audio).push(k);
  }
  if (!video.length) return null;

  const drop = new Set(audio);
  const keep = new Set(video);
  const wasSeq = audio.some((k) => boxTiming(rows[k], cfg).lane === 'seq');
  const culled = rows
    .map((b, k) => (keep.has(k) ? withFields(b!, { [cfg.muteField]: '', [link]: '' }) : b))
    .filter((_, k) => !drop.has(k));
  return wasSeq ? rippleOverlays(rows, packSeq(culled, cfg, mediaDur), cfg) : culled;
}

// ── snapping + formatting ─────────────────────────────────────────────────────

/**
 * Snap a time to the nearest candidate within `snapPx` SCREEN pixels (clip edges, the
 * playhead, whole seconds - the caller assembles the list). The threshold is in
 * screen space so snapping feels identical at every zoom level, the same convention
 * free-canvas uses for its spatial guides.
 */
export function snapTime(tSec: number, candidates: number[], pxPerSec: number, snapPx: number = SNAP_PX): SnapTimeResult {
  const t = num(tSec, 0);
  const pps = num(pxPerSec, 0);
  const px = num(snapPx, SNAP_PX);
  if (!(pps > 0) || !(px > 0) || !Array.isArray(candidates)) return { t, snapped: null };
  const tol = px / pps;
  let best: number | null = null;
  let bestD = Infinity;
  for (const raw of candidates) {
    const c = typeof raw === 'number' ? raw : parseFloat(raw as unknown as string);
    if (!Number.isFinite(c)) continue;
    const dd = Math.abs(c - t);
    if (dd <= tol && dd < bestD) { best = c; bestD = dd; }
  }
  return best === null ? { t, snapped: null } : { t: best, snapped: best };
}

/**
 * Format seconds as a transport readout: `m:ss.d`, growing to `h:mm:ss.d` past an
 * hour. Rounds to tenths BEFORE splitting the fields so 59.99 reads "1:00.0" rather
 * than "0:60.0".
 */
export function fmtTime(sec: number): string {
  const v = num(sec, 0);
  const neg = v < 0;
  const tenths = Math.round(Math.abs(v) * 10);
  const d = tenths % 10;
  const total = (tenths - d) / 10;
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (n: number): string => (n < 10 ? '0' + n : String(n));
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}.${d}` : `${m}:${pad(s)}.${d}`;
  return neg && tenths > 0 ? '-' + body : body;
}

/**
 * Format a LENGTH for the trim readout: `4.2s` under ten seconds, `12s` under a
 * minute, `1:05` (fmtTime's shape, minus the tenths) beyond it.
 *
 * A separate function from fmtTime on purpose. fmtTime is the TRANSPORT readout - an
 * absolute position, always `m:ss.d`, always the same width so the clock does not
 * jitter. A duration is read as a magnitude, and `0:04.2` for a four-second clip is
 * three characters of ceremony over `4.2s` (IMG.LY's mobile timeline is the precedent:
 * one decimal only where a tenth is still a visible fraction of the bar).
 *
 * Each band is picked from the ROUNDED value, never the raw one, so 9.96 reads `10s`
 * rather than `10.0s` and 59.9 reads `1:00` rather than `60s`.
 */
export function fmtDur(sec: number): string {
  const v = num(sec, 0);
  if (v < 0) return `-${fmtDur(-v)}`;
  const tenths = Math.round(v * 10);
  if (tenths < 100) return `${(tenths / 10).toFixed(1)}s`;
  const whole = Math.round(v);
  if (whole < 60) return `${whole}s`;
  // fmtTime already knows when to grow an hours field; drop its tenths rather than
  // re-deriving the m:ss split here.
  return fmtTime(whole).replace(/\.\d$/, '');
}

/**
 * Format a CHANGE in length: `+0.6s` / `-0.6s`, same bands as {@link fmtDur}.
 *
 * ASCII `+`/`-` deliberately - not `±`, not U+2212 MINUS SIGN. This string is read
 * aloud by a screen reader as well as drawn in a badge, and the house copy style keeps
 * the typographically fancy characters out of running text.
 *
 * A delta that rounds away to nothing reads `+0.0s`, never `-0.0s`.
 */
export function fmtDelta(sec: number): string {
  const v = num(sec, 0);
  const a = Math.abs(v);
  const sign = v < 0 && Math.round(a * 10) > 0 ? '-' : '+';
  return `${sign}${fmtDur(a)}`;
}

/**
 * How wide each trim edge zone may be on a bar of `barWidthPx`, given the pointer's
 * base zone (`EDGE_PX` for a mouse, `EDGE_PX_COARSE` for a finger).
 *
 * Returns 0 below {@link MIN_TRIM_BAR_PX} - the bar is too narrow to carry a trim
 * target that is not also the whole clip. Above it, a third of the bar is the ceiling,
 * so the in and out zones can never meet: 2 × floor(w/3) < w for every w ≥ 3, leaving
 * at least one pixel of body that still starts a move.
 */
export function edgeZonePx(barWidthPx: number, basePx: number): number {
  const w = num(barWidthPx, 0);
  const base = num(basePx, 0);
  if (!(w >= MIN_TRIM_BAR_PX) || !(base > 0)) return 0;
  return Math.min(base, Math.floor(w / 3));
}
