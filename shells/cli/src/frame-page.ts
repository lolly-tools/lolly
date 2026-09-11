// SPDX-License-Identifier: MPL-2.0
/**
 * The `s=` still-export frame filter, CLI side (plan 112 section 10).
 *
 * `?s=2&format=png` is a per-slide image link in the web shell; the CLI is URL mode under
 * a different transport, so `lolly design --s=2 --export=png` must mean the same thing.
 * WHAT it means lives in the engine (`frame-address.ts` - the address grammar, the page
 * selection, and which formats a per-slide filter applies to); this module is only the
 * DOM half: read the rendered `[data-pdf-page]` list, hand the ids to the engine, and give
 * the caller back the one page element to export, at that page's own authored size.
 *
 * Mirrors the web shell's per-page fan-out (views/tool-actions.ts), which exports each
 * `[data-pdf-page]` at its own layout size with the document dims stripped. Here the size
 * comes from the page's inline style rather than `offsetWidth` - jsdom lays nothing out,
 * and the hook writes the frame's true w×h into that style either way.
 */
import { selectFramePage } from '@lolly/engine';

import { usageError } from './exit-codes.ts';

/** The page to export, and the size it was authored at (px). */
export interface PickedFramePage {
  node: Element;
  width: number;
  height: number;
  /** 0-based position among the rendered pages - for the "rendered slide 2 of 5" note. */
  index: number;
  /** How many pages the document rendered. */
  total: number;
}

/** Read a px length off a page's inline style (`width:1080px`); 0 when absent/unparseable. */
function inlinePx(el: Element, prop: 'width' | 'height'): number {
  const v = (el as { style?: { getPropertyValue(p: string): string } }).style?.getPropertyValue(prop) ?? '';
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Resolve `--s=<address>` against a hydrated canvas.
 *
 * Returns null when no address was given (every caller then exports the whole document,
 * exactly as before the filter existed). THROWS a usage error when an address was given
 * and names nothing: the CLI's contract is no silent defaults, and quietly rendering the
 * whole deck - or slide 1 - under the name of slide 9 is the failure this shell exists to
 * refuse. (The web shell keeps its fan-out and announces the mismatch instead; the
 * resolution is identical, only the ergonomics of being wrong differ.)
 */
export function pickFramePage(canvas: Element, slide: string | null | undefined): PickedFramePage | null {
  const pages = [...canvas.querySelectorAll('[data-pdf-page]')];
  const pick = selectFramePage(pages.map((p) => p.getAttribute('data-frame-id')), slide);
  if (pick.kind === 'none') return null;

  if (pick.kind === 'unmatched') {
    const ids = pages.map((p) => p.getAttribute('data-frame-id')).filter((id): id is string => !!id);
    throw usageError(
      `--s=${pick.address.raw} names no slide in this document` +
      (pages.length
        ? ` (it rendered ${pages.length} ${pages.length === 1 ? 'slide' : 'slides'}` +
          (ids.length ? `: ${ids.join(', ')}` : '') +
          '; a number is the 1-based position, anything else is a frame id).'
        : ' - it has no slides at all (no frames), so there is nothing to select.') +
      ' Nothing was written.',
      'SLIDE_NOT_FOUND',
    );
  }

  const node = pages[pick.index]!;
  return { node, width: inlinePx(node, 'width'), height: inlinePx(node, 'height'), index: pick.index, total: pages.length };
}
