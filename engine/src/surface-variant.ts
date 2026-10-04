// SPDX-License-Identifier: MPL-2.0
/**
 * Surface-aware logos and icons (plan 291 W4): one reference, `<id>?theme=auto`, that
 * takes the variant the surface under the layer asks for.
 *
 * A Design layer names any member of a logo family (`suse/logo/hor-pos-green?theme=auto`)
 * or a themable icon (`suse/icons/web?theme=auto`). The pass asks two questions:
 *
 *   1. What is under the layer? `surfaceUnderDesignLayer` replays the earlier layers of
 *      the same artboard in paint order (array order; `z` is depth, never stacking) and
 *      takes the topmost one that covers at least 90% of the layer, the share the house
 *      rules use. A picture is `photo`; a translucent colour or gradient over a picture
 *      (a scrim) is still `photo`; a colour is `light` or `dark` by the Rec.709 test of
 *      `logo-variant.ts`. The layer's own fill or gradient is the topmost surface. With
 *      nothing painted under the layer, the artboard's own fill answers, or, in a
 *      document with no frames, the canvas background.
 *   2. Which variant does the brand put there? `pickSurfaceVariant` reads a table built
 *      once from declared data only (`buildSurfaceVariantTable`):
 *        - the `logo-surface` house rule's ordered `light`, `dark` and `photo` lists, which
 *          state the brand's preference (SUSE: the negative white mark on dark and on
 *          photography). The first id with the layer's orientation wins; a mono mark asks
 *          for a mono mark first;
 *        - without that rule, the `asset.logo.<orientation>-<treatment>` tokens: a
 *          treatment flips to its reverse on dark and back on light;
 *        - without those, a `LogoSetV1` (the master's tags);
 *        - for icons, the first declared theme whose `surfaces` include the surface (a
 *          photograph counts as dark unless a theme names `photo`), else the contrast test
 *          the brief states: light where the base colour (c2) reaches 3:1 on the light
 *          surface, dark where the accent (c1) reaches 3:1 on the dark surface.
 *
 * The authored id stays the reference. The resolved asset keeps `?theme=auto` in its
 * `id`, and the pick rides in `meta.surfaceVariant = { id, surface }`, so a saved
 * document re-picks on every open and in every theme. Where nothing answers, the
 * base id is what renders: both bridges already serve plain base bytes for a theme
 * they do not know, which makes the authored id the cached value.
 *
 * `applySurfaceRuleToLogoSet` is the same table seen from a master: the logo set a
 * master's tags give, restated in the rule's order. Compose, `seedFrame`, the web's New
 * slide and check all read logos through it, so they agree with the runtime pick.
 *
 * Pure: no DOM, no clock, no network, no filesystem.
 */
