// SPDX-License-Identifier: MPL-2.0
import { markLookFailed, markLookReady } from './gallery-carousel.ts';
import { previewDeadline } from '../lib/preview-deadline.ts';
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
