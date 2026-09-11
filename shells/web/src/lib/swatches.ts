// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-palette grouping + swatch markup - shared by the Platform view and the Catalog
 * view so both render the swatches identically (and click-to-copy works the same). The
 * source of truth for the colours themselves is palette.ts (PALETTE).
 *
 * The markup keeps the `.plat-swatch*` class contract (global CSS), so a `swatch()` reads
 * the same wherever it's dropped. Copy-to-clipboard is wired by the host view over the
 * `.plat-swatch-chip[data-copy]` buttons.
 *
 * `swatchTile()` is a second, smaller markup factory (component-audit rec 12) for the
 * two SHAPE-ONLY tiles - the brand studio's editable grid (`.be-swatch`) and the mobile
 * palette sheet's read-only mirror chip (`.stu-chip`) - which show no visible text, only
 * a colour + title/aria-label. It's deliberately separate from `swatch()` above: that one
 * renders a full read-only card (name + hex + CMYK row) and its three call sites
 * (dashboard.ts, catalog.ts) are outside this refactor. The palette-wheel dot stays its
 * own thing too - it's geometry (positioned on a hue/lightness disc), not a tile.
 */
import { escape } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from './icons.ts';
import type { PaletteEntry } from '../palette.ts';

export const isTransparent = (hex: string): boolean => !hex || hex.toLowerCase() === 'transparent';

export const cmykText = (cmyk: PaletteEntry['cmyk']): string =>
  Array.isArray(cmyk) ? `C ${cmyk[0]}  M ${cmyk[1]}  Y ${cmyk[2]}  K ${cmyk[3]}` : 'RGB→CMYK (generic)';

/** A swatch carries a locked print value - a CMYK anchor, a named spot colour,
 *  or both (independent locks; see palette.ts's PaletteEntry doc comment). */
export const isLockedInk = (c: Pick<PaletteEntry, 'cmyk' | 'spot'>): boolean => Array.isArray(c.cmyk) || !!c.spot;

/** The ink readout for a swatch: the spot name when locked to one, plus its
 *  CMYK figures too when a CMYK anchor is ALSO explicitly set (the fallback
 *  used for non-PDF export); a spot-only lock shows just the name (its
 *  print-time CMYK equivalent is derived, not a value the user set); a
 *  CMYK-only lock shows its figures; neither shows the generic RGB→CMYK
 *  fallback note. */
export const inkText = (c: Pick<PaletteEntry, 'cmyk' | 'spot'>): string =>
  c.spot
    ? `Spot · ${c.spot.name}${Array.isArray(c.cmyk) ? ` · ${cmykText(c.cmyk)}` : ''}`
    : cmykText(c.cmyk);

/** One family's tint ramp, e.g. ['Jungle', [Jungle 1, Jungle 2, …]]. */
export type PaletteRamp = [string, PaletteEntry[]];

export interface GroupedPalette {
  brand: PaletteEntry[];
  spectrum: PaletteEntry[];
  ramps: PaletteRamp[];
}

// Split the flat palette into three buckets: the named "brand" colours, the secondary
// "spectrum" palette (tagged group:'spectrum'), and the numbered tint ramps (e.g.
// "Jungle 1".."Jungle 8"), grouped by family in first-seen order. An explicit group that
// names a family (e.g. White → 'Fog') pins a swatch into that ramp; otherwise a trailing
// number in the label decides the family.
export function groupPalette(palette: readonly PaletteEntry[]): GroupedPalette {
  const ramps = new Map<string, PaletteEntry[]>();
  const brand: PaletteEntry[] = [];
  const spectrum: PaletteEntry[] = [];
  const addToRamp = (fam: string, c: PaletteEntry) => {
    if (!ramps.has(fam)) ramps.set(fam, []);
    ramps.get(fam)!.push(c); // just set above when absent, so always present here
  };
  for (const c of palette) {
    if (c.group === 'spectrum') {
      spectrum.push(c);
    } else if (c.group) {
      addToRamp(c.group, c);
    } else {
      const m = /^(.+?)\s+\d+$/.exec(c.label);
      if (m) addToRamp(m[1]!, c); // group 1 (`.+?`) always captures when matched
      else brand.push(c);
    }
  }
  return { brand, spectrum, ramps: [...ramps] };
}

/** `opts.fav` (host views that wire a favourites overlay, e.g. the Catalog) renders a
 *  star toggle on the card; omit it (or call via `.map(swatch)`, whose index lands here
 *  and is ignored) for the plain read-only card. */