import type { BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import type { SlideMasterV1 } from '@lolly-tools/core';
import type { TokenSet } from './bridge/host-v1.ts';
import { bgIsDark, contrastRatio, type LogoSetV1 } from './logo-variant.ts';
import { AUTO_ASSET_THEME, parseIconThemesDoc, parseThemedAssetId } from './icon-theme.ts';
import { parseColor, colorToSrgb8 } from './css-color.ts';
import { parseGradientSpec } from './gradient-spec.ts';
import { aliasPath, createTokenSet } from './tokens.ts';
import { TOKEN_EXT } from './token-ext.ts';

/** What a layer sits on, as far as a logo or icon variant is concerned. */
export type DesignSurfaceV1 = 'light' | 'dark' | 'photo';

/** The share of a layer an earlier layer must cover to count as its surface (the house rules' share). */
export const SURFACE_COVER_SHARE = 0.9;

/**
 * The Design canvas field map this pass reads: the `canvas` spec of a blocks input, the
 * one community/design/tool.json declares. Absent keys take Design's own names.
 */
export interface DesignCanvasFields {
  idField?: string;
  xField?: string;
  yField?: string;
  wField?: string;
  hField?: string;
  frameField?: string;
  hiddenField?: string;
  fillField?: string;
  gradField?: string;
  imageField?: string;
  opacityField?: string;
  frameKind?: string;
  /**
   * The canvas fill of a document with no frames (Design's `background` input, which
   * the renderer paints on the root artboard under every layer). A stored colour, an
   * alias or a token value; ignored once any frame row exists, because the root is
   * then a pasteboard that paints nothing.
   */
  background?: unknown;
  [key: string]: unknown;
}

/** A logo's place in its family, from the `asset.logo.<orientation>-<treatment>` tokens. */
export interface SurfaceLogoMemberV1 {
  /** Every orientation a token lists this id under (one file can serve two). */
  orientations: string[];
  /** The treatment, for example `primary`, `primary-reverse`, `mono`, `mono-reverse`. */
  treatments: string[];
}

/** The variant table, built once per token selection from declared data. */
export interface SurfaceVariantTableV1 {
  format: 'lolly-surface-variants';
  version: 1;
  /** False when the master states its logo does not vary by background: picks are skipped. */
  variesByBackground: boolean;
  logos: {
    /** Logo ids from the asset tokens. */
    members: Record<string, SurfaceLogoMemberV1>;
    /** The `logo-surface` rule's ordered lists, when the brand states one. */
    rule: { ruleId: string; light: string[]; dark: string[]; photo: string[] } | null;
    /** A master's logo set (its tags resolved), the last fallback. */
    set: LogoSetV1<string> | null;
  };
  icons: {
    /** The icon theme per surface, or null when none reads there. */
    light: string | null;
    dark: string | null;
    photo: string | null;
    /** Where the answer came from. */
    from: 'declared' | 'contrast' | 'none';
  };
}

export interface SurfaceVariantTableInputV1 {
  /** The token set of the active theme (asset.logo tokens). */
  tokens: TokenSet | null;
  /** The brand system's rules; the first `logo-surface` rule with lists is used. */
  rules?: readonly BrandRuleV1[] | null;
  /** An icon-themes palette document (`{ themes }`), declared or derived. */
  iconThemes?: unknown;
  /** The slide master, when there is one: `logo.variantByBackground: false` turns picks off. */
  master?: SlideMasterV1 | null;
  /** A logo set from the master's tags, the last logo fallback. */
  logos?: LogoSetV1<string> | null;
  /** The light and dark semantic surfaces, for the icon contrast test. */
  surfaceColours?: { light?: string | null; dark?: string | null } | null;
}

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length > 0) : [];
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};
const LOGO_TOKEN_PREFIX = 'asset.logo.';
const REVERSE = '-reverse';
const isMonoTreatment = (t: string): boolean => t === 'mono' || t.startsWith('mono-');
const isReverseTreatment = (t: string): boolean => t.endsWith(REVERSE) || t === 'reverse';

/** The id an image field holds: a string, or an asset ref's `id`. */
export function designImageId(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (record(value) && typeof value.id === 'string') return value.id || null;
  return null;
}

/** Is this image id a surface-aware reference (`<id>?theme=auto`)? */
export function isSurfaceAutoId(id: unknown): id is string {
  return typeof id === 'string' && parseThemedAssetId(id).theme === AUTO_ASSET_THEME;
}

/** `<base>?theme=auto` for a catalog id; a URL, a modified id or an empty value is returned as it is. */
export function surfaceAutoId(id: string): string {
  if (!id || id.includes('://') || id.includes('?') || id.startsWith('data:') || id.startsWith('blob:')) return id;
  return `${id}?theme=${AUTO_ASSET_THEME}`;
}

// ── colours ──────────────────────────────────────────────────────────────────

const BRAND_TOKEN_VAR = /^var\(\s*--brand-token-([0-9a-f]+)\s*(?:,\s*([\s\S]*))?\)$/i;
const BRAND_SLOT_VAR = /^var\(\s*--brand-([a-z][a-z-]*)\s*(?:,\s*([\s\S]*))?\)$/i;

function decodeUtf8Hex(hex: string): string | null {
  if (hex.length % 2 || hex.length > 2048) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
}

