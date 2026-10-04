// SPDX-License-Identifier: MPL-2.0
/**
 * The design brief (plan 291 W3): everything an agent needs to compose on brand, as one
 * JSON document per design system.
 *
 * `designBrief` wraps `brandContext` rather than widening it, so every caller of the
 * context (the web Start looks, `checkBrandDesign`) keeps its exact output and cost. The
 * brief keeps every context key and adds sections:
 *
 *   - `themes`        the semantic colour slots per declared theme;
 *   - `combinations`  which foregrounds a brand approves on which backgrounds, text and
 *                     graphics apart (the token extension `combinations`), or pairs
 *                     derived from the semantic slots by contrast when none are declared;
 *   - `type`          families, the master's type scale and per-role sizes, weights and
 *                     alignments as the master's placeholders state them;
 *   - `logos`         the master's logo per surface and every logo variant with its surface;
 *   - `icons`         icon ids, the two-colour themes, the surfaces each theme suits and
 *                     the id form `<id>?theme=<themeId>`;
 *   - `media`         photography, illustration and background families plus treatments;
 *   - `master`        archetypes with their slots in px at the master's size;
 *   - `houseRules`    the brand's machine-checkable rules (`BrandRuleV1`), the same list
 *                     `checkDesignHouseRules` evaluates.
 *
 * `coverage` gains one entry per section: `declared` when the pack states it, `derived`
 * when it was computed from the tokens, `neutral` for the stand-in master and
 * `unavailable` when nothing answers. A blank pack gets a brief with empty sections, never
 * an exception.
 *
 * Pure: the catalog facts arrive as data (`DesignBriefCatalogV1`); the Node reader lives
 * in packages/node-shell/src/design-brief.ts.
 */
import type { BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import type { SlideMasterV1 } from '@lolly-tools/core';
import { roleFontSize } from '@lolly-tools/core';
import { brandContext } from './brand-context.ts';
import { brandSystemOf } from './brand-system.ts';
import { createTokenSet, TOKEN_EXT } from './tokens.ts';
import { contrastRatio } from './logo-variant.ts';
import { iconThemeSurfaces } from './surface-variant.ts';
import type { LogoSetV1 } from './logo-variant.ts';
import { parseIconThemesDoc } from './icon-theme.ts';
import { textStylesFromBrief } from './design-text-style.ts';
import { parsePhotoTreatmentsDoc } from './photo-treatment.ts';
import { deriveIconThemesDoc, derivePhotoTreatmentsDoc } from './brand-treatments.ts';
import { neutralSlideMaster } from './rebrand-design-system.ts';
import { DESIGN_HOUSE_RULE_KINDS, designHouseRules } from './design-house-rules.ts';
import { parseColorToSrgb8 } from './css-color.ts';
import type { BrandCheckCatalogOpts } from './brand-check.ts';

/** One catalog asset, with only the fields the brief reads. */
export interface DesignBriefAssetV1 {
  id: string;
  type?: string;
  name?: string;
  description?: string;
  tags?: string[];
  license?: string;
  deprecated?: boolean;
}

/** The catalog facts a brief adds to a token document. Every field is optional. */
export interface DesignBriefCatalogV1 {
  /** The content profile these facts were read from. */
  profile?: string;
  /** The catalog id of the token document, when it came from the catalog. */
  tokensAsset?: string;
  /** Asset index entries (no bytes). */
  assets?: DesignBriefAssetV1[];
  /** The palette document tagged `icon-themes`. */
  iconThemes?: unknown;
  /** The palette document tagged `photo-treatments`. */
  photoTreatments?: unknown;
  /** The first usable slide master, and the catalog id it came from. */
  master?: SlideMasterV1 | null;
  masterAsset?: string;
  /** The master's logos resolved by its own asset tags. */
  logos?: LogoSetV1;
}

export interface DesignBriefOpts { name?: string; theme?: string }

type Coverage = 'declared' | 'derived' | 'neutral' | 'unavailable';
type Swatch = { path: string; value: string; name: string };

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const tagsOf = (a: DesignBriefAssetV1): string[] => Array.isArray(a.tags) ? a.tags.filter((t) => typeof t === 'string') : [];
const hexOf = (value: unknown): string | null => {
  const rgba = typeof value === 'string' ? parseColorToSrgb8(value) : null;
  return rgba && rgba[3] >= 1 ? '#' + rgba.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('') : null;
};
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Counted values, most frequent first, then by value. */
function tally<T extends string | number>(values: T[]): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

function themeSection(doc: unknown) {
  const base = createTokenSet(doc);
  const names = base.themes().map((t) => t.name).filter(Boolean);
  const slotsOf = (theme?: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of createTokenSet(doc, { theme }).colors()) {
      if (c.path.startsWith('color.semantic.') && c.value) out[c.path.slice('color.semantic.'.length)] = c.value;
    }
    return out;
  };
  // The themed role tokens (`color.role.*`, plan 291 W4), named so an agent can write
  // `{color.role.<role>}` and have the colour follow the theme. Only a pack that has them lists them.
  const rolesOf = (theme?: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of createTokenSet(doc, { theme }).colors()) {
      if (c.path.startsWith('color.role.') && c.value) out[c.path.slice('color.role.'.length)] = c.value;
    }
    return out;
  };
  return names.map((name) => {
    const roles = rolesOf(name);
    return { name, semantic: slotsOf(name), ...(Object.keys(roles).length ? { roles } : {}) };
  });
}

