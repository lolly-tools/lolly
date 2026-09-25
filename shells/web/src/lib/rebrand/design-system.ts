// SPDX-License-Identifier: MPL-2.0
/**
 * The active design system, read once for the renovation journey (plan 274 sections
 * 3.3, 3.5 and 4), and the readers Design's slide-master menus share with it.
 *
 * Two surfaces need the same four facts about the design system this device is on:
 * its slide master, the logo asset each background calls for, its colour tokens and
 * its faces. Design reads them to seed a slide from an archetype
 * (`views/free-canvas/slide-masters.ts`); `#/rebrand` reads them to plan and compile a
 * renovation. The readers live here and both import them, so a pack that answers one
 * surface answers the other the same way.
 *
 * `resolveActiveDesignSystem` builds the two values the journey carries:
 *
 *   - `input`, a `RebrandDesignSystemInputV1`, plain JSON the stage worker takes and
 *     hands to the engine's `resolveRebrandDesignSystem`. Nothing in it is a closure
 *     or a live object, so it survives `postMessage`.
 *   - `info`, what the top bar and the readiness panel show: the archetypes in the
 *     master's own order, the colours, the faces, whether a logo resolved, and whether
 *     the master is the neutral stand-in.
 *
 * A design system that ships no slide master, or ships one this build cannot read,
 * gets the engine's `neutralSlideMaster()` with `neutralMaster: true`, so the view can
 * tell the person plainly rather than planning against nothing. Logos are still looked up
 * against the neutral master's tags, since a pack with logos and no master is common.
 *
 * Every host read is feature-detected: a host without `assets` or `tokens` (a test
 * stub, a partial shell) is an ordinary answer, and a read that throws counts as
 * absent rather than failing the journey.
 */
import { neutralSlideMaster, type DeckLookV1, type LogoSetV1, type RebrandDesignSystemInputV1 } from '@lolly/engine';
import type { RebrandThemeFactsV1 } from '../../../../../engine/src/deck-compile.ts';
import type { ArchetypeRefV1, SlideMasterFileV1, SlideMasterV1 } from '@lolly-tools/core';
import { sha256Hex } from '../../../../../engine/src/bytes.ts';
import { t } from '../../i18n.ts';
import { FONTS } from '../typefaces.ts';
import { brandFontFamilies } from '../register-user-fonts.ts';
import type { DesignSystemRegistry } from '../design-system/registry.ts';
import type { RebrandDesignSystemInfoV1, RebrandResolvedSystemV1 } from './controller-api.ts';

/** The catalog query that finds a design system's slide masters, on every profile. */
export const MASTER_ASSET_TAGS = ['slides', 'slide-master'] as const;

/** The slice of `host.assets` the readers use. `HostV1['assets']` satisfies it. */
export interface MasterAssetsApi {
  query(filter: { type?: string; tags?: string[] }): Promise<Array<{ id?: string; url?: string }>>;
  get?(id: string): Promise<{ id?: string; url?: string } | null>;
  bytes?(target: unknown): Promise<Uint8Array>;
}

/** One token entry as the set hands it back. */
interface TokenEntryLike {
  path?: string;
  value?: unknown;
}

/** The slice of `host.tokens` the readers use: one read of the resolved token set, and its themes. */
export interface MasterTokensApi {
  get?(opts?: { theme?: string }): Promise<{
    query?(filter?: { type?: string }): TokenEntryLike[];
    get?(path: string): TokenEntryLike | undefined;
  }>;
  themes?(): Promise<Array<{ name: string; group?: string | null }>>;
}

/** Whatever a caller holds as its host. Both reads are narrowed below. */
export interface DesignSystemHost {
  assets?: unknown;
  tokens?: unknown;
  designSystems?: unknown;
}

/** The registry and asset reads `readLocalLooks` takes. */
interface LooksHost {
  designSystems: DesignSystemRegistry;
  assets: { _getBlob?(id: string): Promise<Blob | null> };
}

function hasLookRegistry(host: DesignSystemHost): host is DesignSystemHost & LooksHost {
  const registry = host.designSystems;
  return registry !== null && typeof registry === 'object' && 'list' in registry && typeof registry.list === 'function'
    && host.assets !== null && typeof host.assets === 'object';
}

export function isMasterAssets(api: unknown): api is MasterAssetsApi {
  return typeof (api as { query?: unknown } | null | undefined)?.query === 'function';
}