/**
 * A colour reader for the surface test over a token set: a literal CSS colour, a
 * `{path}` alias, `var(--brand-token-<utf8 hex of the path>, <cached>)` (the form the
 * web colour field writes) and `var(--brand-<slot>, <fallback>)` (the semantic slot
 * vars, `--brand-surface` and the rest) all read as the colour they paint. The value
 * comes back as a CSS colour string, or null when it cannot be told.
 */
export function surfaceColourResolver(set: TokenSet | null | undefined): (value: unknown) => string | null {
  const viaToken = (path: string): string | null => {
    if (!set) return null;
    try {
      const v = set.resolve(path);
      return typeof v === 'string' && v && !v.startsWith('{') ? v : null;
    } catch { return null; }
  };
  const read = (value: unknown, depth: number): string | null => {
    if (depth > 4) return null;
    const raw = typeof value === 'string' ? value.trim()
      : record(value) && typeof value.value === 'string' ? value.value.trim()
        : record(value) && typeof value.ref === 'string' ? value.ref.trim() : '';
    if (!raw) return null;
    const path = aliasPath(raw);
    if (path) return viaToken(path);
    const tokenVar = BRAND_TOKEN_VAR.exec(raw);
    if (tokenVar) {
      const decoded = decodeUtf8Hex(tokenVar[1]!);
      return (decoded ? viaToken(decoded) : null) ?? (tokenVar[2] ? read(tokenVar[2], depth + 1) : null);
    }
    const slotVar = BRAND_SLOT_VAR.exec(raw);
    if (slotVar) return viaToken(`color.semantic.${slotVar[1]!.toLowerCase()}`) ?? (slotVar[2] ? read(slotVar[2], depth + 1) : null);
    return raw;
  };
  return (value) => read(value, 0);
}

/** sRGB bytes and alpha of a CSS colour; null when unreadable. Fully transparent reads alpha 0. */
function rgba(css: string | null): [number, number, number, number] | null {
  if (!css) return null;
  const c = parseColor(css);
  return c ? colorToSrgb8(c) : null;
}

// ── the surface under a layer ────────────────────────────────────────────────

type Under = { kind: 'photo' } | { kind: 'colour'; rgb: [number, number, number] };

interface Fields {
  id: string; x: string; y: string; w: string; h: string; frame: string; hidden: string;
  fill: string; grad: string; image: string; opacity: string; frameKind: string;
}

function fieldsOf(canvas: DesignCanvasFields | null | undefined): Fields {
  const f = canvas ?? {};
  const s = (v: unknown, d: string): string => (typeof v === 'string' && v ? v : d);
  return {
    id: s(f.idField, 'id'), x: s(f.xField, 'x'), y: s(f.yField, 'y'), w: s(f.wField, 'w'), h: s(f.hField, 'h'),
    frame: s(f.frameField, 'frame'), hidden: s(f.hiddenField, 'hidden'), fill: s(f.fillField, 'bg'),
    grad: s(f.gradField, 'grad'), image: s(f.imageField, 'image'), opacity: s(f.opacityField, 'opacity'),
    frameKind: s(f.frameKind, 'frame'),
  };
}

const isFrame = (row: Row, f: Fields): boolean => row.kind === f.frameKind;
const hidden = (row: Row, f: Fields): boolean => row[f.hidden] === true || row[f.hidden] === 'true';
function boardOf(row: Row, f: Fields): string | undefined {
  const frame = row[f.frame];
  if (typeof frame === 'string' && frame) return frame;
  const id = row[f.id];
  return isFrame(row, f) && typeof id === 'string' ? id : undefined;
}

function coverShare(over: Row, row: Row, f: Fields): number {
  const [x, y, w, h] = [num(row[f.x], 0), num(row[f.y], 0), num(row[f.w], 0), num(row[f.h], 0)];
  const [ox, oy, ow, oh] = [num(over[f.x], 0), num(over[f.y], 0), num(over[f.w], 0), num(over[f.h], 0)];
  const iw = Math.min(x + w, ox + ow) - Math.max(x, ox);
  const ih = Math.min(y + h, oy + oh) - Math.max(y, oy);
  if (iw <= 0 || ih <= 0) return 0;
  return (iw * ih) / Math.max(1, w * h);
}

