// SPDX-License-Identifier: MPL-2.0
/**
 * Fonts a PDF export embeds for live text: the SUSE statics by weight and style, and
 * a resolved face that may travel as live text. Shared by the HTML walker in export.ts
 * and the SVG painter in export-pdf-svg.ts, which is why it lives in its own leaf.
 */
import { loadFontBase64 } from './export-font-data.ts';
import { canEmbedPdfSubset } from './pdf-font-policy.ts';
import { suseFontFile, SUSE_FONT_DIR } from './text-svg.ts';
import { _host } from './export-shared.ts';
import type { VectorFont } from './font-registry.ts';
import type { PdfDoc } from './export-pdf-doc.ts';

/** The family name the SUSE statics are registered under. */
export const suseFontName = (mono: boolean): string => (mono ? 'SUSEMono' : 'SUSE');

/**
 * Embed a SUSE weight and style into the document once, and return the style key to
 * use with pdf.setFont(suseFontName(mono), key). `registeredFonts` is the per-PDF set
 * that avoids registering a face twice. The file naming is shared with the SVG path
 * emitter (text-svg.ts) so both exports resolve a weight to the same file.
 */
export async function embedSuseFont(pdf: Pick<PdfDoc, 'addFileToVFS' | 'addFont'>, registeredFonts: Set<unknown>, weight: number, italic: boolean, mono = false): Promise<string | null> {
  const style = (mono ? 'm' : '') + (italic ? `wi${weight}` : `w${weight}`);
  if (!registeredFonts.has(style)) {
    const file = suseFontFile(weight, italic, mono);
    const url = SUSE_FONT_DIR + file;
    try {
      const b64 = await loadFontBase64(url);
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, suseFontName(mono), style);
      registeredFonts.add(style);
    } catch {
      return null; // fetch failed; caller falls back to helvetica
    }
  }
  return style;
}

/**
 * Live PDF text needs one permitted TrueType face at its default instance. Other runs
 * use the outline path, which supports variations and fallback faces.
 */
export async function pdfFontEmbed(vf: VectorFont | null): Promise<string | null> {
  if (!vf || vf.fallbacks?.length) return null;
  try {
    const bytes = Uint8Array.from(atob(await loadFontBase64(vf.url)), char => char.charCodeAt(0));
    if (!canEmbedPdfSubset(bytes)) return null;
  } catch { return null; }
  if (!vf.variations?.length) return vf.url; // static face → its own weight
  const defs = await _host?.text?.axisDefaults?.(vf.url).catch(() => null);
  return vf.variations.every(setting => {
    const match = /^([A-Za-z0-9]{4})=(-?\d+(?:\.\d+)?)$/.exec(setting);
    if (!match) return false;
    const wanted = Number(match[2]), def = defs?.[match[1]!];
    return def != null && Math.abs(def - wanted) < 0.001;
  }) ? vf.url : null;
}