export function isMasterTokens(api: unknown): api is MasterTokensApi {
  return typeof (api as { get?: unknown } | null | undefined)?.get === 'function';
}

/**
 * Is this parsed object a master the engine can seed from?
 *
 * `seedFrame` reads `size`, `typeScale`, `logo` and `furniture` without guarding, so a
 * pack whose file is short of one of them would throw out of a menu click. A master that
 * does not answer this is reported the way an absent master is.
 */
export function isUsableMaster(value: unknown): value is SlideMasterV1 {
  const m = value as Partial<SlideMasterV1> | null | undefined;
  if (!m || typeof m.id !== 'string' || !m.id) return false;
  if (!Array.isArray(m.archetypes) || !m.archetypes.length) return false;
  if (!Array.isArray(m.furniture)) return false;
  if (!m.typeScale || typeof m.typeScale.body !== 'number') return false;
  if (!m.logo || typeof m.logo !== 'object') return false;
  const size = m.size;
  return Boolean(size) && Number.isFinite(size?.width) && Number.isFinite(size?.height)
    && Number(size?.width) > 0 && Number(size?.height) > 0;
}

/** The master a pack ships, the catalog id it came from and the bytes it was read from. */
export interface MasterAssetV1 {
  master: SlideMasterV1;
  assetId?: string;
  bytes: Uint8Array;
}

/**
 * Read the first slide master this design system offers, with the asset it came from,
 * or null when it offers none or the file is not a master this build can read.
 */
export async function readMasterAsset(assets: MasterAssetsApi): Promise<MasterAssetV1 | null> {
  const found = await assets.query({ type: 'data', tags: [...MASTER_ASSET_TAGS] });
  const first = Array.isArray(found) ? found[0] : undefined;
  if (!first) return null;
  let target: { id?: string; url?: string } = first;
  if (!target.url && first.id && assets.get) {
    const full = await assets.get(first.id);
    if (full) target = full;
  }
  if (!assets.bytes) return null;
  const raw = await assets.bytes(target.url ?? target);
  const text = new TextDecoder().decode(raw);
  const file = JSON.parse(text) as SlideMasterFileV1;
  if (file?.version !== 1 || !Array.isArray(file.masters)) return null;
  const master = file.masters[0];
  if (!isUsableMaster(master)) return null;
  const assetId = typeof first.id === 'string' && first.id ? first.id : undefined;
  return { master, bytes: raw, ...(assetId ? { assetId } : {}) };
}

/** Read the first slide master this design system offers, or null when it offers none. */
export async function readMasterFile(assets: MasterAssetsApi): Promise<SlideMasterV1 | null> {
  return (await readMasterAsset(assets))?.master ?? null;
}

/** The first asset id a tag list resolves to, or undefined when the pack has none. */
async function firstIdFor(assets: MasterAssetsApi, tags: string[], notId?: string): Promise<string | undefined> {
  if (!tags.length) return undefined;
  const found = await assets.query({ tags });
  if (!Array.isArray(found)) return undefined;
  for (const ref of found) {
    const id = typeof ref?.id === 'string' ? ref.id : '';
    if (id && id !== notId) return id;
  }
  const fallback = found[0];
  return typeof fallback?.id === 'string' && fallback.id ? fallback.id : undefined;
}

/**
 * Resolve the master's logo tags to catalog asset ids, per side and per mono variant.
 *
 * The side tags come from the master; the mono variant is the side's tags plus the
 * master's mono tags, which is how the deck tools have always found the mono mark. A
 * side the pack cannot answer stays absent, and `pickLogoVariant` inside `seedFrame`
 * then leaves that frame's logo empty rather than putting a light mark on a dark slide.
 */
export async function resolveLogos(assets: MasterAssetsApi, master: SlideMasterV1): Promise<LogoSetV1<string>> {
  const tags = master.logo?.assetTags;
  if (!tags) return {};
  const out: LogoSetV1<string> = {};
  const mono = Array.isArray(tags.mono) ? tags.mono : [];
  const sides: Array<['onLight' | 'onDark', 'monoOnLight' | 'monoOnDark', string[]]> = [
    ['onLight', 'monoOnLight', Array.isArray(tags.onLight) ? tags.onLight : []],
    ['onDark', 'monoOnDark', Array.isArray(tags.onDark) ? tags.onDark : []],
  ];
  for (const [side, monoSide, sideTags] of sides) {
    if (!sideTags.length) continue;
    const monoId = mono.length ? await firstIdFor(assets, [...new Set([...sideTags, ...mono])]) : undefined;
    const colourId = await firstIdFor(assets, [...sideTags], monoId);
    if (colourId) out[side] = colourId;
    if (monoId) out[monoSide] = monoId;
  }
  return out;
}