function combinationSection(doc: unknown, theme: string | undefined, themes: Array<{ name: string; semantic: Record<string, string> }>) {
  const tokens = createTokenSet(doc, { theme });
  const swatches = tokens.colors();
  const byPath = new Map(swatches.map((s) => [s.path, s]));
  const declared: Array<{ background: Swatch; text: Swatch[]; graphic: Swatch[]; graphicOnly: Swatch[] }> = [];
  for (const entry of tokens.query({ type: 'color' })) {
    const vendor = entry.extensions?.[TOKEN_EXT];
    const combos = record(vendor) && record(vendor.combinations) ? vendor.combinations : null;
    const bg = byPath.get(entry.path);
    if (!combos || !bg) continue;
    const group = entry.path.split('.').slice(0, -1).join('.');
    const resolve = (names: unknown): Swatch[] => (Array.isArray(names) ? names : [])
      .filter((n): n is string => typeof n === 'string')
      .map((n) => byPath.get(`${group}.${n}`))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({ path: s.path, value: s.value, name: s.name }));
    const text = resolve(combos.text);
    const graphic = resolve(combos.graphic);
    declared.push({
      background: { path: bg.path, value: bg.value, name: bg.name },
      text, graphic, graphicOnly: graphic.filter((g) => !text.some((t) => t.path === g.path)),
    });
  }
  if (declared.length) {
    return {
      from: 'declared' as Coverage,
      note: 'Approved pairings for the named colours. Shades outside them are not covered: check their contrast.',
      pairs: declared,
    };
  }
  // Nothing declared: pair the semantic slots of each theme by WCAG contrast. A derived
  // pair is arithmetic, not a brand approval, and says so.
  const derived: Array<{ theme: string | null; background: { slot: string; value: string }; text: Array<{ slot: string; value: string; contrast: number }>; graphic: Array<{ slot: string; value: string; contrast: number }> }> = [];
  const sets = themes.length ? themes : [{ name: '', semantic: Object.fromEntries(swatches.filter((s) => s.path.startsWith('color.semantic.')).map((s) => [s.path.slice(15), s.value])) }];
  for (const set of sets) {
    for (const bgSlot of ['surface', 'primary', 'secondary']) {
      const bg = hexOf(set.semantic[bgSlot]);
      if (!bg) continue;
      const fgs = Object.entries(set.semantic).filter(([slot]) => slot !== bgSlot)
        .map(([slot, value]) => ({ slot, value, contrast: round2(contrastRatio(String(value), bg)) }))
        .filter((f) => Number.isFinite(f.contrast));
      derived.push({
        theme: set.name || null,
        background: { slot: bgSlot, value: set.semantic[bgSlot]! },
        text: fgs.filter((f) => f.contrast >= 4.5),
        graphic: fgs.filter((f) => f.contrast >= 3),
      });
    }
  }
  return derived.length
    ? { from: 'derived' as Coverage, note: 'No approved pairings are declared. These pair the semantic slots by contrast (text 4.5:1, graphics 3:1), not by brand approval.', pairs: derived }
    : { from: 'unavailable' as Coverage, note: 'No pairings are declared and no semantic slots can be paired.', pairs: [] };
}

