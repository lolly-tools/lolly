// SPDX-License-Identifier: MPL-2.0
/**
 * Brand colours for audio waveform thumbnails - the "that song is the pink blob one"
 * layer.
 *
 * WHY COLOUR, when the shape already varies. Shape alone gives five identities, and
 * measurement showed that is not enough in practice: catalog music is loudness-
 * maximised, so most clips' peaks sit near 1.0 for most of their length and two tiles
 * of the same shape look near-identical at 100px. Colour is what makes a grid
 * scannable - a viewer recognises a tile before reading its label, and after a few
 * uses the pairing becomes a memory hook rather than decoration.
 *
 * IDENTITY IS MULTIPLICATIVE, WHICH IS WHY THE HASHES MUST NOT AGREE. Shape and
 * colour are derived from the same asset id but with DIFFERENT salts. Hash the id
 * once and reuse it and the two dimensions correlate perfectly - every blob comes out
 * the same colour, and five shapes × six hues collapses back to five identities
 * instead of thirty. The salts are what buy the multiplication.
 *
 * THIS DOES NOT BREACH THE HONESTY RULE. The hash chooses PRESENTATION - which form,
 * which hue - and never DATA. The bars' heights remain measured peaks or the tile
 * stays an honest glyph; nothing here invents a waveform, and nothing here may ever be
 * extended to. See lib/audio-thumb.ts's header for the rule itself.
 *
 * TWO CONSTRAINTS INHERITED FROM THE VISUALIZER WORK, both learned the hard way:
 *
 *   NEVER INVENT A HUE THE BRAND DOES NOT OWN. A monochrome or greyscale brand gets
 *   its variety from LIGHTNESS, not from a synthesised colour - a tile in a hue the
 *   brand has never used is off-brand, and "it looked nicer" is not a licence to
 *   repaint someone's identity. This is not an edge case: the lolly-start profile is
 *   nearly neutral, so it is the COMMON path here and wants testing first.
 *
 *   LEGIBILITY, JUDGED AGAINST THE SURFACE ACTUALLY PAINTED ON. A candidate is checked
 *   against the ACTIVE theme's tile background - not against both. Requiring both was
 *   tried first and is wrong, measurably: against SUSE it rejects the dark green
 *   (APCA Lc 100 on white, 0 on dark) and the off-white (0 on white, −97 on dark) - 
 *   precisely the brand's most characteristic colours - leaving only mid-tones, which
 *   is the monotony this module exists to remove. A tile is only ever on one surface
 *   at a time, so that is what it must be judged against.
 */

/** A resolved paint for one tile: the ink, and the palette slot it came from. */
export interface AudioThumbInk {
  /** The colour to paint with - goes on `--audio-thumb-ink`. */
  hex: string;
  /** Which pool entry this is, so a caller can persist a CHOICE rather than a hex. */
  index: number;
}

/**
 * Minimum APCA lightness contrast a candidate must reach against BOTH tile
 * backgrounds.
 *
 * Deliberately well below a text threshold (|60| for body copy): a waveform is a large
 * solid shape, not 14px type, and holding it to a text bar would reject most of a
 * brand's mid-tones and leave only near-black and near-white - which is exactly the
 * monotony this module exists to remove. 25 keeps a shape clearly readable while
 * leaving the palette usable. APCA rather than WCAG on the house rule that APCA comes
 * first for anything perceptual.
 */
const MIN_LC = 25;

/** Tile backgrounds per theme. Approximations of the card surfaces, not exact tokens:
 *  the guard only needs to reject a colour that VANISHES, and a couple of points of
 *  lightness either way does not change that. */
export const THUMB_SURFACE = { light: '#ffffff', dark: '#12141a' } as const;
export type ThumbTheme = keyof typeof THUMB_SURFACE;

/** Ceiling on the pool. More than this and neighbouring tiles stop being tellable
 *  apart anyway, so the extra colours buy nothing and only dilute the memory hook. */
const MAX_POOL = 8;

/** The host slice this module reads - the perceptual maths, feature-detected. */
interface ColourHost {
  color?: {
    apca?(text: string, bg: string): number;
    contrast?(a: string, b: string): number;
    deltaE?(a: string, b: string): number;
  };
}

