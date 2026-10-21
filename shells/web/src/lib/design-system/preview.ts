// SPDX-License-Identifier: MPL-2.0
/**
 * A design system at a glance, read from its own head document: the light and
 * dark looks a cover is painted in, how many colours it has, its typefaces,
 * colourways and logo files. Every surface that shows a system small reads it
 * here (the Settings strip, the Preferences rows and the Design system tab's
 * cover), so no two of them count the same system differently.
 *
 * Everything is pure except readDesignSystemPreview and logoUrlsFor, which read
 * the host. No stylesheet is imported, so the node tests load this directly.
 *
 * Imported documents are untrusted. Every colour that leaves this module has
 * been through tokenValueToHex, so a value that later goes into a style
 * attribute is always a plain `#rrggbb`; a font stack has been through
 * brandFontStack; text is returned as text for the caller to escape.
 */
import { createTokenSet, hexToOklch } from '@lolly/engine';
import type { HostV1, TokenSet } from '@lolly-tools/core/host-v1';
import type { PaletteEntry } from '../../palette.ts';
import { toPaletteEntry } from '../live-palette.ts';
import { isTransparent, splitPalette } from '../swatches.ts';
import { getExcludedSwatches } from '../brand-exclusions.ts';
import { logoTokensOf } from '../brand-logos.ts';
import { brandFontStack, swatchInk, tokenValueToHex, SWATCH_INK } from '../../brand-vars.ts';
import { logoRefsForTheme } from '../../theme.ts';
import { leadModes, listLeads } from './leads.ts';
import { fontRoleFamily } from './ownership.ts';
import type { BrandPreview } from './brand-specimen.ts';
import type { DesignSystemRecord } from './registry.ts';

/** One look of a system. Every value is a `#rrggbb` from tokenValueToHex. */
export interface CoverLook { surface: string; ink: string; primary: string; onPrimary: string; secondary: string }
/** The looks a cover can be painted in. `dark` is absent when the doc has no dark mode. */
export interface CoverLooks { light: CoverLook; dark?: CoverLook }

export interface DesignSystemPreview extends BrandPreview {
  label: string;
  /** The first grapheme of the label, for a cover with no logo. */
  monogram: string;
  looks: CoverLooks;
  /** Asset URLs per app theme, the horizontal form first. */
  logos: { light?: string; dark?: string; brand?: string };
  /** The display stack (font.display, else font.brand), safe for a style value. */
  display: string;
  /** Distinct family names in role order: display, brand, italic, mono. */
  families: string[];
  /** How many colourways the system has. */
  colourways: number;
  /** Distinct logo files across every logo slot. */
  logoCount: number;
}

/** One font role, as the readers show the role. */
export interface FontRoleRead {
  role: 'display' | 'brand' | 'italic' | 'mono';
  family: string;
  /** Display or italic with no face of its own, so it takes the text face. */
  follows: boolean;
  /** The `font.<role>` token's own description, or ''. */
  note: string;
}

/** The host slice a preview reads. The Preferences card's host has this shape. */
export interface PreviewHost {
  assets: Pick<HostV1['assets'], 'get'> & { _getBlob(id: string, opts?: { fetchIfMissing?: boolean }): Promise<Blob | null> };
  designSystems: { activeId(): Promise<string> };
  tokens?: { raw?(): Promise<unknown> };
}

/** Head documents over this size are not parsed for a preview. */
export const PREVIEW_DOC_BYTES = 2 * 1024 * 1024;

/** The stack a preview falls back to: the shell's text face (brand-vars.ts FONT_SLOTS). */
const FALLBACK_STACK = "'SUSE', ui-sans-serif, system-ui, sans-serif";
/** The shell's own faces, which a doc with no font tokens is shown in (brand-vars.ts FONT_SLOTS). */
const SHELL_TEXT_FAMILY = 'SUSE';
const SHELL_MONO_FAMILY = 'SUSE Mono';

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A colour as a lower-case `#rrggbb`, or null when it is not one. */
const hexOf = (value: unknown): string | null => tokenValueToHex(value)?.toLowerCase() ?? null;

const distinct = <T>(list: readonly T[]): T[] => [...new Set(list)];

/** Distinct `#rrggbb` values of some palette entries, in order. */
const coreHexes = (core: readonly PaletteEntry[]): string[] => distinct(core.map(c => hexOf(c.hex)).filter((h): h is string => !!h));

/**
 * The doc's colours as palette entries, the same list `host.tokens.colors()`
 * gives for the active system: the default selection, without the swatches the
 * doc excludes (bridge/tokens.ts filters them the same way).
 */
export function docPalette(doc: unknown): PaletteEntry[] {
  if (!isRec(doc)) return [];
  const excluded = new Set(getExcludedSwatches(doc));
  return createTokenSet(doc).colors()
    .filter(c => !excluded.size || (!excluded.has(c.path) && !excluded.has(c.path.startsWith('color.') ? c.path : `color.${c.path}`)))
    .map(toPaletteEntry);
}

