// SPDX-License-Identifier: MPL-2.0
/**
 * Decoded-pixel budgets and the resolution ladder for the renovation journey
 * (plan 274 section 9, "Memory"; the Codex review section 5, "Budget decoded data,
 * not compressed megabytes").
 *
 * WHY DECODED PIXELS AND NOT FILE BYTES
 * A compressed deck says nothing about what a device has to hold. The arithmetic
 * the plan states: one 1920 by 1080 RGBA buffer is 1920 * 1080 * 4 = 8,294,400
 * bytes, which is 7.91 MiB. Forty source slides beside forty proposed slides at
 * that size is 80 * 7.91 MiB = about 633 MiB before ZIP parts, SVG or DOM trees,
 * textures, OCR tensors or export buffers, and a device pixel ratio of two in both
 * dimensions multiplies each buffer by four. So the ceiling a phone gets has to
 * sit far below that number, and the ladder has to shrink as the deck grows.
 *
 * Every number in DECODE_BUDGETS is pinned by budget.test.ts. They are starting
 * engineering goals, not measurements: plan 274 says baselines get taken on a
 * named desktop, a constrained laptop and a real phone, and these values move
 * when those baselines exist. Three invariants hold across the table:
 *   maxCacheBytes === maxDecodedPixels * 4   (the cache holds decoded RGBA)
 *   every long edge is a multiple of the ladder step, 16
 *   phone maxCacheBytes is under a thirteenth of the 633 MiB figure above
 *
 * Pure. No DOM, no clock, no storage. The caller reads device hints and passes
 * them in, so a test can pin a class without a browser.
 */
import type { DecodeBudgetV1 } from '@lolly-tools/core';

/** Bytes one decoded RGBA pixel occupies. */
export const RGBA_BYTES_PER_PIXEL = 4;

export type DeviceClassV1 = DecodeBudgetV1['deviceClass'];

/** What a shell can learn about the device without measuring anything itself. */
export interface DeviceHintsV1 {
  /** `navigator.deviceMemory`, in GiB. Absent on Safari and Firefox. */
  deviceMemoryGb?: number;
  /** `navigator.hardwareConcurrency`. */
  hardwareConcurrency?: number;
  /** A phone or tablet, from the shell's own coarse-pointer check. */
  isMobile?: boolean;
}

/**
 * The pinned table. A budget is a whole record, never a formula applied at the
 * call site, so one place answers "what may this device hold" and a test can read
 * the same numbers a person would.
 */
export const DECODE_BUDGETS: Readonly<Record<DeviceClassV1, Readonly<DecodeBudgetV1>>> = Object.freeze({
  // 96 M pixels is about 11.6 full 1920 by 1080 buffers, or 366 MiB decoded.
  desktop: Object.freeze({
    deviceClass: 'desktop',
    maxDecodedPixels: 96_000_000,
    maxCacheBytes: 384_000_000,
    thumbnailLongEdge: 320,
    previewLongEdge: 1600,
    ocrConcurrency: 2,
    decodeConcurrency: 4,
  }),
  // Half of desktop: 48 M pixels, 183 MiB decoded.
  laptop: Object.freeze({
    deviceClass: 'laptop',
    maxDecodedPixels: 48_000_000,
    maxCacheBytes: 192_000_000,
    thumbnailLongEdge: 256,
    previewLongEdge: 1280,
    ocrConcurrency: 1,
    decodeConcurrency: 3,
  }),
  // 12 M pixels, 45.8 MiB decoded: under a thirteenth of the 633 MiB the plan
  // warns about, and one OCR pass at a time so a multithreaded model plus a
  // worker per slide cannot exhaust the device.
  phone: Object.freeze({
    deviceClass: 'phone',
    maxDecodedPixels: 12_000_000,
    maxCacheBytes: 48_000_000,
    thumbnailLongEdge: 192,
    previewLongEdge: 896,
    ocrConcurrency: 1,
    decodeConcurrency: 2,
  }),
});

/**
 * The budget for a device class, or for the hints a shell could gather.
 *
 * The rules, in order: a mobile device is a phone whatever else it reports;
 * 4 GiB or less of reported memory is a phone; 8 GiB or more with eight or more
 * cores is a desktop; with no memory reading, twelve or more cores is a desktop.
 * Everything else, including a device that reports nothing, is a laptop, which is
 * the middle of the table rather than the generous end.
 */
export function decodeBudgetFor(input: DeviceClassV1 | DeviceHintsV1): DecodeBudgetV1 {
  const cls = typeof input === 'string' ? input : classifyDevice(input);
  // A class name that is not in the table (one read back from a stored record,
  // or off a message) falls back to the middle of the table. Without this the
  // spread of an absent row is an empty budget, and every number downstream
  // becomes NaN with no error to show for it.
  const table: Record<string, Readonly<DecodeBudgetV1> | undefined> = DECODE_BUDGETS;
  return { ...(table[cls] ?? DECODE_BUDGETS.laptop) };
}

/** The class alone, for a caller that wants to name the device without the numbers. */
export function classifyDevice(hints: DeviceHintsV1): DeviceClassV1 {
  if (hints.isMobile === true) return 'phone';
  const cores = hints.hardwareConcurrency;
  const memory = hints.deviceMemoryGb;
  if (typeof memory === 'number' && Number.isFinite(memory)) {
    if (memory <= 4) return 'phone';
    if (memory >= 8 && typeof cores === 'number' && cores >= 8) return 'desktop';
    return 'laptop';
  }
  if (typeof cores === 'number' && Number.isFinite(cores) && cores >= 12) return 'desktop';
  return 'laptop';
}

