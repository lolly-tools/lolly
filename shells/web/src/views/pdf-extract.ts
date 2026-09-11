// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack (#/unpack, alias #/pdf) - take a design file apart: the extraction surface.
 *
 * A PDF is a container, and almost every tool that opens one treats it as a
 * single opaque thing you either read whole or convert whole. This view opens it
 * up: the words, and (as the extraction passes land) the images, fonts and
 * attachments inside it, each one viewable, downloadable, and addable to the
 * catalogue.
 *
 * Everything runs on-device. The words are not OCR'd and never uploaded - a
 * born-digital PDF already contains its glyphs and their positions, so
 * `extractPageText` (engine/src/pdf-text.ts) simply puts them back into reading
 * order. The one case that genuinely cannot be served offline is a SCANNED page,
 * which carries a picture of text and no text at all; those are reported as such
 * per page rather than quietly contributing nothing.
 *
 * Structure: one tab per extraction pass - Text, Images, Fonts, Attachments. A
 * tab whose pass found nothing is not rendered at all, so the strip reflects what
 * this document actually contains rather than what a PDF could contain, and a
 * plain text-only document still reads as a single uncluttered column.
 *
 * Design-system hand-offs (plan 97 section 8, M5). A guidelines PDF usually holds the
 * exact vector marks, the palette they are drawn in and real font files, so this
 * view keeps everything it already does and gains three doors into the studio:
 * a font row installs its face, a mark goes to the Logos room, and the bar sends
 * the whole scan. None of them RE-SCANS - every hand-off is built from what the
 * passes above already extracted, so a send costs a census and a state write, not
 * a second walk of the document.
 */

import '../styles/parts/pdf-extract.css';   // async CSS chunk (lazy view)
import { joinPageText } from '@lolly/engine';
import type { PageText, HiddenTextFinding } from '@lolly/engine';
import { escape } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import type { IconName } from '../lib/icons.ts';
import { wireTabs } from '../lib/tabs.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { armViewEnter } from '../view-enter.ts';
import { playSfx } from '../lib/sfx.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { UserFontsHost } from '../user-fonts.ts';
import type { EmbeddedFont, EmbeddedImage, EmbeddedAttachment, ExtractedVector } from './pdf-import.ts';
import type { UnpackHandle } from './unpack-open.ts';

/** Beyond this a page-by-page reconstruction stops being interactive. */
const MAX_PAGES = 400;
/** Reading a whole PDF into memory twice (bytes + nodes) has a ceiling. */
const MAX_BYTES = 120 * 1024 * 1024;

interface Extracted {
  fileName: string;
  pages: PageText[];
  /** Pages/slides this container holds (capped at MAX_PAGES) - the count art and
   *  the page strip are built from, so a no-text file still shows its pictures. */
  pageCount: number;
  /** Whether the handle offered a text pass at all. False for a container whose
   *  reader has no words to give (a deck's slide renderer today) - the Text panel
   *  then says so plainly instead of presenting an empty column as "no text". */
  textSupported: boolean;
  /** Pages we refused to walk because the document is enormous. */
  truncated: number;
  /** Text an opaque shape is painted over - the failed-redaction check. */
  hidden: HiddenTextFinding[];
  /** The distinct colours the container paints with, as hex strings. */
  palette: string[];
  fonts: EmbeddedFont[];
  images: EmbeddedImage[];
  /** Rasters found but not handed over here - undecodable compression (PDF) or a
   *  linked/external reference we will not fetch (SVG). */
  imagesSkipped: number;
  /** The compression filters behind `imagesSkipped`, when the reason is a codec
   *  (PDF). Empty means the skip was a linked reference, which changes the note. */
  imagesSkippedFilters: string[];
  attachments: EmbeddedAttachment[];
  vectors: ExtractedVector[];
}

/** Object URLs minted for image previews, revoked when the report is replaced. */
let previewUrls: string[] = [];
function releasePreviews(): void {
  for (const u of previewUrls) URL.revokeObjectURL(u);
  previewUrls = [];
}

// ── helpers ───────────────────────────────────────────────────────────────────

const stem = (name: string): string => name.replace(/\.[^.]+$/, '') || 'document';

/** A download name for an extracted raster: its source name when it has one (a PSD
 *  layer), else a positional "…-image-N". */
