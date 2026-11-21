// SPDX-License-Identifier: MPL-2.0
/**
 * The one preview reader (plan 373, section 5.6): how every saved session, export
 * and revision picture reaches an `<img>`.
 *
 * A view writes its tile markup as it always did, with `previewImg()` in place of
 * a hand-written `<img src="${thumb}">`. What that produces depends on the row:
 *
 *  - a picture reference (session format 5): an `<img>` with no `src` yet and its
 *    content key in `data-preview-key`; the tile's stylesheet gives it its shape, as
 *    it always did. The reader fills it when it
 *    comes within a screen of the viewport, so a Projects view of 5,000 sessions
 *    reads the pictures of the tiles near the screen and no others;
 *  - a legacy data URL or a catalog URL: an `<img src>` exactly as before;
 *  - nothing: no `<img>` (the view keeps its own empty placeholder).
 *
 * The element and its classes do not change, so every stylesheet rule that reaches
 * a tile picture (the calmed Projects pictures under "Hide colourful previews"
 * among them) applies unchanged.
 *
 * A raster comes back as an object URL and SVG as a data URL (lib/preview-urls.ts
 * says why SVG is never a blob: URL). A picture whose bytes are missing turns into
 * the view's empty placeholder, and a session tile whose picture came from another
 * build or another device asks for a redraw on idle time (lib/preview-events.ts,
 * taken by lib/preview-idle.ts).
 */
import type { SessionPreviewRef } from '../../../../engine/src/session-preview.ts';
import { readPreviewRef } from '../../../../engine/src/session-preview.ts';
import { escape } from '../utils.ts';
import { staleTile } from '../lib/preview-events.ts';

/** What a tile may know about its picture. */
export interface PictureSource {
  preview?: SessionPreviewRef | null;
  /** A legacy data URL, or any URL the browser loads itself (a catalog file). */
  thumb?: string | null;
  url?: string | null;
  /** The session the picture belongs to, for a redraw when it is stale or missing. */
  slot?: string;
  toolId?: string;
}

/** Whether a row has any picture to show. */
export function hasPicture(source: PictureSource | null | undefined): boolean {
  return !!(source && (readPreviewRef(source.preview) || source.thumb || source.url));
}

/**
 * An `<img>` for a row's picture, or '' when it has none. `attrs` is the rest of
 * the element's attributes (class, alt, loading and so on), written verbatim;
 * `empty` is the class list of the placeholder the view shows for a missing
 * picture, used if the stored bytes turn out to be gone.
 */
export function previewImg(source: PictureSource | null | undefined, attrs: string, empty?: string): string {
  if (!source) return '';
  const ref = readPreviewRef(source.preview);
  if (ref) {
    ensureReader();
    // No width or height attributes: the tile's stylesheet sizes the element exactly
    // as it sized an <img src> before; a presentational size would override that rule.
    return `<img ${attrs} data-preview-key="${ref.key}" data-preview-type="${escape(ref.type)}"${ref.route ? ` data-preview-route="${escape(ref.route)}"` : ''}`
      + `${source.slot ? ` data-preview-slot="${escape(source.slot)}"` : ''}${source.toolId ? ` data-preview-tool="${escape(source.toolId)}"` : ''}`
      + `${empty ? ` data-preview-empty="${escape(empty)}"` : ''}>`;
  }
  const src = source.thumb || source.url;
  return src ? `<img ${attrs} src="${escape(src)}">` : '';
}

/** Where the reader gets bytes: the live host's state (the Tauri file store, or the
 *  web preview store) and, for pictures only the web store holds, the database. */
export interface PictureReader {
  (ref: SessionPreviewRef): Promise<Blob | null>;
}

let reader: PictureReader | null = null;
/** Install the byte source (bridge/index.ts does, once the host exists). Tests
 *  install their own. */
export function setPictureReader(read: PictureReader | null): void { reader = read; }

let installed = false;
let io: IntersectionObserver | null = null;
/** Bind any picture tiles already in the document (a view that kept its markup). */
export function bindPreviewImages(): void { ensureReader(); }
const READ_MARGIN = '600px';