/** Is this a real hex we can reason about? Palette entries can carry aliases and
 *  unresolved token refs, which must not reach the colour maths. */
function isHex(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(v.trim());
}

/** Legible on the surface this tile is actually painted on. Without host.color - or
 *  without a stated theme - the guard cannot run and everything passes: an older shell
 *  shows a slightly less curated pool rather than no colour at all. */
function legible(host: ColourHost | undefined, hex: string, theme: ThumbTheme | undefined): boolean {
  const apca = host?.color?.apca;
  if (typeof apca !== 'function' || !theme) return true;
  try {
    return Math.abs(apca(hex, THUMB_SURFACE[theme])) >= MIN_LC;
  } catch {
    return true;
  }
}

/**
 * Build the colour pool from a brand's palette.
 *
 * Order matters and is not alphabetical: entries keep their palette order, which is
 * the brand's own declared order (primary first), so the commonest tiles land on the
 * brand's most characteristic colours rather than on whatever sorted first.
 *
 * Near-duplicates are dropped - two swatches a JND apart are two tiles a viewer reads
 * as the same tile, which defeats the point.
 */
export function audioThumbPool(
  palette: ReadonlyArray<{ hex?: unknown }> | undefined,
  host?: ColourHost,
  theme?: ThumbTheme,
): string[] {
  const pool: string[] = [];
  const deltaE = host?.color?.deltaE;
  for (const entry of palette ?? []) {
    const hex = entry?.hex;
    if (!isHex(hex)) continue;
    const c = hex.trim().toLowerCase().slice(0, 7);
    if (pool.includes(c)) continue;
    if (!legible(host, c, theme)) continue;
    // ~0.06 in OKLab is comfortably past a just-noticeable difference, so what
    // survives is a set of colours a person would actually name differently.
    if (typeof deltaE === 'function' && pool.some((p) => { try { return deltaE(p, c) < 0.06; } catch { return false; } })) continue;
    pool.push(c);
    if (pool.length >= MAX_POOL) break;
  }
  return pool;
}

/**
 * The ink for one asset - a stable pick from the pool, decorrelated from its shape.
 *
 * Returns null when the pool is empty, and that is a real outcome rather than a
 * failure: a brand with no legible distinct colours (or a shell with no palette yet)
 * gets tiles that inherit `currentColor` exactly as they do today. A single-colour
 * brand yields a pool of one and every tile shares it - correct, and still varied by
 * shape. Never fabricate a hue to fill the gap.
 */
export function audioThumbInk(id: string, pool: readonly string[]): AudioThumbInk | null {
  if (!pool.length) return null;

  // A SECOND, independent hash. Same FNV-1a construction as audioThumbShape but with
  // a different offset basis, so the two dimensions cannot line up: with one shared
  // hash every `blob` would be the same colour and the grid would carry five
  // identities rather than shapes × colours.
  let h = 0x9dc5811c;
  const s = String(id ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }

  // AVALANCHE BEFORE THE MODULO - not optional, and the reason is measurable.
  // FNV-1a mixes its LOW bits poorly (its final step is dominated by `h + (h << 1)`),
  // and a pool is very often a power of two, so `h % pool.length` reads exactly those
  // worst bits. Shape takes `% 5`, which is coprime with 2 and therefore samples the
  // hash far more evenly - so the two dimensions ended up keyed to the same weak bits
  // and correlated in practice despite the different salts: measured over the real
  // catalog ids against a 4-colour pool, five of six `ring` tiles drew the same
  // colour. This is the xor-shift finaliser (MurmurHash3's fmix32) that spreads the
  // high bits down before the modulo takes them.
  // The trailing `>>> 0` on the last xor is required: `^` yields a SIGNED 32-bit
  // int, so without it `h` can be negative and `h % pool.length` returns a NEGATIVE
  // index - `pool[-2]` is undefined and the tile paints nothing.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;

  const index = h % pool.length;
  return { hex: pool[index]!, index };
}

/** The inline style that paints a tile, or '' when there is no ink to apply. */
export function audioThumbInkStyle(ink: AudioThumbInk | null): string {
  return ink ? `--audio-thumb-ink:${ink.hex}` : '';
}
