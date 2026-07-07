// SPDX-License-Identifier: MPL-2.0
/**
 * Colour treatments for raster photo assets — the raster analogue of the
 * two-colour icon themes in ./icon-theme.ts.
 *
 * A treatment (greyscale, or a soft two-colour duotone wash) is chosen at pick
 * time and rides inside the asset id as a `?treatment=<id>` suffix, so it
 * survives URL-mode round-trips (an asset value serialises to its id alone),
 * exactly like `?theme=` does for icons.
 *
 * Unlike an icon, a photo's bytes are opaque raster — there is nothing to
 * rewrite in place. Instead the treatment is *baked* at resolve time into a
 * small self-contained SVG that embeds the photo (as a data URI) and applies an
 * SVG <filter>. That wrapper is a normal image everywhere an <img>/background
 * is: on screen, and rasterised into exports. Treatment definitions themselves
 * are catalog data (a palette-type asset tagged "photo-treatments"), never
 * engine code — only the filter mechanics live here.
 */

/** A single treatment entry from the "photo-treatments" palette document. */
export interface PhotoTreatment {
  id: string;
  label?: string;
  kind: 'greyscale' | 'duotone';
  /** duotone: colour mapped onto the shadows (luminance 0). */
  shadow?: string;
  /** duotone: colour mapped onto the highlights (luminance 1). */
  highlight?: string;
  /** OPTIONAL midtone (luminance 0.5) — when present the duotone becomes a TRITONE
   *  (shadow → mid → highlight), e.g. black → pine → jungle for a rich dark wash. */
  mid?: string;
  /** surface a light treatment needs behind it to read in pickers/previews. */
  previewBg?: string;
}

/** The JSON payload shape of a palette-type asset tagged "photo-treatments". */
export interface PhotoTreatmentsDoc {
  treatments?: unknown;
}

/** Result of splitting a possibly-treated asset id. */
export interface ParsedTreatedAssetId {
  baseId: string;
  treatment: string | null;
}

const TREATMENT_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TREATMENT_SUFFIX = '?treatment=';

/**
 * Split `<baseId>?treatment=<treatmentId>` into its parts.
 * Returns { baseId, treatment } — treatment is null when the id carries none.
 * Full URLs (tool embeds) are never treated ids; they pass through untouched.
 */
export function parseTreatedAssetId(id: string): ParsedTreatedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, treatment: null };
  const i = id.indexOf(TREATMENT_SUFFIX);
  if (i <= 0) return { baseId: id, treatment: null };
  const baseId = id.slice(0, i);
  const treatment = id.slice(i + TREATMENT_SUFFIX.length);
  if (baseId.includes('?') || !TREATMENT_ID_RE.test(treatment)) return { baseId: id, treatment: null };
  return { baseId, treatment };
}

/** Compose a treated id; a falsy treatment returns the base id unchanged. */
export function buildTreatedAssetId(baseId: string, treatmentId: string | null | undefined): string {
  if (!treatmentId) return baseId;
  if (!TREATMENT_ID_RE.test(treatmentId)) throw new Error(`Bad photo treatment id: ${treatmentId}`);
  return `${baseId}${TREATMENT_SUFFIX}${treatmentId}`;
}

/** Is this treatment id valid for use in a treated asset id? */
export function isValidTreatmentId(treatmentId: unknown): treatmentId is string {
  return typeof treatmentId === 'string' && TREATMENT_ID_RE.test(treatmentId);
}

/**
 * Base asset id with any presentation-modifier suffix stripped — both the icon
 * `?theme=` and the photo `?treatment=` forms. A modifier is presentation, not
 * identity, so favourites / hidden / category overlays and blob-cache pruning
 * all key off this. Full URLs (tool embeds) may legitimately contain `?` and
 * pass through untouched.
 */
export function stripAssetModifiers(id: string): string {
  if (typeof id !== 'string' || id.includes('://')) return id;
  const i = id.indexOf('?');
  return i > 0 ? id.slice(0, i) : id;
}