/**
 * A layer's paints, top first: its gradient over its fill (Design paints the fill under a
 * gradient). `own` reads the layer a mark sits in: its picture is the mark itself, so
 * only the layer's fill and gradient count.
 */
function paintsOf(row: Row, f: Fields, resolveColour: (value: unknown) => string | null, own = false): Array<{ kind: 'image' } | { kind: 'colour'; rgb: [number, number, number]; alpha: number } | { kind: 'unknown' }> {
  const out: Array<{ kind: 'image' } | { kind: 'colour'; rgb: [number, number, number]; alpha: number } | { kind: 'unknown' }> = [];
  // Design's opacity runs 0 to 100, read the way the renderer reads it (boxCss).
  const opacity = Math.max(0, Math.min(100, num(row[f.opacity], 100))) / 100;
  if (opacity <= 0) return out;
  const image = designImageId(row[f.image]);
  if (!own && (row.kind === 'image' || image)) {
    // A picture paints opaque as far as a mark on it is concerned, even when faded.
    out.push({ kind: 'image' });
    return out;
  }
  const grad = typeof row[f.grad] === 'string' ? (row[f.grad] as string).trim() : '';
  if (grad) {
    const spec = parseGradientSpec(grad);
    if (!spec?.stops.length) out.push({ kind: 'unknown' });
    else {
      let r = 0; let g = 0; let b = 0; let a = 0; let n = 0;
      let readable = true;
      for (const stop of spec.stops) {
        const colour = resolveColour(stop.color);
        const c = colour ? parseColor(colour) : null;
        if (!c) { readable = false; break; }
        const [cr, cg, cb] = colorToSrgb8(c);
        r += cr; g += cg; b += cb; a += Math.max(0, Math.min(1, c.alpha)); n++;
      }
      if (!readable || !n) out.push({ kind: 'unknown' });
      else out.push({ kind: 'colour', rgb: [r / n, g / n, b / n], alpha: (a / n) * opacity });
    }
  }
  const fillRaw = row[f.fill];
  const fillText = typeof fillRaw === 'string' ? fillRaw.trim()
    : record(fillRaw) && typeof fillRaw.value === 'string' ? fillRaw.value.trim()
      : record(fillRaw) && typeof fillRaw.ref === 'string' ? fillRaw.ref.trim() : '';
  if (fillText && fillText !== 'transparent' && fillText !== 'none') {
    const c = rgba(resolveColour(fillRaw));
    if (!c) out.push({ kind: 'unknown' });
    else if (c[3] > 0) out.push({ kind: 'colour', rgb: [c[0], c[1], c[2]], alpha: c[3] * opacity });
  }
  return out;
}

function blend(top: [number, number, number], alpha: number, under: [number, number, number]): [number, number, number] {
  return [top[0] * alpha + under[0] * (1 - alpha), top[1] * alpha + under[1] * (1 - alpha), top[2] * alpha + under[2] * (1 - alpha)];
}

/**
 * What a layer sits on: `photo`, `dark`, `light`, or null when that cannot be told.
 *
 * The topmost earlier row of the same artboard that covers 90% or more of the layer
 * answers (frames and path rows are skipped: a path's box is not its fill); a hidden
 * or fully transparent row is looked through. A picture is a photograph. A translucent
 * colour or gradient is composited over what is under it, and over a picture it is
 * still a photograph (a scrim). The layer's own fill and gradient (not its picture)
 * paint directly behind the mark, so they come first. The artboard's own fill, gradient
 * or picture answers when nothing covers the layer, and a document with no frames sits
 * on `canvas.background`. Opacity is Design's 0 to 100. `resolveColour` turns a stored
 * colour into a CSS colour (`surfaceColourResolver` reads token references).
 */
