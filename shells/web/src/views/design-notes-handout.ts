// SPDX-License-Identifier: MPL-2.0
/**
 * Presenter-facing PDF pages for a Design deck.
 *
 * This module only builds temporary DOM. The ordinary web export bridge remains the
 * renderer: every outer page is a `[data-pdf-page]`, so standard PDF export gives it a
 * true page size. The notes region takes the walker's scoped high-resolution fallback;
 * the authored slide is cloned, never moved.
 */
import { namespaceInlinedSvgIds } from '../bridge/svg-inline-ids.ts';

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_PAD = 56;
const PREVIEW_WIDTH = PAGE_WIDTH - PAGE_PAD * 2;
const PREVIEW_HEIGHT = 430;
const FIRST_NOTES_LIMIT = 900;
const CONTINUED_NOTES_LIMIT = 1_800;
const NOTE_LINE_LIMIT = 60;
const NOTE_LINE_HEIGHT = 24.8;
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface DesignHandoutSlide {
  source: HTMLElement;
  width: number;
  height: number;
  name: string;
  notes: string;
  frameId?: string;
  /** A faithful raster of the authored slide. Browser export supplies a temporary blob URL. */
  previewSrc?: string;
}

export interface MountedDesignNotesHandout {
  root: HTMLElement;
  pages: HTMLElement[];
  dispose(): void;
}

function positive(...values: number[]): number {
  return values.find((value) => Number.isFinite(value) && value > 0) ?? 1;
}

/** Capture the dimensions and plain-text metadata that must survive after the live slide moves on. */
export function snapshotDesignHandoutSlide(page: HTMLElement, index: number): DesignHandoutSlide {
  const rect = page.getBoundingClientRect();
  const style = getComputedStyle(page);
  return {
    source: page.cloneNode(true) as HTMLElement,
    width: positive(page.offsetWidth, Number.parseFloat(style.width), rect.width),
    height: positive(page.offsetHeight, Number.parseFloat(style.height), rect.height),
    name: page.getAttribute('data-frame-name')?.trim() || `Slide ${index + 1}`,
    notes: page.getAttribute('data-frame-notes') ?? '',
    frameId: page.getAttribute('data-frame-id') || undefined,
  };
}