/**
 * Extract the treatment list from a photo-treatments palette document (the JSON
 * payload of a palette-type asset tagged "photo-treatments"):
 * `{ treatments: [{ id, label?, kind, shadow?, highlight?, previewBg? }, …] }`.
 * Entries with an invalid id, unknown kind, or (for duotone) unusable colours
 * are dropped. "None" is not a treatment — it's the plain photo, expressed as an
 * id with no suffix, and prepended by the UI.
 */
export function parsePhotoTreatmentsDoc(doc: PhotoTreatmentsDoc | null | undefined): PhotoTreatment[] {
  if (!doc || !Array.isArray(doc.treatments)) return [];
  return (doc.treatments as unknown[]).filter(isPhotoTreatment);
}

function isPhotoTreatment(t: unknown): t is PhotoTreatment {
  if (!t || !isValidTreatmentId((t as PhotoTreatment).id)) return false;
  const kind = (t as PhotoTreatment).kind;
  if (kind === 'greyscale') return true;
  if (kind === 'duotone') return !!hexToUnitRgb((t as PhotoTreatment).shadow) && !!hexToUnitRgb((t as PhotoTreatment).highlight);
  return false;
}

/**
 * The SVG <filter> element that realises a treatment, wrapped with the given id.
 * `color-interpolation-filters="sRGB"` is deliberate: the default linearRGB
 * would shift the duotone colours away from their authored hex values, and it
 * also keeps a CSS `filter: url(#id)` preview identical to the baked result.
 */
export function treatmentFilterSvg(treatment: PhotoTreatment, filterId: string): string {
  return `<filter id="${filterId}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${treatmentFilterBody(treatment)}</filter>`;
}

function treatmentFilterBody(treatment: PhotoTreatment): string {
  if (treatment.kind === 'greyscale') {
    return '<feColorMatrix type="saturate" values="0"/>';
  }
  // Duotone: collapse to luminance, then map that single channel across a table
  // shadow→highlight (feComponentTransfer interpolates linearly). An optional `mid`
  // colour inserts a third stop at luminance 0.5 → a tritone (shadow → mid → highlight).
  const s = hexToUnitRgb(treatment.shadow) ?? [0, 0, 0];
  const h = hexToUnitRgb(treatment.highlight) ?? [1, 1, 1];
  const m = hexToUnitRgb(treatment.mid);
  const table = (i: 0 | 1 | 2): string => (m ? `${trim(s[i])} ${trim(m[i])} ${trim(h[i])}` : `${trim(s[i])} ${trim(h[i])}`);
  return '<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/>'
    + '<feComponentTransfer>'
    + `<feFuncR type="table" tableValues="${table(0)}"/>`
    + `<feFuncG type="table" tableValues="${table(1)}"/>`
    + `<feFuncB type="table" tableValues="${table(2)}"/>`
    + '</feComponentTransfer>';
}

/** Inputs for baking a treatment into a self-contained SVG wrapper. */
export interface RasterTreatmentWrap {
  /** the photo as a data URI (`data:image/jpeg;base64,…`) — must be inline, as
   *  an SVG used as an image may not load external resources. */
  href: string;
  width: number;
  height: number;
  treatment: PhotoTreatment;
}

/**
 * Bake a treatment into a standalone SVG that embeds the photo and applies the
 * treatment filter. The result is a normal raster-bearing image: usable as an
 * `<img>` src or CSS background, and rasterised faithfully on export.
 */
export function wrapRasterWithTreatment({ href, width, height, treatment }: RasterTreatmentWrap): string {
  const fid = 't';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<defs>${treatmentFilterSvg(treatment, fid)}</defs>`
    + `<image width="${width}" height="${height}" preserveAspectRatio="none" href="${href}" filter="url(#${fid})"/>`
    + '</svg>';
}

/** Parse a `#rgb`/`#rrggbb` colour to three 0..1 channels, or null if unusable. */
function hexToUnitRgb(hex: unknown): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.replace(/./g, (c) => c + c) : m[1]!;
  const n = parseInt(h, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/** Compact a 0..1 channel to at most 4 decimals with no trailing zeros. */
function trim(v: number): string {
  return String(Math.round(v * 1e4) / 1e4);
}
