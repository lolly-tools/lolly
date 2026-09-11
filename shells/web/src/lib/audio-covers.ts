// SPDX-License-Identifier: MPL-2.0
/**
 * Per-user cover art for an audio asset - the OPT-IN override over the generated look.
 *
 * THE GENERATED DEFAULT IS THE PRODUCT. Every audio asset already gets a waveform shape
 * and a brand colour derived from its id, free, with no interaction (lib/audio-thumb.ts
 * + lib/audio-thumb-colour.ts). This module exists only so the handful of tracks a user
 * actually cares about can be styled deliberately. There is no empty state, no prompt
 * and no nag: someone who never opens the details modal must never notice a feature is
 * missing, and the honest measure of success here is how RARELY this is used. If people
 * feel they have to customise, the generated default is not good enough and the fix
 * belongs upstream, not in a bigger picker.
 *
 * ── WHAT IS STORED IS A RECIPE, NOT PIXELS ─────────────────────────────────────
 * `"<shape>"`, `"<shape>:<colourIndex>"`, `"viz:<presetId>"` or `"viz:<presetId>:<i>"` - 
 * a few bytes on the profile. That split is the whole design:
 *
 *   STRUCTURE IS FROZEN. The shape is what the user chose and nothing we do may change
 *   it. A rebrand must never turn their blob into a ring.
 *
 *   COLOUR RE-RESOLVES. The index points into the ACTIVE brand's pool rather than at a
 *   hex, so a cover re-skins when the brand changes and keeps mixing with its
 *   environment. That is desired behaviour, not drift - the user picked a generative
 *   default, so seeing it follow the brand is the point.
 *
 * Storing a hex would freeze the paint as well and strand the cover on whichever brand
 * happened to be active; storing an image would additionally cost real bytes and stop
 * it re-rendering crisply at any size. A MilkDrop cover follows the SAME rule: the
 * preset id is the truth and any rendered pixels are a cache that can be thrown away and
 * regenerated - which is what lets a MilkDrop cover re-skin on a rebrand too, since the
 * brand colour is baked into the shader wrapping rather than into the stored value.
 *
 * ── WHY THE PROFILE ────────────────────────────────────────────────────────────
 * A catalog asset is a PERMANENT CONTRACT and cannot be mutated, so an override has to
 * be a per-user overlay keyed by asset id. That is exactly what favourites, hides and
 * category overrides already are, so this follows lib/asset-favourites.ts rather than
 * inventing a second mechanism - same base-id keying, same load/save shape, and it
 * travels in the portable profile backup so a cover is not stranded on one device.
 */
import { assetBaseId } from './asset-favourites.ts';
import { audioThumbShape, type AudioThumbShape } from './audio-thumb.ts';
import { audioThumbInk, type AudioThumbInk } from './audio-thumb-colour.ts';
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

type CoverHost = HostV1 & { profile: { set(p: Profile): Promise<unknown> } };

/** The shapes a cover may name. Kept as a value so a stored string can be validated - 
 *  a profile is user data and can carry anything, including a shape from a future
 *  version this build has never heard of. */
const SHAPES: readonly AudioThumbShape[] = ['bars', 'mirror', 'wave', 'ring', 'blob'];

/**
 * One asset's chosen cover.
 *
 * `kind` is the STRUCTURE, and it is what must never change under the user: either one
 * of the drawn waveform shapes, or a MilkDrop preset id. `colour` absent = keep the
 * generated ink, so pinning only a shape still lets the brand choose the paint.
 */
export interface AudioCover {
  /** A waveform shape, or `viz:<presetId>` for a MilkDrop preset. */
  shape: AudioThumbShape | `viz:${string}`;
  colour?: number;
}

/** Is this cover a MilkDrop preset rather than a drawn shape? */
export function isVizCover(cover: AudioCover | null | undefined): boolean {
  return typeof cover?.shape === 'string' && cover.shape.startsWith('viz:');
}

/** The preset id inside a `viz:` cover, or '' when it is a plain shape. */
export function vizPresetOf(cover: AudioCover | null | undefined): string {
  return isVizCover(cover) ? cover!.shape.slice(4) : '';
}

/** Parse a stored value. Returns null for anything unrecognised rather than throwing or
 *  guessing: an unreadable cover must degrade to the generated look, never to an error
 *  or to a shape the user did not choose. */