export function swatch(c: PaletteEntry, opts?: { fav?: boolean } | number): string {
  const fav = typeof opts === 'object' && opts ? opts.fav : undefined;
  const measured = isLockedInk(c);
  const trans = isTransparent(c.hex);
  const chipStyle = trans ? '' : `style="background:${escape(c.hex)}"`;
  // Transparent has no ink at all - a generic RGB→CMYK note would be misleading, so mark
  // it N/A. Locked colours show their exact/spot values; everything else, the generic note.
  const cmykLabel = trans ? 'CMYK N/A' : inkText(c);
  const flag = c.spot
    ? `<span class="plat-chip-flag" title="${escape(`Spot colour: ${c.spot.name}${c.spot.book ? ' · ' + c.spot.book : ''} - its CMYK equivalent is substituted into CMYK PDF exports`)}">SPOT</span>`
    : '<span class="plat-chip-flag" title="Exact CMYK ink values - substituted directly into CMYK PDF exports">CMYK</span>';
  return `
    <div class="plat-swatch${measured ? ' is-measured' : ''}">
      <button type="button" class="plat-swatch-chip${trans ? ' is-transparent' : ''}" ${chipStyle}
              data-copy="${trans ? 'transparent' : escape(c.hex)}"
              aria-label="${escape(c.label)} - ${trans ? 'transparent' : escape(c.hex)} (click to copy)">
        ${measured ? flag : ''}
      </button>
      ${fav === undefined ? '' : `<button type="button" class="plat-swatch-fav${fav ? ' is-on' : ''}" data-fav-swatch="${escape(c.label)}" aria-pressed="${fav}" aria-label="${escape(fav ? t('Remove from favourites') : t('Add to favourites'))}" title="${escape(fav ? t('Remove from favourites') : t('Add to favourites'))}">${icon('star', { size: 13 })}</button>`}
      <span class="plat-swatch-name">${escape(c.label)}</span>
      <code class="plat-swatch-hex">${trans ? 'transparent' : escape(c.hex)}</code>
      <span class="plat-swatch-cmyk${measured || trans ? '' : ' is-generic'}">${cmykLabel}</span>
    </div>`;
}

// ── Shape-only swatch tile (.be-swatch / .stu-chip) - rec 12 ────────────────────

/** Minimal data a shape-only tile needs - a subset any palette source (a
 *  brand-editor `BrandSwatch`, or a scraped-DOM mirror) can supply. */
export interface SwatchTileEntry {
  /** `size:'md'`: the raw swatch name, composed into the accessible label below.
   *  `size:'sm'`: the FULL accessible label already, verbatim - a mirror chip
   *  scrapes it pre-formatted off the tile it mirrors, so it's passed through
   *  as-is rather than re-composed (re-composing would need the raw name and
   *  lock state back out of a locale-formatted string). */
  label: string;
  /** '' or the literal string 'transparent' both render the checkerboard. */
  hex: string;
  /** Print-locked swatches (CMYK/spot) get `.is-pinned`; `size:'sm'` never sets it
   *  (the mirror doesn't recompute the label, so there's nothing to flag). */
  locked?: boolean;
}

export interface SwatchTileOptions {
  /** 'md' (default) = the brand studio's interactive grid tile (`.be-swatch`);
   *  'sm' = the mobile palette sheet's read-only mirror chip (`.stu-chip`). */
  size?: 'md' | 'sm';
  /** Grid index, wired as `data-be-tile` (md) / `data-stu-tile` (sm) so click
   *  delegation can look the swatch back up. Always rendered when given, even
   *  as `""` - callers that always expect the attribute rely on that. */
  idx?: number | string;
  /** md only: whether to show the locked/empty state classes. Default true -
   *  the brand studio's own grid always wants them; a caller reusing the 'md'
   *  shape purely for layout (none currently) can opt out. */
  editable?: boolean;
  /** md only: the role mark this tile wears in the corner - `P`, `S`, `Su`, `T`
   *  (plan 182 section 4.2). Decorative and aria-hidden: the Roles strip is
   *  where roles are listed and named, and the tile's accessible label is kept
   *  fresh in place by the studio's own recolour paths, which know nothing about
   *  roles. Omit it and the tile is byte-identical to what it always was. */
  roleGlyph?: string;
  /** md only: the tile is light enough that the mark needs ink rather than
   *  paper. The caller measures - it already holds the swatch's OKLCH. */
  roleOnLight?: boolean;
}

/** The tile's accessible name - the visible grid is shape-only, so name + hex
 *  live in title/aria-label (and are kept fresh by the in-place recolour paths). */
export function tileLabel(name: string, hex: string, locked: boolean): string {
  const hexPart = hex || t('unset');
  return locked
    ? tRaw('{name} - {hex} (print colour locked)', { name, hex: hexPart })
    : tRaw('{name} - {hex}', { name, hex: hexPart });
}

export function swatchTile(entry: SwatchTileEntry, opts: SwatchTileOptions = {}): string {
  const { size = 'md', idx, editable = true, roleGlyph = '', roleOnLight = false } = opts;
  const trans = !entry.hex || entry.hex === 'transparent';
  const sw = escape(trans ? 'transparent' : entry.hex);
  if (size === 'sm') {
    const idxAttr = idx != null ? ` data-stu-tile="${escape(String(idx))}"` : '';
    return `<button type="button" class="stu-chip"${idxAttr}
      style="--sw:${sw}" aria-label="${escape(entry.label)}" title="${escape(entry.label)}"></button>`;
  }
  const label = tileLabel(entry.label, entry.hex, !!entry.locked);
  const idxAttr = idx != null ? ` data-be-tile="${escape(String(idx))}"` : '';
  const stateCls = editable ? `${trans ? ' is-empty' : ''}${entry.locked ? ' is-pinned' : ''}` : '';
  const mark = roleGlyph
    ? `<span class="be-swatch-role${roleOnLight ? ' is-onlight' : ''}" aria-hidden="true">${escape(roleGlyph)}</span>`
    : '';
  return `
    <button type="button" class="be-swatch${stateCls}"${idxAttr}
      style="--sw:${sw}"
      title="${escape(label)}" aria-label="${escape(label)}">
      <span class="be-swatch-chip" aria-hidden="true"></span>${mark}
    </button>`;
}
