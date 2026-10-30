// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-look.ts - writing a box's keyed APPEARANCE (plans/328) onto the live DOM.
 *
 * Fill colour, stroke colour, stroke width, corner radius and trim are keyframe channels
 * (engine kf-look.ts). The Design hook renders a box whose track keys one of them with
 * that paint behind a custom property (`background:var(--lolly-kf-fill, <authored>)`),
 * so posing the box is setting `--lolly-kf-*` on its element and nothing else, and
 * putting it back is removing them. No authored declaration is ever rewritten, which
 * is what keeps the applier's "every write is reversible, declaration-identical" law
 * true for these channels with no shorthand surgery.
 *
 * Two callers, one rule: the preview applier (sequence-dom.ts), which poses the stage
 * at the playhead, and the video re-raster (sequence-live-raster.ts), which poses one
 * box for one shot. Both hand in the pose the engine evaluated, so the canvas and the
 * file read the same paint.
 *
 * The one DOM write that is not a custom property is a trimmed box shape's outline:
 * its `d` depends on the box's size, radius and stroke width, so a keyed size, radius
 * or width redraws it from the authored outline the hook stamped (`data-trim-*`). The
 * authored `d` is kept and handed back on restore.
 */
import { KF_LOOK_CHANNELS, KF_LOOK_VARS, kfLookUsed, kfLookVars, kfOklabOf, kfOutlinePath, type KfPose, type KfTrack } from '@lolly/engine';

const VAR_NAMES: readonly string[] = Object.values(KF_LOOK_VARS);

/** What this module last wrote on one box: the variable string (so a steady frame writes nothing) and the outline. */
interface LookRecord {
  key: string;
  outline: { path: SVGPathElement; authored: string } | null;
}

const WRITTEN = new WeakMap<HTMLElement, LookRecord>();
const ALPHA = new WeakMap<HTMLElement, { fill: number; stroke: number }>();
const KEYED = new WeakMap<KfTrack, boolean>();

/** Does this track key any appearance channel? Memoised on the (frozen, shared) track. */
export function tracksLook(track: KfTrack | null | undefined): boolean {
  if (!track || track.length === 0) return false;
  const hit = KEYED.get(track);
  if (hit !== undefined) return hit;
  const yes = kfLookUsed(track).length > 0;
  KEYED.set(track, yes);
  return yes;
}

/** The pose's appearance channels only, or null when it holds none. */
export function lookOf(pose: KfPose): KfPose | null {
  const out: KfPose = {};
  let any = false;
  for (const ch of KF_LOOK_CHANNELS) {
    const v = pose[ch];
    if (typeof v === 'number') { out[ch] = v; any = true; }
  }
  return any ? out : null;
}

/** A short stable key for one look, for a memo that must re-shoot when the paint moves. */
export function lookKey(look: KfPose | null | undefined): string {
  if (!look) return '';
  return Object.keys(look).sort().map((k) => `${k}${look[k as keyof KfPose]}`).join('_');
}

/**
 * The alpha of the box's own fill and stroke, which a key does not carry. Read once from
 * computed style, which is the authored colour whatever the playhead wrote: every colour
 * this module writes keeps the alpha it read.
 */
function baseAlpha(el: HTMLElement): { fill: number; stroke: number } {
  const hit = ALPHA.get(el);
  if (hit) return hit;
  let fill = 1, stroke = 1;
  try {
    // A pen path's fill is its first <path>; its stroke is the first one that carries a
    // stroke attribute (the same path unless the stroke is placed or trimmed). A box's
    // are its background and border, unless a trim drew the border as an outline.
    const fillPath = el.querySelector<SVGElement>(':scope > svg.lolly-box-path > path');
    const inkPath = el.querySelector<SVGElement>(':scope > svg.lolly-box-path > path[stroke]')
      ?? el.querySelector<SVGElement>(':scope > svg.lolly-box-trim > path');
    const cs = getComputedStyle(el);
    fill = kfOklabOf(fillPath ? getComputedStyle(fillPath).fill : cs.backgroundColor)?.alpha ?? 1;
    stroke = kfOklabOf(inkPath ? getComputedStyle(inkPath).stroke : cs.borderTopColor)?.alpha ?? 1;
  } catch { /* jsdom, or a detached box: opaque, which every brand colour is */ }
  const out = { fill, stroke };
  ALPHA.set(el, out);
  return out;
}

/** The trimmed box-shape outline the hook drew, when this box has one. */
function trimOutline(el: HTMLElement): { svg: SVGSVGElement; path: SVGPathElement } | null {
  const svg = el.querySelector<SVGSVGElement>(':scope > svg.lolly-box-trim');
  const path = svg?.querySelector<SVGPathElement>('path') ?? null;
  return svg && path ? { svg, path } : null;
}

/**
 * Pose one box's appearance. `look` is the evaluated pose (appearance channels only, or
 * null to take the box back to its authored paint); `size` is the box's layout size at
 * this instant, which a trimmed box shape's outline is redrawn at.
 */
export function applyLook(el: HTMLElement, look: KfPose | null, size?: { w: number; h: number } | null): void {
  if (!look) { clearLook(el); return; }
  const vars = kfLookVars(look, (() => {
    const a = baseAlpha(el);
    return { fillAlpha: a.fill, strokeAlpha: a.stroke };
  })());
  const trim = trimOutline(el);
  let d: string | null = null;
  if (trim && (typeof look.lw === 'number' || typeof look.cr === 'number' || size)) {
    const shape = trim.svg.getAttribute('data-trim-shape') || 'rect';
    const r = typeof look.cr === 'number' ? look.cr : Number(trim.svg.getAttribute('data-trim-r')) || 0;
    const sw = typeof look.lw === 'number' ? look.lw : Number(trim.svg.getAttribute('data-trim-sw')) || 0;
    const w = size && size.w > 0 ? size.w : el.offsetWidth || parseFloat(el.style.width) || 0;
    const h = size && size.h > 0 ? size.h : el.offsetHeight || parseFloat(el.style.height) || 0;
    if (w > 0 && h > 0) d = kfOutlinePath(shape, w, h, r, sw / 2);
  }
  const key = `${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}|${d ?? ''}`;
  const rec = WRITTEN.get(el);
  if (rec && rec.key === key) return;
  for (const name of VAR_NAMES) {
    const v = vars[name];
    if (v === undefined) { if (el.style.getPropertyValue(name)) el.style.removeProperty(name); }
    else if (el.style.getPropertyValue(name) !== v) el.style.setProperty(name, v);
  }
  let outline = rec?.outline ?? null;
  if (d !== null && trim) {
    if (!outline) outline = { path: trim.path, authored: trim.path.getAttribute('d') ?? '' };
    if (trim.path.getAttribute('d') !== d) trim.path.setAttribute('d', d);
  } else if (outline) {
    outline.path.setAttribute('d', outline.authored);
    outline = null;
  }
  WRITTEN.set(el, { key, outline });
}

/** Take a box back to its authored appearance. A no-op on a box this module never posed. */
export function clearLook(el: HTMLElement): void {
  const rec = WRITTEN.get(el);
  if (!rec) return;
  for (const name of VAR_NAMES) if (el.style.getPropertyValue(name)) el.style.removeProperty(name);
  if (rec.outline) rec.outline.path.setAttribute('d', rec.outline.authored);
  WRITTEN.delete(el);
}

/** True while this module has a pose written on `el`. */
export function lookWritten(el: HTMLElement): boolean {
  return WRITTEN.has(el);
}
