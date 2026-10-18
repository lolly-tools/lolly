// SPDX-License-Identifier: MPL-2.0

// ─── PDF (optional) ───────────────────────────────────────────────────────────

export interface PdfAPI {
  /**
   * Report the metadata a PDF carries (Info dictionary + XMP packet), for a
   * "what's hidden" view. Read-only; never mutates the input.
   */
  analyze(bytes: Uint8Array): Promise<{ findings: PdfFinding[] }>;

  /**
   * Re-save the PDF with its Info-dictionary entries and XMP packet removed.
   * Pages/content are preserved, but the document is re-serialised - the output
   * is not byte-identical, and any digital signature is invalidated.
   */
  strip(bytes: Uint8Array): Promise<{ bytes: Uint8Array }>;

  /**
   * Re-save the PDF smaller. Recompresses oversized embedded JPEG images
   * (downsample + re-encode on a canvas) and re-serialises with object streams;
   * text and vector graphics are left untouched. Like strip(), the output is NOT
   * byte-identical and any digital signature is invalidated. Runs locally - the
   * bytes are never uploaded. The result is guaranteed never larger than the input
   * (the original is returned unchanged when recompression wouldn't shrink it).
   * Image recompression needs a canvas (web/Tauri); a shell without one (the node
   * CLI) still applies the structural pass. Added after analyze/strip, so a tool
   * must feature-detect `host.pdf?.compress` - an older shell may lack it.
   */
  compress(bytes: Uint8Array, opts?: PdfCompressOpts): Promise<PdfCompressResult>;

  /**
   * Redact by rasterise-and-rebuild. Each page is rendered to an image, the
   * given bars are burned in as fully opaque fills, and a BRAND-NEW document is
   * constructed whose pages contain only those images at the original page
   * sizes - no text layer, fonts, annotations, attachments, layers, scripts or
   * metadata survive, because nothing is carried over. Bar coordinates are in
   * PDF points with y measured from the TOP of the page, and each bar names its
   * page by 1-based index. Like strip(), the output is not byte-identical and
   * any digital signature is invalidated; unlike strip(), the content under a
   * bar is destroyed, not hidden. Needs a real canvas, so shells without one
   * omit it (the node CLI brings its own over @napi-rs/canvas, so it redacts
   * natively) - a tool must feature-detect `host.pdf?.redact`
   * per method, exactly as for compress. Runs locally; the bytes are never
   * uploaded.
   */
  redact?(bytes: Uint8Array, opts: PdfRedactOpts): Promise<PdfRedactResult>;

  /**
   * Render each page to a self-contained SVG document, for interactive tools
   * that need a live preview to draw on (the Redact tool's bar overlay). Text
   * is outlined to real paths with fonts embedded as a safety net, so the SVG
   * renders identically with no document fonts installed. Each page's viewBox
   * is in PDF points with the origin at the TOP-LEFT - the same coordinate
   * space as PdfRedactBar, so an overlay measured against the rendered SVG
   * converts to bars with a single scale factor (widthPt / rendered width) and
   * no DPI involved. At most `maxPages` pages are returned (default 40), with
   * `truncated` reporting that more exist; a page that fails to render is
   * SKIPPED from `pages` rather than thrown, so one broken page cannot kill
   * the preview. Optional per method like redact: the web shell provides it
   * and the node CLI does not - a tool must feature-detect `host.pdf?.pages`.
   * Runs locally; the bytes are never uploaded.
   */
  pages?(bytes: Uint8Array, opts?: { maxPages?: number; pageNumbers?: number[]; signal?: AbortSignal }): Promise<PdfPagesResult>;

  /**
   * Reorder, rotate, extract, delete, merge, or split pages without rasterising
   * them. Page expressions are 1-based (`1-3,7,10-`); repeated page numbers are
   * retained for reorder/extract and rejected where they would be ambiguous.
   * Document metadata is carried from the primary input and no producer credit
   * is added. Encrypted documents and XFA forms are refused by name. When the
   * pages are copied into a new PDF (every operation except rotating a single
   * PDF), nothing on a page that is not in the output comes along through a
   * link, form field or reply that refers to it, and signature values (signer,
   * date, certificate) are left out.
   */
  organize?(bytes: Uint8Array, opts: PdfOrganizeOpts): Promise<PdfOrganizeResult>;