function imageFileName(im: EmbeddedImage, base: string, index: number): string {
  const ext = im.mime.replace(/^image\//, '').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const clean = (im.name || '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return clean ? `${base}-${clean}.${ext}` : `${base}-image-${index + 1}.${ext}`;
}

function download(host: HostV1, text: string, filename: string, mime: string): void {
  void host.export.download(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

/** Words in a page's reconstructed prose - the honest measure of what came out. */
const wordCount = (p: PageText): number => (p.text.match(/\S+/g) ?? []).length;

// Counts. Two whole keys per phrase behind a ternary - the app-wide convention
// (see catalog.ts / gallery.ts), because a translator needs the whole sentence,
// not "{n}" glued to a noun that inflects differently at one.
const nPages = (n: number): string => (n === 1 ? t('1 page') : t('{n} pages', { n }));
const nWords = (n: number): string => (n === 1 ? t('1 word') : t('{n} words', { n }));
const nPlaces = (n: number): string => (n === 1 ? t('1 place') : t('{n} places', { n }));

// ── rendering ─────────────────────────────────────────────────────────────────

/**
 * The page picture beside the prose. Rendered LAZILY (an IntersectionObserver
 * fills it as it approaches the viewport - a 400-page document must not pay for
 * 400 SVG renders up front) and vector: the same `pageToSvg` path design-import
 * uses, so what you see is the actual page, not a raster approximation.
 * `user-select: none` in CSS keeps a drag-select over the report picking up
 * words only - the picture is a duplicate of the text beside it, which is also
 * why it is aria-hidden.
 */
const pageArtMarkup = (index: number): string =>
  `<figure class="pdfx-page-art" data-page-art="${index}" aria-hidden="true"></figure>`;

function pageMarkup(p: PageText, index: number): string {
  if (p.scanned) {
    return `
      <section class="pdfx-page pdfx-page--scan" data-page="${index}">
        <h3 class="pdfx-page-n">${t('Page {n}', { n: index + 1 })}</h3>
        <div class="pdfx-page-cols">
          <p class="pdfx-scan">
            <span class="pdfx-scan-icon" aria-hidden="true">${icon('camera', { size: 20 })}</span>
            ${t('This page is a scanned image. It holds a picture of text, not text, so there is nothing to extract without OCR.')}
          </p>
          ${pageArtMarkup(index)}
        </div>
      </section>`;
  }
  if (!p.blocks.length) {
    return `
      <section class="pdfx-page pdfx-page--empty" data-page="${index}">
        <h3 class="pdfx-page-n">${t('Page {n}', { n: index + 1 })}</h3>
        <div class="pdfx-page-cols">
          <p class="pdfx-empty">${t('No text on this page.')}</p>
          ${pageArtMarkup(index)}
        </div>
      </section>`;
  }

  const body = p.blocks.map((b) => {
    if (b.kind === 'heading') {
      const lvl = Math.min(6, Math.max(1, b.level ?? 1));
      return `<p class="pdfx-b pdfx-b--h" data-level="${lvl}">${escape(b.text)}</p>`;
    }
    if (b.kind === 'list-item') return `<p class="pdfx-b pdfx-b--li">${escape(b.text)}</p>`;
    return `<p class="pdfx-b">${escape(b.text)}</p>`;
  }).join('');

  // Notes the reader needs to judge the reconstruction - how many columns it was
  // read as, and whether anything was left out of the flow.
  const notes: string[] = [];
  if (p.columns > 1) notes.push(t('read as {n} columns', { n: p.columns }));
  if (p.rotated) notes.push(t('{n} rotated runs left out', { n: p.rotated }));

  return `
    <section class="pdfx-page" data-page="${index}">
      <h3 class="pdfx-page-n">
        ${t('Page {n}', { n: index + 1 })}
        <span class="pdfx-page-meta">${escape(nWords(wordCount(p)))}${notes.length ? ` · ${escape(notes.join(' · '))}` : ''}</span>
        <button type="button" class="btn btn--ghost pdfx-page-copy" data-copy-page="${index}">${t('Copy')}</button>
      </h3>
      <div class="pdfx-page-cols">
        <div class="pdfx-page-body">${body}</div>
        ${pageArtMarkup(index)}
      </div>
    </section>`;
}

/**
 * The floating page strip - quick nav, docked to the right centre of the view.
 *
 * One button per page, filled with the SAME lazily-rendered SVG the page art
 * uses (the handle caches per page, so a thumb and its full-size twin cost one
 * render between them). Clicking scrolls the reading column to that page; the
 * button carrying `.is-current` follows the scroll position. Not rendered for a
 * single page - one thumbnail is not navigation.
 */
function thumbsMarkup(count: number): string {
  if (count < 2) return '';
  const thumbs = Array.from({ length: count }, (_, i) => `
    <button type="button" class="pdfx-thumb${i ? '' : ' is-current'}" data-goto="${i}"
      aria-label="${escape(t('Page {n}', { n: i + 1 }))}">
      <span class="pdfx-thumb-art" data-thumb-art="${i}" aria-hidden="true"></span>
      <span class="pdfx-thumb-n">${i + 1}</span>
    </button>`).join('');
  return `<nav class="pdfx-thumbs" data-thumbs aria-label="${escape(t('Pages'))}">${thumbs}</nav>`;
}

/**
 * The failed-redaction banner.
 *
 * Leads the report when it fires, because it changes what the user should do
 * next more than anything else on the page: a document whose black bars do not
 * actually remove the words underneath must not be sent anywhere.
 *
 * It shows the hidden words. That is the whole point - the words are already
 * trivially readable by any extractor, and seeing them is what makes the problem
 * believable rather than theoretical. The wording stays an observation ("not
 * visible"), never an accusation about why.
 */
function hiddenMarkup(hidden: HiddenTextFinding[]): string {
  if (!hidden.length) return '';
  const words = hidden.reduce((a, f) => a + (f.text.match(/\S+/g) ?? []).length, 0);
  const pages = new Set(hidden.map((f) => f.page ?? 0)).size;

  const rows = hidden.map((f) => `
    <li class="pdfx-hidden-row">
      <span class="pdfx-hidden-where">${escape(t('Page {n}', { n: (f.page ?? 0) + 1 }))}</span>
      <code class="pdfx-hidden-text">${escape(f.text)}</code>
    </li>`).join('');

  return `
    <section class="pdfx-hidden" role="alert">
      <h2 class="pdfx-hidden-head">
        <span aria-hidden="true">${icon('eye', { size: 20 })}</span>
        ${t('Text is hidden behind shapes in this document')}
      </h2>
      <p class="pdfx-hidden-lede">${escape(tRaw('{words} in {runs} are covered by opaque shapes on {pages}. They are still in the file, and any PDF reader can pull them back out, including this one below. If these were meant to be redacted, drawing boxes over them did not remove them.', {
        words: nWords(words), runs: nPlaces(hidden.length), pages: nPages(pages),
      }))}</p>
      <ul class="pdfx-hidden-list">${rows}</ul>
      <p class="pdfx-hidden-cta">
        <a class="btn pdfx-hidden-redact" href="#/tool/redact">${t('Redact this properly')}</a>
        <span class="pdfx-hidden-cta-note">${escape(t('The Redact tool rebuilds the file so covered text is destroyed, not hidden.'))}</span>
      </p>
    </section>`;
}


/** Bytes → a short human size. */
function sizeLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The Images panel - every raster at its STORED resolution.
 *
 * Stored, not displayed: a logo placed at 20mm may be a 4000px original, and the
 * original is what someone extracting assets actually wants. Each tile previews
 * from an object URL minted here and released when the report is replaced.
 */
function imagesMarkup(x: Extracted): string {
  if (!x.images.length && !x.imagesSkipped) return '';
  const tiles = x.images.map((im, i) => {
    const url = URL.createObjectURL(new Blob([im.bytes as BlobPart], { type: im.mime }));
    previewUrls.push(url);
    const dims = `${im.width}×${im.height}`;
    // A named source (a PSD/XCF layer) leads with its name and keeps the dimensions
    // in the sub-line; an unnamed raster (PDF) leads with the dimensions as before.
    const primary = im.name ? im.name : dims;
    const sub = `${im.name ? `${dims} · ` : ''}${im.mime.replace(/^image\//, '')} · ${sizeLabel(im.bytes.length)} · ${t('page {n}', { n: im.page + 1 })}`;
    return `
      <figure class="pdfx-asset" data-image="${i}">
        <div class="pdfx-asset-art"><img src="${escape(url)}" alt="" loading="lazy" decoding="async"></div>
        <figcaption class="pdfx-asset-meta">
          <span class="pdfx-asset-name">${escape(primary)}</span>
          <span class="pdfx-asset-sub">${escape(sub)}</span>
        </figcaption>
        <div class="pdfx-asset-actions">
          <button type="button" class="btn btn--ghost" data-save-image="${i}">${t('Download')}</button>
          <button type="button" class="btn btn--ghost" data-catalog-image="${i}">${t('Add to catalogue')}</button>
        </div>
      </figure>`;
  }).join('');

  // Skipped rasters are STATED, never silently dropped - otherwise a page of
  // JPEG2000 scans looks like a document with no images in it. The reason is read
  // from the data (a codec name vs none), not from the file's format, so the view
  // never special-cases one kind: a codec skip explains the codec, and a linked
  // reference (an SVG <image href> pointing elsewhere) explains that it was not
  // fetched.
  const note = x.imagesSkipped
    ? `<p class="pdfx-note">${x.imagesSkippedFilters.length
        ? t('{n} more images use a compression this browser cannot decode (JPEG 2000, CCITT fax or JBIG2), so they cannot be shown or saved here.', { n: x.imagesSkipped })
        : t('{n} more images are linked from outside this file, so their pixels are not here to show or save.', { n: x.imagesSkipped })}</p>`
    : '';

  return `<div class="pdfx-panel" data-panel="images" hidden>${note}<div class="pdfx-assets">${tiles}</div></div>`;
}

/**
 * The Vectors panel - the logos.
 *
 * Most logos in a PDF are vector, so this is usually the most valuable tab:
 * what comes out stays sharp at any size, unlike the raster in the Images tab.
 * Each mark previews as the actual SVG (inline, so it scales in the tile) and
 * carries the reason it was believed to be artwork rather than page furniture - 
 * the judgement is a heuristic and the user should be able to see it was made.
 *
 * "Send to Logos" hands one mark to the Logos room, where it is classified and
 * confirmed exactly like a mark dropped by hand. It deliberately does NOT place
 * the mark in a slot: the heuristic above says this was probably artwork, not
 * which artwork it is, and a silent placement would spend that guess twice.
 */
function vectorsMarkup(x: Extracted): string {
  if (!x.vectors.length) return '';
  const tiles = x.vectors.map((v, i) => {
    const url = URL.createObjectURL(new Blob([v.svg], { type: 'image/svg+xml' }));
    previewUrls.push(url);
    const swatches = v.fills.slice(0, 6).map((f) =>
      `<span class="pdfx-swatch" style="background:${escape(f)}" title="${escape(f)}"></span>`).join('');
    return `
      <figure class="pdfx-asset" data-vector="${i}">
        <div class="pdfx-asset-art"><img src="${escape(url)}" alt="" loading="lazy" decoding="async"></div>
        <figcaption class="pdfx-asset-meta">
          <span class="pdfx-asset-name">${escape(`${v.width}×${v.height} pt`)}</span>
          <span class="pdfx-asset-sub">${escape(t('{n} shapes · page {p}', { n: v.shapes, p: v.page + 1 }))}</span>
          <span class="pdfx-swatches">${swatches}</span>
          <span class="pdfx-asset-why">${escape(tRaw('Detected by {reason}', { reason: v.reason }))}</span>
        </figcaption>
        <div class="pdfx-asset-actions">
          <button type="button" class="btn btn--ghost" data-save-vector="${i}">${t('Download SVG')}</button>
          <button type="button" class="btn btn--ghost" data-catalog-vector="${i}">${t('Add to catalogue')}</button>
          <button type="button" class="btn btn--ghost" data-logos-vector="${i}">${t('Send to Logos')}</button>
        </div>
      </figure>`;
  }).join('');

  return `<div class="pdfx-panel" data-panel="vectors" hidden><div class="pdfx-assets">${tiles}</div></div>`;
}

/**
 * The Fonts panel.
 *
 * Two caveats ride on every row, and they are the honest part of this feature.
 * A SUBSET carries only the glyphs the document printed, so it will silently
 * lose characters anywhere else - it is not a usable font, whatever its name
 * says. And `fsType` is the font's own machine-readable statement about reuse;
 * a restrictive one is an unambiguous no, and a permissive one still is not the
 * licence. Both are shown per font rather than buried in a general disclaimer.
 *
 * "Add to the design system" (plan 97 section 7.2) installs the face through the same
 * `installFontFromBytes` an upload uses, so a PDF-embedded family lands as an
 * ordinary user font with its embedding statement recorded on the asset. The
 * button is offered only on a face that is a whole installable file: a `cff` or
 * `pfb` row is raw font-program bytes, the row already says so, and a button
 * guaranteed to answer "could not add" would be a worse way to say it. The
 * caveats do not soften on the way in - a SUBSET installs as a subset and says
 * so, because the alternative is a family that quietly loses characters later.
 */
function fontsMarkup(x: Extracted): string {
  if (!x.fonts.length) return '';

  const PERMISSION: Record<string, string> = {
    installable: t('The font itself states no embedding restriction, which is not the same as a licence to reuse it.'),
    restricted: t('The font forbids reuse outside this document.'),
    'preview-print': t('The font allows viewing and printing only, not reuse.'),
    editable: t('The font allows embedding for editing.'),
    unknown: t('This format carries no embedding statement, so nothing is stated either way.'),
  };

  const rows = x.fonts.map((f, i) => {
    // A names-only face carries no bytes - the file merely REFERENCES the family
    // (an SVG @font-face with no embedded source, an IDML that links its fonts).
    // There is nothing to download or install, and the caveats and buttons must
    // say exactly that rather than talk about bytes that are not here.
    const namesOnly = f.bytes.length === 0;

    const tags: string[] = [];
    if (f.subset) tags.push(`<span class="pdfx-tag pdfx-tag--warn">${t('subset')}</span>`);
    if (namesOnly) tags.push(`<span class="pdfx-tag">${t('not embedded')}</span>`);
    else if (!f.installable) tags.push(`<span class="pdfx-tag">${t('not installable')}</span>`);
    if (f.embedding.permission === 'restricted') tags.push(`<span class="pdfx-tag pdfx-tag--warn">${t('reuse forbidden')}</span>`);

    const caveats: string[] = [];
    if (namesOnly) {
      caveats.push(t('This family is named in the file but its font file is not embedded, so there is nothing to download or install here.'));
    } else {
      if (f.subset) caveats.push(t('Only the glyphs this document used are embedded, so it will be missing characters anywhere else.'));
      if (!f.installable) caveats.push(t('These are raw font-program bytes, not a file a system can install.'));
      caveats.push(PERMISSION[f.embedding.permission] ?? PERMISSION.unknown!);
    }

    const add = f.installable
      ? `<button type="button" class="btn btn--ghost" data-add-font="${i}">${t('Add to the design system')}</button>`
      : '';
    // No bytes → no Download; the sub-line drops the meaningless "0 B" size too.
    const actions = namesOnly ? add : `<button type="button" class="btn btn--ghost" data-save-font="${i}">${t('Download')}</button>${add}`;
    const sub = namesOnly ? escape(t('referenced, not embedded')) : escape(`.${f.ext} · ${sizeLabel(f.bytes.length)}`);

    return `
      <li class="pdfx-font">
        <div class="pdfx-font-head">
          <span class="pdfx-font-name">${escape(f.family)}</span>
          ${tags.join('')}
          <span class="pdfx-font-sub">${sub}</span>
          <span class="pdfx-font-actions">${actions}</span>
        </div>
        <p class="pdfx-font-caveat">${escape(caveats.join(' '))}</p>
      </li>`;
  }).join('');

  return `<div class="pdfx-panel" data-panel="fonts" hidden><ul class="pdfx-fonts">${rows}</ul></div>`;
}

/** The Attachments panel - the files the document carries inside it. */
function attachmentsMarkup(x: Extracted): string {
  if (!x.attachments.length) return '';
  const rows = x.attachments.map((a, i) => `
    <li class="pdfx-att">
      <span class="pdfx-att-icon" aria-hidden="true">${icon('package', { size: 18 })}</span>
      <span class="pdfx-att-name">${escape(a.name)}</span>
      <span class="pdfx-att-sub">${escape(sizeLabel(a.bytes.length))}</span>
      <button type="button" class="btn btn--ghost" data-save-att="${i}">${t('Download')}</button>
    </li>`).join('');

  return `
    <div class="pdfx-panel" data-panel="attachments" hidden>
      <p class="pdfx-note">${t('These files ride inside the PDF. Opening one runs whatever it is, so treat an attachment from a document you did not make the way you would treat any other unexpected file.')}</p>
      <ul class="pdfx-atts">${rows}</ul>
    </div>`;
}

/**
 * The Palette panel - the distinct colours the container paints with.
 *
 * One row per colour: a swatch, the hex value the extractor normalised it to, and
 * a copy button. The value is what someone rebuilding a brand actually reaches for,
 * so it is shown as text (and copyable) rather than only as a chip.
 */
function paletteMarkup(x: Extracted): string {
  if (!x.palette.length) return '';
  const rows = x.palette.map((hex) => `
    <li class="pdfx-pal-row">
      <span class="pdfx-pal-chip" style="background:${escape(hex)}" aria-hidden="true"></span>
      <code class="pdfx-pal-hex">${escape(hex)}</code>
      <button type="button" class="btn btn--ghost pdfx-pal-copy" data-copy-color="${escape(hex)}">${t('Copy')}</button>
    </li>`).join('');
  return `<div class="pdfx-panel" data-panel="palette" hidden><ul class="pdfx-palette">${rows}</ul></div>`;
}

/**
 * The reading column for a container whose reader has no text pass (a slide deck
 * today). One honest line, then the page pictures the SVG pass can still render - 
 * so the file opens and shows what it is, rather than failing or pretending it
 * holds no words. Each `.pdfx-page` carries `data-page` so the strip and the
 * current-page highlight wire up exactly as they do for a text document.
 */
function artOnlyPagesMarkup(count: number): string {
  const note = `<p class="pdfx-note">${t('This file type has no extractable text here yet.')}</p>`;
  const secs = Array.from({ length: count }, (_, i) => `
    <section class="pdfx-page pdfx-page--art" data-page="${i}">
      <h3 class="pdfx-page-n">${t('Page {n}', { n: i + 1 })}</h3>
      <div class="pdfx-page-cols">${pageArtMarkup(i)}</div>
    </section>`).join('');
  return note + secs;
}

function resultMarkup(x: Extracted): string {
  const words = x.pages.reduce((a, p) => a + wordCount(p), 0);
  const scans = x.pages.filter((p) => p.scanned).length;

  // Page count comes from `pageCount` (== pages.length on the text path, so a PDF
  // is unchanged), so a no-text file still reports its slides. Words only when
  // there was a text pass - a deck with no reader for its words must not say "0".
  const summary: string[] = [nPages(x.pageCount)];
  if (x.textSupported) summary.push(nWords(words));
  if (scans) summary.push(t('{n} scanned', { n: scans }));

  // An all-scan document deserves the headline, not a footnote: the user's next
  // move (find an OCR tool) is completely different from "read the text".
  const allScans = scans > 0 && scans === x.pages.length;

  // The studio hand-off is offered only when this document has design material
  // in it. A text-only PDF would send an empty census and land the reader in a
  // studio with nothing new in it, which is a worse answer than not asking.
  const studio = x.vectors.length > 0 || x.fonts.length > 0;

  // Only passes that FOUND something get a tab, so the strip describes this
  // document rather than what a PDF could theoretically hold. The count rides in
  // a separate badge (not appended to the label) so the CSS can make it loud - the
  // whole point of the strip is that a reader scrolling the pages SEES that their
  // images, fonts and colours came out too.
  const tabs = [
    { id: 'text', label: t('Text'), icon: 'document' as IconName, n: 0 },
    ...(x.palette.length ? [{ id: 'palette', label: t('Palette'), icon: 'palette' as IconName, n: x.palette.length }] : []),
    ...(x.vectors.length ? [{ id: 'vectors', label: t('Logos'), icon: 'shapes' as IconName, n: x.vectors.length }] : []),
    // The Images tab appears when a raster was decoded OR when some were only
    // referenced/undecodable - so the honest "not here" note is reachable, never
    // orphaned behind a tab that never shows.
    ...(x.images.length || x.imagesSkipped ? [{ id: 'images', label: t('Images'), icon: 'image' as IconName, n: x.images.length }] : []),
    ...(x.fonts.length ? [{ id: 'fonts', label: t('Fonts'), icon: 'font' as IconName, n: x.fonts.length }] : []),
    ...(x.attachments.length ? [{ id: 'attachments', label: t('Attachments'), icon: 'package' as IconName, n: x.attachments.length }] : []),
  ];

  return `
    <div class="pdfx-result">
      <div class="pdfx-bar">
        <div class="pdfx-bar-meta">
          <strong class="pdfx-file">${escape(x.fileName)}</strong>
          <span class="pdfx-sum">${escape(summary.join(' · '))}</span>
        </div>
        <div class="pdfx-bar-actions">
          ${studio ? `<button type="button" class="btn" data-act="studio">${t('Send to the design system studio')}</button>` : ''}
          ${x.textSupported ? `<button type="button" class="btn" data-act="copy">${t('Copy all')}</button>` : ''}
          ${x.textSupported ? `<button type="button" class="btn" data-act="md">${t('Download .md')}</button>` : ''}
          ${x.textSupported ? `<button type="button" class="btn" data-act="txt">${t('Download .txt')}</button>` : ''}
          <button type="button" class="btn btn--ghost" data-act="clear">${t('Open another')}</button>
        </div>
      </div>

      ${hiddenMarkup(x.hidden)}

      ${x.truncated ? `<p class="pdfx-note">${t('Only the first {n} pages were read. The rest of this document is too long to take apart here.', { n: x.pages.length })}</p>` : ''}
      ${allScans ? `<p class="pdfx-note pdfx-note--warn">${t('Every page in this document is a scanned image. There is no text layer to extract, and reading it would need OCR, which does not run on-device.')}</p>` : ''}

      <div class="pdfx-tabs" role="tablist" aria-label="${t('Extracted content')}">
        ${tabs.length > 1 ? `<span class="pdfx-tabs-lead" aria-hidden="true">${t('In this file')}</span>` : ''}
        ${tabs.map((tb, i) => `<button type="button" class="btn pdfx-tab${i ? '' : ' is-active'}${tb.n ? ' pdfx-tab--asset' : ''}" role="tab" aria-selected="${i ? 'false' : 'true'}" data-tab="${tb.id}">
          <span class="pdfx-tab-ico" aria-hidden="true">${icon(tb.icon, { size: 18 })}</span>
          <span class="pdfx-tab-label">${escape(tb.label)}</span>
          ${tb.n ? `<span class="pdfx-tab-n">${tb.n}</span>` : ''}
        </button>`).join('')}
      </div>

      <div class="pdfx-pages pdfx-panel" data-panel="text">
        ${x.textSupported ? x.pages.map(pageMarkup).join('') : artOnlyPagesMarkup(x.pageCount)}
      </div>
      ${paletteMarkup(x)}
      ${vectorsMarkup(x)}
      ${imagesMarkup(x)}
      ${fontsMarkup(x)}
      ${attachmentsMarkup(x)}
      ${thumbsMarkup(x.pageCount)}
    </div>`;
}

// ── mount ─────────────────────────────────────────────────────────────────────

export async function mountPdfExtract(viewEl: HTMLElement, host: HostV1, _params?: string): Promise<void> {
  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout pdfx-layout">
      <header class="plat-header">
        <h1 class="plat-title">${t('Unpack')}</h1>
        <div class="plat-header-text">
          <p class="plat-sub">${t('Pull the words, images, fonts, colours and attachments out of a design file and keep what you need. PDF, SVG, InDesign, Penpot, Figma, PowerPoint and Photoshop, all on this device; the file is never uploaded.')}</p>
        </div>
      </header>

      <div class="pdfx-drop" data-drop tabindex="0" role="button" aria-label="${escape(t('Choose or drop a design file to take apart'))}">
        <input type="file" accept=".pdf,.ai,.svg,.idml,.penpot,.fig,.pptx,.psd,.psb,.xcf,application/pdf,image/svg+xml" hidden>
        <span class="pdfx-drop-icon" aria-hidden="true">${icon('document', { size: 32 })}</span>
        <strong>${t('Drop a design file here')}</strong>
        <span>${t('pdf · svg · idml · penpot · fig · pptx · psd · nothing leaves your device')}</span>
      </div>

      <div class="pdfx-out" data-out hidden></div>
    </div>
  `;
  armViewEnter(viewEl, '.tools-home, .plat-header, .pdfx-drop');
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  const drop = viewEl.querySelector<HTMLElement>('[data-drop]')!;
  const input = drop.querySelector<HTMLInputElement>('input[type="file"]')!;
  const out = viewEl.querySelector<HTMLElement>('[data-out]')!;

  let current: Extracted | null = null;
  /** The open document - kept for the lazy per-page SVG renders. */
  let curHandle: UnpackHandle | null = null;
  // Each new file, cancellation and unmount invalidates every older read.
  let readGeneration = 0;
  let active = true;
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    active = false;
    reset();
  };
  /** Memoised page → object-URL renders, so page art and its thumb share one. */
  let artPromises = new Map<number, Promise<string | null>>();
  let observers: Array<{ disconnect(): void }> = [];

  function unwire(): void {
    for (const o of observers) o.disconnect();
    observers = [];
  }

  /**
   * Render page `i` to a self-contained SVG object URL, once. A stale resolve
   * (the report was replaced mid-render) returns null WITHOUT minting a URL, so
   * nothing leaks past `releasePreviews`.
   *
   * The SVG is destined for an `<img>`, where the browser loads no external
   * resources and no document fonts - a bare `<text>` run would paint in a
   * generic fallback face at the original face's positions. So text is outlined
   * to real paths through the app's shaper, with `embedFonts` inlining an
   * @font-face for any run the outliner could not resolve - the same recipe as
   * lib/pdf-vector-shot.ts, whose comment explains it, for the same destination.
   */
  function pageArtUrl(i: number): Promise<string | null> {
    let p = artPromises.get(i);
    if (!p) {
      const h = curHandle;
      p = (async () => {
        if (!h) return null;
        try {
          const { makeTextOutliner, embedFonts } = await import('../lib/pdf-vector-shot.ts');
          const page = await h.pageToSvg(i, {
            outlineText: makeTextOutliner([], host.text),
            // Terminal <img> output, never re-exported - safe to hoist repeats.
            dedupePaths: true,
          });
          const svg = await embedFonts(page.svg, []);
          if (curHandle !== h) return null;
          const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
          previewUrls.push(url);
          return url;
        } catch (err) {
          host.log('warn', 'pdf-extract: page render failed', { page: i, error: (err as Error)?.message });
          return null;
        }
      })();
      artPromises.set(i, p);
    }
    return p;
  }

  /**
   * Wire the lazy renders and the current-page highlight for a fresh report.
   *
   * Two observers: one fills page art and strip thumbs as they near their
   * viewport (`rootMargin` pre-renders a screen ahead so the picture is usually
   * there when the page is), one watches which page section crosses the middle
   * band of the screen and lights its thumb.
   */
  function wirePages(): void {
    unwire();
    const strip = out.querySelector<HTMLElement>('[data-thumbs]');

    // Two stacked sticky headers - the action bar, then the tab strip pinned right
    // under it - both wrap (narrow viewports, largeText), so their real heights are
    // measured into custom properties rather than hard-coded. `--pdfx-bar-bottom`
    // is where the tab strip pins; `--pdfx-chrome-bottom` (bar + tabs) is what the
    // pages and the sticky page art must clear so neither hides under the strip.
    const bar = out.querySelector<HTMLElement>('.pdfx-bar');
    const tabsEl = out.querySelector<HTMLElement>('.pdfx-tabs');
    if (bar) {
      const measure = (): void => {
        const top = Number.parseFloat(getComputedStyle(bar).top) || 0;
        const barBottom = Math.ceil(top + bar.offsetHeight);
        out.style.setProperty('--pdfx-bar-bottom', `${barBottom}px`);
        // offsetHeight is 0 when the lone-Text strip is display:none, so a text-only
        // document keeps the old single-header offset with no gap.
        const tabsH = tabsEl ? tabsEl.offsetHeight : 0;
        out.style.setProperty('--pdfx-chrome-bottom', `${barBottom + tabsH}px`);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(bar);
      if (tabsEl) ro.observe(tabsEl);
      observers.push(ro);
    }

    const artIo = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        artIo.unobserve(el);
        const i = Number(el.dataset.pageArt ?? el.dataset.thumbArt);
        void pageArtUrl(i).then((url) => {
          if (!el.isConnected) return;
          if (!url) { el.hidden = true; return; }
          el.innerHTML = `<img src="${escape(url)}" alt="" decoding="async">`;
        });
      }
    }, { rootMargin: '600px 0px' });
    // The strip is its own scroller, so its thumbs observe against it - a thumb
    // far down a 200-page strip renders when scrolled to, not on load.
    const thumbIo = strip ? new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const el = en.target as HTMLElement;
        thumbIo!.unobserve(el);
        void pageArtUrl(Number(el.dataset.thumbArt)).then((url) => {
          if (!url || !el.isConnected) return;
          el.innerHTML = `<img src="${escape(url)}" alt="" decoding="async">`;
        });
      }
    }, { root: strip, rootMargin: '200px 0px' }) : null;

    for (const el of out.querySelectorAll<HTMLElement>('[data-page-art]')) artIo.observe(el);
    if (thumbIo) for (const el of out.querySelectorAll<HTMLElement>('[data-thumb-art]')) thumbIo.observe(el);
    observers.push(artIo);
    if (thumbIo) observers.push(thumbIo);

    if (strip) {
      const pageCount = out.querySelectorAll('.pdfx-page').length;
      let lastCur = -1;
      const setCurrent = (cur: number): void => {
        if (cur === lastCur) return;
        lastCur = cur;
        for (const th of strip.querySelectorAll<HTMLElement>('.pdfx-thumb')) {
          const on = Number(th.dataset.goto) === cur;
          th.classList.toggle('is-current', on);
          // Keep the lit thumb inside the strip's own scroll window - but only
          // nudge the strip, never the page (scrollIntoView would move both).
          if (on && (th.offsetTop < strip.scrollTop
            || th.offsetTop + th.offsetHeight > strip.scrollTop + strip.clientHeight)) {
            strip.scrollTop = th.offsetTop - strip.clientHeight / 2 + th.offsetHeight / 2;
          }
        }
      };

      // The view is its own scroller (.pdfx-view { overflow-y: auto }); fall
      // back to the document for safety if that ever changes.
      const scroller = (): Element =>
        (viewEl.scrollHeight > viewEl.clientHeight ? viewEl : document.scrollingElement ?? viewEl);
      const atEnd = (): boolean => {
        const s = scroller();
        return s.scrollTop + s.clientHeight >= s.scrollHeight - 4;
      };

      const visible = new Set<number>();
      const apply = (): void => {
        // At the bottom of the scroller the reader is on the LAST page, even
        // when it is too short to ever reach the middle band - without this its
        // thumb can never light and clicking it appears to do nothing.
        if (atEnd()) { setCurrent(pageCount - 1); return; }
        if (visible.size) setCurrent(Math.min(...visible));
      };

      const curIo = new IntersectionObserver((entries) => {
        for (const en of entries) {
          const i = Number((en.target as HTMLElement).dataset.page);
          if (en.isIntersecting) visible.add(i);
          else visible.delete(i);
        }
        apply();
      }, { rootMargin: '-45% 0px -45% 0px' });
      for (const el of out.querySelectorAll<HTMLElement>('.pdfx-page')) curIo.observe(el);
      observers.push(curIo);

      // Capture-phase, so it hears the view's own scroller as well as the
      // document. Cheap: reads two geometry values; setCurrent exits on no-op.
      const onScroll = (): void => apply();
      document.addEventListener('scroll', onScroll, { passive: true, capture: true });
      observers.push({ disconnect: () => document.removeEventListener('scroll', onScroll, { capture: true }) });
    }
  }

  function fail(message: string): void {
    current = null;
    curHandle = null;
    unwire();
    out.hidden = false;
    drop.hidden = false;
    out.innerHTML = `<p class="pdfx-error">${escape(message)}</p>`;
  }

  async function open(file: File): Promise<void> {
    if (!active) return;
    const generation = ++readGeneration;
    const stale = (): boolean => !active || generation !== readGeneration;
    if (file.size > MAX_BYTES) {
      fail(t('That file is too large to take apart here (over {n} MB).', { n: Math.round(MAX_BYTES / 1024 / 1024) }));
      return;
    }
    // A 400-page / 120 MB read is minutes of work, so the busy line carries a page
    // count and a way out. The generation is checked after awaits and at each 8-page
    // yield; the reads themselves have no abort, so a cancelled parse finishes in the
    // background and its result is dropped. Deliberately view-scoped (not a job): the
    // report only exists on this view, so there is nothing to hand back after a leave.
    out.hidden = false;
    out.innerHTML = `<p class="pdfx-busy">`
      + `<span>${t('Reading {name}…', { name: file.name })}</span> `
      + `<span data-busy-count role="status" aria-live="polite"></span> `
      + `<button type="button" class="btn btn--ghost" data-busy-cancel>${t('Cancel')}</button></p>`;
    const busyCount = out.querySelector<HTMLElement>('[data-busy-count]');
    out.querySelector<HTMLElement>('[data-busy-cancel]')?.addEventListener('click', () => {
      reset();
      announce(t('Import cancelled'));
    });

    // The module import and the document parse fail for unrelated reasons and
    // must not share a catch: a stale chunk after a deploy (or a wiped dev dep
    // cache) makes this lazy import reject, and blaming the user's file for
    // that sends them off to "remove the password" from a perfectly good PDF.
    let openDesignFile: (typeof import('./unpack-open.ts'))['openDesignFile'];
    try {
      ({ openDesignFile } = await import('./unpack-open.ts'));
      if (stale()) return;
    } catch (err) {
      if (stale()) return;
      host.log('warn', 'pdf-extract: reader module failed to load', { error: (err as Error)?.message });
      fail(t('The reader failed to load. Your file is fine; reload the page and try again.'));
      return;
    }

    // The router owns every failure message (it alone knows the format), and each
    // is a translated, safe-to-show string. A per-format opener chunk that fails
    // to load carries the same "reload" wording, so a stale sub-chunk is never
    // blamed on the file either.
    let handle: UnpackHandle;
    try {
      handle = await openDesignFile(file);
      if (stale()) return;
    } catch (err) {
      if (stale()) return;
      host.log('warn', 'pdf-extract: open failed', { error: (err as Error)?.message, cause: ((err as Error)?.cause as Error)?.message });
      fail((err as Error)?.message || t('That file could not be opened.'));
      return;
    }

    const total = handle.pageCount;
    const count = Math.min(total, MAX_PAGES);
    // A handle without a text pass (a slide deck today) still opens: its pictures
    // render from the SVG pass and the Text panel says so plainly, instead of the
    // hard failure this used to be.
    const textSupported = typeof handle.pageToText === 'function';
    const pages: PageText[] = [];
    for (let i = 0; textSupported && i < count; i++) {
      try {
        pages.push(handle.pageToText!(i));
      } catch (err) {
        // One unreadable page must not cost the other 200. It reports as empty,
        // which is what the reader sees anyway.
        host.log('warn', 'pdf-extract: page failed', { page: i, error: (err as Error)?.message });
        pages.push({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });
      }
      // Yield between pages so a long document keeps the view responsive and the
      // busy line stays painted - and repaint the count while we are there.
      if (i % 8 === 7) {
        if (busyCount) busyCount.textContent = t('{done} of {total}', { done: i + 1, total: count });
        await new Promise((r) => setTimeout(r, 0));
        if (stale()) return;
      }
    }

    // The redaction check reuses the interpreted nodes the text pass just built,
    // so it costs almost nothing here - and it is the finding most worth having.
    let hidden: HiddenTextFinding[] = [];
    try {
      hidden = handle.findHiddenText?.({ maxPages: count })?.findings ?? [];
    } catch (err) {
      host.log('warn', 'pdf-extract: hidden-text scan failed', { error: (err as Error)?.message });
    }

    // Assets. Each pass is independently guarded - a document with an
    // unwalkable font table should still hand over its images.
    let fonts: EmbeddedFont[] = [];
    try { fonts = handle.listFonts?.() ?? []; }
    catch (err) { host.log('warn', 'pdf-extract: font scan failed', { error: (err as Error)?.message }); }

    let images: EmbeddedImage[] = [];
    let imagesSkipped = 0;
    let imagesSkippedFilters: string[] = [];
    try {
      const scan = await handle.listImages?.();
      images = scan?.images ?? [];
      imagesSkipped = scan?.skipped ?? 0;
      imagesSkippedFilters = scan?.skippedFilters ?? [];
    } catch (err) { host.log('warn', 'pdf-extract: image scan failed', { error: (err as Error)?.message }); }

    let vectors: ExtractedVector[] = [];
    try { vectors = await handle.listVectors?.({ maxPages: Math.min(count, 40) }) ?? []; }
    catch (err) { host.log('warn', 'pdf-extract: vector scan failed', { error: (err as Error)?.message }); }

    let attachments: EmbeddedAttachment[] = [];
    try { attachments = handle.listAttachments?.() ?? []; }
    catch (err) { host.log('warn', 'pdf-extract: attachment scan failed', { error: (err as Error)?.message }); }

    let palette: string[] = [];
    try { palette = handle.listPalette?.() ?? []; }
    catch (err) { host.log('warn', 'pdf-extract: palette scan failed', { error: (err as Error)?.message }); }

    if (stale()) return;
    releasePreviews();
    unwire();
    current = {
      fileName: file.name, pages, pageCount: count, textSupported,
      truncated: Math.max(0, total - count), hidden, palette,
      fonts, images, imagesSkipped, imagesSkippedFilters, attachments, vectors,
    };
    curHandle = handle;
    artPromises = new Map();
    drop.hidden = true;
    out.innerHTML = resultMarkup(current);
    wirePages();
    const tablist = out.querySelector<HTMLElement>('[role="tablist"]')!;
    for (const panel of out.querySelectorAll<HTMLElement>('.pdfx-panel')) {
      panel.id = `pdfx-panel-${panel.dataset.panel}`;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `pdfx-tab-${panel.dataset.panel}`);
    }
    for (const tab of tablist.querySelectorAll<HTMLElement>('[data-tab]')) {
      tab.id = `pdfx-tab-${tab.dataset.tab}`;
      tab.setAttribute('aria-controls', `pdfx-panel-${tab.dataset.tab}`);
    }
    wireTabs(tablist, { key: 'tab', onSelect: showPanel })('text');
    playSfx('land');
  }

  function reset(): void {
    readGeneration++;
    releasePreviews();
    unwire();
    current = null;
    curHandle = null;
    artPromises = new Map();
    out.hidden = true;
    out.innerHTML = '';
    drop.hidden = false;
    input.value = '';
  }

  /**
   * Put an extracted raster into the user's asset library.
   *
   * This is the point of the whole view over any other PDF tool: an extracted
   * asset lands somewhere it can be used, instead of in a downloads folder.
   */
  async function addToCatalogue(im: EmbeddedImage, index: number, btn: HTMLElement): Promise<void> {
    const was = btn.textContent;
    btn.textContent = t('Adding…');
    try {
      const { storeUserUpload } = await import('./picker.ts');
      const name = imageFileName(im, stem(current!.fileName), index);
      const file = new File([im.bytes as BlobPart], name, { type: im.mime });
      await storeUserUpload(host as unknown as Parameters<typeof storeUserUpload>[0], file);
      btn.textContent = t('Added');
      playSfx('save');
    } catch (err) {
      host.log('warn', 'pdf-extract: catalogue add failed', { error: (err as Error)?.message });
      btn.textContent = t('Could not add');
    }
    setTimeout(() => { btn.textContent = was; }, 1800);
  }

  /**
   * Put an extracted logo into the asset library.
   *
   * The File MUST carry an explicit image/svg+xml MIME: storeUserUpload detects
   * vectors by MIME *or* extension so the SVG would still be sanitised, but the
   * stored `format` comes from the MIME alone - without it the asset is recorded
   * as 'bin' and displayed as "logo.bin". The name is counter-unique because the
   * asset id is minted from `Date.now()` plus the filename, so two same-named
   * files stored in one millisecond silently overwrite each other.
   */
  async function addVectorToCatalogue(v: ExtractedVector, index: number, btn: HTMLElement): Promise<void> {
    const was = btn.textContent;
    btn.textContent = t('Adding…');
    try {
      const { storeUserUpload } = await import('./picker.ts');
      const name = `${stem(current!.fileName)}-logo-${index + 1}.svg`;
      const file = new File([v.svg], name, { type: 'image/svg+xml' });
      await storeUserUpload(host as unknown as Parameters<typeof storeUserUpload>[0], file);
      btn.textContent = t('Added');
      playSfx('save');
    } catch (err) {
      host.log('warn', 'pdf-extract: vector catalogue add failed', { error: (err as Error)?.message });
      btn.textContent = t('Could not add');
    }
    setTimeout(() => { btn.textContent = was; }, 1800);
  }

  /**
   * "This control is answering, do not press it again", said with `aria-disabled`
   * rather than `disabled`.
   *
   * A real `disabled` on the button that was just pressed hands focus to the
   * body: a keyboard user who activates Add lands nowhere, and on the failure
   * path there is nothing to return them to. `aria-disabled` says the same thing
   * to assistive tech, keeps the button focusable, and leaves the guard to the
   * handler - which is what `busy()` is.
   */
  const busy = (btn: HTMLElement): boolean => btn.getAttribute('aria-disabled') === 'true';
  function setBusy(btn: HTMLElement, on: boolean): void {
    if (on) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
  }

  /** A mark as the File the studio's own drop zone would have received. */
  function vectorFile(v: ExtractedVector, index: number): File {
    return new File([v.svg], `${stem(current!.fileName)}-logo-${index + 1}.svg`, { type: 'image/svg+xml' });
  }

  /**
   * Install an embedded face as a user font (plan 97 section 7.2 / M5).
   *
   * `installFontFromBytes` is the whole vetting story - the size cap, the magic
   * number, the name table, the `fsType` reading and the variable-axis handling
   * all live there, and it returns null rather than throwing for bytes it cannot
   * use, because a drop zone handling several files must not abandon the rest.
   * So the only judgement here is what to SAY: a null is reported as plainly as
   * the row's own caveats, and a subset that installs is still called a subset,
   * because the missing characters turn up long after this screen is closed.
   */
  async function addFontToSystem(f: EmbeddedFont, btn: HTMLButtonElement): Promise<void> {
    if (busy(btn)) return;
    const was = btn.textContent;
    setBusy(btn, true);
    btn.textContent = t('Adding…');
    let family: string | null = null;
    // A throw is NOT the same answer as a null, and the difference is what the
    // sentence below is allowed to claim. `installFontFromBytes` writes the
    // asset first and registers/promotes it afterwards, so a throw can land
    // with the face already stored - "nothing was added" would be false.
    let threw = false;
    try {
      const { installFontFromBytes } = await import('../user-fonts.ts');
      const installed = await installFontFromBytes(host as unknown as UserFontsHost, f.bytes, {
        filename: `${f.name.replace(/[^a-z0-9.+-]/gi, '_')}.${f.ext}`,
      });
      family = installed?.family ?? null;
    } catch (err) {
      threw = true;
      host.log('warn', 'pdf-extract: font install failed', { error: (err as Error)?.message });
    }
    if (!family) {
      // Nothing usable came back, so the button goes back to being an offer
      // either way. Only the sentence differs: a null means the bytes were
      // refused before anything was written, which is the one case that can
      // honestly promise nothing was added.
      btn.textContent = t('Could not add');
      announce(threw
        ? tRaw('{name} could not be added. Part of it may have been saved, so check the fonts in the design system before trying again.', { name: f.family })
        : tRaw('{name} could not be read as a font, so nothing was added.', { name: f.family }), { assertive: true });
      setTimeout(() => { btn.textContent = was; setBusy(btn, false); }, 1800);
      return;
    }
    // A quiet, permanent state: the face is installed, and offering to install it
    // again would say the first press did nothing.
    btn.textContent = t('Added');
    btn.classList.add('is-added');
    announce(f.subset
      ? tRaw('{family} added to the design system. It is a subset, so characters this document did not print are missing from it.', { family })
      : tRaw('{family} added to the design system', { family }));
    playSfx('save');
  }

  /**
   * One mark to the Logos room. The stash survives exactly one navigation and
   * never touches disk (lib/design-system/pending-files.ts), so a reload after
   * this lands in an ordinary empty room rather than on a mystery queue.
   *
   * Neither failure is allowed to be silent, and they are DIFFERENT failures: a
   * mark over the stash's 4 MB cap (an extracted mark inherits the page's
   * inlined rasters, so a logo over a photograph can be that big) was refused,
   * while a throw means the hand-off itself never happened. Navigating and
   * playing the success sound on either would put the person in an empty room
   * with no explanation, which is the one outcome this view is written to avoid.
   */
  async function sendVectorToLogos(v: ExtractedVector, index: number, btn: HTMLButtonElement): Promise<void> {
    if (busy(btn)) return;
    const was = btn.textContent;
    setBusy(btn, true);
    /** Put the button back to being an offer - nothing travelled. */
    const failed = (label: string, said: string): void => {
      btn.textContent = label;
      announce(said, { assertive: true });
      setTimeout(() => {
        if (!btn.isConnected) return;
        btn.textContent = was;
        setBusy(btn, false);
      }, 1800);
    };
    try {
      const { stashPendingLogoFiles } = await import('../lib/design-system/pending-files.ts');
      const { sent } = stashPendingLogoFiles([vectorFile(v, index)]);
      if (!sent) {
        failed(t('Too large'), t('That mark is over the 4 MB limit, so it was not sent. Download the SVG instead.'));
        return;
      }
    } catch (err) {
      host.log('warn', 'pdf-extract: logo handoff failed', { error: (err as Error)?.message });
      failed(t('Could not send'), t('That mark could not be sent to Logos.'));
      return;
    }
    playSfx('save');
    location.hash = '#/start?area=logos';
  }

  /**
   * The whole scan to the studio (plan 97 section 8).
   *
   * Built from what the passes already extracted - the marks and their per-mark
   * fill palettes, and the embedded families - so this costs a census, not a
   * second walk of the document. Colours and fonts land as tray CANDIDATES,
   * never as installs: the tray is the one place a source's findings wait, and
   * nothing joins the design system without a tap there.
   *
   * The tray is LOADED before the add. It persists its whole candidate list on
   * every write, so adding to an unloaded one would erase whatever an earlier
   * source left in it.
   *
   * What the announcement claims is what the two sinks actually TOOK, never what
   * this view offered them: the tray dedupes (a re-send of the same document
   * keeps nothing), the stash refuses a mark over its byte cap, and counting
   * colours alone would report "0 colours and 0 marks" for the commonest
   * document of all - a text PDF whose embedded families did reach the tray.
   */
  async function sendToStudio(btn: HTMLButtonElement): Promise<void> {
    const x = current;
    if (!x || busy(btn)) return;
    const was = btn.textContent;
    setBusy(btn, true);
    btn.textContent = t('Sending…');
    try {
      const [{ pdfScanToCensus, pdfLogoPicks }, { createTray, candidatesFromCensus }, pending] = await Promise.all([
        import('../lib/design-system/sources/pdf.ts'),
        import('../lib/design-system/tray.ts'),
        import('../lib/design-system/pending-files.ts'),
      ]);
      // The label is the provenance chip every candidate then wears ("from
      // guidelines"), so it is the file's STEM - the same thing the source
      // picker's own door passes, or the two doors chip one document two ways.
      const census = pdfScanToCensus({ vectors: x.vectors, fonts: x.fonts }, stem(x.fileName));
      const candidates = candidatesFromCensus(census);
      const tray = createTray(host);
      await tray.load();
      const kept = await tray.add(candidates);

      // The marks travel as files, the tray carries the colours and the
      // families, and both are the same send - so the studio opens with
      // everything this document had to offer.
      //
      // WHICH marks is `pdfLogoPicks`' judgement, not this view's: a document
      // with thirty marks is not thirty logo decisions, and the source picker
      // ranks the same way, so the two doors into the studio never disagree
      // about what a PDF holds. Each pick is named after the tile it came from
      // (the tile's own Download SVG writes that filename), so a mark arriving
      // in the Logos room is traceable back to the row it was sent from - off
      // the pick's own `index`, because two pages can carry the same mark
      // verbatim and matching the SVG text back would name both after the first.
      const marks = pdfLogoPicks(x.vectors, { max: pending.PENDING_LOGO_MAX_FILES })
        .map((pick) => new File([pick.svg], `${stem(x.fileName)}-logo-${pick.index + 1}.svg`, { type: 'image/svg+xml' }));
      const sent = marks.length ? pending.stashPendingLogoFiles(marks).sent : 0;

      // Two facts, each said only when it is true, and each counted at the sink
      // rather than at the send.
      const said = [
        kept ? (kept === 1 ? t('1 kept in the tray') : tRaw('{n} kept in the tray', { n: kept })) : t('Nothing new for the tray.'),
        sent ? (sent === 1 ? t('1 mark sent to Logos') : tRaw('{n} marks sent to Logos', { n: sent })) : '',
      ].filter(Boolean).join(' ');
      announce(said);
      playSfx('save');
      location.hash = '#/start?area=overview';
    } catch (err) {
      host.log('warn', 'pdf-extract: studio handoff failed', { error: (err as Error)?.message });
      btn.textContent = t('Could not send');
      announce(t('Nothing could be sent to the studio.'), { assertive: true });
      setTimeout(() => { btn.textContent = was; setBusy(btn, false); }, 1800);
    }
  }

  async function copy(text: string, btn: HTMLElement | null): Promise<void> {
    try {
      await host.clipboard.writeText(text);
      if (btn) {
        const was = btn.textContent;
        btn.textContent = t('Copied');
        setTimeout(() => { btn.textContent = was; }, 1400);
      }
    } catch {
      host.log('warn', 'pdf-extract: clipboard refused');
    }
  }

  // ── wiring ──────────────────────────────────────────────────────────────────

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) void open(f);
  });

  for (const type of ['dragenter', 'dragover'] as const) {
    drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  }
  for (const type of ['dragleave', 'drop'] as const) {
    drop.addEventListener(type, () => drop.classList.remove('is-over'));
  }
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) void open(f);
  });

  /** Show one panel and light its tab. */
  function showPanel(id: string): void {
    for (const panel of out.querySelectorAll<HTMLElement>('.pdfx-panel')) {
      panel.hidden = panel.dataset.panel !== id;
    }
    for (const tab of out.querySelectorAll<HTMLElement>('.pdfx-tab')) {
      const on = tab.dataset.tab === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    // The strip navigates the reading column, so it rides with the Text panel
    // only - floating page numbers over the Fonts list would point at nothing.
    const strip = out.querySelector<HTMLElement>('[data-thumbs]');
    if (strip) strip.hidden = id !== 'text';
  }

  function saveBytes(bytes: Uint8Array, filename: string, mime: string): void {
    void host.export.download(new Blob([bytes as BlobPart], { type: mime }), filename);
  }

  out.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (!current) return;

    const goto = el.closest<HTMLElement>('[data-goto]');
    if (goto) {
      out.querySelector(`.pdfx-page[data-page="${Number(goto.dataset.goto)}"]`)
        ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }

    const pageBtn = el.closest<HTMLElement>('[data-copy-page]');
    if (pageBtn) {
      const p = current.pages[Number(pageBtn.dataset.copyPage)];
      if (p) void copy(p.text, pageBtn);
      return;
    }

    const copyColor = el.closest<HTMLElement>('[data-copy-color]');
    if (copyColor?.dataset.copyColor) {
      void copy(copyColor.dataset.copyColor, copyColor);
      return;
    }

    const base = stem(current.fileName);

    const saveImg = el.closest<HTMLElement>('[data-save-image]');
    if (saveImg) {
      const i = Number(saveImg.dataset.saveImage);
      const im = current.images[i];
      if (im) saveBytes(im.bytes, imageFileName(im, base, i), im.mime);
      return;
    }

    const toCatalog = el.closest<HTMLElement>('[data-catalog-image]');
    if (toCatalog) {
      const i = Number(toCatalog.dataset.catalogImage);
      const im = current.images[i];
      if (im) void addToCatalogue(im, i, toCatalog);
      return;
    }

    const saveVec = el.closest<HTMLElement>('[data-save-vector]');
    if (saveVec) {
      const i = Number(saveVec.dataset.saveVector);
      const v = current.vectors[i];
      if (v) saveBytes(new TextEncoder().encode(v.svg), `${base}-logo-${i + 1}.svg`, 'image/svg+xml');
      return;
    }

    const catVec = el.closest<HTMLElement>('[data-catalog-vector]');
    if (catVec) {
      const i = Number(catVec.dataset.catalogVector);
      const v = current.vectors[i];
      if (v) void addVectorToCatalogue(v, i, catVec);
      return;
    }

    const logoVec = el.closest<HTMLButtonElement>('[data-logos-vector]');
    if (logoVec) {
      const i = Number(logoVec.dataset.logosVector);
      const v = current.vectors[i];
      if (v) void sendVectorToLogos(v, i, logoVec);
      return;
    }

    const addFont = el.closest<HTMLButtonElement>('[data-add-font]');
    if (addFont) {
      const f = current.fonts[Number(addFont.dataset.addFont)];
      if (f) void addFontToSystem(f, addFont);
      return;
    }

    const saveFont = el.closest<HTMLElement>('[data-save-font]');
    if (saveFont) {
      const f = current.fonts[Number(saveFont.dataset.saveFont)];
      // The stored name keeps the subset prefix when there is one - the file IS a
      // subset, and naming it plainly would invite installing it as the real face.
      if (f) saveBytes(f.bytes, `${f.name.replace(/[^a-z0-9.+-]/gi, '_')}.${f.ext}`, 'font/otf');
      return;
    }

    const saveAtt = el.closest<HTMLElement>('[data-save-att]');
    if (saveAtt) {
      const a = current.attachments[Number(saveAtt.dataset.saveAtt)];
      if (a) saveBytes(a.bytes, a.name.replace(/[^a-z0-9._-]/gi, '_') || 'attachment', a.mime);
      return;
    }

    const actEl = el.closest<HTMLElement>('[data-act]');
    const act = actEl?.dataset.act;
    if (!act) return;
    if (act === 'studio') void sendToStudio(actEl as HTMLButtonElement);
    else if (act === 'copy') void copy(joinPageText(current.pages, { markdown: false }), actEl);
    else if (act === 'md') download(host, joinPageText(current.pages), `${base}.md`, 'text/markdown');
    else if (act === 'txt') download(host, joinPageText(current.pages, { markdown: false }), `${base}.txt`, 'text/plain');
    else if (act === 'clear') reset();
  });
}
