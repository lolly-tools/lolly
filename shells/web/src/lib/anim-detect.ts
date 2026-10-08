// SPDX-License-Identifier: MPL-2.0
/**
 * Animated-asset detection for the live frame loop (views/live-controls.ts).
 *
 * A tool with an `onFrame` hook can be driven by any moving picture, not just the
 * camera - the media bridge's anim source (bridge/media.ts AnimSourceSpec) replays
 * an animated asset through the same per-frame path. This module answers the ONE
 * question that decides whether the Play affordance appears for a picked asset:
 * "does this ref hold motion we can actually play?"
 *
 * Three kinds, three signals:
 *   - video:  the ref's own type/format - a video container is motion by definition.
 *   - raster: `meta.animated` - stamped at ingest for uploads (picker.ts sniffs the
 *             header bytes via the engine's sniffAnimatedRaster) and derived from
 *             the catalog's "animated" tag for library assets (bridge/assets.ts).
 *             Playback needs WebCodecs ImageDecoder (drawImage of an animated
 *             <img> yields only the first frame per spec), so this kind is gated
 *             on `canDecodeRaster`.
 *   - svg:    nothing on the ref says whether an SVG moves - the markup does. The
 *             caller fetches it (cached - views/anim-svg-mount.ts) and asks
 *             svgMarkupAnimated(). 'svg-check' is the "fetch it and see" verdict.
 *
 * Lottie assets are deliberately NOT classified as playable here - the anim source
 * has no lottie player yet (they keep their existing static poster path).
 *
 * Pure and DOM-free so the whole decision table is node-testable
 * (lib/anim-detect.test.ts).
 */

/** The structure of an asset-input value this module reads - a structural subset of
 *  AssetRef so hooks-produced / test refs classify identically. */
export interface AnimRefLike {
  type?: string;
  format?: string;
  url?: string;
  meta?: Record<string, unknown> | null;
}

/** A playable verdict: what to arm the media anim source with. */
export interface AnimSourceHint {
  kind: 'svg' | 'raster' | 'video';
  url: string;
}

/** Video container formats a ref may carry (mirrors the picker's video set). */
const VIDEO_FORMATS = new Set(['mp4', 'm4v', 'webm', 'mov', 'ogv']);

