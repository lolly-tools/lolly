// SPDX-License-Identifier: MPL-2.0
/**
 * A one-dimensional OKLCH slider whose track is BROKEN where the colour stops
 * being displayable.
 *
 * An ordinary colour slider paints a smooth ramp along its axis and quietly lies:
 * most of a chroma track at high lightness names colours no screen can show, and
 * the ramp goes flat there because every one of them maps to the same boundary
 * colour. This one samples the axis, keeps the runs that fit the gamut, and
 * and washes the rest back to a faint hint. So the track tells you where you can
 * actually go before you drag, while still reading as one continuous axis.
 *
 * On a hue track the effect is the most useful: at a fixed lightness and chroma
 * you get several solid arcs with real gaps between them - the hues that can
 * hold that much chroma, and the ones that cannot.
 *
 * Companion to the 2D charts in oklch-slice.ts: same engine primitives
 * (`inGamut`, `maxChroma`), one axis instead of two. Kept free of a CSS import so
 * it stays testable under `node --test` - see the note in oklch-slice.ts.
 */

import { inGamut, clipToGamut, oklchToHex, gamutTierProbe, BEYOND_TIER, chromaAxisMax } from '@lolly/engine';
import type { GamutLimit } from '@lolly/engine';
import { escapeHtml } from './html.ts';

/** Which channel a slider drives. */
export type GamutChannel = 'l' | 'c' | 'h';

export interface GamutSliderState {
  channel: GamutChannel;
  /** The colour the OTHER two channels are held at. */
  base: { l: number; c: number; h: number };
  /** The gamut a value must reach to count as reproducible - a display gamut by
   *  name, or any {@link GamutLimit}, so a press profile breaks the track the same
   *  way a narrow screen does. */
  limit: GamutLimit;
  /** Ceiling of the chroma axis. Defaults to the ceiling `limit` itself implies
   *  (`chromaAxisMax`), so a chroma track never runs past the gamut it is drawn
   *  for - nor stops short of it. */
  cMax?: number;
  /**
   * The gamut THIS DISPLAY can actually show - `displayAnchorGamut()`, so 'srgb'
   * or 'p3'. When given, a run the display can render TRUTHFULLY is painted opaque
   * and in the display's own space (CSS `oklch()`, which the browser resolves in
   * that gamut) instead of washed and sRGB-clamped: on a P3 screen the P3 segments
   * become real colour, not a faint hint. Omitted ⇒ every out-of-`limit` run
   * washes as before - the honest default for an sRGB screen, which genuinely
   * cannot show those colours.
   */
  displayGamut?: GamutLimit;
}

/** Only for a caller with no gamut in hand; see SLICE_C_MAX in oklch-slice-geom.ts. */
const DEFAULT_C_MAX = 0.4;

/** The chroma ceiling a slider should use: explicit if given, else derived from
 *  the gamut it is limited to. */
const cMaxOf = (state: GamutSliderState): number => state.cMax ?? chromaAxisMax(state.limit);

/**
 * The ceiling to actually draw against, given the value the thumb has to sit on.
 *
 * A chroma axis maximum is a CHOICE, not a bound - OKLCH will name c = 0.7 quite
 * happily - and a range input cannot express a value above its own `max`. So a value
 * past the ceiling stretches the axis rather than being pulled back to the end of the
 * track: the alternative is the control quietly editing the colour it is reporting.
 * The runs are built from the same number, so the track and the thumb stay in
 * register. Lightness and hue have real ends and are left alone.
 */
const drawCMax = (state: GamutSliderState, value: number): number => {
  const base = cMaxOf(state);
  return state.channel === 'c' && Number.isFinite(value) && value > base ? value : base;
};

/** The axis range and step for a channel, in that channel's own units. */
export function channelRange(ch: GamutChannel, cMax = DEFAULT_C_MAX): { min: number; max: number; step: number } {
  if (ch === 'h') return { min: 0, max: 360, step: 0.5 };
  if (ch === 'l') return { min: 0, max: 1, step: 0.005 };
  return { min: 0, max: cMax, step: 0.002 };
}

const CHANNEL_LABEL: Record<GamutChannel, string> = { l: 'Lightness', c: 'Chroma', h: 'Hue' };

/** The colour at `v` along the axis, with the other two channels held. */
function colorAt(state: GamutSliderState, v: number): { l: number; c: number; h: number } {
  return { ...state.base, [state.channel]: v };
}

/** Format a channel value the way that channel is normally read. */
export function formatChannel(ch: GamutChannel, v: number): string {
  if (ch === 'h') return `${Math.round(v)}°`;
  if (ch === 'l') return `${Math.round(v * 100)}%`;
  return v.toFixed(3);
}

/** One stretch of the axis. `tier` 0 is reachable under `state.limit`; 1.. are the
 *  rings out (the gamut one step wider, then the next), and {@link BEYOND_TIER} is
 *  the stretch no display gamut holds. Same classifier the picker's tracks use
 *  (engine/src/gamut-tier.ts), so the two surfaces cannot disagree about how far
 *  out a colour is. */
