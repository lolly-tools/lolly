// SPDX-License-Identifier: MPL-2.0
/**
 * The pictures an export draws, recorded in its Content Credentials.
 *
 * A credentialed bitmap on a page (a signed photo, an AI picture with its own
 * credential) loses that credential when a route draws it: the SVG and PDF walkers
 * re-encode it through a canvas, and a raster export paints it into new pixels. So
 * the route reads the picture's own manifest from the bytes it is about to draw and
 * records it as a `componentOf` ingredient of the export (C2PA 2.2 section 18.15.3:
 * the export is composed of parts, this picture being one of them). The embedder
 * then copies the picture's manifests in verbatim and writes a `c2pa.placed` step
 * with the picture's AI source type. Nothing is added beyond what the picture's own
 * credential holds.
 *
 * One rule for the SVG walker, the PDF walker and the still raster routes, so a page
 * records the same pictures in every format. Before this, only the SVG walker read
 * them: a PNG or PDF of the same page recorded none of its `data:` pictures.
 *
 * Every entry point is gated on the sink, which renderFormat creates only when the
 * export is stamped, so a preview or a thumbnail never reads a picture's bytes.
 * Nothing here throws: a picture that cannot be read adds no ingredient.
 */
import { extractC2paStore, prepareC2paIngredientFromStore } from '@lolly/engine';
import type { IngredientCredential } from '@lolly-tools/core/host-v1';
import { blobToDataUrl } from './export-shared.ts';

/** The credential a picture's bytes carry, as a componentOf ingredient, or null. */
function bytesIngredient(bytes: Uint8Array): IngredientCredential | null {
  try {
    const store = extractC2paStore(bytes);
    const ing = store && prepareC2paIngredientFromStore(store.store, store.format);
    return ing ? { ...ing, relationship: 'componentOf' } : null;
  } catch { return null; /* not a credentialed picture */ }
}

/** The same for a `data:` picture. */
function pictureIngredient(dataUrl: string): IngredientCredential | null {
  if (!dataUrl.startsWith('data:')) return null;
  try {
    return bytesIngredient(Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0)));
  } catch { return null; /* not base64 */ }
}

/** One entry per manifest: the same picture placed twice is one ingredient. */
function keep(sink: IngredientCredential[], ing: IngredientCredential | null): void {
  if (ing && !sink.some((p) => p.activeLabel === ing.activeLabel)) sink.push(ing);
}

/**
 * The `<img>` source a vector route inlines, as a `data:` URL (the raw src when it
 * cannot be fetched, which is what the walkers always wrote), with the picture's
 * credential recorded first, before a canvas re-encode can strip the credential.
 * Every scheme is inlined, not only `data:` and `blob:`: an SVG viewed through
 * `<img>` has no network access, so a picture left as an address would draw blank.
 */
export async function inlinePicture(src: string, sink: IngredientCredential[] | undefined): Promise<string> {
  const dataUrl = src.startsWith('data:') ? src : await blobToDataUrl(src).catch(() => src);
  if (sink) keep(sink, pictureIngredient(dataUrl));
  return dataUrl;
}

/**
 * Does the browser skip painting this element even though its computed style says it
 * is visible? Two cases, both of which lay out normally and both of which the walker
 * would otherwise draw:
 *
 *   - a subtree inside a CLOSED <details> (excluding its own <summary>, which paints)
 *   - `content-visibility: hidden`, whose subtree is laid out but never painted
 *
 * checkVisibility() knows about both, but its `checkOpacity`/`checkVisibilityCSS`
 * options overlap gates the walk already applies more precisely (an opacity-0 element
 * is dropped a line above, and the walker's own opacity handling is richer), so the
 * DOM answer is used only as a cross-check on the two cases above.
 */
export function isPaintSkipped(el: Element, style: CSSStyleDeclaration): boolean {
  if (style.contentVisibility === 'hidden') return true;
  const details = el.closest('details:not([open])');
  // closest() matches the element itself: the <details> box is painted (it is the
  // card), only its non-summary CONTENTS are skipped.
  if (!details || details === el) return false;
  // The summary is the part a closed <details> DOES paint - as is anything inside the summary.
  const summary = details.querySelector(':scope > summary');
  return !(summary?.contains(el));
}

/** The still formats whose renderers paint the page's DOM into pixels (dom-to-image). */
const RASTER_STILLS = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'tiff', 'cmyk-tiff']);

/**
 * Would the walkers draw this picture? The same gates they apply on the way down from
 * the export root: a box with no area, or an element on the path that is not
 * displayed, is hidden, is fully transparent, or whose paint the browser skips.
 */
function drawnPicture(img: HTMLImageElement, root: Element): boolean {
  const box = img.getBoundingClientRect();
  if (!(box.width > 0 && box.height > 0)) return false;
  for (let el: Element | null = img; el; el = el === root ? null : el.parentElement) {
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false;
    if (isPaintSkipped(el, style)) return false;
  }
  return true;
}

