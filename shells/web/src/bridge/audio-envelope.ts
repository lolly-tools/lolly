// SPDX-License-Identifier: MPL-2.0
/**
 * The bed-duck gain envelope - pure scheduling math shared by the two Web Audio
 * mix graphs: bridge/export.ts's looped-bed path (live AudioContext and the
 * WebCodecs OfflineAudioContext bed render) and bridge/sequence-render.ts's
 * OfflineAudioContext mix. The rule (plans/41-tts-stt-programme.md section 6.1): a mix-in
 * bed plays at FULL volume wherever the primary audio (a tool's own clip, or a
 * sequence's audio boxes) is silent - before it starts and after it ends, the
 * top-and-tail intro/outro - and glides to a user-set CENTRE level underneath
 * it. Boundaries are always linear ramps (setValueAtTime/linearRampToValueAtTime
 * consumers), never hard steps.
 *
 * Deliberately dependency-free: sequence-render.ts must not import export.ts
 * (that would drag the whole rasteriser into its lazy chunk), so the one copy of
 * this math lives here and both graphs consume it.
 */

/** A window (seconds, clip time) over which the primary audio is playing. */
export interface DuckSpan { from: number; to: number }

/** A clip's own duck request (plans/165 WP-6 v1): drop to `level` while any of the
 *  CLIP-LOCAL `spans` (other audible clips' windows) plays. level 1 = no duck. */
export interface ClipDuck { level: number; spans: readonly DuckSpan[] }

