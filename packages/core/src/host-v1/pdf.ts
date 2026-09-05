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
  pages?(bytes: Uint8Array, opts?: { maxPages?: number }): Promise<PdfPagesResult>;
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
}

export interface PdfPagesResult {
  /** Rendered pages in document order. A page that failed to render is absent. */
  pages: PdfPageSvg[];
  /** True when the document has more pages than the cap allowed to return. */
  truncated: boolean;
  /**
   * 1-based numbers of pages within the cap whose render failed (absent when
   * none did), so a caller can say which previews are missing instead of
   * letting a skipped page pass silently.
   */
  failed?: number[];
}