export interface GamutRun {
  from: number;
  to: number;
  stops: string[];
  tier: number;
  /** True when {@link GamutSliderState.displayGamut} can render this run - it is
   *  then painted opaque (tier notwithstanding) and its `stops` are CSS `oklch()`
   *  in the display's gamut rather than sRGB hex. Always false when no
   *  `displayGamut` was given, so the wash behaves exactly as before. */
  displayable: boolean;
}

/**
 * Every run along the axis - reachable AND not - as `{ from, to }` fractions of
 * the track with the colours to paint across each.
 *
 * The unreachable runs are returned too, so the caller can render them as a faint
 * wash rather than as a hole. An empty gap says "nothing here"; the truthful
 * message is "more range, just not reachable at this lightness and chroma", and a
 * wash says that without promising a colour it cannot deliver. It also keeps the
 * axis legible as an axis: a hue track broken into four floating fragments is hard
 * to read as one continuous 0–360.
 *
 * Each unreachable run carries HOW FAR out it is rather than a bare boolean, so a
 * stretch a wider screen could show reads brighter than one nothing can - the same
 * onion rings the picker paints, from the same classifier.
 *
 * `samples` is the resolution of the tier test. 180 puts a run's edges within half
 * a percent of the track - finer than the eye reads on a slider, and cheap: each
 * sample is a handful of matrix multiplies, not a bisection.
 */
export function gamutRuns(state: GamutSliderState, samples = 180): GamutRun[] {
  const { min, max } = channelRange(state.channel, cMaxOf(state));
  const n = Math.max(8, Math.floor(samples));
  const tierAt = gamutTierProbe(state.limit);
  // A second, independent probe against what THIS DISPLAY can show. A run inside it
  // is painted truthfully (opaque, in-gamut colour) regardless of its `limit` tier.
  const showsAt = state.displayGamut ? gamutTierProbe(state.displayGamut) : null;
  const runs: GamutRun[] = [];
  let start = 0;
  let startTier: number | null = null;
  let startShown = false;

  const close = (endIdx: number, tier: number, displayable: boolean): void => {
    const from = start / n;
    const to = endIdx / n;
    if (to <= from) return;
    // A handful of stops across the run is plenty - the ramp is smooth, and one
    // stop per sample would put 180 colour stops in a style attribute.
    const stops: string[] = [];
    const steps = Math.max(1, Math.min(12, Math.round((to - from) * 24)));
    for (let k = 0; k <= steps; k++) {
      const v = min + (from + ((to - from) * k) / steps) * (max - min);
      const o = colorAt(state, v);
      // A displayable run is emitted as CSS oklch() so the browser paints the REAL
      // colour in the display's gamut. Everything else is sRGB-mapped hex, so a
      // wash still shades in the right direction rather than promising a colour the
      // screen cannot deliver (or flat-lining at the boundary).
      stops.push(displayable ? `oklch(${o.l.toFixed(4)} ${o.c.toFixed(4)} ${o.h.toFixed(2)})` : oklchToHex(o));
    }
    runs.push({ from, to, stops, tier, displayable });
  };

  for (let i = 0; i <= n; i++) {
    const v = min + (i / n) * (max - min);
    const o = colorAt(state, v);
    const tier = tierAt(o.l, o.c, o.h);
    const shown = showsAt ? showsAt(o.l, o.c, o.h) === 0 : false;
    if (startTier === null) { startTier = tier; startShown = shown; start = i; continue; }
    if (tier !== startTier || shown !== startShown) {
      close(i, startTier, startShown);
      startTier = tier;
      startShown = shown;
      start = i;
    }
  }
  if (startTier !== null) close(n, startTier, startShown);
  return runs;
}

/**
 * The slider's markup. Paint it with {@link paintGamutSlider} once it is in the
 * document and wire it with {@link wireGamutSlider}.
 *
 * The real `<input type="range">` carries the interaction - keyboard, touch and
 * assistive tech all work without any of it being reimplemented - and the
 * segments are decoration behind it.
 */
export function renderGamutSlider(id: string, state: GamutSliderState, value: number): string {
  const r = channelRange(state.channel, drawCMax(state, value));
  const label = CHANNEL_LABEL[state.channel];
  return `
    <div class="gsl" data-gsl="${escapeHtml(id)}" data-channel="${state.channel}">
      <span class="gsl-key" aria-hidden="true">${escapeHtml(label.charAt(0))}</span>
      <div class="gsl-well">
        <div class="gsl-track" data-gsl-track aria-hidden="true"></div>
        <input type="range" class="gsl-input" data-gsl-input
          min="${r.min}" max="${r.max}" step="${r.step}" value="${value}"
          aria-label="${escapeHtml(label)}">
      </div>
      <output class="gsl-val" data-gsl-val>${escapeHtml(formatChannel(state.channel, value))}</output>
    </div>`;
}