function pxBox(box: { x: number; y: number; w: number; h: number }, size: { width: number; height: number }) {
  return {
    x: Math.round(box.x * size.width), y: Math.round(box.y * size.height),
    width: Math.round(box.w * size.width), height: Math.round(box.h * size.height),
  };
}

function masterSection(master: SlideMasterV1, resolve: (path: string) => string | undefined, asset?: string) {
  const colour = (hex?: string, tokenPath?: string): Record<string, string> => {
    const value = hex ?? (tokenPath ? resolve(tokenPath) : undefined);
    return { ...(tokenPath ? { tokenPath } : {}), ...(value ? { value } : {}) };
  };
  return {
    id: master.id, version: master.version, name: master.name, ...(asset ? { asset } : {}),
    size: master.size, typeScale: master.typeScale,
    furniture: master.furniture.map((f) => ({
      id: f.id, kind: f.kind, box: pxBox(f.box, master.size),
      ...(f.text ? { text: f.text } : {}), ...(f.variantByBackground ? { variantByBackground: true } : {}),
      ...(f.tokenPath || f.hex ? { fill: colour(f.hex, f.tokenPath) } : {}),
      ...(f.style ? { style: { ...f.style, ...(f.style.fg || f.style.fgTokenPath ? { fg: colour(f.style.fg, f.style.fgTokenPath) } : {}) } } : {}),
    })),
    archetypes: master.archetypes.map((a) => ({
      id: a.id, name: a.name,
      ...(a.structure ? { structure: a.structure } : {}), ...(a.section ? { section: a.section } : {}),
      ...(a.background ? { background: { ...colour(a.background.hex, a.background.tokenPath), dark: a.background.dark === true } } : {}),
      ...(a.variants?.dark ? { darkVariant: a.variants.dark } : {}), ...(a.variantOf ? { variantOf: a.variantOf } : {}),
      furniture: a.furniture ?? [],
      placeholders: a.placeholders.map((p) => ({
        role: p.role, kind: p.kind, box: pxBox(p.box, master.size),
        ...(p.kind === 'text' ? { fontSize: roleFontSize(master, p.role, p.style) } : {}),
        ...(p.style?.weight ? { weight: p.style.weight } : {}),
        ...(p.style?.align ? { align: p.style.align } : {}), ...(p.style?.valign ? { valign: p.style.valign } : {}),
        ...(p.style?.font ? { font: p.style.font } : {}),
        ...(p.style?.fg || p.style?.fgTokenPath ? { fg: colour(p.style.fg, p.style.fgTokenPath) } : {}),
        ...(p.fit ? { fit: p.fit } : {}), ...(p.prompt ? { prompt: p.prompt } : {}),
        ...(p.group ? { group: p.group } : {}), ...(typeof p.index === 'number' ? { index: p.index } : {}),
        ...(p.optional ? { optional: true } : {}), ...(p.overlay ? { overlay: true } : {}),
      })),
    })),
  };
}