export function surfaceUnderDesignLayer(
  rows: readonly Record<string, unknown>[],
  index: number,
  canvas: DesignCanvasFields,
  resolveColour: (value: unknown) => string | null,
): DesignSurfaceV1 | null {
  const f = fieldsOf(canvas);
  const row = rows[index];
  if (!record(row)) return null;
  const board = boardOf(row, f);
  let frameRow: Row | undefined;
  if (board && !isFrame(row, f)) frameRow = rows.find((r) => record(r) && isFrame(r, f) && r[f.id] === board) as Row | undefined;

  // Rows under the layer, top first, then the frame.
  const stack: Row[] = [];
  for (let i = Math.min(index, rows.length) - 1; i >= 0; i--) {
    const under = rows[i];
    if (!record(under) || hidden(under, f) || isFrame(under, f) || under.kind === 'path' || boardOf(under, f) !== board) continue;
    if (coverShare(under, row, f) < SURFACE_COVER_SHARE) continue;
    stack.push(under);
  }
  if (frameRow && !hidden(frameRow, f)) stack.push(frameRow);

  // The layer's own fill and gradient paint directly behind its picture (boxCss), so
  // they are the topmost surface. A path's fill paints its curve, never a box under the mark.
  const own = isFrame(row, f) || row.kind === 'path' ? [] : paintsOf(row, f, resolveColour, true);
  const paints = [...own, ...stack.flatMap((r) => paintsOf(r, f, resolveColour))];
  // A document with no frames paints its canvas background under every layer.
  if (canvas?.background !== undefined && canvas.background !== null && canvas.background !== ''
    && !rows.some((r) => record(r) && isFrame(r, f))) {
    paints.push(...paintsOf({ [f.fill]: canvas.background }, f, resolveColour));
  }
  const resolveFrom = (at: number): Under | null => {
    for (let i = at; i < paints.length; i++) {
      const p = paints[i]!;
      if (p.kind === 'image') return { kind: 'photo' };
      if (p.kind === 'unknown') return null;
      if (p.alpha >= 1) return { kind: 'colour', rgb: p.rgb };
      if (p.alpha <= 0) continue;
      const below = resolveFrom(i + 1);
      if (!below) return p.alpha >= 0.5 ? { kind: 'colour', rgb: p.rgb } : null;
      if (below.kind === 'photo') return below;
      return { kind: 'colour', rgb: blend(p.rgb, p.alpha, below.rgb) };
    }
    return null;
  };
  const under = resolveFrom(0);
  if (!under) return null;
  if (under.kind === 'photo') return 'photo';
  const hex = '#' + under.rgb.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
  return bgIsDark(hex) ? 'dark' : 'light';
}

// ── the variant table ────────────────────────────────────────────────────────

/** The first `logo-surface` rule with readable lists, from a brand system's rules. */
function logoSurfaceRule(rules: readonly BrandRuleV1[] | null | undefined): SurfaceVariantTableV1['logos']['rule'] {
  for (const rule of rules ?? []) {
    if (!record(rule) || rule.kind !== 'logo-surface' || !record(rule.parameters)) continue;
    if (record(rule.scope) && Array.isArray(rule.scope.tools) && !rule.scope.tools.includes('design')) continue;
    const light = strings(rule.parameters.light);
    const dark = strings(rule.parameters.dark);
    const photo = strings(rule.parameters.photo);
    if (!light.length && !dark.length && !photo.length) continue;
    return { ruleId: typeof rule.id === 'string' ? rule.id : 'logo-surface', light, dark, photo: photo.length ? photo : dark };
  }
  return null;
}

/**
 * The brand-system rules of a token document, read without validating the rest of
 * the brand system: only the `logo-surface` records matter here, and a brand system
 * that fails another check must not lose its logo order.
 */
export function brandRulesOfTokenDocument(doc: unknown): BrandRuleV1[] {
  if (!record(doc) || !record(doc.$extensions)) return [];
  const vendor = doc.$extensions[TOKEN_EXT];
  if (!record(vendor) || !record(vendor.brandSystem) || !Array.isArray(vendor.brandSystem.rules)) return [];
  return vendor.brandSystem.rules.filter((r): r is BrandRuleV1 => record(r) && typeof r.id === 'string' && typeof r.kind === 'string');
}

