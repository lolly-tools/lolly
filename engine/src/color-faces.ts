// SPDX-License-Identifier: MPL-2.0
/**
 * A brand colour's FACES: one canonical value, plus what it becomes in every
 * space and on every press it can be expressed in.
 *
 * The generalisation of `PrintLock` (`shells/web/src/lib/brand-doc.ts`), which
 * already let a token pin a CMYK build and a spot ink. Andy's direction is that
 * pinning is not a print feature — "print lock is what we want to expand to all
 * colour spaces for brand colour tokens" — so this module owns the shape and the
 * rules, and the brand editor, the pickers and the export walkers all read it.
 *
 * ## Canonical plus overrides, not a bag of values
 *
 * A token could store an independently authored colour per space. It must not.
 * Only canonical-plus-overrides can answer *"are these the same colour?"*, and
 * that question is the whole point of a brand:
 *
 *  - drift is detectable — "your P3 face is ΔE 4.2 from canonical, deliberate?"
 *  - CHOSEN stays distinguishable from COMPUTED, so a re-derive knows what it may
 *    recompute and what it must leave alone
 *  - a target that did not exist yet (a new press, Rec.2100) derives itself
 *    without invalidating anything already authored
 *
 * ## The narrow faces are not lesser
 *
 * The sRGB face is the BAKE — what most viewers, most print pipelines and every
 * older browser actually receive. The automatic §14.2 gamut map picks the nearest
 * reproducible colour by ΔE, and a brand will often prefer a *different* sRGB
 * green: one that reads as the same brand colour to a human even though it is not
 * the closest by measurement. So an override on a narrow space is an authored
 * fallback that must WIN at bake time, not a note attached to the real value.
 *
 * ## Keyed by identity, never by name
 *
 * Two shops' "coated" profiles are not the same profile, so a friendly name
 * cannot be the key — a target id is the profile's own identity
 * (`gamutSourceId`: `icc:<sha256-prefix>:<intent>`) or a CSS space name. The
 * human label rides ALONGSIDE as a label, never as the lookup. Getting that
 * backwards silently corrupts a brand pack: an override authored against one
 * shop's profile would be applied to another's under the same label, and nothing
 * would report an error.
 *
 * A face whose profile is not currently mounted is KEPT. The override is still
 * the user's, and dropping it because a profile was unmounted is data loss.
 */

import { deltaEOkColor, parseColor, formatColor, convertColor } from './css-color.ts';
import type { CssColor } from './css-color.ts';

/**
 * A face's target: a CSS colour space tag, or a mounted profile × intent.
 *
 * Deliberately a plain string rather than a union. The set is DYNAMIC — it grows
 * when a press profile is loaded and shrinks when one is removed — so a fixed
 * enum would either have to be edited for every new profile or would reject the
 * ids it is supposed to carry.
 */
export type FaceTarget = string;

/** How a face got its value. */
export type FaceOrigin =
  /** Computed from the canonical value. Recomputed freely; never stored. */
  | 'auto'
  /** Authored. Survives a re-derive, and wins at bake time. */
  | 'set';

export interface ColorFace {
  target: FaceTarget;
  /**
   * The colour, in whatever notation that target speaks — a CSS colour string
   * for a space, four ink percentages for a press profile.
   */
  value: string | [number, number, number, number];
  origin: FaceOrigin;
  /**
   * A human name for the target, carried for display only.
   *
   * Stored alongside a `set` face so a profile that is not mounted can still be
   * NAMED in the UI ("Coated FOGRA39, relative — not on this device") rather than
   * appearing as a hash. Never consulted to match a face to a target.
   */
  label?: string;
  /**
   * Perceptual distance from what the target WOULD have derived, when both are
   * known. The number that lets a swatch say "this face is deliberate, and it is
   * this far from the automatic answer". Absent for an `auto` face (it is the
   * derived value, so the distance is zero by construction) and for a face whose
   * target cannot currently be derived.
   */
  drift?: number;
}

/** The stored form: only `set` faces exist on disk. */
export interface StoredFace {
  value: string | [number, number, number, number];
  label?: string;
}

/**
 * Read the `faces` map out of a token's vendor-extension namespace.
 *
 * Tolerant by design. This parses a file a user may have hand-edited or that a
 * future version wrote, so an entry it cannot make sense of is SKIPPED rather
 * than throwing — losing one override is recoverable, refusing to open the brand
 * pack is not.
 */
export function readFaces(ext: unknown): Map<FaceTarget, StoredFace> {
  const out = new Map<FaceTarget, StoredFace>();
  if (!isRec(ext)) return out;
  const faces = (ext as Record<string, unknown>).faces;
  if (!isRec(faces)) return out;
  for (const [target, raw] of Object.entries(faces)) {
    if (!target || !isRec(raw)) continue;
    const v = (raw as Record<string, unknown>).value;
    const label = (raw as Record<string, unknown>).label;
    const value = normaliseFaceValue(v);
    if (value === null) continue;
    out.set(target, { value, ...(typeof label === 'string' && label ? { label } : {}) });
  }
  return out;
}