/** Bound elements, so a tile reinserted by its view is not read twice. */
const bound = new WeakSet<Element>();
/** Reads started since the page loaded (a test watches this). */
let reads = 0;
export function pictureReadCount(): number { return reads; }

function ensureReader(): void {
  if (typeof document === 'undefined') return;
  if (!installed) {
    installed = true;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io!.unobserve(entry.target);
          void fill(entry.target as HTMLImageElement);
        }
      }, { rootMargin: READ_MARGIN });
    }
  }
  scheduleSweep();
}

/**
 * Bind the tiles a view has just written. A view inserts the markup previewImg()
 * returned right after building it, or a moment later, so the document is swept on
 * the next frame and twice more shortly after. Only after markup was built: no
 * observer watches the whole document, so an editor's own DOM work costs nothing.
 */
let sweepPending = false;
function scheduleSweep(): void {
  if (sweepPending) return;
  sweepPending = true;
  const sweep = (): void => { for (const img of document.querySelectorAll<HTMLImageElement>('img[data-preview-key]')) observe(img); };
  const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn: () => void) => setTimeout(fn, 16);
  frame(() => {
    sweep();
    setTimeout(sweep, 300);
    setTimeout(() => { sweep(); sweepPending = false; }, 1500);
  });
}

function observe(img: HTMLImageElement): void {
  if (bound.has(img)) return;
  bound.add(img);
  if (io) io.observe(img);
  else void fill(img);
}

/** Read a stored picture as an `<img>` source, or null when its bytes are gone. */
export async function pictureSrcFor(ref: SessionPreviewRef): Promise<string | null> {
  const { heldObjectUrl, srcForBlob } = await import('../lib/preview-urls.ts');
  const held = heldObjectUrl(ref.key);
  if (held) return held;
  reads++;
  const blob = await (reader ?? defaultReader)(ref).catch(() => null);
  return blob ? srcForBlob(ref.key, blob) : null;
}

/** The live host's state first (the Tauri file store, or the web preview store),
 *  then the web database, which holds the pictures only it keeps (the export log's,
 *  on the Tauri apps). */
async function defaultReader(ref: SessionPreviewRef): Promise<Blob | null> {
  const { getHostRef } = await import('../lib/host-ref.ts');
  const state = getHostRef()?.state as { picture?: (ref: SessionPreviewRef) => Promise<Blob | null> } | undefined;
  const viaState = await state?.picture?.(ref).catch(() => null);
  if (viaState) return viaState;
  const [{ openDB }, store] = await Promise.all([import('../bridge/db.ts'), import('../bridge/preview-store.ts')]);
  const row = await store.readPictureRow(await openDB(), ref.key);
  return row ? store.blobOfRow(row) : null;
}

async function fill(img: HTMLImageElement): Promise<void> {
  const key = img.dataset.previewKey;
  const type = img.dataset.previewType;
  if (!key || !type) return;
  const ref = readPreviewRef({ key, type, width: 0, height: 0 });
  if (!ref) return;
  const src = await pictureSrcFor(ref);
  if (img.dataset.previewKey !== key) return;
  if (src) {
    img.src = src;
    // A picture drawn by another build or another device is shown at once and
    // redrawn on idle time when the session can be drawn again here.
    const route = img.dataset.previewRoute;
    if (img.dataset.previewSlot && (route === 'legacy' || route === 'received')) void requestRedraw(img);
    return;
  }
  const empty = img.dataset.previewEmpty;
  if (empty && img.isConnected) {
    const span = img.ownerDocument.createElement('span');
    span.className = empty;
    span.setAttribute('aria-hidden', 'true');
    img.replaceWith(span);
  }
  if (img.dataset.previewSlot) void requestRedraw(img);
}

async function requestRedraw(img: HTMLImageElement): Promise<void> {
  staleTile({ slot: img.dataset.previewSlot!, toolId: img.dataset.previewTool, key: img.dataset.previewKey });
}
