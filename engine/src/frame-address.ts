// SPDX-License-Identifier: MPL-2.0
/**
 * The `s=` state address, and the still-export frame filter it drives (plan 112 section 10).
 *
 * `s` names ONE state of a multi-frame document: `s=2` is the 1-based position in
 * presentation order, anything else (`s=slide1`, a ULID) is a frame id, and an `.N`
 * suffix (`s=2.3`) names a build step. The web shell's presenter reads it to deep-link
 * a slide; EXPORT reads it to render only that slide - `?s=2&format=png` is a per-slide
 * image link.
 *
 * This module is the single source of that meaning. The web fan-out
 * (`views/tool-actions.ts`, one still per `[data-pdf-page]`) and the CLI
 * (`shells/cli/src/run.ts`) both resolve the address HERE and then apply it to their own
 * DOM, so "CLI is URL mode under a different transport" holds by construction rather than
 * by two shells agreeing to behave alike. Nothing in this file touches the DOM: callers
 * hand it the page ids they read off `[data-frame-id]`, in render order.
 *
 * Ordering note: the ids arrive in RENDER order, which for the frame primitive is already
 * presentation order (`order` asc, tie-break `x` asc - the hook sorts once, so present
 * order == export order == page order). A paged tool with no frame ids still answers a
 * positional address; only `s=<id>` needs the stamps.
 *
 * Build steps are presenter-only. A still export shows every build (plan section 7: "static
 * exports show everything"), so `parseFrameAddress` reports `build` and the filter ignores it.
 */

/** A parsed `s=` address. Exactly one of `position` / `id` is non-null. */
export interface FrameAddress {
  /** 1-based position among the rendered pages, or null when the address names an id. */
  position: number | null;
  /** Frame id (`data-frame-id`), or null when the address is positional. */
  id: string | null;
  /** Build step from an `.N` suffix - a 1-based threshold. Presenter-only; exports
   *  render every build, so the still filter reads this and does nothing with it. */
  build: number | null;
  /** The address as written, for messages ("no frame matches ?s=…"). */
  raw: string;
}

/** What the still-export filter decided.
 *  - `none`     - no address was given: export every page, unchanged.
 *  - `page`     - export ONLY the page at `index`.
 *  - `unmatched`- an address was given and named nothing. The caller decides: the web
 *                 shell keeps the whole fan-out and says so, the CLI refuses. Never
 *                 silently collapse it to "the first page". */
export type FrameSelection =
  | { kind: 'none' }
  | { kind: 'page'; index: number; address: FrameAddress }
  | { kind: 'unmatched'; address: FrameAddress };

/** Is a string a bare non-negative integer (a positional address)? */
function isPositional(s: string): boolean {
  return /^\d+$/.test(s);
}

/**
 * Formats the per-slide filter does not apply to, and why - the same set the web shell's
 * per-page fan-out already excludes, named once so the CLI cannot pick a different one:
 *
 *  - `pdf` / `zip` / `pptx` / `html` are MULTI-PAGE containers: they carry every slide in
 *    one file by construction (renderMultiPagePdf, the deck model, the archive), so a
 *    filter would silently produce a one-page document where the format's own answer is
 *    the whole deck. (A single-slide PDF is a real want - see plan 112 section 10; it is not
 *    this filter's job.)
 *  - the motion formats are a TIMELINE, not a deck: which frame you see is a function of
 *    time, and `s` addresses a slide. The sequence transport is that selector.
 *
 * `pdf-cmyk` is deliberately NOT here, and that is not an oversight: the web fan-out
 * already renders it one press-ready PDF PER PAGE (only bare `pdf` becomes a single
 * multi-page document), so a slide filter selects exactly one of those files. Removing it
 * from the fan-out is what would need justifying, not filtering it.
 */
export const FRAME_FILTER_SKIP_FORMATS: ReadonlySet<string> = new Set([
  // `scorm` joins them for the same reason (plans/180 M-D1): a course package IS the whole
  // deck - a manifest, a launch page and every slide - so filtering it to one slide would
  // produce a one-slide course, not a shorter file.
  'pdf', 'zip', 'html', 'pptx', 'scorm',
  'webm', 'mp4', 'gif', 'apng', 'webp-anim', 'svg-anim',
]);

/** Does the `s=` still filter apply to this export format? (Case-insensitive; an absent
 *  format is "no", since there is nothing to filter.) */
export function frameFilterApplies(format: string | null | undefined): boolean {
  return !!format && !FRAME_FILTER_SKIP_FORMATS.has(String(format).toLowerCase());
}

/**
 * Parse an `s=` value. Returns null when nothing was addressed (absent/empty), so a caller
 * can tell "no filter asked for" from "asked for something that isn't here". Total function -
 * junk parses as an id (which then matches nothing), never a throw.
 */
export function parseFrameAddress(s: string | null | undefined): FrameAddress | null {
  if (s == null) return null;
  const raw = String(s).trim();
  if (raw === '') return null;

  const dot = raw.indexOf('.');
  const slidePart = dot < 0 ? raw : raw.slice(0, dot);
  const buildPart = dot < 0 ? '' : raw.slice(dot + 1);

  // `.N` is a 1-based build threshold; `.0` and junk are meaningless → null.
  let build: number | null = null;
  if (isPositional(buildPart)) {
    const n = parseInt(buildPart, 10);
    build = n >= 1 ? n : null;
  }

  if (slidePart === '') return null;                       // a bare ".3" addresses no slide
  if (isPositional(slidePart)) {
    const n = parseInt(slidePart, 10);
    // `s=0` is not a slide - positions are 1-based. Treated as an id (matching nothing)
    // would be a lie about what the caller meant, so it resolves as an unmatched position.
    return { position: n, id: null, build, raw };
  }
  return { position: null, id: slidePart, build, raw };
}

/**
 * Resolve an address against the pages actually rendered, in render order. `pageIds[i]` is
 * page i's `data-frame-id` (null/empty where a paged tool stamps none).
 *
 * An id match wins wherever it is - reorder-proof, the Figma `node-id` lesson - and a
 * positional address counts pages from 1. An empty page list with an address given is
 * `unmatched`, not `none`: the caller asked for a slide in a document that has no pages.
 */
export function selectFramePage(
  pageIds: readonly (string | null | undefined)[],
  s: string | null | undefined,
): FrameSelection {
  const address = parseFrameAddress(s);
  if (!address) return { kind: 'none' };

  if (address.id != null) {
    const index = pageIds.findIndex((id) => id != null && String(id) === address.id);
    return index >= 0 ? { kind: 'page', index, address } : { kind: 'unmatched', address };
  }
  const index = (address.position ?? 0) - 1;
  return index >= 0 && index < pageIds.length
    ? { kind: 'page', index, address }
    : { kind: 'unmatched', address };
}
