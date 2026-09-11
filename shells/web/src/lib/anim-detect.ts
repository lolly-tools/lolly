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
