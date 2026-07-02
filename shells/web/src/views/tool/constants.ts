// SPDX-License-Identifier: MPL-2.0
/**
 * Canonical constants and pure helpers for the tool view — format labels /
 * extensions, print-mark CSV (de)serialisation, and the export-panel readers.
 * Extracted from the tool.js god module (finding 1); the pure parts are
 * node-unit-tested (see constants.test.ts).
 */
import type { BlockFieldSpec, InputValue } from '@lolly/engine';
import { videoSupport, cmykTiffSupport } from '../../capabilities.ts';

// Above this readable-query length, the address bar / Share dialog switch to the
// packed `z=` form (when it's actually shorter). Kept well under the ~2000-char
// ceiling pasted links, social crawlers and servers still enforce, while
// leaving simple/typical links in hand-editable readable form.
export const AUTO_PACK_MIN = 1800;

// Human-readable labels and file extensions for format identifiers that differ
// from their raw string (e.g. "pdf-cmyk" → "Print PDF" / ".pdf").
export const FMT_LABEL: Record<string, string> = { 'pdf-cmyk': 'Print PDF', 'cmyk-tiff': 'Print TIFF', 'jpeg': 'JPG', 'webm': 'WebM', 'mp4': 'MP4',
  emf: 'EMF (old)', eps: 'EPS', 'eps-cmyk': 'EPS (CMYK)', ics: 'Calendar', vcf: 'vCard', ico: 'Icon', zip: 'ZIP', csv: 'CSV', json: 'JSON' };
export const FMT_EXT: Record<string, string> = { 'pdf-cmyk': 'pdf', 'cmyk-tiff': 'tiff', 'jpeg': 'jpg', 'eps-cmyk': 'eps' };

/** The print-mark toggle map carried on the export bar and in the `marks` param. */
export interface PrintMarks {
  crop: boolean;
  registration: boolean;
  bleed: boolean;
  colorBars: boolean;
  provenance: boolean;
}

// Print marks & bleed apply to the three print formats (pdf / pdf-cmyk / cmyk-tiff).
// Defaults on when the user turns the card on; the CSV tokens (crop,reg,bleed,bars)
// match the engine's `marks` URL param (engine/src/url-mode.ts parseMarks). Bleed is
// carried as a dimension string. Color profile (press condition) card applies to the
// two CMYK formats.
export const DEFAULT_PRINT_MARKS: PrintMarks = { crop: true, registration: true, bleed: true, colorBars: false, provenance: true };
export const isCmykFmt  = (f: string | undefined): boolean => f === 'pdf-cmyk' || f === 'cmyk-tiff';
export const isPrintFmt = (f: string | undefined): boolean => f === 'pdf' || f === 'pdf-cmyk' || f === 'cmyk-tiff';
export function marksToCsv(m: Partial<PrintMarks> | null | undefined): string {
  return m ? [m.crop && 'crop', m.registration && 'reg', m.bleed && 'bleed', m.colorBars && 'bars', m.provenance && 'prov'].filter(Boolean).join(',') : '';
}
export function marksFromCsv(csv: string | null | undefined): PrintMarks | null {
  if (!csv) return null;
  const s = new Set(String(csv).split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
  return { crop: s.has('crop'), registration: s.has('reg') || s.has('registration'), bleed: s.has('bleed'), colorBars: s.has('bars') || s.has('colorbars'), provenance: s.has('prov') || s.has('provenance') };
}
// Read the Print marks card from an export-panel element `el` (empty when off).
export const printEnabled  = (el: Element | null | undefined): boolean => Boolean(el?.querySelector<HTMLInputElement>('[data-action="print-enable"]')?.checked);
export function readBleed(el: Element | null | undefined): string {
  if (!printEnabled(el)) return '';
  const mm = parseFloat(el?.querySelector<HTMLInputElement>('[data-action="print-bleed"]')?.value ?? '');
  return mm > 0 ? `${mm}mm` : '';
}
export function readMarks(el: Element | null | undefined): string {
  if (!printEnabled(el)) return '';
  return marksToCsv({
    crop:         el?.querySelector<HTMLInputElement>('[data-action="mark-crop"]')?.checked,
    registration: el?.querySelector<HTMLInputElement>('[data-action="mark-reg"]')?.checked,
    bleed:        el?.querySelector<HTMLInputElement>('[data-action="mark-bleed"]')?.checked,
    colorBars:    el?.querySelector<HTMLInputElement>('[data-action="mark-bars"]')?.checked,
    provenance:   el?.querySelector<HTMLInputElement>('[data-action="mark-prov"]')?.checked,
  });
}

// The formats a "download all" ZIP bundle collects (data/text formats are excluded):
// the shell passes opts.bundleFormats; the export bridge renders each and
// archives them (see renderZip).
export const ZIP_BUNDLE = new Set(['png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'emf', 'eps', 'eps-cmyk', 'pdf', 'pdf-cmyk', 'cmyk-tiff', 'gif', 'ico']);

// Which video containers the browser's MediaRecorder can actually record.
// Safari/iOS = mp4 only; Firefox = webm only; recent Chrome = both. Used to gate the
// video format options so users only ever see what the browser can produce.
const VIDEO = videoSupport();
// Print TIFF is desktop-only with working canvas readback (see cmykTiffSupport);
// hide it everywhere it can't be produced or cleanly downloaded.
const CMYK_TIFF_OK = cmykTiffSupport();
export const keepFormat = (f: string): boolean =>
  f === 'webm' ? VIDEO.webm
  : f === 'mp4' ? VIDEO.mp4
  : f === 'cmyk-tiff' ? CMYK_TIFF_OK
  : true;

export const fmtLabel = (f: string): string => FMT_LABEL[f] ?? f.toUpperCase();

// The download extension follows the produced Blob — a deep-linked video request may
// fall back to another container, so trust the Blob's MIME over the format id.
export function extFor(fmt: string, blob: { type?: string } | null | undefined): string {
  const t = blob?.type || '';
  if (t.includes('mp4')) return 'mp4';
  if (t.includes('webm')) return 'webm';
  return FMT_EXT[fmt] ?? fmt;
}

// Undo/redo glyphs for the history toast (Lucide undo-2 / redo-2). App chrome,
// not exported, so currentColor is safe here (unlike tool-template SVGs).
export const ICON_UNDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';
export const ICON_REDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5 5.5 5.5 0 0 0 9.5 20H13"/></svg>';

// Starting value for a freshly-added block field. An explicit `default` wins;
// otherwise the type picks a sensible empty (number→min, select→first option,
// asset→null, text/color→'').
export function blockFieldDefault(f: BlockFieldSpec): InputValue {
  if (f.default !== undefined) return f.default;
  switch (f.type) {
    case 'number':  return f.min ?? 0;
    case 'select':  return f.options?.[0]?.value ?? '';
    case 'boolean': return false;
    case 'asset':   return null;
    default:        return '';
  }
}

// Human-readable byte size for the file picker (chosen-file label + size limits).
export function fmtBytes(n: number): string {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}
