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
 * `exportSwatches` hands each BrandSwatch to the engine through `toPaletteSwatch`,
 * which adds the colour as authored and the print lock for the formats that keep
 * them (ENGINE 1.281). Pure - no DOM, no host - so it stays unit-testable like
 * brand-doc.ts.
 */
import type { BrandSwatch } from './brand-doc.ts';
import type { PaletteEntry } from '../palette.ts';
import { describeColor } from '@lolly/engine';
import {
  paletteTokensJson, paletteCssVariables, paletteCssClasses, paletteScssVariables,
  paletteGpl, paletteAse, type PaletteTokensOpts, type PaletteSwatch,
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
      // The colour as authored, where the token has one, so the formats that can
      // hold a wider colour get it (toPaletteSwatch below).
      raw: e.token?.css ?? e.hex,
      hex: e.hex, // non-hex values ('transparent', oklch strings) are filtered by resolved()
      isAlias: false,
      kind: e.group === 'spectrum' ? 'spectrum' : e.group ? 'ramp' : 'other',
      set: null,
      deletable: false,
      lock: e.cmyk || e.spot ? {
        ...(e.cmyk ? { cmyk: [...e.cmyk] as [number, number, number, number] } : {}),
        ...(e.spot ? { spot: e.spot } : {}),
      } : null,
    };
  });
}

/** A brand swatch as the engine's exporters take it: the hex, plus the colour as
 *  authored and the print lock, which the formats with room for them keep. An
 *  alias carries no colour of its own, so it carries no authored value. */
export function toPaletteSwatch(s: BrandSwatch): PaletteSwatch {
  return {
    key: s.key, name: s.name, group: s.group, hex: s.hex,
    ...(!s.isAlias && s.raw && s.raw !== s.hex ? { css: s.raw } : {}),
    ...(s.lock?.cmyk ? { cmyk: s.lock.cmyk } : {}),
    ...(s.lock?.spot ? { spot: s.lock.spot } : {}),
  };
}

/**
 * What each format can hold, as the engine's serializers write it
 * (engine/src/palette-export.ts, whose header gives the detail).
 *
 *   - `alpha`: a translucent colour. None of the six: the engine keeps a swatch
 *     only when its hex is six digits.
 *   - `beyondSrgb`: a colour wider than sRGB, kept as itself. CSS variables and
 *     classes write it beside the hex, tokens JSON as a face, .ase as Lab.
 *   - `print`: the CMYK build and the spot ink. Tokens JSON (as Lolly's own
 *     extension) and .ase (as CMYK and Spot swatches).
 *
 * The menu reads its notes from this table, so a serializer that gains room for
 * more changes one row here rather than a rule spread through the UI.
 */
const FORMAT_REACH: Record<SwatchExportFormat, { alpha: boolean; beyondSrgb: boolean; print: boolean }> = {
  'tokens-json': { alpha: false, beyondSrgb: true, print: true },
  'css-vars': { alpha: false, beyondSrgb: true, print: false },
  'css-classes': { alpha: false, beyondSrgb: true, print: false },
  scss: { alpha: false, beyondSrgb: false, print: false },
  gpl: { alpha: false, beyondSrgb: false, print: false },
  ase: { alpha: false, beyondSrgb: true, print: true },
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
  /** Written without their CMYK build or spot ink, which this format has no room for. */
  printDropped: PaletteEntry[];
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
  const fit: SwatchFit = { kept: [], approximated: [], printDropped: [], skipped: [] };
  for (const entry of entries) {
    const hex = entry.hex.trim();
    if (!hex || hex.toLowerCase() === 'transparent') { fit.skipped.push({ entry, reason: 'no-colour' }); continue; }
    const opaque = opaqueHex(hex);
    if (opaque === 'translucent' && !reach.alpha) { fit.skipped.push({ entry, reason: 'translucent' }); continue; }
    if (opaque === null || opaque === 'translucent') { fit.skipped.push({ entry, reason: 'unreadable' }); continue; }
    fit.kept.push(opaque === hex ? entry : { ...entry, hex: opaque });
    const css = entry.token?.css;
    if (!reach.beyondSrgb && css && describeColor(css)?.inSrgb === false) fit.approximated.push(entry);
    if (!reach.print && (Array.isArray(entry.cmyk) || entry.spot)) fit.printDropped.push(entry);
  }
  return fit;
}

/** One entry point for the UI: pick a format, get a ready-to-save Blob + filename. */
export function exportSwatches(
  swatches: BrandSwatch[], format: SwatchExportFormat, paletteName = 'Lolly brand',
  opts?: PaletteTokensOpts,
): { blob: Blob; filename: string } {
  const base = slug(paletteName) || 'brand';
  const rows = swatches.map(toPaletteSwatch);
  switch (format) {
    case 'tokens-json':
      // The DTCG shape Penpot (>= 2.6) and Tokens Studio import natively; when the
      // brand declares font.* roles they ride along as fontFamilies tokens, so the
      // brand's faces reach Penpot with its colours (plans/173 slice 1).
      return { blob: new Blob([paletteTokensJson(rows, opts)], { type: 'application/json' }), filename: `${base}-tokens.json` };
    case 'css-vars':
      return { blob: new Blob([paletteCssVariables(rows)], { type: 'text/css' }), filename: `${base}-variables.css` };
    case 'css-classes':
      return { blob: new Blob([paletteCssClasses(rows)], { type: 'text/css' }), filename: `${base}-classes.css` };
    case 'scss':
      return { blob: new Blob([paletteScssVariables(rows)], { type: 'text/x-scss' }), filename: `${base}-variables.scss` };
    case 'gpl':
      return { blob: new Blob([paletteGpl(rows, paletteName)], { type: 'text/plain' }), filename: `${base}.gpl` };
    case 'ase':
      return { blob: new Blob([paletteAse(rows) as BlobPart], { type: 'application/octet-stream' }), filename: `${base}.ase` };
  }
}