function typeSection(master: SlideMasterV1, fonts: Array<{ path: string; value: string }>, rules: BrandRuleV1[]) {
  const roles = new Map<string, { sizes: number[]; weights: string[]; aligns: string[] }>();
  const add = (role: string, size: number | undefined, weight: string | undefined, align: string | undefined): void => {
    const r = roles.get(role) ?? { sizes: [], weights: [], aligns: [] };
    if (typeof size === 'number') r.sizes.push(size);
    r.weights.push(weight ?? 'unset');
    r.aligns.push(align ?? 'unset');
    roles.set(role, r);
  };
  for (const a of master.archetypes) {
    for (const p of a.placeholders) {
      if (p.kind !== 'text') continue;
      add(p.role, roleFontSize(master, p.role, p.style), p.style?.weight, p.style?.align);
    }
  }
  for (const f of master.furniture) if (f.style && (f.kind === 'page-number' || f.kind === 'footer')) add(f.kind, f.style.fontSize, f.style.weight, f.style.align);
  return {
    families: fonts,
    size: master.size,
    scale: master.typeScale,
    note: 'Sizes are px at the master size; scale them with the artboard. "unset" means the master leaves the field to the Design default (weight 700, centred). styles is the table a Design $style resolves to at the master size: each size is the most frequent size in roles, and scale only fills in a title, subtitle, body or caption size the master never states. Size authored text from styles or with lolly measure --style.',
    roles: Object.fromEntries([...roles].map(([role, r]) => [role, { sizes: tally(r.sizes), weights: tally(r.weights), aligns: tally(r.aligns) }])),
    rules: rules.filter((r) => ['text-weight', 'text-align', 'text-case'].includes(r.kind))
      .map((r) => ({ ruleId: r.id, kind: r.kind, label: r.label, requirement: r.requirement, parameters: r.parameters })),
  };
}

function surfaceFromTags(tags: string[]): 'light' | 'dark' | 'any' {
  if (tags.includes('on-dark') || tags.includes('reverse')) return 'dark';
  if (tags.includes('on-light') || tags.includes('primary')) return 'light';
  return 'any';
}

function logoSection(catalog: DesignBriefCatalogV1, assets: DesignBriefAssetV1[], tokenLogos: Array<{ path: string; id: string }>, rules: BrandRuleV1[]) {
  const logos = catalog.logos ?? {};
  const byId = new Map<string, { id: string; name?: string; surface: 'light' | 'dark' | 'any'; mono: boolean; tags: string[]; tokenPaths: string[]; description?: string }>();
  for (const a of assets) {
    const tags = tagsOf(a);
    if (!tags.includes('logo')) continue;
    byId.set(a.id, { id: a.id, ...(a.name ? { name: a.name } : {}), surface: surfaceFromTags(tags), mono: tags.includes('mono'), tags, tokenPaths: [], ...(a.description ? { description: a.description } : {}) });
  }
  for (const t of tokenLogos) {
    const hit = byId.get(t.id) ?? { id: t.id, surface: 'any' as const, mono: false, tags: [], tokenPaths: [] };
    hit.tokenPaths.push(t.path);
    byId.set(t.id, hit);
  }
  const surfaceRules = rules.filter((r) => r.kind === 'logo-surface')
    .map((r) => ({ ruleId: r.id, label: r.label, requirement: r.requirement, parameters: r.parameters }));
  return {
    ...(logos.onLight ? { onLight: logos.onLight } : {}), ...(logos.onDark ? { onDark: logos.onDark } : {}),
    ...(logos.monoOnLight ? { monoOnLight: logos.monoOnLight } : {}), ...(logos.monoOnDark ? { monoOnDark: logos.monoOnDark } : {}),
    from: 'The on-light and on-dark choices are the slide master\'s, picked by its logo asset tags and then put in the order a logo-surface house rule states, when there is one: the brand\'s own statement wins.',
    autoForm: '<id>?theme=auto',
    autoNote: 'Write any family member as <id>?theme=auto and the mark follows the surface under it in every theme: the logo-surface rule\'s first mark with the same orientation for light, dark or photography, else the reverse treatment on dark. A mono mark asks for a mono mark first, so write the colour mark (the light-surface one) to get the brand\'s first choice on every surface.',
    variants: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)),
    rules: surfaceRules,
  };
}