/** The colours a person put in, without the interface layers, the aliases and Transparent. */
export function coreColoursOf(entries: readonly PaletteEntry[]): PaletteEntry[] {
  return splitPalette(entries).core.filter(c => !isTransparent(c.hex));
}

/** How many colours a system has. The Settings tab and the Preferences row both count this way. */
export function colourCountOf(doc: unknown): number {
  return coreColoursOf(docPalette(doc)).length;
}

/** The colour with the highest (or, for a dark ground, the lowest) OKLCH lightness. */
function byLightness(hexes: readonly string[], highest: boolean): string | null {
  let best: string | null = null;
  let bestL = highest ? -Infinity : Infinity;
  for (const hex of hexes) {
    const l = hexToOklch(hex)?.l;
    if (l == null) continue;
    if (highest ? l > bestL : l < bestL) { best = hex; bestL = l; }
  }
  return best;
}

/** Fill a look's missing slots from its colours. `slots` holds what the doc declares. */
function completeLook(slots: Partial<CoverLook>, colours: readonly string[], mode: 'light' | 'dark'): CoverLook {
  const surface = slots.surface ?? byLightness(colours, mode === 'light') ?? (mode === 'light' ? SWATCH_INK.light : SWATCH_INK.dark);
  const ink = slots.ink ?? swatchInk(surface) ?? SWATCH_INK.dark;
  const primary = slots.primary ?? colours[0] ?? ink;
  const onPrimary = slots.onPrimary ?? swatchInk(primary) ?? SWATCH_INK.light;
  const secondary = slots.secondary ?? colours[1] ?? primary;
  return { surface, ink, primary, onPrimary, secondary };
}

/** Looks for a doc-less preview (the component library's demo rows): one light look from its colours. */
export function looksFromColours(colors: readonly string[]): CoverLooks {
  const hexes = distinct(colors.map(hexOf).filter((h): h is string => !!h));
  return { light: completeLook({}, hexes, 'light') };
}

/** The doc's mode id for `light` or `dark`, matched without regard to case. */
function modeIdOf(doc: unknown, mode: 'light' | 'dark'): string | undefined {
  return leadModes(doc).find(m => m.id.toLowerCase() === mode)?.id;
}

const tokenSetFor = (doc: unknown, theme: string | undefined): TokenSet => createTokenSet(doc, theme ? { theme } : {});

/**
 * The light and dark looks: each mode's semantic surface, text, primary,
 * on-primary and secondary slots. A slot the doc does not declare falls back
 * to its colours (the lightest for a light surface, the darkest for a dark one,
 * the first and second for primary and secondary) and to the swatch ink for
 * text. `dark` is left out when the doc declares no dark mode.
 */
export function looksOf(doc: unknown): CoverLooks {
  return looksWith(doc, coreHexes(coreColoursOf(docPalette(doc))));
}

function looksWith(doc: unknown, colours: readonly string[]): CoverLooks {
  const lookFor = (mode: 'light' | 'dark', theme: string | undefined): CoverLook => {
    const set = tokenSetFor(doc, theme);
    const slot = (role: string): string | undefined => hexOf(set.resolve(`color.semantic.${role}`)) ?? undefined;
    return completeLook({ surface: slot('surface'), ink: slot('text'), primary: slot('primary'), onPrimary: slot('on-primary'), secondary: slot('secondary') }, colours, mode);
  };
  const dark = modeIdOf(doc, 'dark');
  const looks: CoverLooks = { light: lookFor('light', modeIdOf(doc, 'light')) };
  if (dark) looks.dark = lookFor('dark', dark);
  return looks;
}

/**
 * The four font roles in reading order: Headings (display), Text (brand),
 * Emphasis (italic) and Code (mono). Display and italic with no face of their
 * own follow the text face; a doc with no text or mono face is shown in the
 * shell's own.
 */
export function fontRolesOf(doc: unknown): FontRoleRead[] {
  const notes = new Map<string, string>();
  for (const entry of createTokenSet(doc).query({ type: 'fontFamily' })) {
    if (typeof entry.description === 'string' && entry.description) notes.set(entry.path, entry.description);
  }
  const text = fontRoleFamily(doc, 'brand') || SHELL_TEXT_FAMILY;
  return (['display', 'brand', 'italic', 'mono'] as const).map(role => {
    const declared = fontRoleFamily(doc, role);
    const follows = !declared && (role === 'display' || role === 'italic');
    const family = declared || (role === 'mono' ? SHELL_MONO_FAMILY : text);
    return { role, family, follows, note: declared ? notes.get(`font.${role}`) ?? '' : '' };
  });
}

