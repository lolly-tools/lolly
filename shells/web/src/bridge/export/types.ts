// SPDX-License-Identifier: MPL-2.0
/**
 * Shared types for the export format adapters (finding 2).
 *
 * The god-module bridge/export.js is a single 4k-line renderer switch; these
 * types describe the seam it is being decomposed behind: a registry of format
 * adapters, each fed a RenderContext.
 */

import type { ExportOpts, ExportMeta, HostV1 } from '@lolly/engine';

/**
 * Every format the renderer switch actually handles — a superset of the
 * tool-facing host-v1 `ExportFormat`, which enumerates only the headline
 * formats. This is the honest internal set (raster, CMYK TIFF, the SVG-vector
 * sinks, PDF ± CMYK, motion, data, and text formats).
 */
export type ExportFormat =
  | 'png' | 'jpg' | 'jpeg' | 'webp' | 'avif'
  | 'cmyk-tiff'
  | 'svg' | 'emf' | 'eps' | 'eps-cmyk'
  | 'pdf' | 'pdf-cmyk'
  | 'html' | 'md' | 'txt'
  | 'json' | 'csv' | 'ics' | 'vcf'
  | 'ico' | 'zip'
  | 'webm' | 'mp4' | 'gif';

/** One brand swatch: a hex colour with an optional measured CMYK substitution (0–100). */
export interface PaletteSwatch {
  hex: string;
  /** [C, M, Y, K] integer percentages 0-100; null/absent → generic RGB→CMYK fallback. */
  cmyk?: readonly number[] | null;
  label?: string;
}

/** Progress callback for the long single-threaded passes (CMYK TIFF, video, GIF). */
export type ProgressFn = (done: number, total: number) => void;

/**
 * The full internal export options. Extends the tool-facing `ExportOpts` (the
 * documented subset) with the extra fields the shell UI and runtime thread
 * through the renderer: pre-hydrated data payloads, print-finishing marks,
 * vector/PDF toggles, motion parameters and bundle/favicon controls.
 */
export interface ExportOptions extends ExportOpts {
  // Data formats: the engine pre-hydrates the payload; the host just wraps it.
  dataText?: string;
  dataMime?: string;

  // Print finishing (PDF + CMYK TIFF), resolved into engine print geometry.
  bleed?: number | string;
  cropMarks?: boolean;
  registrationMarks?: boolean;
  bleedMarks?: boolean;
  colorBars?: boolean;
  provenance?: boolean;
  palette?: readonly PaletteSwatch[];

  // PDF-only.
  password?: string;

  // Vector sinks (SVG/PDF/EMF/EPS).
  convertPaths?: boolean;
  noBoxShadow?: boolean;
  unit?: string;

  // Favicon / bundle.
  icoSizes?: number[];
  bundleFormats?: ExportFormat[];

  // Motion (video/GIF).
  fps?: number;
  duration?: number;
  wait?: number;
  repeat?: number;
  dither?: boolean;

  // Static HTML.
  fullPage?: boolean;

  onProgress?: ProgressFn;
}

// ── dom-to-image-more (ambient; the package ships no type declarations) ────────

export interface DomToImageStyle {
  transform?: string;
  transformOrigin?: string;
  width?: string;
  height?: string;
  background?: string;
}

export interface DomToImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  bgcolor?: string;
  style?: DomToImageStyle;
}

export interface DomToImage {
  toPng(node: Node, opts?: DomToImageOptions): Promise<string>;
  toJpeg(node: Node, opts?: DomToImageOptions): Promise<string>;
  toCanvas(node: Node, opts?: DomToImageOptions): Promise<HTMLCanvasElement>;
}

/**
 * Everything a format adapter needs to turn a rendered DOM node into a Blob.
 * `renderFormat` lets a composite adapter (the ZIP bundler) delegate back to the
 * registry per sub-format without re-applying the watermark; `getDomToImage`
 * shares the lazily-loaded rasteriser.
 */
export interface RenderContext {
  readonly node: HTMLElement;
  readonly format: ExportFormat;
  readonly opts: ExportOptions;
  readonly host: HostV1 | null;
  getDomToImage(): Promise<DomToImage>;
  renderFormat(format: ExportFormat, opts: ExportOptions): Promise<Blob>;
}

/**
 * A renderer for one or more formats. `render` receives the resolved
 * RenderContext and returns the encoded bytes as a Blob (whose MIME type the
 * caller reads from `Blob.type`).
 */
export interface FormatAdapter {
  readonly formats: readonly ExportFormat[];
  render(ctx: RenderContext): Promise<Blob>;
}

export type { ExportMeta };