/** The optional mix-in track riding a primary export audio selection. */
export interface ExportAudioMixIn {
  id?: string;
  url: string;
  /** Bed gain 0..1 while the primary track plays; full gain outside its extent
   *  (the top/tail intro-outro). The popup's off/low/full select: 0 / 0.2 / 1. */
  centre?: number;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

/**
 * The export bar's audio selection - THE one declaration of this shape (memory
 * export-settings-fragmentation: fields are added here once; bridge/export.ts's
 * ExportOpts and views/tool.ts's RunExportOpts both reference it). Without `mix`
 * it is the single track today's readers always understood; with `mix` the
 * primary is a tool's own audio and the mix-in bed ducks under it.
 */
export interface ExportAudio {
  id?: string;
  url: string;
  fadeIn?: number;
  fadeOut?: number;
  volume?: number;
  /** Legacy single-track duck level (the "Duck to" control, footage-under-bed). */
  duck?: number;
  /** In-point into the SOURCE, seconds (the tool's data-audio-start contract). */
  start?: number;
  /** Optional second track mixed in around/under the primary (section 6.1). */
  mix?: ExportAudioMixIn;
}

/** One automation event, seconds from envelope t0.
 *  ramp=false → setValueAtTime; ramp=true → linearRampToValueAtTime (a ramp
 *  ENDING at `t`, starting from the previous event). */
export interface GainEvent { t: number; v: number; ramp: boolean }

/** Boundary ramp length, seconds - the bed glides between full and centre. */
export const MIX_RAMP_SEC = 0.8;

/** The "low" centre level of the export card's off/low/full select. */
export const CENTRE_LOW = 0.2;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Build the bed's whole gain timeline: fade in → full → (per primary span) ramp
 * down to volume·centre, hold, ramp back to full → fade out. Spans are clamped
 * into the clip (and out of the fade-out region, so the bed is back at full for
 * an authored outro fade), merged when the gap between them is too short for the
 * bed to meaningfully return to full, and spans shorter than the ramp pair use
 * proportionally shorter ramps so the duck is always honoured without a step.
 * centre ≥ 1 (or no spans) degrades to the plain fade envelope.
 */
export function bedDuckEnvelope(o: {
  clipSec: number;
  volume?: number;
  /** Bed gain multiplier 0..1 while a primary span plays; 1 = no duck. */
  centre?: number;
  spans?: DuckSpan[];
  fadeIn?: number;
  fadeOut?: number;
  rampSec?: number;
}): GainEvent[] {
  const vol = clamp01(o.volume ?? 1);
  const centre = clamp01(o.centre ?? 1);
  const ramp = Math.max(0.05, o.rampSec ?? MIX_RAMP_SEC);
  const fadeIn = Math.max(0, o.fadeIn ?? 0);
  const fadeOut = Math.max(0, o.fadeOut ?? 0);
  const clip = Math.max(0, o.clipSec);

  const events: GainEvent[] = [];
  if (fadeIn > 0) { events.push({ t: 0, v: 0, ramp: false }, { t: fadeIn, v: vol, ramp: true }); }
  else events.push({ t: 0, v: vol, ramp: false });

  // Where the fade-out begins (the bed must be back at full by here) - the same
  // `clip > fadeIn` guard the legacy single-window envelope used.
  const wantFadeOut = fadeOut > 0 && clip > fadeIn;
  const fs = wantFadeOut ? Math.max(fadeIn, clip - fadeOut) : clip;

  if (centre < 1) {
    // Clamp into [0, fs], drop empties, sort, merge overlaps and near-misses
    // (a gap shorter than a down+up ramp pair never reaches full anyway).
    const spans = (o.spans ?? [])
      .map(s => ({ from: Math.min(Math.max(0, s.from), fs), to: Math.min(Math.max(0, s.to), fs) }))
      .filter(s => s.to - s.from > 0.05)
      .sort((a, b) => a.from - b.from);
    const merged: DuckSpan[] = [];
    for (const s of spans) {
      const last = merged[merged.length - 1];
      if (last && s.from - last.to < ramp * 2) last.to = Math.max(last.to, s.to);
      else merged.push({ ...s });
    }
    const low = vol * centre;
    for (const s of merged) {
      // Never fight the fade-in ramp: the duck starts once the fade has landed.
      const a = Math.max(s.from, fadeIn);
      if (s.to - a <= 0.1) continue;
      const r = Math.min(ramp, (s.to - a) / 2);
      events.push(
        { t: a, v: vol, ramp: false },
        { t: a + r, v: low, ramp: true },
        { t: s.to - r, v: low, ramp: false },
        { t: s.to, v: vol, ramp: true },
      );
    }
  }

  if (wantFadeOut) events.push({ t: fs, v: vol, ramp: false }, { t: clip, v: 0, ramp: true });
  return events;
}

/**
 * One placed clip's whole gain timeline, in CLIP-LOCAL seconds (t = 0 is the
 * clip's own start on the timeline): a flat volume, shaped by an optional
 * fade-in/out pair. The SAME list drives both consumers - the preview clock
 * schedules it onto a GainNode (scheduleGainEvents) and the export mix evaluates
 * it analytically per sample (mixWindow) - so what plays is what renders, by
 * construction. Volume keyframes (plans/165 WP-3) fold in here as further ramp
 * segments; both consumers then inherit them with no extra wiring.
 *
 * A no-op timeline (gain 1, no fades) comes back as the single set the evaluator
 * expects; `isTrivialGain` names that case so hot paths can skip the multiply.
 */
export interface VolumeKey {
  /** CLIP-LOCAL seconds (a kf key's own `t`, /1000). */
  tSec: number;
  /** The keyed multiplier, 0..2. */
  value: number;
}

/** Sanitise + sort a caller's volume keys once, shared by both evaluators. */
function cleanVolumeKeys(keys: readonly VolumeKey[] | undefined): VolumeKey[] | null {
  if (!keys || keys.length === 0) return null;
  const out = keys
    .filter((k) => Number.isFinite(k.tSec) && Number.isFinite(k.value))
    .map((k) => ({ tSec: Math.max(0, k.tSec), value: Math.min(2, Math.max(0, k.value)) }))
    .sort((a, b) => a.tSec - b.tSec);
  return out.length ? out : null;
}

/** The v-track value at t: hold before the first key, linear between, hold after. */
function volumeKeyValueAt(keys: readonly VolumeKey[], t: number): number {
  const first = keys[0]!;
  if (t <= first.tSec) return first.value;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i]!;
    if (t <= k.tSec) {
      const prev = keys[i - 1]!;
      const span = k.tSec - prev.tSec;
      return span > 0 ? prev.value + (k.value - prev.value) * ((t - prev.tSec) / span) : k.value;
    }
  }
  return keys[keys.length - 1]!.value;
}

