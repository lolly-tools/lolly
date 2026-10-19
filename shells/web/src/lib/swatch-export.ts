// SPDX-License-Identifier: MPL-2.0
/**
 * Palette download - export every swatch a brand carries (BrandSwatch[], from
 * brand-doc.ts) as a standalone file in one of six formats: a DTCG design-tokens
 * JSON (nested under each swatch's canonical dotted key), a plain CSS custom-
 * properties block, a set of CSS utility classes (bg/text/border), an SCSS `$var`
 * block, a GIMP .gpl palette (name + 0-255 RGB only, no alpha), or a binary Adobe
 * Swatch Exchange (.ase) file.
 *
 * The serializers themselves LIVE IN THE ENGINE now (engine/src/palette-export.ts,
 * ENGINE 1.108) so a tool reaches them through host.color.paletteExport and every
 * shell produces identical bytes - see MEMORY/CLAUDE. This module is the thin web
 * adapter over them: it keeps the BrandSwatch-typed names the brand editor + catalog
 * import (swatchesTo…), plus the two web-only helpers below (rebuild BrandSwatch rows
 * from live PaletteEntry rows, and wrap a serializer's output in a Blob + filename).
 * BrandSwatch structurally satisfies the engine's PaletteSwatch, so no adaptation is
 * needed. Pure - no DOM, no host - so it stays unit-testable like brand-doc.ts.
 */
import type { BrandSwatch } from './brand-doc.ts';
import type { PaletteEntry } from '../palette.ts';
import { describeColor } from '@lolly/engine';
import {
  paletteTokensJson, paletteCssVariables, paletteCssClasses, paletteScssVariables,
  paletteGpl, paletteAse, type PaletteTokensOpts,
} from '../../../../engine/src/palette-export.ts';

export type SwatchExportFormat = 'tokens-json' | 'css-vars' | 'css-classes' | 'scss' | 'gpl' | 'ase';

// The engine serializers under the names the brand editor + catalog (and the
// existing test) import. BrandSwatch carries key/name/group/hex and more, so it
// structurally satisfies the engine's PaletteSwatch - these are pure renames.
export {
  paletteTokensJson as swatchesToTokensJson,
  paletteCssVariables as swatchesToCssVariables,
  paletteCssClasses as swatchesToCssClasses,
  paletteScssVariables as swatchesToScssVariables,
  paletteGpl as swatchesToGpl,
  paletteAse as swatchesToAse,
} from '../../../../engine/src/palette-export.ts';

/** A swatch's canonical dotted key ('color.ramp.primary.5') slugged into a safe
 *  CSS identifier / JSON path segment ('color-ramp-primary-5'). Local to the two
 *  web-only helpers below (bucket keys + a download filename base); the engine's
 *  serializers carry their own copy for the bytes they emit. */
function slug(key: string): string {
  return key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'swatch';
}

/**
 * The Catalog's Swatches section shows the LIVE palette (lib/live-palette.ts - 
 * the resolved brand tokens, so catalog-shipped colours AND everything added in
 * the brand editor alike) as PaletteEntry rows. Rebuild BrandSwatch-shaped
 * entries from them so the same exporters serve that section's download links:
 * whatever the section shows is exactly what downloads.
 */
export function paletteEntriesToSwatches(entries: readonly PaletteEntry[]): BrandSwatch[] {
  return entries.map((e) => {
    const bucket = e.group === 'spectrum' ? 'spectrum' : e.group ? `ramp.${slug(e.group)}` : 'brand';
    const key = `color.${bucket}.${slug(e.label)}`;
    return {
      path: key.split('.'),
      key,
      group: e.group === 'spectrum' ? 'Spectrum' : (e.group ?? 'Brand'),
      name: e.label,
      raw: e.hex,
      hex: e.hex, // non-hex values ('transparent', oklch strings) are filtered by resolved()
      isAlias: false,
      kind: e.group === 'spectrum' ? 'spectrum' : e.group ? 'ramp' : 'other',
      set: null,
      deletable: false,
      lock: null,
    };
  });
}

/**
 * What each format can hold, as the serializers above write a colour today.
 *
 * All six write an opaque sRGB colour and nothing else today: the engine keeps a
 * swatch only when its hex is six digits (`resolved()` in palette-export.ts).
 * The table exists so the answer is stated per format, and so a serializer that
 * learns to carry alpha or a wider colour changes one row here rather than a
 * rule spread through the UI.
 */
