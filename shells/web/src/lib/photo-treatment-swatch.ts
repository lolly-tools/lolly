// SPDX-License-Identifier: MPL-2.0
/**
 * The CSS background of a photo treatment's swatch, shared by the asset picker's
 * treatment strip (views/picker.ts) and the Assets view's colour rows
 * (views/assets/thumbs.ts), so both show the same look.
 *
 * - greyscale: a grey ramp.
 * - duotone: shadow, optional mid, highlight.
 * - gradient-map (plan 291 W7): a look has only `stops`, so the swatch is sampled from
 *   the engine's preview table, which carries the look's grade and amount. Building it
 *   from shadow/mid/highlight gave `linear-gradient(135deg,)` (blank) in the picker and a
 *   neutral grey in the Assets rows.
 * - lut: a LUT has no colours to show, so the swatch is a neutral hatched marker.
 *
 * Every colour that reaches the CSS is a validated `#rrggbb`, so the result is safe
 * inside a `style` attribute.
 */
import { photoLookPreviewTable } from '../../../../engine/src/photo-look.ts';
import type { PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';

const GREY_RAMP = 'linear-gradient(135deg,#2b2b2b,#e9e9e9)';
const LUT_MARKER = 'repeating-linear-gradient(135deg,#8a8a8a 0 3px,#b8b8b8 3px 6px)';
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const hex2 = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');

/** The swatch background for one treatment. */
export function photoTreatmentSwatch(t: PhotoTreatment): string {
  if (t.kind === 'greyscale') return GREY_RAMP;
  if (t.kind === 'lut') return LUT_MARKER;
  if (t.kind === 'gradient-map') {
    const rows = photoLookPreviewTable(t, 7);
    if (rows.length < 2) return GREY_RAMP;
    return `linear-gradient(135deg,${rows.map(r => `#${hex2(r[0])}${hex2(r[1])}${hex2(r[2])}`).join(',')})`;
  }
  const stops = [t.shadow ?? '#333333', t.mid, t.highlight ?? '#eeeeee']
    .filter((c): c is string => typeof c === 'string' && HEX.test(c.trim()))
    .map(c => c.trim());
  return stops.length >= 2 ? `linear-gradient(135deg,${stops.join(',')})` : GREY_RAMP;
}