/** The first grapheme of a label, upper-cased when that keeps it one character. */
export function monogramOf(label: string): string {
  const text = label.trim();
  if (!text) return '';
  const first = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)][0]?.segment ?? ''
    : Array.from(text)[0] ?? '';
  const upper = first.toLocaleUpperCase();
  return Array.from(upper).length === Array.from(first).length ? upper : first;
}

/** Everything a preview shows that needs no host read. */
export function previewFromDoc(doc: unknown, label: string): Omit<DesignSystemPreview, 'logos' | 'logoUrl'> {
  const core = coreColoursOf(docPalette(doc));
  const hexes = coreHexes(core);
  const set = createTokenSet(doc);
  const font = brandFontStack(set.resolve('font.brand'), FALLBACK_STACK) ?? FALLBACK_STACK;
  const display = brandFontStack(set.resolve('font.display'), font) ?? font;
  return {
    label,
    monogram: monogramOf(label),
    font,
    display,
    colors: hexes.slice(0, 6),
    colorCount: core.length,
    looks: looksWith(doc, hexes),
    families: distinct(fontRolesOf(doc).map(f => f.family)),
    colourways: listLeads(doc).length,
    logoCount: new Set(logoTokensOf(doc).map(l => l.id)).size,
  };
}

/**
 * The logo for each app theme, as the asset URL the host gives for that file. Light
 * reads the primary form, dark the reverse then the primary, and brand the
 * on-brand form, then the reverse, then the primary (theme.ts logoRefsForTheme).
 * The horizontal forms are tried first and the vertical ones after them; the
 * first id the host has a URL for wins.
 */
export async function logoUrlsFor(host: { assets: Pick<HostV1['assets'], 'get'> }, doc: unknown): Promise<DesignSystemPreview['logos']> {
  const logos: DesignSystemPreview['logos'] = {};
  if (!logoTokensOf(doc).length) return logos;
  const urls = new Map<string, Promise<string | undefined>>();
  const urlOf = (id: string): Promise<string | undefined> => {
    let url = urls.get(id);
    if (!url) {
      url = host.assets.get(id).then(asset => (typeof asset?.url === 'string' && asset.url) || undefined, () => undefined);
      urls.set(id, url);
    }
    return url;
  };
  const sets = { light: tokenSetFor(doc, modeIdOf(doc, 'light')), dark: tokenSetFor(doc, modeIdOf(doc, 'dark')) };
  for (const look of ['light', 'dark', 'brand'] as const) {
    const set = look === 'dark' ? sets.dark : sets.light;
    for (const ref of [...logoRefsForTheme(look, 'horizontal'), ...logoRefsForTheme(look, 'vertical')]) {
      const id = set.resolve(ref);
      if (typeof id !== 'string' || !id || id.startsWith('{')) continue;
      const url = await urlOf(id);
      if (url) { logos[look] = url; break; }
    }
  }
  return logos;
}

/** The record's head document, or null. Only the active record falls back to the live tokens. */
async function headDocOf(host: PreviewHost, record: DesignSystemRecord): Promise<unknown> {
  let blob: Blob | null = null;
  try {
    blob = record.headId ? await host.assets._getBlob(record.headId, { fetchIfMissing: record.source.kind === 'shipped' }) : null;
  } catch { blob = null; }
  if (blob) return blob.size <= PREVIEW_DOC_BYTES ? JSON.parse(await blob.text()) as unknown : null;
  if ((await host.designSystems.activeId()) === record.id) return await host.tokens?.raw?.() ?? null;
  return null;
}

/**
 * A record's preview, read from its own head document. `cache` belongs to one
 * mount (keyed `${id}|${headId}`), never to the module: a head document can
 * change under the same id. A preview never rejects; a doc that cannot be read
 * gives a plain one in black and white.
 */
export function readDesignSystemPreview(host: PreviewHost, record: DesignSystemRecord, cache?: Map<string, Promise<DesignSystemPreview>>): Promise<DesignSystemPreview> {
  const key = `${record.id}|${record.headId}`;
  const hit = cache?.get(key);
  if (hit) return hit;
  const read = (async (): Promise<DesignSystemPreview> => {
    let doc: unknown = null;
    try { doc = await headDocOf(host, record); } catch { doc = null; }
    let base: Omit<DesignSystemPreview, 'logos' | 'logoUrl'>;
    try { base = previewFromDoc(doc, record.label); } catch { doc = null; base = previewFromDoc(null, record.label); }
    const logos: DesignSystemPreview['logos'] = doc ? await logoUrlsFor(host, doc).catch(() => ({})) : {};
    const logoUrl = logos.light ?? logos.dark ?? logos.brand;
    return { ...base, logos, ...(logoUrl ? { logoUrl } : {}) };
  })();
  cache?.set(key, read);
  return read;
}

/** The preview for one record, uncached. Kept for the card and its tests. */
export function previewOf(host: PreviewHost, record: DesignSystemRecord): Promise<DesignSystemPreview> {
  return readDesignSystemPreview(host, record);
}