/** A picture's credential, read from its `src` as it is: a `data:` URL decoded, anything else fetched. */
async function pictureFromSrc(src: string): Promise<IngredientCredential | null> {
  // The bytes are read as they are, with no detour through a data: URL: nothing is inlined here.
  const ing = src.startsWith('data:') ? pictureIngredient(src)
    : await fetch(src).then(async (r) => (r.ok ? bytesIngredient(new Uint8Array(await r.arrayBuffer())) : null)).catch(() => null);
  // An SVG source is left out, as the walkers leave it out: they draw it as vectors, and it
  // keeps its own manifest in its own markup.
  return ing?.format === 'svg' ? null : ing;
}

/**
 * The raster routes' record of the pictures they paint: every `<img>` the walkers
 * would draw, in document order, read and recorded as they record theirs. Formats a
 * walker draws record their pictures as they walk, so this only runs for the still
 * raster formats; a motion format records per frame (recordFramePictures) or per
 * plate (recordStagePictures).
 */
export async function recordDrawnPictures(node: Element, format: string, sink: IngredientCredential[] | undefined): Promise<void> {
  if (!sink || !RASTER_STILLS.has(format)) return;
  for (const img of node.querySelectorAll('img')) {
    const src = img.src || img.getAttribute('src') || '';
    if (!src || !drawnPicture(img, node)) continue;
    keep(sink, await pictureFromSrc(src));
  }
}

/** The sources each stamped clip has read, keyed by its sink, so a source is read once per clip. */
const clipSources = new WeakMap<IngredientCredential[], Set<string>>();

/**
 * The record for a motion export that paints the page's DOM frame by frame (video, GIF,
 * APNG, animated WebP through createFrameSource). Called once per captured frame, at
 * that frame's pose: every picture the frame draws, by the stills' rule, is recorded, so
 * a picture drawn in any frame of the clip is a component of the file. Each source's
 * bytes are read once per sink, at the first frame that draws the picture, so a repeat
 * call costs a walk and no read. Nothing is read when the export is not stamped.
 */
export async function recordFramePictures(node: Element, sink: IngredientCredential[] | undefined): Promise<void> {
  if (!sink) return;
  const read = clipSources.get(sink) ?? new Set<string>();
  clipSources.set(sink, read);
  for (const img of node.querySelectorAll('img')) {
    const src = img.src || img.getAttribute('src') || '';
    if (!src || read.has(src) || !drawnPicture(img, node)) continue;
    read.add(src);
    keep(sink, await pictureFromSrc(src));
  }
}

/**
 * A planned layer of a sequence stage: whether the film draws its plate in some exported
 * frame, and what inside it no exported frame shows (a slide's boxes timed outside them).
 */
export interface StageLayer { el: Element; drawn: boolean; hidden?: readonly Element[] }

/**
 * The record for a sequence export (Design and Sequence motion). The compositor draws
 * the stage as plates: one per planned layer, inside that layer's exported frames, with
 * the layer's whole subtree, and one background plate of the rest of the stage under
 * every frame, shot without `backgroundHides`. A picture is recorded when a drawn plate
 * holds it and shows it, judged by the stills' rule from that plate's root. Video and
 * audio clips are recorded by the sequence's own gather.
 *
 * `offClass` is the class the playhead puts on a box outside its window. The compositor
 * clears it for each plate it shoots (rasterBox), so it is cleared here too while the
 * pictures are judged. The judging is synchronous, so nothing paints in between.
 */
export async function recordStagePictures(
  stage: Element, layers: readonly StageLayer[], sink: IngredientCredential[] | undefined,
  own: { offClass: string; backgroundHides: string },
): Promise<void> {
  if (!sink) return;
  const off = [...(stage.classList.contains(own.offClass) ? [stage] : []), ...stage.querySelectorAll(`.${own.offClass}`)];
  for (const el of off) el.classList.remove(own.offClass);
  const drawn: string[] = [];
  const srcOf = (img: HTMLImageElement): string => img.src || img.getAttribute('src') || '';
  try {
    for (const L of layers) {
      if (!L.drawn) continue;
      for (const img of L.el.querySelectorAll('img')) {
        if (L.hidden?.some((h) => h.contains(img))) continue;
        if (srcOf(img) && drawnPicture(img, L.el)) drawn.push(srcOf(img));
      }
    }
    for (const img of stage.querySelectorAll('img')) {
      const hidden = img.closest(own.backgroundHides);
      if (hidden && hidden !== stage && stage.contains(hidden)) continue;
      if (srcOf(img) && drawnPicture(img, stage)) drawn.push(srcOf(img));
    }
  } finally {
    for (const el of off) el.classList.add(own.offClass);
  }
  for (const src of new Set(drawn)) keep(sink, await pictureFromSrc(src));
}