/**
 * Paint (or repaint) the broken track and the readout.
 *
 * `outOfBounds` marks the thumb when the current value sits in one of the gaps - 
 * the small indicator that makes free dragging honest. It is a mark, not a
 * refusal: leaving the gamut is frequently the intent.
 */
export function paintGamutSlider(root: HTMLElement, state: GamutSliderState, value: number): void {
  // One ceiling for the whole repaint - the runs, the range's bounds and the thumb
  // all read it, so they cannot land on different scales.
  const drawn: GamutSliderState = { ...state, cMax: drawCMax(state, value) };
  const track = root.querySelector<HTMLElement>('[data-gsl-track]');
  if (track) {
    track.innerHTML = gamutRuns(drawn).map((run) => {
      const left = (run.from * 100).toFixed(3);
      const width = ((run.to - run.from) * 100).toFixed(3);
      const grad = run.stops.length > 1
        ? `linear-gradient(90deg, ${run.stops.join(',')})`
        : (run.stops[0] ?? 'transparent');
      // A wash keeps the axis readable as a whole while staying clearly a hint, and
      // the ring it belongs to says how far out it is. The opacity is a CSS token
      // (--track-tier-*, styles/tokens.css) so it is tunable without touching this,
      // and it is the SAME scale the picker's color-mix stops read - one scale, two
      // mechanisms (here an element really can carry an `opacity`).
      // Opaque when the run is in `limit` (tier 0) OR when the display can render
      // it truthfully (displayable) - on a P3 screen the P3 rings stop being a hint.
      const alpha = (run.tier === 0 || run.displayable)
        ? ''
        : `--seg-a:var(${run.tier === BEYOND_TIER ? '--track-tier-beyond' : `--track-tier-${run.tier}`}, 0%);`;
      return `<span class="gsl-seg" style="${alpha}left:${left}%;width:${width}%;background:${grad}"></span>`;
    }).join('');
  }
  const out = root.querySelector<HTMLElement>('[data-gsl-val]');
  if (out) out.textContent = formatChannel(state.channel, value);
  const input = root.querySelector<HTMLInputElement>('[data-gsl-input]');
  if (input) {
    // The chroma axis ceiling can move between repaints (a caller changed its scale,
    // or the value itself stretched it), so keep the range's bounds in step here as
    // well as at render time - otherwise the thumb sits on the old scale while the
    // track behind it shows the new one.
    //
    // Set before the value. `drawn` guarantees max >= value, which is what makes the
    // order safe in BOTH directions: writing a lower max first would clamp the value
    // being written, and writing the value first against a lower old max would clamp
    // it just the same.
    const r = channelRange(drawn.channel, cMaxOf(drawn));
    if (input.max !== String(r.max)) input.max = String(r.max);
    if (document.activeElement !== input) input.value = String(value);
  }

  // Is the value itself reachable? Asked of the whole colour, not just this axis,
  // because a hue is only "out" in combination with the chroma and lightness held.
  //
  // The flag goes on the COMPONENT root (.gsl), not on whatever container the
  // caller handed us - the CSS targets `.gsl.is-out`, and putting it on a mount
  // wrapper instead means the styling silently never applies.
  const o = colorAt(state, value);
  const el = root.classList.contains('gsl') ? root : root.querySelector<HTMLElement>('.gsl');
  el?.classList.toggle('is-out', !inGamut(o.l, o.c, o.h, state.limit));
}

/**
 * The nearest reachable colour when bounds are ON: keep the channel the user is
 * dragging, and let CHROMA give.
 *
 * The obvious alternative - refuse a value that leaves the gamut - behaves badly
 * on a broken track, because it traps the thumb inside whichever segment it
 * started in and makes most of the hue circle unreachable. Yielding chroma
 * instead matches how the request is actually meant: *this hue, as vivid as it
 * can be*. Lightness is preserved for the same reason - it is the axis a designer
 * is usually holding fixed on purpose.
 */
export function clampIntoGamut(
  o: { l: number; c: number; h: number },
  limit: GamutLimit,
): { l: number; c: number; h: number } {
  // Delegates to the engine primitive (same behaviour: hold L+H, yield chroma to
  // maxChroma's ceiling; in-gamut input returned unchanged).
  return clipToGamut(o, limit);
}

export interface GamutSliderHandlers {
  /** Continuous, on every movement - cheap work only. */
  onInput(value: number): void;
  /** The gesture ended (or a keyboard step landed) - spend the expensive work here. */
  onChange(value: number): void;
}

/** Wire the range input. Returns a teardown. */
export function wireGamutSlider(root: HTMLElement, h: GamutSliderHandlers): () => void {
  const input = root.querySelector<HTMLInputElement>('[data-gsl-input]');
  if (!input) return () => {};
  const onInput = (): void => h.onInput(Number(input.value));
  const onChange = (): void => h.onChange(Number(input.value));
  input.addEventListener('input', onInput);
  input.addEventListener('change', onChange);
  return () => {
    input.removeEventListener('input', onInput);
    input.removeEventListener('change', onChange);
  };
}