/** How finely a region where BOTH factors ramp is subdivided: their product is
 *  quadratic and a linear ramp can only approximate it. 50 ms keeps the error
 *  inaudible (< 0.5% of full scale on any real fade) and the list small. */
const GAIN_SUBDIVIDE_SEC = 0.05;

interface ClipGainShape {
  span: number;
  g: number;
  fi: number;
  fo: number;
  keys: VolumeKey[] | null;
  /** Duck-to level 0..1 while a duck span plays (1 = no duck). */
  dl: number;
  /** Merged, clamped duck spans with their per-span ramp, or null when no duck applies. */
  dspans: { from: number; to: number; r: number }[] | null;
}

function clipGainShape(o: {
  spanSec: number; gain?: number; fadeInSec?: number; fadeOutSec?: number;
  volumeKeys?: readonly VolumeKey[]; duck?: ClipDuck;
}): ClipGainShape {
  const span = Math.max(0, o.spanSec);
  const g = Math.min(2, Math.max(0, Number.isFinite(o.gain as number) ? (o.gain as number) : 1));
  let fi = Math.max(0, Math.min(o.fadeInSec ?? 0, MAX_CLIP_FADE_SEC));
  let fo = Math.max(0, Math.min(o.fadeOutSec ?? 0, MAX_CLIP_FADE_SEC));
  // Fades that together outrun the clip shrink proportionally and meet in the
  // middle - the shape a user dragging one fade past the other expects, never a step.
  if (span > 0 && fi + fo > span) {
    const k = span / (fi + fo);
    fi *= k;
    fo *= k;
  }
  // The duck factor (plans/165 WP-6 v1), sanitised the way bedDuckEnvelope sanitises
  // its spans: clamped into the clip, merged when the gap is too short for the sound
  // to meaningfully come back up, ramps shortened on spans too short for the pair.
  let dl = 1;
  let dspans: { from: number; to: number; r: number }[] | null = null;
  const duckLevel = clamp01(o.duck?.level ?? 1);
  if (duckLevel < 1 && o.duck?.spans?.length && span > 0) {
    const sorted = o.duck.spans
      .map((s) => ({ from: Math.min(Math.max(0, s.from), span), to: Math.min(Math.max(0, s.to), span) }))
      .filter((s) => s.to - s.from > 0.05)
      .sort((x, y) => x.from - y.from);
    const merged: DuckSpan[] = [];
    for (const s of sorted) {
      const last = merged[merged.length - 1];
      if (last && s.from - last.to < MIX_RAMP_SEC * 2) last.to = Math.max(last.to, s.to);
      else merged.push({ ...s });
    }
    const rs = merged
      .filter((s) => s.to - s.from > 0.1)
      .map((s) => ({ from: s.from, to: s.to, r: Math.min(MIX_RAMP_SEC, (s.to - s.from) / 2) }));
    if (rs.length) { dl = duckLevel; dspans = rs; }
  }
  return { span, g, fi, fo, keys: cleanVolumeKeys(o.volumeKeys), dl, dspans };
}

/** The 0..1 fade factor at t for a resolved shape. */
function fadeFactorAt(sh: ClipGainShape, t: number): number {
  let f = 1;
  if (sh.fi > 0.001 && t < sh.fi) f = Math.min(f, t / sh.fi);
  if (sh.fo > 0.001 && sh.span > 0 && t > sh.span - sh.fo) f = Math.min(f, (sh.span - t) / sh.fo);
  return Math.min(1, Math.max(0, f));
}

