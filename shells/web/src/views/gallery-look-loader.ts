// SPDX-License-Identifier: MPL-2.0
import { markLookFailed, markLookReady } from './gallery-carousel.ts';
import { previewDeadline } from '../lib/preview-deadline.ts';
import { bakedCoverSet } from '../lib/gallery-covers.ts';
import { heldGalleryLook } from '../lib/gallery-preview.ts';

/** A failed or stalled preview releases the serial queue and stays visibly failed. */
export async function loadGalleryLook(
  gcar: HTMLElement,
  slide: HTMLElement,
  render: () => Promise<{ thumb: string; href: string }>,
  timeoutMs = 30_000,
): Promise<void> {
  const img = slide.querySelector<HTMLImageElement>('.gcar-img');
  // A cover held from before a repaint (showHeldLook) is a stand-in: the render replaces the held picture.
  if (!gcar.isConnected || !img || (img.getAttribute('src') && img.dataset.held === undefined)) return;
  let expired = false;
  const work = async (): Promise<void> => {
    const { thumb, href } = await render();
    if (expired || !gcar.isConnected) return;
    if (!thumb) throw new Error('Preview unavailable');
    img.src = thumb;
    await img.decode();
    if (expired || !gcar.isConnected) return;
    delete img.dataset.held;
    slide.querySelector('a')?.setAttribute('href', href);
    markLookReady(gcar, slide);
  };
  try {
    await previewDeadline(work(), timeoutMs);
  } catch {
    expired = true;
    if (gcar.isConnected) {
      img.removeAttribute('src');
      markLookFailed(gcar, slide);
    }
  }
}

/**
 * A baked cover is a plain file, so the browser fetches and decodes it with no render and
 * no queue. Returns false when the slide already has a finished picture. A cover held from
 * before a repaint (showHeldLook) is a stand-in, so the baked file replaces that picture.
 * A file that does not load is taken off the slide again and `onMissing` runs, so the
 * caller can render the look live.
 */
export function placeBakedCover(
  gcar: HTMLElement,
  slide: HTMLElement,
  url: string,
  href: Promise<string>,
  onMissing: () => void,
): boolean {
  const img = slide.querySelector<HTMLImageElement>('.gcar-img');
  if (!gcar.isConnected || !img || (img.getAttribute('src') && img.dataset.held === undefined)) return false;
  const stop = (): void => { img.removeEventListener('load', loaded); img.removeEventListener('error', failed); };
  const loaded = (): void => {
    stop();
    if (!gcar.isConnected) return;
    delete img.dataset.held;
    void href.then((target) => slide.querySelector('a')?.setAttribute('href', target)).catch(() => { /* the default route stays */ });
    markLookReady(gcar, slide);
  };
  const failed = (): void => {
    stop();
    if (!gcar.isConnected) return;
    delete img.dataset.held;
    img.removeAttribute('src');
    onMissing();
  };
  img.addEventListener('load', loaded);
  img.addEventListener('error', failed);
  // A card far down the page fetches its file when the page gets there, not on arrival.
  if (img.getAttribute('fetchpriority') !== 'high') img.loading = 'lazy';
  img.src = url;
  return true;
}

/** What the baked pass reads from one card: its tool, and the look its first slide shows. */
export interface CoverTarget { tool: { id: string; version?: string }; look: { templateId?: string }; index: number }

/**
 * Put every baked cover this visitor's context allows onto its card: one context read and
 * one manifest for the whole grid, then the browser loads each picture by itself. A cover
 * placed here does not wait for the render queue, which is held behind the welcome and
 * runs one job at a time on idle. Performance UI draws no live look, and a picture that
 * needs no render costs that mode nothing, so its cards get their baked cover too.
 *
 * `targetOf` reads a card's tool and first look, `hrefOf` gives the address the look
 * opens, and `renderLive` queues a card whose baked file turned out to be missing.
 * Returns how many covers were placed.
 */
export async function placeBakedCovers<T extends CoverTarget>(
  host: Parameters<typeof bakedCoverSet>[0],
  cars: readonly HTMLElement[],
  targetOf: (gcar: HTMLElement, slide: HTMLElement) => T | null,
  hrefOf: (target: T) => Promise<string>,
  renderLive: (gcar: HTMLElement) => void,
): Promise<number> {
  const baked = await bakedCoverSet(host);
  if (!baked) return 0;
  let placed = 0;
  for (const gcar of cars) {
    const slide = gcar.isConnected ? gcar.querySelector<HTMLElement>('.gcar-slide--ex') : null;
    const target = slide ? targetOf(gcar, slide) : null;
    const url = target ? baked.fileFor(target.tool, target.index, target.look.templateId) : null;
    if (slide && target && url && placeBakedCover(gcar, slide, url, hrefOf(target), () => renderLive(gcar))) placed += 1;
  }
  return placed;
}

/**
 * Put a cover held from before a repaint (lib/gallery-preview.ts heldGalleryLook) on a
 * slide. The tile then shows the last picture while the new one is drawn. loadGalleryLook
 * replaces the held picture, or takes the picture off if the new draw fails.
 */
export async function showHeldLook(gcar: HTMLElement, slide: HTMLElement, thumb: string): Promise<void> {
  const img = slide.querySelector<HTMLImageElement>('.gcar-img');
  if (!gcar.isConnected || !img || img.getAttribute('src')) return;
  img.dataset.held = '';
  img.src = thumb;
  try { await img.decode(); } catch { return; }
  if (gcar.isConnected && img.dataset.held !== undefined) markLookReady(gcar, slide);
}

/**
 * Hand a slide's render job to the queue, first putting up the cover drawn for that
 * look earlier in this visit, if there is one (a design system or theme change).
 */
export function withHeldLook<T>(gcar: HTMLElement, slide: HTMLElement, toolId: string, index: number, job: T): T {
  const held = heldGalleryLook(toolId, index);
  if (held) void showHeldLook(gcar, slide, held);
  return job;
}
