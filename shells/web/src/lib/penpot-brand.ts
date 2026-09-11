// SPDX-License-Identifier: MPL-2.0
/**
 * The brand, as a `.penpot` archive wants it (plans/178): the raw Tokens-Studio
 * document the Penpot writer filters into `tokens.json`, the resolved colour
 * swatches for the file's Assets tab, the font roles as typographies, and the
 * two families the Design tool's `sans` / `mono` keys stand for.
 *
 * Shared by the `penpot` export format (bridge/export-penpot.ts) and the Send to
 * Penpot driver (lib/penpot-send.ts) so a download and a send carry the same
 * brand. Everything is read through the web host's tokens surface; a shell
 * without tokens (or a locked brand with none reachable yet) yields an empty
 * brand and the archive simply carries no tokens - never a failure.
 */
import type { PenpotIrTypography, PenpotPaletteColor, PenpotThemeSelection } from '../../../../engine/src/penpot-file.ts';
import type { TokensSnapshot } from '@lolly-tools/core/host-v1';
import { familyFromTokenValue, fontGroupOf } from '../user-fonts.ts';
import { getHostRef } from './host-ref.ts';
import { withLollyUiTokens } from './lolly-ui-tokens.ts';

export interface PenpotBrand {
  /**
   * The effective DTCG / Tokens-Studio document, unresolved. Taken from the render
   * context (host.tokens.snapshot().document - the RENDER version, plans/222 gap
   * #2), falling back to host.tokens.raw() (the edit head) for a host without
   * snapshot.
   */
  tokens: unknown;
  palette: PenpotPaletteColor[];
  typographies: PenpotIrTypography[];
  /** What the Design tool's `sans` / `mono` font keys resolve to. */
  fonts: { sans?: string; mono?: string };
  /** Families known to come from Google Fonts (Penpot's `gfont-` ids). */
  googleFamilies: string[];
  /** The theme selection that produced the render, so the file opens on the same
   *  theme (plans/222 gap #3). Absent when the snapshot names none. */
  themeSelection?: PenpotThemeSelection;
}

interface TokensSurfaceLike {
  raw?: () => Promise<unknown>;
  snapshot?: () => Promise<TokensSnapshot>;
  colors?: (opts?: { theme?: string }) => Promise<Array<{ path: string; name: string; group: string | null; value: string; description: string | null }>>;
}
/** The slice of the assets API the Google-font read needs: the font assets with their meta. */
interface FontAssetsLike {
  list?: (query: { type: 'font' }) => Promise<Array<{ meta?: { source?: unknown; family?: unknown } | null }>>;
}

/**
 * Families installed from Google Fonts on this device - the ones Penpot can name
 * with a `gfont-` id and paint with the real face. Read off the user font assets
 * (user-fonts.ts stamps `meta.source = 'google-fonts'` on each downloaded face).
 * Empty when there are none, or when the shell has no assets surface.
 */
export async function googleFamiliesFrom(assets: FontAssetsLike | null | undefined): Promise<string[]> {
  if (!assets?.list) return [];
  try {
    const refs = await assets.list({ type: 'font' });
    const out = new Set<string>();
    for (const r of refs) {
      const meta = r?.meta;
      if (meta && meta.source === 'google-fonts' && typeof meta.family === 'string' && meta.family.trim()) out.add(meta.family.trim());
    }
    return Array.from(out);
  } catch { return []; }
}

const EMPTY: PenpotBrand = { tokens: null, palette: [], typographies: [], fonts: {}, googleFamilies: [] };

/** Font roles the brand may declare, in the order they are worth listing. */
const FONT_ROLES: ReadonlyArray<{ key: string; name: string; weight: number; italic?: boolean }> = [
  { key: 'brand', name: 'Brand', weight: 400 },
  { key: 'display', name: 'Display', weight: 700 },
  { key: 'mono', name: 'Mono', weight: 400 },
  { key: 'italic', name: 'Italic', weight: 400, italic: true },
];

/** Read the brand through a tokens surface (the web host's, or any object with `raw`/`colors`),
 *  plus the device's Google-sourced font families when an assets surface is given. */
export async function brandFromTokens(surface: TokensSurfaceLike | null | undefined, assets?: FontAssetsLike | null): Promise<PenpotBrand> {
  const googleFamilies = await googleFamiliesFrom(assets);
  if (!surface) return { ...EMPTY, googleFamilies };
  // The RENDER context, not the edit head: snapshot() follows the same version
  // ladder as colors() below, so tokens/palette/fonts describe one render (gap #2).
  // A host without snapshot (older shell, a test surface) keeps the raw() head read.
  let tokens: unknown = null;
  let themeSelection: PenpotThemeSelection | undefined;
  try {
    if (surface.snapshot) {
      const snap = await surface.snapshot();
      tokens = snap.document;
      if (snap.selection && (snap.selection.activeThemes?.length || snap.selection.activeSets?.length)) {
        themeSelection = snap.selection;
      }
    } else {
      tokens = surface.raw ? await surface.raw() : null;
    }
  } catch { tokens = null; }
  let palette: PenpotPaletteColor[] = [];
  try {
    const swatches = surface.colors ? await surface.colors() : [];
    palette = swatches
      .filter((s) => typeof s.value === 'string' && /^#[0-9a-f]{6,8}$/i.test(s.value))
      .map((s) => ({ name: s.name || s.path, path: s.group ?? undefined, color: s.value }));
  } catch { palette = []; }
  const fonts: PenpotBrand['fonts'] = {};
  const typographies: PenpotIrTypography[] = [];
  const group = fontGroupOf(tokens);
  if (group) {
    for (const role of FONT_ROLES) {
      const entry = group[role.key];
      const value = entry && typeof entry === 'object' ? (entry as { $value?: unknown; value?: unknown }).$value ?? (entry as { value?: unknown }).value : entry;
      const family = familyFromTokenValue(value);
      if (!family) continue;
      if (role.key === 'brand') fonts.sans = family;
      if (role.key === 'mono') fonts.mono = family;
      typographies.push({ name: role.name, path: 'Brand', fontFamily: family, fontWeight: role.weight, italic: role.italic, fontSize: 16, lineHeight: 1.2 });
    }
  }
  return { tokens, palette, typographies, fonts, googleFamilies, themeSelection };
}

/**
 * The brand of the running web shell. The host is read through lib/host-ref.ts,
 * which the bridge registers at boot - its tokens and assets surfaces are eager,
 * so this works before any export happened (the catalog's Send modal never opens
 * an export panel). The export bridge's own `_host` is the fallback for a shell
 * that built the bridge without registering the ref (tests, older boot paths).
 */
export async function brandForPenpot(): Promise<PenpotBrand> {
  try {
    let host = getHostRef() as ({ tokens?: TokensSurfaceLike; assets?: FontAssetsLike } | null);
    if (!host) {
      const { _host } = await import('../bridge/export.ts');
      host = _host as typeof host;
    }
    const brand = await brandFromTokens(host?.tokens ?? null, host?.assets ?? null);
    // The raw brand remains the source for palette/font resolution above; the
    // archive gets it PLUS the Lolly UI vocabulary so app-surface files and
    // ordinary tool sends open against the same token contract.
    return { ...brand, tokens: withLollyUiTokens(brand.tokens) };
  } catch {
    return { ...EMPTY, tokens: withLollyUiTokens(null) };
  }
}
