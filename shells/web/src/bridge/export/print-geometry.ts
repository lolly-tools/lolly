// SPDX-License-Identifier: MPL-2.0
/**
 * Print-finishing geometry + provenance labels shared by the PDF and CMYK-TIFF
 * print paths. The geometry itself (page boxes + mark primitives, in points,
 * top-left origin) is the engine's single source of truth — see
 * engine/src/print-marks.ts; this module maps the shell's export options and
 * brand palette onto it.
 */

import { parseDimension, toPoints, computePrintGeometry, cmykCondition } from '@lolly/engine';
import type { PrintGeometry, PrintPaletteSwatch, LabelSlot, ExportMeta, Cmyk, RgbTriple } from '@lolly/engine';
import { exportDims } from './dom.ts';
import type { ExportOptions, PaletteSwatch } from './types.ts';

/** Provenance strings keyed by the engine's label anchor slots. */
export type ProvenanceLabels = Partial<Record<LabelSlot, string>>;

// Resolve the print-marks geometry for a PDF export, or null when no bleed and
// no marks are requested (the legacy "page == trim, art fills it" path). The
// geometry (page boxes + mark primitives, in points, top-left origin) is the
// engine's single source of truth — see engine/src/print-marks.ts.
export function printGeometry(
  node: HTMLElement,
  opts: ExportOptions,
  paletteSource: readonly PaletteSwatch[] | undefined = opts.palette,
): PrintGeometry | null {
  const bleedDim = parseDimension(opts.bleed);
  const bleedPt = bleedDim ? toPoints(bleedDim) : 0;
  const marks = {
    crop:         Boolean(opts.cropMarks),
    registration: Boolean(opts.registrationMarks),
    bleed:        Boolean(opts.bleedMarks),
    colorBars:    Boolean(opts.colorBars),
    provenance:   Boolean(opts.provenance),
  };
  const anyMark = marks.crop || marks.registration || marks.bleed || marks.colorBars || marks.provenance;
  if (bleedPt <= 0 && !anyMark) return null;
  const d = exportDims(node, opts);
  // Brand swatches drive the verification half of the colour bar (RGB reference
  // beside CMYK substitution). The CMYK PDF passes only the inks that actually
  // substituted (see renderCmykPdf); the plain RGB PDF has no palette and gets
  // the generic process/overprint/tint bar.
  const palette = marks.colorBars ? brandSwatchPalette(paletteSource) : [];
  return computePrintGeometry({ trimWpt: toPoints(d.w), trimHpt: toPoints(d.h), bleedPt, marks, palette });
}

// Normalise the shell's brand palette (hex + CMYK 0–100) into the engine's
// colour-bar form: { rgb, cmyk } both 0–1, plus a label. Only entries with a
// declared CMYK substitution qualify (the others fall back to generic RGB→CMYK
// at render time and so have nothing to verify). Deduped by hex+ink, since the
// palette repeats Black/White as ramp endpoints; order is preserved so the
// primary brand hues lead and survive the flat cell cap.
export function brandSwatchPalette(palette: readonly PaletteSwatch[] | undefined): PrintPaletteSwatch[] {
  const out: PrintPaletteSwatch[] = [];
  const seen = new Set<string>();
  for (const { hex, cmyk, label } of palette ?? []) {
    if (!hex || !cmyk || cmyk.length !== 4) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;                         // skips 'transparent' etc.
    const key = `${h}:${cmyk.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const rgb: RgbTriple = [r, g, b];
    const [c = 0, m = 0, y = 0, k = 0] = cmyk;
    const ink: Cmyk = [c / 100, m / 100, y / 100, k / 100];
    out.push(label !== undefined ? { rgb, cmyk: ink, label } : { rgb, cmyk: ink });
  }
  return out;
}

// Compose the proof-margin credit strings from the export's provenance metadata.
// topLeft: export timestamp; topRight: platform attribution; bottomLeftUp: tool
// + author. Anything missing is dropped, so the line stays clean when the user
// isn't opted into personal details. Keyed by the engine's label slots (see
// print-marks.ts).
export function provenanceLabels(meta: ExportMeta | undefined): ProvenanceLabels | null {
  if (!meta) return null;
  const topLeft  = formatStamp(new Date());
  const topRight = meta.source ? `Made with ${meta.source}` : '';
  const credit = [meta.tool, meta.author && `by ${meta.author}`].filter(Boolean).join(' ');
  return { topLeft, topRight, bottomLeftUp: meta.tool ? credit : '' };
}

// Local export timestamp as "YYYY-MM-DD HH:MM".
function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// The human-readable press condition recorded as TIFF provenance (ImageDescription).
// Mirrors the PDF OutputIntent's purpose — naming the condition the DeviceCMYK values
// target — but as metadata only: the pixels stay untagged (no embedded profile), so
// the file is never mislabelled. 'none' opts out; anything else resolves via the
// engine registry (unknown / 'srgb' fall back to the default condition).
export function pressConditionLabel(profile: string | undefined): string | null {
  if (profile === 'none') return null;
  return cmykCondition(profile).info;
}