/** Decoded bytes for a pixel count, at four bytes per pixel. */
export function rgbaBytesForPixels(pixels: number): number {
  return Math.max(0, Math.round(pixels)) * RGBA_BYTES_PER_PIXEL;
}

// ---------------------------------------------------------------------------
// The resolution ladder
// ---------------------------------------------------------------------------

/** Short edge as a share of the long edge, for the 16:9 slide the ladder sizes against. */
const LADDER_ASPECT = 9 / 16;

/** Below these the picture stops being useful, so the ladder refuses to go lower. */
const THUMBNAIL_FLOOR = 96;
const PREVIEW_FLOOR = 480;

/**
 * Previews held at once: the selected slide and one neighbour each side, each as
 * a source and a proposal. The filmstrip beyond that holds thumbnails only.
 */
const PREVIEW_WORKING_SET = 6;

/** Share of the cache ceiling the filmstrip's thumbnails may claim. */
const THUMBNAIL_CACHE_SHARE = 0.5;

/** Long edges are rounded down to a multiple of this, so a ladder value is a round number. */
const LADDER_STEP = 16;

export interface ResolutionLadderV1 {
  thumbnailLongEdge: number;
  previewLongEdge: number;
  /**
   * How many slides' thumbnails (a source and a proposal each) fit in the share
   * of the ceiling the filmstrip may claim, at this rung. Plan 274 section 4
   * requires the filmstrip to window; this is the number to window by.
   */
  slidesThatFitThumbnails: number;
  /**
   * True when the deck has more slides than that. The filmstrip must then hold a
   * window rather than a picture per slide, or the cache evicts on every scroll
   * and re-decodes forever.
   */
  filmstripMustWindow: boolean;
  /** Export always renders at the authored size; only the review surface is budgeted. */
  exportFullRes: true;
}

/** RGBA bytes a 16:9 buffer of this long edge occupies. */
function ladderBytes(longEdge: number): number {
  const w = Math.max(0, Math.round(longEdge));
  const h = Math.max(0, Math.round(longEdge * LADDER_ASPECT));
  return w * h * RGBA_BYTES_PER_PIXEL;
}

/** The largest 16:9 long edge whose RGBA buffer fits in `bytes`. */
function longEdgeForBytes(bytes: number): number {
  if (!(bytes > 0)) return 0;
  return Math.floor(Math.sqrt(bytes / (LADDER_ASPECT * RGBA_BYTES_PER_PIXEL)));
}

function quantise(longEdge: number, floor: number, ceiling: number): number {
  const stepped = Math.floor(longEdge / LADDER_STEP) * LADDER_STEP;
  return Math.max(floor, Math.min(ceiling, stepped));
}

/**
 * Thumbnail and preview sizes for a deck of `slideCount` slides under `budget`.
 *
 * Half the cache ceiling is set aside for two thumbnails per slide (a source and
 * a proposal); what is left divides among the previews the review holds at once.
 * Each value is clamped to the budget's own ceiling and to a floor, so a large
 * deck gets smaller pictures rather than an evicting cache, and a small deck
 * never gets pictures larger than the device class allows.
 *
 * Past a few thousand slides the thumbnail floor is reached and a picture per
 * slide stops fitting. The ladder says so in numbers rather than in a comment:
 * `slidesThatFitThumbnails` is how many fit at the rung it chose, and
 * `filmstripMustWindow` is true when the deck is longer than that. The thumbnails
 * are then costed at their share rather than at what a picture per slide would
 * take, because a windowing filmstrip only ever holds the share, and the previews
 * get what is left instead of being squeezed by pictures nobody holds.
 */
export function resolutionLadder(budget: DecodeBudgetV1, slideCount: number): ResolutionLadderV1 {
  const slides = Math.max(1, Math.floor(Number.isFinite(slideCount) ? slideCount : 1));
  const ceiling = Math.max(0, Number.isFinite(budget.maxCacheBytes) ? budget.maxCacheBytes : 0);

  const thumbnailBudget = ceiling * THUMBNAIL_CACHE_SHARE;
  const perThumbnail = thumbnailBudget / (slides * 2);
  const thumbnailLongEdge = quantise(longEdgeForBytes(perThumbnail), THUMBNAIL_FLOOR, budget.thumbnailLongEdge);

  const pairBytes = ladderBytes(thumbnailLongEdge) * 2;
  const slidesThatFitThumbnails = pairBytes > 0 ? Math.floor(thumbnailBudget / pairBytes) : 0;
  const filmstripMustWindow = slides > slidesThatFitThumbnails;

  const thumbnailCost = Math.min(pairBytes * slides, thumbnailBudget);
  const previewBudget = Math.max(0, ceiling - thumbnailCost);
  const perPreview = previewBudget / PREVIEW_WORKING_SET;
  const previewLongEdge = quantise(longEdgeForBytes(perPreview), PREVIEW_FLOOR, budget.previewLongEdge);

  return { thumbnailLongEdge, previewLongEdge, slidesThatFitThumbnails, filmstripMustWindow, exportFullRes: true };
}

/**
 * Pixels a `w` by `h` source occupies once its long edge is `longEdge`. Never
 * enlarges: a source smaller than the ladder step keeps its own size, because
 * decoding a small picture at a large size buys nothing and costs the ceiling.
 * Returns 0 for a degenerate source or a long edge of zero.
 */
export function pixelsForLongEdge(w: number, h: number, longEdge: number): number {
  if (!(w > 0) || !(h > 0) || !(longEdge > 0)) return 0;
  const scale = Math.min(1, longEdge / Math.max(w, h));
  return Math.max(1, Math.round(w * scale)) * Math.max(1, Math.round(h * scale));
}