/**
 * The light and dark semantic surfaces of a token document, for the icon contrast
 * test: the first theme whose name does not read as dark, and the first that does.
 */
export function themeSurfaceColours(doc: unknown): { light: string | null; dark: string | null } {
  const out: { light: string | null; dark: string | null } = { light: null, dark: null };
  if (!record(doc)) return out;
  let names: string[] = [];
  try { names = createTokenSet(doc).themes().map((t) => t.name); } catch { return out; }
  const read = (theme: string | undefined): string | null => {
    try {
      const v = createTokenSet(doc, theme ? { theme } : {}).resolve('color.semantic.surface');
      return typeof v === 'string' && v && !v.startsWith('{') ? v : null;
    } catch { return null; }
  };
  const lightName = names.find((n) => !/dark/i.test(n));
  const darkName = names.find((n) => /dark/i.test(n));
  out.light = read(lightName);
  out.dark = darkName ? read(darkName) : null;
  return out;
}

/**
 * The surfaces an icon theme reads on: the theme's own `surfaces` when it declares
 * them, else the brief's contrast test (light where c2 reaches 3:1 on the light
 * surface, dark where c1 reaches 3:1 on the dark one). White and black stand in for
 * a surface the design system does not state.
 */
export function iconThemeSurfaces(theme: { c1?: unknown; c2?: unknown; surfaces?: unknown }, colours?: { light?: string | null; dark?: string | null } | null): { surfaces: string[]; from: 'declared' | 'contrast' } {
  const stated = Array.isArray(theme.surfaces) ? theme.surfaces.filter((s): s is string => typeof s === 'string') : null;
  if (stated) return { surfaces: stated, from: 'declared' };
  const light = colours?.light ?? '#ffffff';
  const dark = colours?.dark ?? '#000000';
  return {
    surfaces: [
      ...(contrastRatio(String(theme.c2), light) >= 3 ? ['light'] : []),
      ...(contrastRatio(String(theme.c1), dark) >= 3 ? ['dark'] : []),
    ],
    from: 'contrast',
  };
}

/** Build the variant table from declared data. Nothing here reads a brand by name. */
export function buildSurfaceVariantTable(input: SurfaceVariantTableInputV1): SurfaceVariantTableV1 {
  const members: Record<string, SurfaceLogoMemberV1> = {};
  let entries: Array<{ path: string; value: unknown }> = [];
  try { entries = input.tokens?.query({ type: 'asset' }) ?? []; } catch { entries = []; }
  for (const entry of entries) {
    if (typeof entry.path !== 'string' || !entry.path.startsWith(LOGO_TOKEN_PREFIX) || typeof entry.value !== 'string' || !entry.value) continue;
    const leaf = entry.path.slice(LOGO_TOKEN_PREFIX.length);
    const dash = leaf.indexOf('-');
    if (dash <= 0) continue;
    const orientation = leaf.slice(0, dash);
    const treatment = leaf.slice(dash + 1);
    if (!Object.hasOwn(members, entry.value)) members[entry.value] = { orientations: [], treatments: [] };
    const m = members[entry.value]!;
    if (!m.orientations.includes(orientation)) m.orientations.push(orientation);
    if (!m.treatments.includes(treatment)) m.treatments.push(treatment);
  }

  const declared = parseIconThemesDoc(record(input.iconThemes) ? input.iconThemes as { themes?: unknown } : null) as Array<{ id: string; c1: string; c2: string; surfaces?: unknown }>;
  const icons: SurfaceVariantTableV1['icons'] = { light: null, dark: null, photo: null, from: 'none' };
  if (declared.length) {
    const read = declared.map((t) => ({ id: t.id, ...iconThemeSurfaces(t, input.surfaceColours) }));
    const first = (surface: string): string | null => read.find((t) => t.surfaces.includes(surface))?.id ?? null;
    icons.light = first('light');
    icons.dark = first('dark');
    icons.photo = first('photo') ?? icons.dark;
    icons.from = read.some((t) => t.from === 'declared') ? 'declared' : 'contrast';
  }

  return {
    format: 'lolly-surface-variants',
    version: 1,
    variesByBackground: input.master?.logo?.variantByBackground !== false,
    logos: { members, rule: logoSurfaceRule(input.rules), set: input.logos ? { ...input.logos } : null },
    icons,
  };
}

