// SPDX-License-Identifier: MPL-2.0
/**
 * Baking a MilkDrop cover to pixels - and why this one look, alone, needs baking.
 *
 * Every other cover is a RECIPE the tile redraws from cached peaks: a few bytes, crisp
 * at any size, re-skinning with the brand. A MilkDrop look cannot work that way, and the
 * reason is a hard browser limit rather than a preference: it needs a live WebGL2
 * context, and browsers cap those at roughly 16 and silently drop the oldest. A catalog
 * grid routinely shows more audio tiles than that, so "just mount it per tile" would
 * blank earlier tiles as you scroll, with no error anywhere. So a MilkDrop cover is
 * rendered ONCE, through a single offscreen context, and stored as an image.
 *
 * THE RECIPE IS STILL THE TRUTH. Pixels here are a CACHE, keyed by
 * (asset, preset, brand) - never the stored value. That is what preserves the rule the
 * whole feature rests on: the user's preset is frozen, and the brand colour re-resolves,
 * because a brand change simply changes the key and the cover re-bakes. The alternative
 * - storing the image as the cover - would freeze the paint too and strand it on
 * whichever brand was active when they clicked.
 *
 * DETERMINISM IS WHAT MAKES ONE FRAME MEANINGFUL. MilkDrop is a feedback simulation:
 * frame N is a function of frame N-1, so a single cold frame is a near-empty field, and
 * "render one frame" would produce black. The visualizer is therefore driven with
 * INJECTED audio (host.audio's opt-in sample windows) and warmed for a fixed number of
 * frames before the read, so the same asset + preset + brand always yields the same
 * cover rather than whatever the GPU happened to be showing.
 */
import { openDB } from '../bridge/db.ts';
import type { AudioThumbShape } from './audio-thumb.ts';

/** Object store for baked covers. Bytes, not recipes - see the header. */
export const COVER_STORE = 'audio-cover-bakes';

/** Frames of real audio replayed before the frame is read. ~1.6s at 30fps - enough for
 *  the warp/feedback field to fill, which is the difference between a cover and a black
 *  square. Matches lib/viz-tool-mount.ts's WARMUP for the same reason. */
export const BAKE_WARMUP = 48;

/** Baked at 2x the largest place a cover is shown, so a retina grid tile and the details
 *  modal both get clean pixels without storing a full-size render per asset. */
export const BAKE_SIZE = 320;

export interface BakedCover {
  /** `<assetId>|<presetId>|<brandKey>` - see bakeKey. */
  key: string;
  /** The rendered cover. A Blob rather than a data URL: it is an order of magnitude
   *  cheaper to store and hand to an <img> via createObjectURL. */
  blob: Blob;
  /** Epoch ms, for eviction and for telling a stale bake from a missing one. */
  at: number;
}

/**
 * The cache key. All three parts are required:
 *   asset - a cover is per track.
 *   preset - the user's frozen structural choice.
 *   brand - the palette the shader wrapping baked in. Changing brand MUST miss, which
 *            is exactly how a MilkDrop cover re-skins without storing anything new.
 */
export function bakeKey(assetId: string, presetId: string, brandKey: string): string {
  return `${assetId}|${presetId}|${brandKey}`;
}

/**
 * A short, stable fingerprint of the brand's colour pool.
 *
 * The pool is what the shader wrapping turns into GLSL constants, so two brands with the
 * same pool legitimately share a bake and a re-ordered pool legitimately invalidates
 * one. Hashed rather than concatenated only to keep the key short - this is a cache key,
 * not a security boundary.
 */
export function brandKeyFor(pool: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const c of pool.join(',')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

interface BakeDB {
  get(store: string, key: string): Promise<unknown>;
  put(store: string, value: unknown): Promise<unknown>;
  delete(store: string, key: string): Promise<unknown>;
  getAllKeys?(store: string): Promise<unknown[]>;
}

async function store(): Promise<BakeDB | null> {
  try { return (await openDB()) as unknown as BakeDB; } catch { return null; }
}

/** A baked cover, or null. Never decodes or renders - a pure read. */
export async function cachedBake(key: string): Promise<Blob | null> {
  const db = await store();
  if (!db) return null;
  try {
    const rec = (await db.get(COVER_STORE, key)) as BakedCover | undefined;
    return rec?.blob instanceof Blob ? rec.blob : null;
  } catch {
    return null;
  }
}

/** Persist a bake. Best-effort: a failed write only means it re-renders next time. */
export async function putBake(key: string, blob: Blob): Promise<void> {
  const db = await store();
  if (!db) return;
  try { await db.put(COVER_STORE, { key, blob, at: Date.now() } satisfies BakedCover); } catch { /* quota */ }
}

/** Drop every bake for one asset - its cover changed, or the asset was deleted. Cheap
 *  and total: a stale bake showing the PREVIOUS cover is worse than a brief re-render. */
export async function dropBakes(assetId: string): Promise<void> {
  const db = await store();
  if (!db?.getAllKeys) return;
  try {
    const keys = (await db.getAllKeys(COVER_STORE)) as string[];
    await Promise.all(
      keys.filter(k => typeof k === 'string' && k.startsWith(`${assetId}|`))
        .map(k => db.delete(COVER_STORE, k).catch(() => {})),
    );
  } catch { /* nothing to drop */ }
}

/** What a caller must supply to render one - kept structural so the baker never reaches
 *  for the visualizer itself and stays unit-testable. */
export interface BakeSource {
  /** Mount a visualizer into `el`, warm it, and resolve once a frame is readable. */
  render(el: HTMLElement): Promise<HTMLCanvasElement | null>;
}

/**
 * Bake one cover: cache hit, or render once and store.
 *
 * The offscreen host is positioned off-screen rather than `display:none` - a
 * zero-size or undisplayed element gives WebGL no drawing buffer, which is the
 * black-canvas failure mode this whole area is prone to.
 */
export async function bakeCover(
  key: string, size: number, source: BakeSource,
): Promise<Blob | null> {
  const hit = await cachedBake(key);
  if (hit) return hit;

  const holder = document.createElement('div');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${size}px;height:${size}px;pointer-events:none;`;
  document.body.appendChild(holder);
  try {
    const canvas = await source.render(holder);
    if (!canvas) return null;
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.9));
    if (!blob) return null;
    await putBake(key, blob);
    return blob;
  } catch {
    return null;
  } finally {
    // Always: an offscreen holder left behind keeps a GL context alive, and those are
    // the scarce resource this module exists to conserve.
    holder.remove();
  }
}

/** The drawn shape a MilkDrop cover falls back to when its bake is missing (a fresh
 *  device, an evicted cache, no WebGL2). Never a blank tile. */
export type CoverFallback = AudioThumbShape;