const FORMAT_REACH: Record<SwatchExportFormat, { alpha: boolean; beyondSrgb: boolean }> = {
  'tokens-json': { alpha: false, beyondSrgb: false },
  'css-vars': { alpha: false, beyondSrgb: false },
  'css-classes': { alpha: false, beyondSrgb: false },
  scss: { alpha: false, beyondSrgb: false },
  gpl: { alpha: false, beyondSrgb: false },
  ase: { alpha: false, beyondSrgb: false },
};

/** Why a swatch stays out of a file: no colour at all (Transparent), a colour
 *  the format cannot hold the transparency of, or a value that is not a colour. */
export type SwatchSkipReason = 'no-colour' | 'translucent' | 'unreadable';

/** How a set of swatches fits one format. */
export interface SwatchFit {
  /** Written to the file. */
  kept: PaletteEntry[];
  /** Written, but as the sRGB fallback: the colour as authored is wider than sRGB. */
  approximated: PaletteEntry[];
  /** Left out, each with the reason. */
  skipped: { entry: PaletteEntry; reason: SwatchSkipReason }[];
}

/** A hex as the six digits the serializers read: `#rgb` and a fully opaque
 *  `#rrggbbaa` / `#rgba` widen or drop their alpha, a translucent one gives
 *  'translucent', and anything that is not a hex gives null. */
function opaqueHex(hex: string): string | 'translucent' | null {
  const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex);
  if (!m) return null;
  const digits = m[1]!.length <= 4 ? [...m[1]!].map(d => d + d).join('') : m[1]!;
  if (digits.length === 8 && digits.slice(6).toLowerCase() !== 'ff') return 'translucent';
  return `#${digits.slice(0, 6)}`;
}

/** Sort swatches into what `format` writes, writes approximately, and leaves out.
 *  A kept swatch carries the six-digit hex the format will write. */
export function swatchFit(entries: readonly PaletteEntry[], format: SwatchExportFormat): SwatchFit {
  const reach = FORMAT_REACH[format];
  const fit: SwatchFit = { kept: [], approximated: [], skipped: [] };
  for (const entry of entries) {
    const hex = entry.hex.trim();
    if (!hex || hex.toLowerCase() === 'transparent') { fit.skipped.push({ entry, reason: 'no-colour' }); continue; }
    const opaque = opaqueHex(hex);
    if (opaque === 'translucent' && !reach.alpha) { fit.skipped.push({ entry, reason: 'translucent' }); continue; }
    if (opaque === null || opaque === 'translucent') { fit.skipped.push({ entry, reason: 'unreadable' }); continue; }
    fit.kept.push(opaque === hex ? entry : { ...entry, hex: opaque });
    const css = entry.token?.css;
    if (!reach.beyondSrgb && css && describeColor(css)?.inSrgb === false) fit.approximated.push(entry);
  }
  return fit;
}

/** One entry point for the UI: pick a format, get a ready-to-save Blob + filename. */
export function exportSwatches(
  swatches: BrandSwatch[], format: SwatchExportFormat, paletteName = 'Lolly brand',
  opts?: PaletteTokensOpts,
): { blob: Blob; filename: string } {
  const base = slug(paletteName) || 'brand';
  switch (format) {
    case 'tokens-json':
      // The DTCG shape Penpot (>= 2.6) and Tokens Studio import natively; when the
      // brand declares font.* roles they ride along as fontFamilies tokens, so the
      // brand's faces reach Penpot with its colours (plans/173 slice 1).
      return { blob: new Blob([paletteTokensJson(swatches, opts)], { type: 'application/json' }), filename: `${base}-tokens.json` };
    case 'css-vars':
      return { blob: new Blob([paletteCssVariables(swatches)], { type: 'text/css' }), filename: `${base}-variables.css` };
    case 'css-classes':
      return { blob: new Blob([paletteCssClasses(swatches)], { type: 'text/css' }), filename: `${base}-classes.css` };
    case 'scss':
      return { blob: new Blob([paletteScssVariables(swatches)], { type: 'text/x-scss' }), filename: `${base}-variables.scss` };
    case 'gpl':
      return { blob: new Blob([paletteGpl(swatches, paletteName)], { type: 'text/plain' }), filename: `${base}.gpl` };
    case 'ase':
      return { blob: new Blob([paletteAse(swatches) as BlobPart], { type: 'application/octet-stream' }), filename: `${base}.ase` };
  }
}