  /**
   * Optional v1.262: build a new PDF with one image per page, in the given
   * order. JPEG data is embedded without re-encoding, its camera orientation is
   * applied to the page, and its Exif, XMP, IPTC, comment and appended
   * secondary-image data is left out. 8-bit PNG pixels are copied without
   * loss; a 16-bit PNG is reduced to 8 bits per channel, and PNG colour
   * profiles are not kept. Animated PNGs and other formats are refused by name,
   * so a tool converts them first (host.images.encode).
   * Feature-detect `host.pdf?.fromImages`. Runs locally.
   */
  fromImages?(images: PdfImageInput[], opts?: PdfImagesOpts): Promise<PdfImagesResult>;

  /** Place one or more PNG/JPEG stamps using top-left PDF-point coordinates. */
  stamp?(bytes: Uint8Array, opts: PdfStampOpts): Promise<PdfStampResult>;

  /** Apply an AES-256 open password as the final PDF byte operation. */
  lock?(bytes: Uint8Array, password: string): Promise<{ bytes: Uint8Array }>;
}

export type PdfPageOperation = 'reorder' | 'rotate' | 'extract' | 'delete' | 'merge' | 'split';

export interface PdfOrganizeOpts {
  operation: PdfPageOperation;
  /** 1-based page expression. Empty means every page. */
  pages?: string;
  /** Clockwise degrees; used by rotate. */
  rotation?: 90 | 180 | 270;
  /** Legacy second document for merge. */
  extra?: Uint8Array;
  /** Additional documents, flattened after the primary document in this order. */
  extras?: Uint8Array[];
}

export interface PdfOrganizeFile {
  bytes: Uint8Array;
  /** 1-based source page numbers represented by this output. */
  pages: number[];
}

export interface PdfOrganizeResult {
  bytes?: Uint8Array;
  files?: PdfOrganizeFile[];
  beforePages: number;
  afterPages: number;
  beforeBytes: number;
  afterBytes: number;
  /** Output order expressed as global source page numbers across all inputs. */
  pageOrder: number[];
  operations: string[];
  /**
   * Optional v1.262: what the operation does to the bookmarks, annotations,
   * links, form fields and signatures the inputs carry. Only features that are
   * present appear. Older shells omit the list.
   */
  effects?: PdfPageEffect[];
}

/** A document feature the Pages operations report on. */
export type PdfPageFeature = 'bookmarks' | 'annotations' | 'links' | 'forms' | 'signatures';

/**
 * One line of a page operation's effects report. `kept` means the feature
 * works as before; `removed` means it is absent from the output; `broken`
 * means it is still drawn but no longer works; `invalidated` means a digital
 * signature no longer verifies.
 */
export interface PdfPageEffect {
  feature: PdfPageFeature;
  /** How many the affected inputs carry. */
  count: number;
  outcome: 'kept' | 'removed' | 'broken' | 'invalidated';
  /** A plain sentence that can be shown as is. */
  message: string;
}

export interface PdfImageInput {
  /** PNG or JPEG bytes. */
  bytes: Uint8Array;
}

/**
 * `image` sizes each page to its image at the resolution the image declares,
 * or 96 pixels per inch when it declares none. `a4` and `letter` fit each image
 * inside that paper size, turned to match the image's orientation.
 */
export type PdfImagePageSize = 'image' | 'a4' | 'letter';

export interface PdfImagesOpts {
  /** Default `image`. */
  pageSize?: PdfImagePageSize;
  /** Space around a fitted image, in PDF points. Paper sizes only. Default 0, clamped to 0..144. */
  margin?: number;
}

export interface PdfImagesResult {
  bytes: Uint8Array;
  /** Page count; one page per input image. */
  pages: number;
  /** Images turned upright from their camera orientation. */
  turned: number;
  /** Images whose Exif, XMP, IPTC, comment or other application data was left out. */
  metadataLeftOut: number;
  /** Images with a second picture stored after the main one (a gain map or preview) that was left out. */
  extraPicturesLeftOut: number;
  /** Plain sentences describing those changes. */
  notes: string[];
}

export interface PdfStampImage {
  bytes: Uint8Array;
  /** 1-based destination page. */
  page: number;
  x: number;
  /** Distance from the TOP edge of the page, in PDF points. */
  y: number;
  width: number;
  /** Optional explicit height; otherwise the embedded image aspect ratio is used. */
  height?: number;
}

export interface PdfStampText {
  text: string;
  page: number;
  x: number;
  /** Distance from the TOP edge of the page, in PDF points. */
  y: number;
  size?: number;
}

export interface PdfStampOpts {
  images: PdfStampImage[];
  texts?: PdfStampText[];
}

export interface PdfStampResult {
  bytes: Uint8Array;
  pages: number;
  stamps: number;
}