export function parseCover(raw: unknown): AudioCover | null {
  if (typeof raw !== 'string' || !raw) return null;

  // A MilkDrop cover is `viz:<presetId>[:<colour>]`. Preset ids are slugs (letters,
  // digits, dashes - see scripts/copy-viz-presets.ts idFor), so they can never contain
  // a colon and the LAST segment is unambiguously the optional colour index.
  if (raw.startsWith('viz:')) {
    const parts = raw.split(':');
    const tail = parts.length > 2 ? parts[parts.length - 1]! : '';
    const hasColour = /^\d+$/.test(tail);
    const preset = parts.slice(1, hasColour ? -1 : undefined).join(':');
    if (!preset || !/^[a-z0-9-]+$/i.test(preset)) return null;
    const cover: AudioCover = { shape: `viz:${preset}` };
    if (hasColour) cover.colour = Number.parseInt(tail, 10);
    return cover;
  }

  const [shape, idx] = raw.split(':', 2);
  if (!SHAPES.includes(shape as AudioThumbShape)) return null;
  const cover: AudioCover = { shape: shape as AudioThumbShape };
  if (idx !== undefined) {
    const n = Number.parseInt(idx, 10);
    // A negative or non-numeric index is corrupt; a LARGE one is not, because the pool
    // shrinks and grows with the brand. Out-of-range is handled at read time by falling
    // back to the generated ink, so the choice survives a brand that temporarily has
    // fewer colours.
    if (Number.isInteger(n) && n >= 0) cover.colour = n;
  }
  return cover;
}

/** Serialise for the profile. The inverse of parseCover. */
export function formatCover(cover: AudioCover): string {
  return cover.colour === undefined ? cover.shape : `${cover.shape}:${cover.colour}`;
}

/** Every stored cover, as base-id → cover. Unreadable entries are dropped silently. */
export function loadAudioCovers(profile: Profile | null | undefined): Map<string, AudioCover> {
  const out = new Map<string, AudioCover>();
  const rec = profile?.audioCovers;
  if (!rec || typeof rec !== 'object') return out;
  for (const [id, raw] of Object.entries(rec)) {
    const cover = parseCover(raw);
    if (cover) out.set(id, cover);
  }
  return out;
}

/**
 * Set or CLEAR one asset's cover, then persist.
 *
 * Passing null clears it - reverting to the generated default must be exactly as easy
 * as setting one, and must not be reachable only by picking something else. Best-effort
 * like the other overlays: a failed write means the choice does not survive a reload,
 * which is annoying rather than broken.
 */
export async function saveAudioCover(
  host: CoverHost, profile: Profile, assetId: string, cover: AudioCover | null,
): Promise<void> {
  const key = assetBaseId(assetId);
  const rec = { ...(profile.audioCovers ?? {}) };
  if (cover) rec[key] = formatCover(cover);
  else delete rec[key];
  // Drop the key entirely when the last cover goes, so an untouched profile stays clean
  // and the field's absence keeps meaning "never used this".
  if (Object.keys(rec).length) profile.audioCovers = rec;
  else delete profile.audioCovers;
  try { await host.profile.set(profile); } catch { /* storage off / quota - non-fatal */ }
}

/**
 * The look to draw for one asset: the user's cover where they set one, the generated
 * look everywhere else. ONE read path - an override is checked first and nothing else
 * branches on whether a cover exists.
 */
export function resolveAudioLook(
  id: string,
  pool: readonly string[],
  covers?: ReadonlyMap<string, AudioCover>,
): { shape: AudioThumbShape; ink: AudioThumbInk | null; custom: boolean; viz: string } {
  const cover = covers?.get(assetBaseId(id));
  const generated = audioThumbInk(id, pool);
  if (!cover) return { shape: audioThumbShape(id), ink: generated, custom: false, viz: '' };

  // A pinned colour index that the CURRENT brand's pool cannot satisfy falls back to
  // the generated ink rather than to nothing: the brand having fewer colours today is
  // not a reason to blank someone's cover, and if the pool grows back the pinned choice
  // is still there and starts working again.
  const ink = cover.colour !== undefined && cover.colour < pool.length
    ? { hex: pool[cover.colour]!, index: cover.colour }
    : generated;
  // A MilkDrop cover has no DRAWN shape - the caller renders its baked image instead and
  // uses `shape` only as the fallback for a tile whose bake is missing (a fresh device,
  // an evicted cache), so it must still be a real drawn shape rather than the viz id.
  const viz = vizPresetOf(cover);
  return { shape: viz ? audioThumbShape(id) : (cover.shape as AudioThumbShape), ink, custom: true, viz };
}
