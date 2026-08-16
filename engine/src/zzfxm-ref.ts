// SPDX-License-Identifier: MPL-2.0
/**
 * zzfxm-ref.ts: the `zzfxm:<seed>[:<style>]` asset id, and nothing else.
 *
 * A procedural music bed is named, not stored: the id IS the song. There are no
 * bytes in the catalog, no download, no cache key. A seed and a target length
 * compose a `ZzfxSong` deterministically. The same ref is a 20-second bed
 * under a 20-second sequence, and a 90-second bed under a 90-second one.
 *
 * WHY THE ID FORMAT IS IN THE ENGINE. It is an ASSET ID SCHEME, and asset id
 * schemes are the engine's vocabulary. The direct precedent is `tool-url.ts`,
 * which owns the "a Lolly share link used as an asset id" scheme the same way.
 * Every shell that resolves assets has to recognise one of these, and they must
 * never disagree about what one looks like:
 *
 *   • the web bridge (`shells/web/src/bridge/assets.ts`) resolves it to a ref
 *     whose `url` is the id itself (a procedural asset resolves to its own name;
 *     that is what carries the seed through `resolveAssetRefs`, the one resolution
 *     path preview and export share);
 *   • the CLI bridge (`shells/cli/src/bridge.ts`) does the same, so a headless
 *     render of the same project carries the same bed marker;
 *   • `bridge/sequence-providers.ts` turns it into PCM;
 *   • `views/tool-actions.ts` mints one for the export bar's generated music.
 *
 * NOTHING here synthesises audio. This module is the id format and no more, so it
 * stays free of every dependency and costs a few hundred bytes wherever it lands.
 * The composer itself is `zzfx-compose.ts`. A SHELL decides whether it can render
 * one of these, which is why resolution lives in the bridges and not in the
 * runtime's `resolveOne`.
 *
 * THE IDS ARE CANONICAL AND PERMANENT. A ref is a promise: the same string must
 * mean the same tune forever, because it ships inside saved sessions and shared
 * links. So the parser is strict. It refuses anything it could not have produced
 * itself (leading zeros, a seed past uint32) rather than folding it silently into
 * a different seed. Silent folding would let a round-trip through `formatZzfxmRef`
 * rewrite somebody's shared link to point at a different song.
 */

/** The scheme prefix. Also the guard that keeps a malformed ref from silently opening as a URL. */
export const ZZFXM_SCHEME = 'zzfxm:';

/** The complete set of styles a ref may NAME. Frozen: order is irrelevant here, membership is not. */
export const ZZFXM_ARCHETYPES = [
  'ambient', 'rhythmic', 'melodic', 'drumAndBass', 'jungle', 'classical',
  'spanishGuitar', 'cuban', 'bossaNova', 'whimsical', 'chiptune', 'lofi',
] as const;

export type ZzfxmArchetype = (typeof ZZFXM_ARCHETYPES)[number];

/** A parsed procedural ref. */
export interface ZzfxmRef {
  /** uint32. */
  seed: number;
  /** Present only when the ref named a style AND it was recognised. */
  style?: ZzfxmArchetype;
  /** The raw third segment, recognised or not. Used for the "ignored style" warning. */
  rawStyle?: string;
}

/**
 * Digits only, no leading zeros, and never past uint32.
 *
 * `0000000007` and `4294967296` were both accepted by an earlier `[0-9]{1,10}`
 * and then folded by `>>> 0` into `7` and `0`. That means `format(parse(x)) !== x`:
 * a regenerate action that round-trips a ref would quietly rewrite a shared link's
 * id. Refusing them keeps every ref that parses byte-stable through the round trip.
 */
const SEED_RE = /^(0|[1-9][0-9]{0,9})$/;
const MAX_SEED = 4294967295;

/** Is this string one of ours (well-formed or not)? Cheap, and never throws. */
export function isZzfxmRef(src: unknown): boolean {
  return typeof src === 'string' && src.startsWith(ZZFXM_SCHEME);
}

/**
 * Parse a procedural ref, or null when `src` is not a WELL-FORMED one.
 *
 * Null is the answer for every ordinary url, so callers can try this first
 * without risk. Note the asymmetry with a MALFORMED `zzfxm:` ref: a caller
 * distinguishes the two with `isZzfxmRef`, so `zzfxm:abc` can warn instead of
 * being handed to a demuxer that would report a baffling container error.
 */
export function parseZzfxmRef(src: unknown): ZzfxmRef | null {
  if (!isZzfxmRef(src)) return null;
  const parts = (src as string).slice(ZZFXM_SCHEME.length).split(':');
  if (parts.length > 2) return null;
  const seedRaw = parts[0] ?? '';
  if (!SEED_RE.test(seedRaw)) return null;
  const seed = Number(seedRaw);
  if (!Number.isSafeInteger(seed) || seed > MAX_SEED) return null;
  const rawStyle = parts.length === 2 ? (parts[1] ?? '') : '';
  if (!rawStyle) return { seed };
  const style = ZZFXM_ARCHETYPES.find(a => a === rawStyle);
  return style ? { seed, style } : { seed, rawStyle };
}

/** Render a ref back to its canonical string. `parse(format(x))` deep-equals `x`. */
export function formatZzfxmRef(ref: ZzfxmRef): string {
  const seed = ref.seed >>> 0;
  return ref.style ? `${ZZFXM_SCHEME}${seed}:${ref.style}` : `${ZZFXM_SCHEME}${seed}`;
}