/**
 * A stored face value, validated, or null if it is not one.
 *
 * Ink percentages are clamped to 0–100 rather than rejected: a build of 105%
 * cyan is a typo with an obvious intent, and refusing the whole override over it
 * would throw away the other three numbers too.
 */
function normaliseFaceValue(v: unknown): string | [number, number, number, number] | null {
  if (typeof v === 'string') return v.trim() ? v.trim() : null;
  if (Array.isArray(v) && v.length === 4 && v.every(n => typeof n === 'number' && Number.isFinite(n))) {
    return v.map(n => Math.min(100, Math.max(0, n))) as [number, number, number, number];
  }
  return null;
}

/**
 * Write (or, with `null`, clear) one face in a vendor-extension namespace,
 * mutating it in place and returning it.
 *
 * Clearing prunes the empty `faces` map as well as the entry, so a token that
 * has had every override removed is byte-identical to one that never had any.
 * Without that, "clear" would leave a `"faces": {}` crumb in every brand pack
 * anyone ever experimented in, and a diff would show churn that means nothing.
 */
export function writeFace(
  ns: Record<string, unknown>,
  target: FaceTarget,
  face: StoredFace | null,
): Record<string, unknown> {
  const faces = isRec(ns.faces) ? (ns.faces as Record<string, unknown>) : null;
  if (face === null) {
    if (faces) {
      delete faces[target];
      if (Object.keys(faces).length === 0) delete ns.faces;
    }
    return ns;
  }
  const map = faces ?? ((ns.faces = {} as Record<string, unknown>) as Record<string, unknown>);
  const value = normaliseFaceValue(face.value);
  if (value === null) return ns;
  map[target] = { value, ...(face.label ? { label: face.label } : {}) };
  return ns;
}

/**
 * Every face of a colour: the derived value for each target on offer, with any
 * authored override substituted and marked.
 *
 * `derive` is injected rather than imported because deriving a PRESS face needs
 * an ICC profile and its rendering intent, which is shell state — the engine
 * must not reach for it. It returns null for a target it cannot currently
 * answer for (an unmounted profile), and that case is handled rather than
 * dropped: the override still appears, still marked `set`, just with no drift to
 * report. Losing sight of an override because its profile is unplugged is the
 * data loss this whole module is arranged to avoid.
 */
export function colorFaces(
  canonical: string,
  targets: readonly { target: FaceTarget; label?: string }[],
  stored: ReadonlyMap<FaceTarget, StoredFace>,
  derive: (canonical: string, target: FaceTarget) => ColorFace['value'] | null,
): ColorFace[] {
  const out: ColorFace[] = [];
  const seen = new Set<FaceTarget>();
  for (const { target, label } of targets) {
    seen.add(target);
    const override = stored.get(target);
    const derived = derive(canonical, target);
    if (!override) {
      if (derived === null) continue;   // nothing to show and nothing authored
      out.push({ target, value: derived, origin: 'auto', ...(label ? { label } : {}) });
      continue;
    }
    const drift = derived === null ? undefined : faceDrift(override.value, derived);
    out.push({
      target,
      value: override.value,
      origin: 'set',
      ...(label || override.label ? { label: label ?? override.label } : {}),
      ...(drift === undefined ? {} : { drift }),
    });
  }
  // Overrides whose target is not on offer right now — an unmounted profile.
  // Appended rather than interleaved: they are not choices the reader can act on
  // in this session, and sorting them among live targets would imply they are.
  for (const [target, face] of stored) {
    if (seen.has(target)) continue;
    out.push({ target, value: face.value, origin: 'set', ...(face.label ? { label: face.label } : {}) });
  }
  return out;
}

/**
 * How far an authored face is from the derived one, perceptually.
 *
 * Only meaningful when both are colours in a space we can measure — two ink
 * builds are compared by their largest single-ink difference in percentage
 * points instead, which is what a printer would actually notice and argue about.
 * Returns undefined when the pair cannot be compared at all rather than
 * inventing a zero, because a zero reads as "identical" and would hide drift.
 */
export function faceDrift(
  a: ColorFace['value'],
  b: ColorFace['value'],
): number | undefined {
  if (Array.isArray(a) && Array.isArray(b)) {
    let worst = 0;
    for (let i = 0; i < 4; i++) worst = Math.max(worst, Math.abs((a[i] ?? 0) - (b[i] ?? 0)));
    return worst;
  }
  if (typeof a !== 'string' || typeof b !== 'string') return undefined;
  const ca = parseColor(a), cb = parseColor(b);
  if (!ca || !cb) return undefined;
  return deltaEOkColor(ca, cb);
}

/**
 * The canonical value for storage: Lab, not OKLCH.
 *
 * Lab is the profile connection space of every ICC profile, so a screen face and
 * a press face meet there without a lossy hop through a display gamut. Editing
 * still happens in OKLCH — it is the better space to reason in — but round-
 * tripping an author's OKLCH through sRGB on the way to disk is exactly the bake
 * this model exists to keep OUT of the value path.
 */
export function canonicalValue(color: string | CssColor): string | null {
  const c = typeof color === 'string' ? parseColor(color) : color;
  if (!c) return null;
  return formatColor(convertColor(c, 'lab'));
}

const isRec = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