function iconSection(doc: unknown, catalog: DesignBriefCatalogV1, assets: DesignBriefAssetV1[], themes: Array<{ name: string; semantic: Record<string, string> }>) {
  const icons = assets.filter((a) => tagsOf(a).includes('icon'))
    .map((a) => ({ id: a.id, ...(a.name ? { name: a.name } : {}), themable: tagsOf(a).includes('themable') }));
  const declared = parseIconThemesDoc(record(catalog.iconThemes) ? catalog.iconThemes : null);
  let from: Coverage = declared.length ? 'declared' : 'unavailable';
  let list = declared as Array<Record<string, unknown> & { id: string; c1: string; c2: string; previewBg?: string }>;
  if (!list.length) {
    try {
      const derived = deriveIconThemesDoc(doc).themes;
      if (derived.length) { list = derived as typeof list; from = 'derived'; }
    } catch { /* a token document the deriver cannot read leaves the themes empty */ }
  }
  const light = hexOf(themes.find((t) => !/dark/i.test(t.name))?.semantic.surface) ?? '#ffffff';
  const dark = hexOf(themes.find((t) => /dark/i.test(t.name))?.semantic.surface) ?? '#000000';
  return {
    count: icons.length,
    idForm: '<id>?theme=<themeId>',
    autoForm: '<id>?theme=auto',
    autoNote: 'An icon written as <id>?theme=auto takes the first theme whose surfaces include the surface under it; a photograph counts as dark.',
    themesFrom: from,
    surfaceTest: { light, dark, note: 'Without a declared list: light when the base colour (c2) reaches 3:1 on the light surface, dark when the accent (c1) reaches 3:1 on the dark surface.' },
    themes: list.map((t) => {
      // The same test the runtime's `?theme=auto` pick reads (surface-variant.ts).
      const { surfaces, from: surfacesFrom } = iconThemeSurfaces(t, { light, dark });
      return {
        id: t.id, ...(typeof t.label === 'string' ? { label: t.label } : {}), c1: t.c1, c2: t.c2,
        ...(t.previewBg ? { previewBg: t.previewBg } : {}),
        surfaces, surfacesFrom,
      };
    }),
    ids: icons,
  };
}

const MEDIA_TYPES = new Set(['raster', 'vector', 'lut', 'lottie']);

function mediaSection(doc: unknown, catalog: DesignBriefCatalogV1, assets: DesignBriefAssetV1[]) {
  const families = new Map<string, { type: string[]; ids: string[]; licenses: string[] }>();
  for (const a of assets) {
    const tags = tagsOf(a);
    if (!MEDIA_TYPES.has(String(a.type)) || tags.includes('logo') || tags.includes('icon')) continue;
    const family = a.id.split('/')[1] ?? a.id;
    const f = families.get(family) ?? { type: [], ids: [], licenses: [] };
    if (a.type && !f.type.includes(a.type)) f.type.push(a.type);
    f.ids.push(a.id);
    if (a.license && !f.licenses.includes(a.license)) f.licenses.push(a.license);
    families.set(family, f);
  }
  const declared = parsePhotoTreatmentsDoc(record(catalog.photoTreatments) ? catalog.photoTreatments as { treatments?: unknown } : null);
  let from: Coverage = declared.length ? 'declared' : 'unavailable';
  let treatments: unknown[] = declared;
  if (!treatments.length) {
    try {
      const derived = derivePhotoTreatmentsDoc(doc).treatments;
      if (derived.length) { treatments = derived; from = 'derived'; }
    } catch { /* no treatments then */ }
  }
  return {
    idForm: '<id>?treatment=<treatmentId>',
    note: 'Ids are references, not a licence: check each family\'s licence before the media leaves the brand.',
    families: Object.fromEntries([...families].sort(([a], [b]) => a.localeCompare(b)).map(([name, f]) => [name, { type: f.type.join(', '), count: f.ids.length, licenses: f.licenses, ids: f.ids.sort() }])),
    treatmentsFrom: from,
    treatments,
  };
}