function takeChunk(text: string, limit: number): [string, string] {
  if (text.length <= limit) return [text.trim(), ''];
  const floor = Math.floor(limit * 0.55);
  const window = text.slice(floor, limit + 1);
  const newline = window.lastIndexOf('\n');
  const space = window.lastIndexOf(' ');
  const boundary = Math.max(newline, space);
  const cut = boundary >= 0 ? floor + boundary + 1 : limit;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

/** Conservative pagination guard: no note is silently painted below the A4 crop. */
export function paginateDesignNotes(notes: string): string[] {
  const clean = notes.replace(/\r\n?/g, '\n').trim();
  if (!clean) return [''];
  const chunks: string[] = [];
  let rest = clean;
  let limit = FIRST_NOTES_LIMIT;
  while (rest) {
    const [chunk, next] = takeChunk(rest, limit);
    chunks.push(chunk);
    rest = next;
    limit = CONTINUED_NOTES_LIMIT;
  }
  return chunks;
}

function setStyles(el: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

function textEl(doc: Document, tag: string, text: string, styles: Partial<CSSStyleDeclaration>) {
  const el = doc.createElement(tag);
  el.textContent = text;
  setStyles(el, { fontFamily: 'Helvetica, Arial, sans-serif', ...styles });
  return el;
}

function appendBoundedTextRuns(doc: Document, container: SVGElement, text: string): void {
  let start = 0;
  let line = 0;
  while (start < text.length) {
    const maximum = Math.min(start + NOTE_LINE_LIMIT, text.length);
    let end = maximum;
    if (maximum < text.length) {
      const newline = text.slice(start, maximum).indexOf('\n');
      if (newline >= 0) end = start + newline + 1;
      const minimum = start + Math.floor(NOTE_LINE_LIMIT * 0.55);
      for (let cursor = maximum; cursor > minimum; cursor -= 1) {
        if (end === maximum && /\s/.test(text[cursor - 1] ?? '')) {
          end = cursor;
          break;
        }
      }
    }
    const run = doc.createElementNS(SVG_NS, 'text');
    run.setAttribute('data-handout-note-run', '');
    run.setAttribute('x', '0');
    run.setAttribute('y', String(18 + line * NOTE_LINE_HEIGHT));
    run.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
    run.setAttribute('font-size', '16');
    run.setAttribute('fill', '#172033');
    run.textContent = text.slice(start, end);
    container.appendChild(run);
    start = end;
    line += 1;
  }
}

function prepareSlideClone(slide: DesignHandoutSlide, index: number): HTMLElement {
  const clone = slide.source;
  clone.removeAttribute('data-pdf-page');
  for (const nested of clone.querySelectorAll('[data-pdf-page]')) {
    nested.removeAttribute('data-pdf-page');
  }
  clone.classList.remove('seq-off');
  for (const hidden of clone.querySelectorAll('.seq-off')) hidden.classList.remove('seq-off');
  for (const svg of clone.querySelectorAll('svg')) {
    namespaceInlinedSvgIds(svg, `design-notes-handout-${index}`);
  }
  return clone;
}

function makePage(
  doc: Document,
  slide: DesignHandoutSlide,
  slideIndex: number,
  slideTotal: number,
  noteChunk: string,
  continuation: number,
  continuationTotal: number,
  title: string
): HTMLElement {
  const page = doc.createElement('section');
  page.setAttribute('data-pdf-page', '');
  page.setAttribute('data-design-notes-handout-page', '');
  page.setAttribute('data-handout-slide', String(slideIndex + 1));
  if (slide.frameId) page.setAttribute('data-frame-id', slide.frameId);
  setStyles(page, {
    position: 'relative',
    width: `${PAGE_WIDTH}px`,
    height: `${PAGE_HEIGHT}px`,
    boxSizing: 'border-box',
    overflow: 'hidden',
    background: '#ffffff',
    color: '#172033',
    // jsPDF's HTML walker can reject a variable webfont before falling back. The
    // presenter copy uses a PDF-safe family; the authored slide image keeps its fonts.
    fontFamily: 'Helvetica, Arial, sans-serif',
  });

  const header = doc.createElement('header');
  setStyles(header, {
    position: 'absolute',
    left: `${PAGE_PAD}px`,
    right: `${PAGE_PAD}px`,
    top: '34px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '24px',
    borderBottom: '2px solid var(--brand-primary, #6d5dfc)',
    paddingBottom: '10px',
    boxSizing: 'content-box',
    fontSize: '13px',
    lineHeight: '1.2',
  });
  header.append(
    textEl(doc, 'strong', title, {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    textEl(doc, 'span', `Slide ${slideIndex + 1} of ${slideTotal}`, {
      whiteSpace: 'nowrap',
      color: '#596273',
    })
  );
  page.appendChild(header);

  if (continuation === 0) {
    const preview = doc.createElement('div');
    preview.setAttribute('data-handout-preview', '');
    setStyles(preview, {
      position: 'absolute',
      left: `${PAGE_PAD}px`,
      top: '92px',
      width: `${PREVIEW_WIDTH}px`,
      height: `${PREVIEW_HEIGHT}px`,
      overflow: 'hidden',
      background: '#f2f4f8',
      border: '1px solid #d8dde7',
      boxSizing: 'border-box',
    });
    if (slide.previewSrc) {
      const image = doc.createElement('img');
      image.src = slide.previewSrc;
      image.alt = '';
      image.setAttribute('data-handout-preview-image', '');
      setStyles(image, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        objectFit: 'contain',
      });
      preview.appendChild(image);
    } else {
      // Unit/legacy fallback. The live Design export always supplies previewSrc because
      // the PDF walker does not uniformly scale descendant text through an ancestor
      // transform; a native-resolution slide image is the fidelity boundary there.
      const scale = Math.min(PREVIEW_WIDTH / slide.width, PREVIEW_HEIGHT / slide.height);
      const clone = prepareSlideClone(slide, slideIndex);
      setStyles(clone, {
        position: 'absolute',
        left: `${(PREVIEW_WIDTH - slide.width * scale) / 2}px`,
        top: `${(PREVIEW_HEIGHT - slide.height * scale) / 2}px`,
        width: `${slide.width}px`,
        height: `${slide.height}px`,
        margin: '0',
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      });
      clone.setAttribute('aria-hidden', 'true');
      preview.appendChild(clone);
    }
    page.appendChild(preview);
  }

  const continuedLabel = continuationTotal > 1 ? ` · ${continuation + 1}/${continuationTotal}` : '';
  const notesTop = continuation === 0 ? 556 : 104;
  page.appendChild(
    textEl(doc, 'h2', `${slide.name}${continuedLabel}`, {
      position: 'absolute',
      left: `${PAGE_PAD}px`,
      right: `${PAGE_PAD}px`,
      top: `${notesTop}px`,
      margin: '0',
      fontSize: '22px',
      lineHeight: '1.25',
      fontWeight: '700',
    })
  );
  const body = doc.createElementNS(SVG_NS, 'svg');
  const bodyHeight = PAGE_HEIGHT - 54 - (notesTop + 44);
  body.setAttribute('viewBox', `0 0 ${PREVIEW_WIDTH} ${bodyHeight}`);
  body.setAttribute('width', String(PREVIEW_WIDTH));
  body.setAttribute('height', String(bodyHeight));
  body.setAttribute('aria-label', 'Speaker notes');
  setStyles(body, {
    position: 'absolute',
    left: `${PAGE_PAD}px`,
    width: `${PREVIEW_WIDTH}px`,
    top: `${notesTop + 44}px`,
    height: `${bodyHeight}px`,
    overflow: 'hidden',
    // A no-op in the browser, but an explicit fidelity boundary for the PDF walker:
    // its unsupported-filter fallback photographs only this text region. That avoids
    // jsPDF's live-text positioning state drifting across later pages while the rest
    // of the handout (page, rules, headings and slide preview) keeps its normal path.
    filter: 'brightness(1)',
  });
  body.setAttribute('data-handout-notes', '');
  appendBoundedTextRuns(doc, body, noteChunk || 'No speaker notes.');
  if (!noteChunk) {
    for (const run of body.querySelectorAll('[data-handout-note-run]')) {
      run.setAttribute('fill', '#737b8c');
    }
  }
  page.appendChild(body);
  page.appendChild(
    textEl(doc, 'footer', '', {
      position: 'absolute',
      right: `${PAGE_PAD}px`,
      bottom: '24px',
      fontSize: '12px',
      color: '#737b8c',
    })
  );
  page.lastElementChild?.setAttribute('data-handout-footer', '');
  return page;
}

/** Mount connected, off-screen pages so computed style and font resolution work during export. */
export function mountDesignNotesHandout(
  slides: readonly DesignHandoutSlide[],
  opts: { title: string; document?: Document }
): MountedDesignNotesHandout {
  const doc = opts.document ?? document;
  const root = doc.createElement('div');
  root.setAttribute('data-design-notes-handout', '');
  setStyles(root, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${PAGE_WIDTH}px`,
    pointerEvents: 'none',
    zIndex: '-2147483648',
  });
  const pages: HTMLElement[] = [];
  slides.forEach((slide, slideIndex) => {
    const chunks = paginateDesignNotes(slide.notes);
    chunks.forEach((chunk, continuation) => {
      const page = makePage(
        doc,
        { ...slide, source: slide.source.cloneNode(true) as HTMLElement },
        slideIndex,
        slides.length,
        chunk,
        continuation,
        chunks.length,
        opts.title
      );
      pages.push(page);
      root.appendChild(page);
    });
  });
  pages.forEach((page, index) => {
    const footer = page.querySelector<HTMLElement>('[data-handout-footer]');
    if (footer) footer.textContent = `Page ${index + 1} of ${pages.length}`;
  });
  doc.body.appendChild(root);
  return {
    root,
    pages,
    dispose: () => root.remove(),
  };
}

/** Wait until every slide photograph can be embedded by the PDF walker. */
export async function waitForDesignNotesHandout(root: HTMLElement): Promise<void> {
  await Promise.all(
    [...root.querySelectorAll<HTMLImageElement>('[data-handout-preview-image]')].map(
      async (image) => {
        if (image.complete && image.naturalWidth > 0) return;
        if (typeof image.decode === 'function') {
          await image.decode();
          return;
        }
        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => reject(new Error('Slide preview did not load')), {
            once: true,
          });
        });
      }
    )
  );
}