// ── picking ──────────────────────────────────────────────────────────────────

function setSides(set: LogoSetV1<string> | null): Map<string, { side: 'light' | 'dark'; mono: boolean }> {
  const out = new Map<string, { side: 'light' | 'dark'; mono: boolean }>();
  if (!set) return out;
  if (set.onLight) out.set(set.onLight, { side: 'light', mono: false });
  if (set.onDark) out.set(set.onDark, { side: 'dark', mono: false });
  if (set.monoOnLight) out.set(set.monoOnLight, { side: 'light', mono: true });
  if (set.monoOnDark) out.set(set.monoOnDark, { side: 'dark', mono: true });
  return out;
}

function isLogo(base: string, table: SurfaceVariantTableV1): boolean {
  const { members, rule, set } = table.logos;
  if (Object.hasOwn(members, base)) return true;
  if (rule && (rule.light.includes(base) || rule.dark.includes(base) || rule.photo.includes(base))) return true;
  return setSides(set).has(base);
}

function isMonoLogo(id: string, table: SurfaceVariantTableV1): boolean {
  const m = Object.hasOwn(table.logos.members, id) ? table.logos.members[id] : undefined;
  if (m?.treatments.length) return m.treatments.some(isMonoTreatment);
  return setSides(table.logos.set).get(id)?.mono === true;
}

function sameOrientation(a: string, b: string, table: SurfaceVariantTableV1): boolean {
  const ma = Object.hasOwn(table.logos.members, a) ? table.logos.members[a]!.orientations : [];
  const mb = Object.hasOwn(table.logos.members, b) ? table.logos.members[b]!.orientations : [];
  if (!ma.length || !mb.length) return true;
  return ma.some((o) => mb.includes(o));
}

/** The family member with the base's orientation and the treatment flipped to the surface's side. */
function flipped(base: string, dark: boolean, table: SurfaceVariantTableV1): string | null {
  const m = Object.hasOwn(table.logos.members, base) ? table.logos.members[base] : undefined;
  if (!m) return null;
  const treatment = m.treatments[0]!;
  const reverse = isReverseTreatment(treatment);
  if (reverse === dark) return base;
  const root = treatment === 'reverse' ? 'primary' : reverse ? treatment.slice(0, -REVERSE.length) : treatment;
  const wanted = dark ? `${root}${REVERSE}` : root;
  for (const [id, other] of Object.entries(table.logos.members)) {
    if (other.treatments.includes(wanted) && other.orientations.some((o) => m.orientations.includes(o))) return id;
  }
  return null;
}

function pickLogo(base: string, surface: DesignSurfaceV1, table: SurfaceVariantTableV1): string | null {
  const { rule, set } = table.logos;
  const mono = isMonoLogo(base, table);
  if (rule) {
    const list = surface === 'photo' ? rule.photo : surface === 'dark' ? rule.dark : rule.light;
    if (list.length) {
      const oriented = list.filter((id) => sameOrientation(id, base, table));
      if (mono) {
        const monoHit = oriented.find((id) => isMonoLogo(id, table));
        if (monoHit) return monoHit;
      }
      if (oriented.length) return oriented[0]!;
    }
  }
  const dark = surface !== 'light';
  const flip = flipped(base, dark, table);
  if (flip) return flip;
  if (set) {
    const sides = setSides(set);
    const wantMono = sides.get(base)?.mono ?? mono;
    const order = dark
      ? (wantMono ? [set.monoOnDark, set.onDark] : [set.onDark, set.monoOnDark])
      : (wantMono ? [set.monoOnLight, set.onLight] : [set.onLight, set.monoOnLight]);
    const hit = order.find((v): v is string => typeof v === 'string' && v.length > 0);
    if (hit) return hit;
  }
  return null;
}