/** The brief for one token document plus the catalog facts of the pack it belongs to. */
export function designBrief(doc: unknown, catalog?: DesignBriefCatalogV1 | null, opts: DesignBriefOpts = {}) {
  const context = brandContext(doc, opts);
  const facts: DesignBriefCatalogV1 = catalog ?? {};
  const assets = (Array.isArray(facts.assets) ? facts.assets : []).filter((a) => record(a) && typeof a.id === 'string' && a.deprecated !== true);
  const tokens = createTokenSet(doc, { theme: opts.theme });
  const resolve = (path: string): string | undefined => {
    const v = tokens.resolve(path);
    return typeof v === 'string' && !v.startsWith('{') ? (hexOf(v) ?? v) : undefined;
  };
  const themes = themeSection(doc);
  const combinations = combinationSection(doc, opts.theme, themes);
  const masterDeclared = facts.master ?? null;
  const master = masterDeclared ?? neutralSlideMaster();
  const houseRules = designHouseRules(brandSystemOf(doc)?.rules);
  const icons = iconSection(doc, facts, assets, themes);
  const media = mediaSection(doc, facts, assets);
  const logos = logoSection(facts, assets, context.assets.filter((a) => a.path.startsWith('asset.logo')), houseRules);
  const mediaCount = Object.values(media.families).reduce((n, f) => n + f.count, 0);
  const type = typeSection(master, context.fonts, houseRules);
  // The text styles a Design `$style` resolves to, at the master size, so an agent sizes
  // authored text from the same numbers the expansion writes.
  const styles = textStylesFromBrief({ type, themes, houseRules, theme: opts.theme ?? null }, { width: master.size.width, height: master.size.height });
  return {
    ...context,
    themes,
    combinations,
    type: { ...type, styles },
    logos,
    icons,
    media,
    master: masterSection(master, resolve, masterDeclared ? facts.masterAsset : undefined),
    houseRules,
    coverage: {
      ...context.coverage,
      themes: (themes.length ? 'declared' : 'unavailable') as Coverage,
      combinations: combinations.from,
      type: (masterDeclared ? 'declared' : 'neutral') as Coverage,
      logos: (logos.variants.length ? 'declared' : 'unavailable') as Coverage,
      icons: (icons.count ? 'declared' : 'unavailable') as Coverage,
      iconThemes: icons.themesFrom,
      media: (mediaCount ? 'declared' : 'unavailable') as Coverage,
      treatments: media.treatmentsFrom,
      master: (masterDeclared ? 'declared' : 'neutral') as Coverage,
      houseRules: (houseRules.length ? 'declared' : 'unavailable') as Coverage,
      houseRuleKinds: [...DESIGN_HOUSE_RULE_KINDS],
    },
  };
}

/** The type of the brief, for callers that store or forward one. */
export type DesignBriefV1 = ReturnType<typeof designBrief>;

/**
 * The catalog facts `checkBrandDesign` takes, from the same catalog a brief reads: every
 * asset id, and the theme and treatment ids the pack declares. A list the pack does not
 * declare is left out, so its modifiers are not judged.
 */
export function brandCheckCatalog(catalog?: DesignBriefCatalogV1 | null): BrandCheckCatalogOpts {
  if (!catalog) return {};
  const themes = parseIconThemesDoc(record(catalog.iconThemes) ? catalog.iconThemes : null).map((t) => t.id);
  const treatments = parsePhotoTreatmentsDoc(record(catalog.photoTreatments) ? catalog.photoTreatments as { treatments?: unknown } : null).map((t) => t.id);
  return {
    assets: (Array.isArray(catalog.assets) ? catalog.assets : []).filter((a) => record(a) && typeof a.id === 'string').map((a) => a.id),
    ...(themes.length ? { iconThemes: themes } : {}),
    ...(treatments.length ? { treatments } : {}),
  };
}