/** One snapshot of the design system's colour tokens, path to hex. */
export async function readColors(tokens: MasterTokensApi | undefined): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!tokens?.get) return out;
  const set = await tokens.get();
  const entries = set?.query?.({ type: 'color' });
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    if (typeof entry?.path === 'string' && typeof entry.value === 'string') out.set(entry.path, entry.value);
  }
  return out;
}

/** A theme name that reads as a dark mode, the node reader's `DARK_THEME_NAME`. */
const DARK_THEME_NAME = /(^|[\s/_-])dark$/i;

/**
 * The pack's dark mode (plan 275 section 6.1): the colour tokens of the first theme
 * the token set names as dark, path to hex. Undefined when it names none. The node
 * reader (`darkColorsFromDtcg`) reads a token file the same way, so a themed plan
 * compiles the same bytes on the web and on the terminal.
 */
export async function readDarkColors(tokens: MasterTokensApi | undefined): Promise<Record<string, string> | undefined> {
  if (!tokens?.themes || !tokens.get) return undefined;
  const themes = await tokens.themes();
  const dark = Array.isArray(themes) ? themes.find((one) => typeof one?.name === 'string' && DARK_THEME_NAME.test(one.name.trim())) : undefined;
  if (!dark) return undefined;
  const set = await tokens.get({ theme: dark.name });
  const out: Record<string, string> = {};
  for (const entry of set?.query?.({ type: 'color' }) ?? []) {
    if (typeof entry?.path === 'string' && typeof entry.value === 'string') out[entry.path] = entry.value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * The looks a `look` deck theme may name, as the engine takes them: every saved
 * design system but the active one, then the examples. Read only for a design
 * system that is not locked, since a locked one applies no look (plan 275 decision 17).
 */
async function readDeckLooks(host: DesignSystemHost, activeId: string): Promise<DeckLookV1[]> {
  const { exampleLooks, readLocalLooks } = await import('../design-system/look-library.ts');
  let looks = exampleLooks();
  if (hasLookRegistry(host)) {
    try {
      // The active design system is left out below, so its own tokens are never read here.
      looks = (await readLocalLooks({ designSystems: host.designSystems, assets: host.assets })).looks;
    } catch {
      // A registry that cannot be read leaves the example looks.
    }
  }
  return looks.filter((look) => look.id !== activeId).map((look) => {
    const colors: Record<string, string> = {};
    for (const color of look.context.colors) if (typeof color.value === 'string') colors[color.path] = color.value;
    return { id: look.id, name: look.name, colors };
  });
}

/** The first family out of a resolved `fontFamily` value, quotes dropped. */
function familyOf(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string' || first.startsWith('{')) return '';
  return first.replace(/^['"]|['"]$/g, '').trim();
}

/**
 * The brand face and the mono face the design system names, read from `font.brand`
 * and `font.mono` in the resolved token set. Either is absent when the set names none.
 */
export async function readFonts(tokens: MasterTokensApi | undefined): Promise<{ brand?: string; mono?: string }> {
  if (!tokens?.get) return {};
  const set = await tokens.get();
  const brand = familyOf(set?.get?.('font.brand')?.value);
  const mono = familyOf(set?.get?.('font.mono')?.value);
  return { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
}

/** The faces a person installed on this device, from the boot-time family cache. */
function installedFamilies(): string[] {
  try {
    return brandFontFamilies();
  } catch {
    return [];
  }
}

/** Families this device can draw: the faces a person installed, then the bundled ones. */
function deviceFamilies(): string[] {
  return [...new Set([...installedFamilies(), ...FONTS.map((face) => face.family)].filter(Boolean))];
}

/** The distinguishing tag of one logo side: its last tag other than `logo`. */
function sideTag(tags: readonly string[] | undefined): string | undefined {
  const own = (tags ?? []).filter((tag) => tag && tag !== 'logo');
  return own[own.length - 1];
}

/**
 * What the readiness rows ask about, read in the same pass as the design system: the
 * master's catalog id (absent for the neutral master, which is engine data rather than
 * an asset) and one tag per logo side the master places.
 */
export interface DesignSystemNeedsV1 {
  masterAssetId?: string;
  logoTags: string[];
}

export interface ActiveDesignSystemReadV1 {
  resolved: RebrandResolvedSystemV1;
  needs: DesignSystemNeedsV1;
}

/** The active design system's id, name and brand lock, from the registry record when there is one. */
async function identityOf(host: DesignSystemHost): Promise<{ id: string; name: string; locked: boolean }> {
  try {
    const { activeDesignSystemRecord } = await import('../design-system/active.ts');
    const record = await activeDesignSystemRecord(host);
    if (record?.id) return { id: record.id, name: record.label || record.id, locked: record.locked === true };
  } catch {
    // No registry behind this host: the shipped design system is the one in force.
  }
  return { id: 'shipped', name: t('Design system'), locked: false };
}

/**
 * Read the active design system for a renovation, with the readiness needs beside it.
 * Null only when the host offers neither an asset API nor a token API, so nothing about
 * a design system can be read at all.
 */
export async function readActiveDesignSystem(host: DesignSystemHost): Promise<ActiveDesignSystemReadV1 | null> {
  const assets = isMasterAssets(host.assets) ? host.assets : undefined;
  const tokens = isMasterTokens(host.tokens) ? host.tokens : undefined;
  if (!assets && !tokens) return null;

  let shipped: MasterAssetV1 | null = null;
  if (assets) {
    try {
      shipped = await readMasterAsset(assets);
    } catch {
      shipped = null;
    }
  }
  const master = shipped?.master ?? neutralSlideMaster();
  const neutral = !shipped;

  const [logos, colors, fonts, identity, darkColors] = await Promise.all([
    assets ? resolveLogos(assets, master).catch((): LogoSetV1<string> => ({})) : Promise.resolve<LogoSetV1<string>>({}),
    readColors(tokens).catch(() => new Map<string, string>()),
    readFonts(tokens).catch((): { brand?: string; mono?: string } => ({})),
    identityOf(host),
    readDarkColors(tokens).catch(() => undefined),
  ]);
  const looks = identity.locked ? [] : await readDeckLooks(host, identity.id).catch((): DeckLookV1[] => []);

  const available = deviceFamilies();
  const colorRecord = Object.fromEntries(colors);
  const assetHashes: Record<string, string> = {};
  if (shipped?.assetId) {
    const hex = await sha256Hex(shipped.bytes).catch(() => undefined);
    if (hex) assetHashes[shipped.assetId] = `sha256:${hex}`;
  }

  // The dark mode, the lock and the looks travel with the input as plain data
  // (`RebrandThemeFactsV1`), so the stage worker compiles a themed plan the way this
  // realm previews it. None of them is part of the token hash.
  const input: RebrandDesignSystemInputV1 & RebrandThemeFactsV1 = {
    id: identity.id,
    name: identity.name,
    master,
    colors: colorRecord,
    logos: { ...logos },
    fonts: {
      ...(fonts.brand ? { brand: fonts.brand } : {}),
      ...(fonts.mono ? { mono: fonts.mono } : {}),
      available,
    },
    assetHashes,
    neutralMaster: neutral,
    ...(darkColors ? { darkColors } : {}),
    ...(identity.locked ? { locked: true } : {}),
    ...(looks.length > 0 ? { looks } : {}),
  };

  const info: RebrandDesignSystemInfoV1 = {
    id: identity.id,
    name: identity.name,
    neutralMaster: neutral,
    hasLogo: Object.values(logos).some((id) => typeof id === 'string' && id.length > 0),
    archetypes: master.archetypes.map((archetype): ArchetypeRefV1 => archetype.id),
    colors: { ...colorRecord },
    fonts: [...new Set([fonts.brand, fonts.mono, ...installedFamilies()].filter((f): f is string => Boolean(f)))],
  };

  const logoTags = [sideTag(master.logo?.assetTags?.onLight), sideTag(master.logo?.assetTags?.onDark)]
    .filter((tag): tag is string => Boolean(tag));
  return {
    resolved: { input, info },
    needs: {
      ...(shipped?.assetId ? { masterAssetId: shipped.assetId } : {}),
      logoTags: [...new Set(logoTags)],
    },
  };
}

/**
 * The active design system as the renovation journey takes it: plain-JSON input for the
 * stage worker and the summary the view shows. Null when nothing can be read.
 */
export async function resolveActiveDesignSystem(host: DesignSystemHost): Promise<RebrandResolvedSystemV1 | null> {
  return (await readActiveDesignSystem(host))?.resolved ?? null;
}