/** The 0..1 duck factor at t: 1 outside every span, `dl` inside, linear edge ramps. */
function duckFactorAt(sh: ClipGainShape, t: number): number {
  if (!sh.dspans) return 1;
  let f = 1;
  for (const s of sh.dspans) {
    if (t <= s.from || t >= s.to) continue;
    if (t < s.from + s.r) f = Math.min(f, 1 - (1 - sh.dl) * ((t - s.from) / s.r));
    else if (t > s.to - s.r) f = Math.min(f, 1 - (1 - sh.dl) * ((s.to - t) / s.r));
    else f = Math.min(f, sh.dl);
  }
  return f;
}

/** The full clip-gain value at t: flat gain × fade factor × keyed multiplier × duck. */
function shapeValueAt(sh: ClipGainShape, t: number): number {
  const v = sh.keys ? volumeKeyValueAt(sh.keys, t) : 1;
  return sh.g * fadeFactorAt(sh, t) * v * duckFactorAt(sh, t);
}

/** Is the fade factor non-constant anywhere strictly inside (a, b)? */
function fadeRampsIn(sh: ClipGainShape, a: number, b: number): boolean {
  return (sh.fi > 0.001 && a < sh.fi) || (sh.fo > 0.001 && b > sh.span - sh.fo);
}

/** Is the v-track non-constant anywhere strictly inside (a, b)? */
function keysRampIn(sh: ClipGainShape, a: number, b: number): boolean {
  if (!sh.keys || sh.keys.length < 2) return false;
  for (let i = 1; i < sh.keys.length; i++) {
    const p = sh.keys[i - 1]!;
    const k = sh.keys[i]!;
    if (p.value !== k.value && k.tSec > a && p.tSec < b) return true;
  }
  return false;
}

/** Is the duck factor non-constant anywhere strictly inside (a, b)? */
function duckRampsIn(sh: ClipGainShape, a: number, b: number): boolean {
  if (!sh.dspans) return false;
  for (const s of sh.dspans) {
    if (a < s.from + s.r && b > s.from) return true;
    if (a < s.to && b > s.to - s.r) return true;
  }
  return false;
}

export function clipGainEvents(o: {
  /** The clip's placed length on the timeline, seconds. */
  spanSec: number;
  /** Flat clip volume, 0..2 (1 = as recorded). */
  gain?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Volume keyframes (the kf grammar's `v` channel), clip-local. Linear between
   *  keys, held beyond the ends - the DAW convention; ease tokens on a key move
   *  the POSE and deliberately not the volume. */
  volumeKeys?: readonly VolumeKey[];
  /** Clip-presence ducking (plans/165 WP-6 v1): drop to `level` while any of the
   *  clip-local `spans` plays. Folds in as a third factor beside fades and keys. */
  duck?: ClipDuck;
}): GainEvent[] {
  const sh = clipGainShape(o);
  // The classic shapes stay EXACT and small: no keys and no duck means every
  // segment is a pure linear ramp of a single factor.
  if (!sh.keys && !sh.dspans) {
    const events: GainEvent[] = [];
    if (sh.fi > 0.001) events.push({ t: 0, v: 0, ramp: false }, { t: sh.fi, v: sh.g, ramp: true });
    else events.push({ t: 0, v: sh.g, ramp: false });
    if (sh.fo > 0.001 && sh.span > 0) events.push({ t: sh.span - sh.fo, v: sh.g, ramp: false }, { t: sh.span, v: 0, ramp: true });
    return events;
  }
  // Keys present: emit the product at every breakpoint (fade edges + key times),
  // subdividing only where fade AND keys ramp together - the one region where the
  // product is quadratic and a linear ramp merely approximates it.
  const marks = new Set<number>([0, sh.span]);
  if (sh.fi > 0.001) marks.add(Math.min(sh.fi, sh.span));
  if (sh.fo > 0.001 && sh.span > 0) marks.add(Math.max(0, sh.span - sh.fo));
  for (const k of sh.keys ?? []) if (k.tSec > 0 && k.tSec < sh.span) marks.add(k.tSec);
  for (const s of sh.dspans ?? []) {
    for (const t of [s.from, s.from + s.r, s.to - s.r, s.to]) if (t > 0 && t < sh.span) marks.add(t);
  }
  const sorted = [...marks].sort((a, b) => a - b);
  const events: GainEvent[] = [{ t: 0, v: shapeValueAt(sh, 0), ramp: false }];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    const ramping = (fadeRampsIn(sh, a, b) ? 1 : 0) + (keysRampIn(sh, a, b) ? 1 : 0) + (duckRampsIn(sh, a, b) ? 1 : 0);
    if (ramping >= 2) {
      const steps = Math.max(1, Math.ceil((b - a) / GAIN_SUBDIVIDE_SEC));
      for (let n = 1; n <= steps; n++) {
        const t = a + ((b - a) * n) / steps;
        events.push({ t, v: shapeValueAt(sh, t), ramp: true });
      }
    } else {
      events.push({ t: b, v: shapeValueAt(sh, b), ramp: true });
    }
  }
  return events;
}