export interface PdfCompressOpts {
  /** Aggressiveness preset; maps to image downsample size + JPEG quality. Default 'balanced'. */
  level?: 'light' | 'balanced' | 'strong';
  /** Re-encode images in grayscale for extra savings (e.g. scanned text). Default false. */
  grayscale?: boolean;
  /** Override the max image dimension (px) the preset implies. */
  maxDim?: number;
  /** Override the JPEG quality (0..1) the preset implies. */
  imageQuality?: number;
}

export interface PdfCompressResult {
  /** The compressed PDF - or the original bytes, if compression wouldn't shrink it. */
  bytes: Uint8Array;
  /** Input size in bytes. */
  before: number;
  /** Output size in bytes (always <= before). */
  after: number;
  /** How many embedded images were recompressed. */
  images: number;
}

export interface PdfFinding {
  /** Short category, e.g. 'Author', 'Created with', 'XMP metadata'. */
  label: string;
  /** The actual embedded value (revealed behind the tool's "show details" toggle). */
  detail: string;
  /** 'warn' flags personally-identifying / fingerprinting data; '' is neutral. */
  tone: '' | 'warn';
}

/** One redaction bar, in PDF points, y measured from the TOP of the page. */
export interface PdfRedactBar {
  /** 1-based page index the bar sits on. */
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfRedactOpts {
  /** The bars to burn in. Bars on out-of-range pages are ignored. */
  bars: PdfRedactBar[];
  /** Raster resolution for the rebuilt pages. Default 200, clamped 72..300. */
  dpi?: number;
  /** Drop colour on the way out (e.g. a scan whose yellow channel carries printer tracking dots). */
  grayscale?: boolean;
  /**
   * Bar fill as a 6-digit hex (v1.90). Colour is security-neutral - any fully
   * opaque fill destroys the pixels underneath equally - so a caller may paint
   * its brand's own tone instead of black. Translucency is NOT neutral, so a
   * value carrying alpha below full opacity is REFUSED, as is anything
   * unreadable: the host falls back to its neutral near-black rather than
   * painting a bar the caller did not mean. Default: the neutral near-black.
   */
  color?: string;
  /**
   * Corner radius in PDF points (v1.90). The painted shape is INFLATED by the
   * radius before the corners are rounded, so the bar the caller asked for
   * stays entirely inside the opaque region - a rounded mark never leaves an
   * uncovered corner sliver. A corner whose sides had to clamp to the page edge
   * is painted square. Default 0 (square).
   */
  radius?: number;
  /**
   * A short label painted ON TOP of the finished bar (v1.90) - an attribution
   * stamp, e.g. the redacting person's or organisation's name. Safe because the
   * pixels beneath are already destroyed. The host never derives this text from
   * the document; it paints exactly what it is given, trimmed and clipped to
   * bars with room for it. Default: no label.
   */
  label?: string;
  /** Label colour as a 6-digit hex (v1.90), validated like `color`. Default white. */
  labelColor?: string;
  /** Prepared label pixels, including selected emoji artwork. Painted over the opaque bar. */
  labelImage?: import('./raster.ts').RasterFrame;
}

export interface PdfRedactResult {
  /** The rebuilt document - page images only, nothing else. */
  bytes: Uint8Array;
  /** Page count of the output (same as the input's). */
  pages: number;
  /** Per-page render fallbacks (a page that could not be rendered ships blank). */
  warnings?: string[];
}

/** One page of a host.pdf.pages preview: a self-contained SVG document. */
export interface PdfPageSvg {
  /** Standalone SVG markup - text outlined, fonts embedded, images inlined. */
  svg: string;
  /** 1-based page index in the source document. */
  page: number;
  /** Page width in PDF points (the viewBox width). */
  widthPt: number;
  /** Page height in PDF points (the viewBox height). */
  heightPt: number;
  /** Optional v1.190: clockwise display rotation; SVG remains in MediaBox coordinates. */
  rotation?: 0 | 90 | 180 | 270;
  /** Optional v1.190: fixed capability notices, without source text or font names. */
  limitations?: string[];
}

export interface PdfPagesResult {
  /** Rendered pages in document order. A page that failed to render is absent. */
  pages: PdfPageSvg[];
  /** Total pages in the source, including pages omitted by the preview cap. */
  totalPages?: number;
  /** True when the document has more pages than the cap allowed to return. */
  truncated: boolean;
  /**
   * 1-based numbers of pages within the cap whose render failed (absent when
   * none did), so a caller can say which previews are missing instead of
   * letting a skipped page pass silently.
   */
  failed?: number[];
}