// SMIL animation elements - <animate>, <animateTransform>, <animateMotion>,
// <animateColor>, <set> - as real element starts (not substrings of other names).
const SMIL_RE = /<(?:animate|animateTransform|animateMotion|animateColor|set)[\s/>]/i;
// CSS animation: an @keyframes block, or an animation/animation-name declaration
// (in a <style> block or a style="" attribute).
const KEYFRAMES_RE = /@keyframes/i;
const CSS_ANIM_RE = /[{;\s"']animation(?:-name)?\s*:/i;

/**
 * Whether SVG markup carries animation that keeps playing inside a rendered
 * document (CSS @keyframes / animation declarations, or SMIL elements). A plain
 * static SVG returns false. Text-level sniff by design - no DOM parse, safe to
 * run on untrusted markup, and cheap enough for a per-pick check.
 */
export function svgMarkupAnimated(markup: string): boolean {
  if (!markup) return false;
  return SMIL_RE.test(markup) || KEYFRAMES_RE.test(markup) || CSS_ANIM_RE.test(markup);
}

// One SMIL animation element's opening tag, and the two attributes the loop reads.
const SMIL_TAG_RE = /<(?:animate|animateTransform|animateMotion|animateColor|set)\b[^>]*>/gi;
const DUR_ATTR_RE = /\bdur\s*=\s*["']([^"']+)["']/i;
const FOREVER_RE = /\brepeat(?:Count|Dur)\s*=\s*["']\s*indefinite\s*["']/i;
// A CSS animation declaration's value, up to the end of the declaration.
const CSS_ANIM_DECL_RE = /\banimation\s*:\s*([^;}"]+)/gi;
const CSS_TIME_RE = /(?:^|[\s,])(\d*\.?\d+)(ms|s)\b/i;
/** The longest loop worth reporting; past it the parts never realign in a useful clip. */
const MAX_LOOP_MS = 120_000;

/** An SMIL clock value in ms: `8s`, `250ms`, a bare number of seconds, or `mm:ss` /
 *  `hh:mm:ss`. 0 for anything else (including `indefinite` and `media`). */
function smilClockMs(raw: string): number {
  const v = raw.trim();
  const unit = /^(\d*\.?\d+)\s*(h|min|s|ms)?$/i.exec(v);
  if (unit) {
    const n = Number(unit[1]);
    const scale = { h: 3_600_000, min: 60_000, s: 1000, ms: 1 }[(unit[2] ?? 's').toLowerCase() as 'h' | 'min' | 's' | 'ms'];
    return n * scale;
  }
  const clock = /^(?:(\d+):)?(\d+):(\d*\.?\d+)$/.exec(v);
  if (clock) return ((Number(clock[1] ?? 0) * 60 + Number(clock[2])) * 60 + Number(clock[3])) * 1000;
  return 0;
}

function gcd(a: number, b: number): number { while (b) [a, b] = [b, a % b]; return a; }

/**
 * How long one full loop of an animated SVG lasts, in ms, read off the markup;
 * 0 when nothing in it repeats forever (a one-shot animation has no loop to report).
 *
 * The loop is the point where every forever-repeating animation is back at its start
 * together: the least common multiple of their durations, taken in centiseconds so a
 * `0.333s` cannot blow the multiple up. SMIL counts when it carries `repeatCount` or
 * `repeatDur="indefinite"`; CSS counts for an `animation:` shorthand that says
 * `infinite`. When the parts never realign inside {@link MAX_LOOP_MS}, the longest single
 * duration is returned instead: still a usable length, though its end will not meet its start.
 *
 * Callers use it to give a moving picture a real length where they place it - a Design
 * box gets a clip exactly one loop long, and a video of that clip ends where it began.
 * Text-level like svgMarkupAnimated, so it is safe on untrusted markup.
 */
export function svgLoopMs(markup: string): number {
  if (!markup) return 0;
  const durs: number[] = [];
  for (const tag of markup.match(SMIL_TAG_RE) ?? []) {
    if (!FOREVER_RE.test(tag)) continue;
    const d = DUR_ATTR_RE.exec(tag);
    const ms = d ? smilClockMs(d[1]!) : 0;
    if (ms > 0) durs.push(ms);
  }
  for (const m of markup.matchAll(CSS_ANIM_DECL_RE)) {
    for (const part of m[1]!.split(',')) {
      if (!/\binfinite\b/i.test(part)) continue;
      const time = CSS_TIME_RE.exec(part);
      const ms = time ? Number(time[1]) * (time[2]!.toLowerCase() === 'ms' ? 1 : 1000) : 0;
      if (ms > 0) durs.push(ms);
    }
  }
  if (!durs.length) return 0;
  const longest = Math.max(...durs);
  let lcm = 1;
  for (const ms of durs) {
    const cs = Math.max(1, Math.round(ms / 10));
    lcm = (lcm / gcd(lcm, cs)) * cs;
    if (lcm * 10 > MAX_LOOP_MS) return Math.round(longest);
  }
  return lcm * 10;
}

/**
 * Classify an asset-input value by its metadata alone (no fetch):
 *   - { kind, url } - playable now (video always; raster only when the runtime
 *                      can decode it, i.e. `canDecodeRaster`),
 *   - 'svg-check' - an SVG whose markup must be fetched + sniffed
 *                      (svgMarkupAnimated) before a verdict,
 *   - null - a still (or unplayable) asset: no Play affordance.
 */
export function precheckAnimatedRef(
  ref: AnimRefLike | null | undefined,
  opts: { canDecodeRaster?: boolean } = {},
): AnimSourceHint | 'svg-check' | null {
  if (!ref || typeof ref !== 'object' || !ref.url) return null;
  const format = String(ref.format ?? '').toLowerCase();
  if (ref.type === 'video' || VIDEO_FORMATS.has(format)) return { kind: 'video', url: ref.url };
  if (ref.meta?.animated === true) {
    return opts.canDecodeRaster ? { kind: 'raster', url: ref.url } : null;
  }
  if (format === 'svg' || ref.type === 'vector') return 'svg-check';
  return null;
}