/** The ceiling one clip fade may run, seconds. plans/165 WP-2 (the 15 s proposal
 *  from plans/101 section 10 awaits an owner call; the wire clamp stays 3 s until then,
 *  so this only bounds junk). */
export const MAX_CLIP_FADE_SEC = 15;

/**
 * The clip-gain value at one CLIP-LOCAL instant - the closed form of
 * clipGainEvents + envelopeGainAt, allocation-free for per-frame callers (the
 * preview drives a <video>'s `volume` with it). MUST match the event builder,
 * proportional fade-shrink included; the round-trip test pins the two together.
 */
export function clipGainValueAt(o: {
  spanSec: number; gain?: number; fadeInSec?: number; fadeOutSec?: number;
  volumeKeys?: readonly VolumeKey[]; duck?: ClipDuck; tSec: number;
}): number {
  const sh = clipGainShape(o);
  return shapeValueAt(sh, Math.min(Math.max(0, o.tSec), sh.span));
}

/** Is this envelope the do-nothing one (a single set at gain 1)? */
export function isTrivialGain(events: GainEvent[] | null | undefined): boolean {
  return !events || events.length === 0 || (events.length === 1 && !events[0]!.ramp && events[0]!.v === 1);
}

/** The subset of AudioParam the scheduler touches - fakeable in Node tests. */
export interface GainParamLike {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}

/** Apply an envelope to a gain param, offset to t0 (ctx.currentTime). */
export function scheduleGainEvents(g: GainParamLike, events: GainEvent[], t0: number): void {
  for (const e of events) {
    if (e.ramp) g.linearRampToValueAtTime(e.v, t0 + e.t);
    else g.setValueAtTime(e.v, t0 + e.t);
  }
}

/**
 * Evaluate an envelope at time t exactly as Web Audio would (a set holds, a ramp
 * interpolates linearly from the previous event). Assumes the event list starts
 * with a set at t=0, which bedDuckEnvelope guarantees. Used by tests to render a
 * tiny mix headlessly and by nothing on the hot path.
 */
export function envelopeGainAt(events: GainEvent[], t: number): number {
  let curV = events.length && !events[0]!.ramp ? events[0]!.v : 1;
  let curT = 0;
  for (const e of events) {
    if (t < e.t) {
      if (!e.ramp) return curV;
      const span = e.t - curT;
      return span > 0 ? curV + (e.v - curV) * ((t - curT) / span) : e.v;
    }
    curV = e.v;
    curT = e.t;
  }
  return curV;
}
