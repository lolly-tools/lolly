// SPDX-License-Identifier: MPL-2.0
/**
 * The page deck a paged tool (multi-page-pdf) shows on its gallery card.
 *
 * Moved out of views/gallery.ts's mount closure as it was: the deck reads nothing from
 * that closure but the host, so the function takes the host and stands by itself.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { escape as esc } from '../utils.ts';
import { renderFeaturedPages } from '../lib/featured-render.ts';
import { stripCarouselNav } from './gallery-carousel.ts';

type PagedDeckHost = HostV1;
/** The part of a gallery tool the deck reads. */
export interface PagedDeckTool { formats?: readonly string[]; width?: number; height?: number }

// Fit a page of aspect `ar` (width / height) inside the square deck box (hydratePaged),
// as width/height percentages of that square. A landscape page keeps full width and loses
// height; a portrait page keeps full height and loses width; a square page fills the box. Extreme
// aspects (a 5:1 banner → h 20%, a 1:5 vertical banner → w 20%) stay true to shape - the fan
// offset is applied by the outer layer in box units, so the deck still reads as a stack even
// when each sheet is a thin strip. The card element is then sized to the page's TRUE shape,
// so its shadow + hairline rim wrap the real page rather than a letterboxed square.
function deckPageFit(ar: number): { w: number; h: number } {
  if (!(ar > 0) || !Number.isFinite(ar)) return { w: 100, h: 100 };
  return ar >= 1 ? { w: 100, h: 100 / ar } : { w: 100 * ar, h: 100 };
}

// A paged tool (multi-page-pdf): render each page and rebuild the strip's slides +
// dots from them (page count is unknown until rendered). The track element persists,
// so its listeners survive; nav/dots are delegated off .gcar (see wireCarousel).
export async function hydratePaged(host: PagedDeckHost, gcar: HTMLElement, toolId: string, tool: PagedDeckTool): Promise<void> {
  if (gcar.dataset.pagedDone === '1') return;
  let urls: string[];
  try {
    urls = await renderFeaturedPages(host, toolId, tool.formats);
  } catch (e) {
    host.log?.('warn', `Gallery pages failed for ${toolId}`, { error: String((e as { message?: unknown })?.message ?? e) });
    return;
  }
  const track = gcar.querySelector<HTMLElement>('.gcar-track');
  if (!gcar.isConnected || !track || !urls.length) return;
  gcar.dataset.pagedDone = '1';
  const openHref = `#/tool/${esc(toolId)}`;
  // Multi-page content reads as a swipeable STACK, not a flat carousel - the same
  // language as carousel-maker's featured card. Show the first few pages as an offset,
  // slightly-rotated deck (front page on top, the rest peeking behind). Cap at 3: enough
  // to say "multiple pages" without clutter; the real page-by-page view is the tool.
  const shown = urls.slice(0, 3);
  // Two layers per page: an OUTER square layer (.gcar-deck-page) carries the fan offset +
  // rotation - expressed as % of the square box, so the spread stays constant no matter the
  // page shape (a razor-thin 5:1 banner fans by the same amount as a portrait sheet). The
  // INNER image (.gcar-deck-card) is sized to the page's real aspect (deckPageFit) so its
  // shadow + rim wrap the true sheet. Seed the size from the manifest render size (no load
  // flash for the common case); the image's own dimensions correct it below.
  const seed = deckPageFit((tool.width && tool.height) ? tool.width / tool.height : 1);
  const pages = shown.map((u, k) =>
    // --d = depth: 0 = front (on top), higher = further back. Positioned + z-ordered in CSS.
    `<span class="gcar-deck-page" style="--d:${k}"><img class="gcar-deck-card" style="width:${seed.w.toFixed(2)}%;height:${seed.h.toFixed(2)}%" src="${u}" alt="" aria-hidden="true" decoding="async"></span>`,
  ).join('');
  track.outerHTML =
    `<a class="gcar-open gcar-deck" href="${openHref}" data-new-tool="${esc(toolId)}" tabindex="-1" aria-hidden="true">${pages}</a>`;
  gcar.classList.add('has-art', 'gcar--deck');   // pages rendered → stop the waiting tracer
  // Correct each card to the decoded image's true aspect (authoritative - covers tools
  // whose rendered page differs from, or omits, its manifest size, incl. wide banners).
  gcar.querySelectorAll<HTMLImageElement>('.gcar-deck-card').forEach(img => {
    const fit = (): void => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const f = deckPageFit(img.naturalWidth / img.naturalHeight);
      img.style.width = `${f.w.toFixed(2)}%`;
      img.style.height = `${f.h.toFixed(2)}%`;
    };
    if (img.complete) fit();
    else img.addEventListener('load', fit, { once: true });
  });
  // The deck is a static preview - it has no per-page nav/dots (unlike the old carousel).
  stripCarouselNav(gcar);
}
