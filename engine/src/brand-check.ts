// SPDX-License-Identifier: MPL-2.0
/** Checks authored Design values against one selected design system. No rendering. */
import { aliasPath, createTokenSet } from './tokens.ts';
import { deltaEOk } from './color-tools.ts';
import { colorToHexString, parseColor } from './css-color.ts';
import { brandContext } from './brand-context.ts';
import { parseTreatedAssetId, stripAssetModifiers } from './photo-treatment.ts';
import { AUTO_ASSET_THEME, parseThemedAssetId } from './icon-theme.ts';

export interface BrandFix { layerId: string; field: string; before: unknown; after: string }
export interface BrandFinding {
  id: string;
  kind: 'color' | 'font' | 'asset' | 'reference' | 'coverage';
  status: 'review' | 'unknown';
  layerId?: string;
  label: string;
  field?: string;
  value?: string;
  suggestion?: string;
  fix?: BrandFix;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const valueText = (v: unknown): string => typeof v === 'string' ? v : record(v) && typeof v.ref === 'string' ? v.ref : '';
const family = (v: string): string => v.split(',')[0]!.replace(/["']/g, '').trim().toLowerCase();

/**
 * Catalog facts a check may add (plan 291 W3): the pack's asset ids, so a catalog icon or
 * photo is a known asset, and the icon-theme and photo-treatment ids its `?theme=` and
 * `?treatment=` modifiers may name. Left out, only `asset.*` token ids are known.
 */
export interface BrandCheckCatalogOpts {
  assets?: readonly string[];
  iconThemes?: readonly string[];
  treatments?: readonly string[];
}

export function checkBrandDesign(boxes: unknown, doc: unknown, opts: { theme?: string } & BrandCheckCatalogOpts = {}) {
  const context = brandContext(doc, opts);
  const tokens = createTokenSet(doc, opts);
  const findings: BrandFinding[] = [];
  const checked = { colors: 0, fonts: 0, assets: 0 };
  // A fully transparent token (`color.brand.transparent`) is not a colour a layer can be
  // nudged to, and its distance to any opaque colour is NaN, which used to win the
  // nearest search and flag every colour in a document, exact brand values included.
  const palette = context.colors.filter(c => { const parsed = parseColor(c.value); return !!parsed && parsed.alpha > 0; });
  const allowedFonts = new Set(context.fonts.map(f => family(f.value)));
  const allowedAssets = new Set(context.assets.map(a => a.id));
  const catalogAssets = new Set(Array.isArray(opts.assets) ? opts.assets.filter(id => typeof id === 'string') : []);
  let uploads = 0;
  const nearest = new Map<string, { path: string; value: string; distance: number }>();
  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  if (!Array.isArray(boxes)) findings.push({ id: 'brand.document', kind: 'coverage', status: 'unknown', label: 'No readable composition.' });
  const counts = new Map<string, number>();
  for (const row of rows) if (typeof row.id === 'string') counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
  for (const row of rows.slice(0, 5000)) {
    if (row.hidden === true || row.hidden === 'true') continue;
    const id = typeof row.id === 'string' ? row.id : '';
    const label = String(row.name || (typeof row.text === 'string' ? row.text.slice(0, 40) : '') || id || 'Layer');
    const add = (field: string, kind: BrandFinding['kind'], status: BrandFinding['status'], value: string, suggestion?: string, after?: string): void => {
      findings.push({ id: `brand.${kind}.${id}.${field}`, layerId: id, label, field, kind, status, value, suggestion,
        ...(after && id && counts.get(id) === 1 && row.locked !== true && row.locked !== 'true' ? { fix: { layerId: id, field, before: row[field], after } } : {}),
      });
    };
    for (const field of ['bg', 'fg', 'stroke']) {
      if (field === 'fg' && !row.text) continue;
      const raw = valueText(row[field]);
      if (!raw || raw === 'transparent' || raw === 'none') continue;
      const path = aliasPath(raw) ?? (record(row[field]) ? valueText(row[field]).replace(/^\{|\}$/g, '') : null);
      if (path) {
        if (!tokens.has(path) || tokens.get(path)?.type !== 'color' || !parseColor(String(tokens.resolve(path)))) add(field, 'reference', 'unknown', raw);
        else checked.colors++;
        continue;
      }
      const parsed = parseColor(raw);
      if (parsed?.alpha === 0) continue;
      // A palette colour with an alpha channel (`#13294bcc`, a scrim over a photo) is that
      // palette colour (plan 291 M3b). Any other translucent colour cannot be compared:
      // what it looks like depends on what it is drawn over.
      if (parsed && parsed.alpha < 1 && palette.length) {
        const base = colorToHexString({ ...parsed, alpha: 1 });
        if (palette.some(color => deltaEOk(base, color.value) < 0.000001)) { checked.colors++; continue; }
      }
      if (!parsed || parsed.alpha < 1) { add(field, 'color', 'unknown', raw); continue; }
      if (!palette.length) { add(field, 'color', 'unknown', raw); continue; }
      checked.colors++;
      let closest = nearest.get(raw);
      if (!closest) {
        for (const color of palette) {
          const distance = deltaEOk(raw, color.value);
          if (!Number.isFinite(distance)) continue;
          if (!closest || distance < closest.distance || (distance === closest.distance && color.path < closest.path)) closest = { path: color.path, value: color.value, distance };
        }
        nearest.set(raw, closest!);
      }
      if (!closest) continue;
      if (closest.distance < 0.000001) continue;
      add(field, 'color', 'review', raw, closest.value, `{${closest.path}}`);
    }
    if (row.text) {
      const font = valueText(row.font) || 'sans';
      const role = ({ sans: 'font.brand', display: 'font.display', mono: 'font.mono' } as Record<string, string>)[font];
      const path = aliasPath(font) ?? role;
      const resolved = path ? tokens.resolve(path) : font;
      if (!allowedFonts.size || typeof resolved !== 'string' || (path && !tokens.has(path))) add('font', 'font', 'unknown', font);
      else {
        checked.fonts++;
        if (!allowedFonts.has(family(resolved))) add('font', 'font', 'review', font, context.fonts[0]?.value, tokens.has('font.brand') ? 'sans' : undefined);
      }
    }
    const image = valueText(row.image) || (record(row.image) && typeof row.image.id === 'string' ? row.image.id : '');
    // An uploaded picture (`user/...`, or a ref whose source is the user) is the author's
    // own media, not a catalog asset: it is counted, never reviewed against the pack.
    const upload = image.startsWith('user/') || (record(row.image) && row.image.source === 'user');
    if (image && upload) {
      uploads++;
      // The upload is the author's, but a photo look on it (plan 291 W7) is the pack's:
      // a look the design system does not declare is a reference that resolves to nothing.
      const look = parseTreatedAssetId(image).treatment;
      if (look && Array.isArray(opts.treatments) && !opts.treatments.includes(look)) add('image', 'reference', 'unknown', image);
    }
    else if (image) {
      const assetId = aliasPath(image) ? tokens.resolve(image) : image;
      if ((!allowedAssets.size && !catalogAssets.size) || typeof assetId !== 'string') add('image', 'asset', 'unknown', image);
      else {
        checked.assets++;
        const base = stripAssetModifiers(assetId);
        const theme = parseThemedAssetId(assetId).theme;
        const treatment = parseTreatedAssetId(assetId).treatment;
        const exact = allowedAssets.has(assetId);
        if (!exact && !allowedAssets.has(base) && !catalogAssets.has(base)) add('image', 'asset', 'review', image);
        // `?theme=auto` (plan 291 W4) is the surface-aware form, known by construction:
        // the variant comes from the surface, and the logo house rule judges the pick.
        else if (!exact && theme && theme !== AUTO_ASSET_THEME && Array.isArray(opts.iconThemes) && !opts.iconThemes.includes(theme)) add('image', 'reference', 'unknown', image);
        else if (!exact && treatment && Array.isArray(opts.treatments) && !opts.treatments.includes(treatment)) add('image', 'reference', 'unknown', image);
      }
    }
  }
  return {
    findings, checked,
    coverage: { truncated: rows.length > 5000, colors: palette.length > 0, fonts: allowedFonts.size > 0, assets: allowedAssets.size > 0 || catalogAssets.size > 0 },
    uploads,
    requiresMount: ['computed contrast', 'font availability', 'text layout'],
    notAssessed: ['gradients', 'effects', 'nested tool content', 'motion', 'rights', 'subjective quality'],
  };
}

/** Compare before writing so a delayed fix cannot overwrite a newer edit or a locked layer. */
export function applyBrandFix(boxes: unknown, fix: BrandFix): Record<string, unknown>[] | null {
  if (!Array.isArray(boxes) || !['bg', 'fg', 'stroke', 'font'].includes(fix.field)) return null;
  const matches = boxes.filter(row => record(row) && row.id === fix.layerId);
  if (matches.length !== 1) return null;
  const target = matches[0] as Record<string, unknown>;
  if (target.locked === true || target.locked === 'true' || JSON.stringify(target[fix.field]) !== JSON.stringify(fix.before)) return null;
  return boxes.map(row => row === target ? { ...row, [fix.field]: fix.after } : row);
}