/**
 * The concrete id for `baseId` (with or without `?theme=auto`) on `surface`, or null
 * when the table has no answer (the caller then keeps the base id). A logo family
 * member gets a sibling mark; anything else is treated as a themable icon and gets
 * `<base>?theme=<theme>`.
 */
export function pickSurfaceVariant(baseId: string, surface: DesignSurfaceV1, table: SurfaceVariantTableV1): string | null {
  if (typeof baseId !== 'string' || !baseId) return null;
  const parsed = parseThemedAssetId(baseId);
  const base = parsed.theme === AUTO_ASSET_THEME ? parsed.baseId : baseId;
  if (base.includes('?') || base.includes('://')) return null;
  if (isLogo(base, table)) {
    if (!table.variesByBackground) return base;
    return pickLogo(base, surface, table);
  }
  const theme = table.icons[surface];
  return theme ? `${base}?theme=${theme}` : null;
}

/**
 * A master's logo set restated in the brand's own order: each side takes the first
 * mark the `logo-surface` rule lists for it with the same orientation (a mono slot
 * asks for a mono mark first). A slot the rule cannot answer keeps its own mark, and
 * without a rule the set is returned as it is. This is how compose, `seedFrame` and
 * the web's New slide come to put the mark on dark that the runtime picks there.
 */
export function applySurfaceRuleToLogoSet(logos: LogoSetV1<string>, table: SurfaceVariantTableV1): LogoSetV1<string> {
  const rule = table.logos.rule;
  if (!rule) return { ...logos };
  const out: LogoSetV1<string> = { ...logos };
  const restate = (slot: keyof LogoSetV1<string>, surface: DesignSurfaceV1, mono: boolean): void => {
    const current = logos[slot];
    const reference = current ?? logos.onLight ?? logos.onDark ?? logos.monoOnLight ?? logos.monoOnDark;
    if (!reference) return;
    const list = surface === 'dark' ? rule.dark : rule.light;
    const oriented = list.filter((id) => sameOrientation(id, reference, table));
    const hit = mono ? oriented.find((id) => isMonoLogo(id, table)) : oriented[0];
    if (hit && (current !== undefined || !mono)) out[slot] = hit;
  };
  restate('onLight', 'light', false);
  restate('onDark', 'dark', false);
  restate('monoOnLight', 'light', true);
  restate('monoOnDark', 'dark', true);
  return out;
}

/**
 * `applySurfaceRuleToLogoSet` over a token document: its asset tokens and its brand
 * system's `logo-surface` rule. The one call the Node and web logo readers make, so
 * both surfaces restate the master's logos the same way (E18).
 */
export function logoSetInBrandOrder(logos: LogoSetV1<string>, doc: unknown): LogoSetV1<string> {
  if (!record(doc)) return { ...logos };
  let tokens: TokenSet | null = null;
  try { tokens = createTokenSet(doc); } catch { tokens = null; }
  return applySurfaceRuleToLogoSet(logos, buildSurfaceVariantTable({ tokens, rules: brandRulesOfTokenDocument(doc) }));
}

/** One pick of the runtime pass: the row, the authored id, what is under it and what it takes. */
export interface SurfacePickV1 {
  index: number;
  authored: string;
  surface: DesignSurfaceV1 | null;
  /** The concrete id to resolve, or null to keep the authored base. */
  id: string | null;
}

/** Every `?theme=auto` image of a Design rows list, with its surface and pick. */
export function planSurfaceVariants(
  rows: readonly Record<string, unknown>[],
  canvas: DesignCanvasFields,
  table: SurfaceVariantTableV1,
  resolveColour: (value: unknown) => string | null,
): SurfacePickV1[] {
  const f = fieldsOf(canvas);
  const out: SurfacePickV1[] = [];
  rows.forEach((row, index) => {
    if (!record(row)) return;
    const authored = designImageId(row[f.image]);
    if (!isSurfaceAutoId(authored)) return;
    const surface = surfaceUnderDesignLayer(rows, index, canvas, resolveColour);
    out.push({ index, authored, surface, id: surface ? pickSurfaceVariant(authored, surface, table) : null });
  });
  return out;
}
