// SPDX-License-Identifier: MPL-2.0
/**
 * The design system a terminal renovates against, read from the active content
 * profile (plan 274 sections 3.3 and 3.5).
 *
 * The engine's `resolveRebrandDesignSystem` takes a design system as plain data;
 * this module is the Node answer to "which data": the profile's catalog, read
 * through `content-roots.ts` exactly as every other Node reader reads it.
 *
 * ONE SNAPSHOT ON EVERY SURFACE. A plan records the snapshot it was made against,
 * and `checkPlanFits` refuses a plan whose token hash or master differs, so a plan
 * made in the web view compiles here only when both surfaces build the same input
 * from the same pack. Every rule below is the web reader's
 * (`shells/web/src/lib/rebrand/design-system.ts`), restated over the catalog on
 * disk, and `tests/rebrand-node-pipeline.test.ts` pins the two together:
 *
 *   - The slide master is the first `data` asset tagged `slides` and
 *     `slide-master`, in asset id order (the order the web's asset store hands
 *     back); its first master is the one used. A profile that ships none, or ships
 *     one this build cannot use, gets `neutralSlideMaster()` and
 *     `neutralMaster: true`, so a caller can say plainly that the neutral master
 *     stands in.
 *   - The colours are the engine token set's `color` entries
 *     (`createTokenSet(doc).query({ type: 'color' })`), every string value kept,
 *     so `transparent` counts here exactly as it counts on the web.
 *   - The logos are picked by the master's own `logo.assetTags`, per side: the
 *     mono mark is the first asset carrying the side's tags plus the mono tags,
 *     and the colour mark the first asset carrying the side's tags that is not
 *     that mono mark.
 *   - The faces are the token set's `font.brand` and `font.mono`.
 *   - The dark mode is the first theme whose name reads as dark, composed over
 *     the base (`darkColorsFromDtcg`). It is not part of the token hash, and the
 *     Dark deck theme draws from it and nowhere else.
 *   - The id is the shipped design system's (`SHIPPED_DESIGN_SYSTEM_ID`), and
 *     `assetHashes` pins the master file by `sha256:<hex>` of its bytes.
 *
 * A catalog file that cannot be read or parsed is a `design-system.unreadable`
 * failure naming the file, never an unclassified exception.
 *
 * Reads files and nothing else: no network, no clock.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  SHIPPED_DESIGN_SYSTEM_ID,
  createTokenSet,
  neutralSlideMaster,
  resolveRebrandDesignSystem,
  type RebrandDesignSystemInputV1,
  type RebrandDesignSystemV1,
} from '@lolly/engine';
import type { SlideMasterFileV1, SlideMasterV1 } from '@lolly-tools/core';

import { contentRoots, contentUrlFile, readAssetIndex, type ContentRoots } from '../content-roots.ts';
import { RebrandPipelineError } from './pipeline.ts';

// ─── colour tokens and faces ─────────────────────────────────────────────────

/**
 * The colour tokens of a DTCG brand file, as token path to value, read through
 * the engine's token set: the file's sets merged for its default theme, every
 * `{alias}` followed, and every `color` entry whose value is a string kept.
 */
export function colorTokensFromDtcg(file: unknown): Map<string, string> {
  const out = new Map<string, string>();
  for (const entry of createTokenSet(file).query({ type: 'color' })) {
    if (typeof entry.path === 'string' && typeof entry.value === 'string') out.set(entry.path, entry.value);
  }
  return out;
}

/** A theme name that reads as a dark mode: `dark`, or one ending in ` dark`, `/dark`, `_dark` or `-dark`. */
export const DARK_THEME_NAME = /(^|[\s/_-])dark$/i;

/**
 * The pack's dark mode (plan 275 section 6.1): the colour tokens of the first theme
 * the file names as dark, composed over its base the way the default theme is, as
 * token path to value. Undefined when the file names no dark theme or it states no
 * colour. The web reader (`readDarkColors` there) makes the same read through
 * `host.tokens`, so a themed plan compiles the same bytes on both surfaces.
 */
export function darkColorsFromDtcg(file: unknown): Map<string, string> | undefined {
  const dark = createTokenSet(file).themes().find((one) => DARK_THEME_NAME.test(one.name.trim()));
  if (!dark) return undefined;
  const out = new Map<string, string>();
  for (const entry of createTokenSet(file, { theme: dark.name }).query({ type: 'color' })) {
    if (typeof entry.path === 'string' && typeof entry.value === 'string') out.set(entry.path, entry.value);
  }
  return out.size > 0 ? out : undefined;
}

/** The first family out of a resolved `fontFamily` value, quotes dropped. */
function familyOf(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string' || first.startsWith('{')) return '';
  return first.replace(/^['"]|['"]$/g, '').trim();
}

/** The brand face and the mono face a DTCG brand file names at `font.brand` and `font.mono`. */
export function fontsFromDtcg(file: unknown): { brand?: string; mono?: string } {
  const set = createTokenSet(file);
  const brand = familyOf(set.get('font.brand')?.value);
  const mono = familyOf(set.get('font.mono')?.value);
  return { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
}

// ─── the catalog ─────────────────────────────────────────────────────────────

/** One asset index entry, typed only as far as this module reads it. */
interface IndexAsset {
  id: string;
  type?: string;
  tags?: string[];
  deprecated?: boolean;
  formats?: Array<{ format?: string; url?: string }>;
}

function assetsOf(roots: ContentRoots): IndexAsset[] {
  let index: { assets?: unknown[] };
  try {
    index = readAssetIndex(roots) as { assets?: unknown[] };
  } catch (err) {
    throw new RebrandPipelineError(
      'design-system.unreadable',
      `The ${roots.profile} asset index could not be read: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return (index.assets ?? []).filter((a): a is IndexAsset => !!a && typeof (a as IndexAsset).id === 'string');
}

const tagsOf = (asset: IndexAsset): string[] => (Array.isArray(asset.tags) ? asset.tags : []);

/**
 * The assets a web `host.assets.query` returns for the same filter: every tag
 * present, the type equal when one is asked for, deprecated entries left out,
 * in asset id order.
 */
function query(assets: IndexAsset[], filter: { type?: string; tags: readonly string[] }): IndexAsset[] {
  return assets
    .filter((asset) => asset.deprecated !== true
      && (filter.type === undefined || asset.type === filter.type)
      && filter.tags.every((tag) => tagsOf(asset).includes(tag)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The file on disk behind an asset's first format that has one. */
function fileOf(asset: IndexAsset, roots: ContentRoots): string | null {
  for (const format of asset.formats ?? []) {
    const file = format.url ? contentUrlFile(format.url, roots) : null;
    if (file) return file;
  }
  return null;
}

function readBytes(file: string, what: string): Uint8Array {
  try {
    return new Uint8Array(readFileSync(file));
  } catch (err) {
    throw new RebrandPipelineError('design-system.unreadable', `The ${what} ${file} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function parseJson(bytes: Uint8Array, file: string, what: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    throw new RebrandPipelineError('design-system.unreadable', `The ${what} ${file} is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** The brand token file: a `tokens` asset tagged `brand`, else the first `tokens` asset. */
function tokenAsset(assets: IndexAsset[]): IndexAsset | undefined {
  const tokens = assets.filter((asset) => asset.type === 'tokens');
  return tokens.find((asset) => tagsOf(asset).includes('brand')) ?? tokens[0];
}

/**
 * Is this parsed object a master the engine can seed from? The web reader's
 * test: a master short of one of these is reported the way an absent one is.
 */
function isUsableMaster(value: unknown): value is SlideMasterV1 {
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

/** The first asset id a tag list resolves to, skipping `notId` while another answers. */
function firstIdFor(assets: IndexAsset[], tags: readonly string[], notId?: string): string | undefined {
  if (!tags.length) return undefined;
  const found = query(assets, { tags });
  return found.find((asset) => asset.id !== notId)?.id ?? found[0]?.id;
}

/** The master's logo tags resolved to catalog ids, per side and per mono variant. */
function resolveLogos(assets: IndexAsset[], master: SlideMasterV1): NonNullable<RebrandDesignSystemInputV1['logos']> {
  const tags = master.logo?.assetTags;
  const out: NonNullable<RebrandDesignSystemInputV1['logos']> = {};
  if (!tags) return out;
  const mono = Array.isArray(tags.mono) ? tags.mono : [];
  const sides: Array<['onLight' | 'onDark', 'monoOnLight' | 'monoOnDark', string[]]> = [
    ['onLight', 'monoOnLight', Array.isArray(tags.onLight) ? tags.onLight : []],
    ['onDark', 'monoOnDark', Array.isArray(tags.onDark) ? tags.onDark : []],
  ];
  for (const [side, monoSide, sideTags] of sides) {
    if (!sideTags.length) continue;
    const monoId = mono.length ? firstIdFor(assets, [...new Set([...sideTags, ...mono])]) : undefined;
    const colourId = firstIdFor(assets, sideTags, monoId);
    if (colourId) out[side] = colourId;
    if (monoId) out[monoSide] = monoId;
  }
  return out;
}

// ─── resolving ───────────────────────────────────────────────────────────────

/** The profile's design system, as data, resolved, and with where each part came from. */
export interface RebrandResolvedSystem {
  /** The content profile it was read from. */
  profile: string;
  /** The plain input, which a caller may post to a worker or record. */
  input: RebrandDesignSystemInputV1;
  /** The resolved system the first pass and the compile take. */
  system: RebrandDesignSystemV1;
  /** True when the profile ships no slide master and the neutral one stands in. */
  neutralMaster: boolean;
  /** Catalog ids the parts were read from, where there was one. */
  assets: { master?: string; tokens?: string; logos: string[] };
  /** One plain sentence per thing that was missing and what stood in for it. */
  notes: string[];
}

export interface ResolveProfileDesignSystemOptsV1 {
  /** A profile name; the active one (LOLLY_PROFILE, then the default) when left out. */
  profile?: string;
  /** A checkout or content root other than the one the marker walk finds. */
  root?: string;
}

/**
 * The active content profile's design system for a renovation, or null when no
 * profile resolves here (a content-free install with no root pointed at it).
 */
export async function resolveProfileDesignSystem(
  opts: ResolveProfileDesignSystemOptsV1 = {},
): Promise<RebrandResolvedSystem | null> {
  let roots: ContentRoots;
  try {
    roots = contentRoots({
      ...(opts.profile !== undefined ? { profile: opts.profile } : {}),
      ...(opts.root !== undefined ? { root: opts.root } : {}),
    });
  } catch {
    return null;
  }
  const assets = assetsOf(roots);
  const notes: string[] = [];
  const used: RebrandResolvedSystem['assets'] = { logos: [] };
  const assetHashes: Record<string, string> = {};

  // The master.
  let master: SlideMasterV1 | undefined;
  const masterEntry = query(assets, { type: 'data', tags: ['slides', 'slide-master'] })[0];
  const masterFile = masterEntry ? fileOf(masterEntry, roots) : null;
  if (masterEntry && masterFile) {
    const bytes = readBytes(masterFile, 'slide master');
    const parsed = parseJson(bytes, masterFile, 'slide master') as Partial<SlideMasterFileV1> | null;
    const first = parsed?.version === 1 && Array.isArray(parsed.masters) ? parsed.masters[0] : undefined;
    if (isUsableMaster(first)) {
      master = first;
      used.master = masterEntry.id;
      assetHashes[masterEntry.id] = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    } else {
      notes.push(`The ${roots.profile} slide master ${masterFile} is not one this build can use, so the neutral master is used.`);
    }
  } else {
    notes.push(`The ${roots.profile} design system has no slide master, so the neutral master is used.`);
  }
  const neutral = !master;
  master ??= neutralSlideMaster();

  // The colours and faces.
  let colors = new Map<string, string>();
  let darkColors: Map<string, string> | undefined;
  let faces: { brand?: string; mono?: string } = {};
  const tokensEntry = tokenAsset(assets);
  const tokensFile = tokensEntry ? fileOf(tokensEntry, roots) : null;
  if (tokensEntry && tokensFile) {
    const doc = parseJson(readBytes(tokensFile, 'token file'), tokensFile, 'token file');
    colors = colorTokensFromDtcg(doc);
    darkColors = darkColorsFromDtcg(doc);
    faces = fontsFromDtcg(doc);
    used.tokens = tokensEntry.id;
  } else {
    notes.push(`The ${roots.profile} design system has no brand token file, so no colour can be mapped.`);
  }

  // The logos, by the master's own tags.
  const logos = resolveLogos(assets, master);
  for (const id of Object.values(logos)) if (id && !used.logos.includes(id)) used.logos.push(id);
  if (!logos.onLight && !logos.onDark) {
    notes.push(`The ${roots.profile} design system has no logo the slide master can place.`);
  }

  const input: RebrandDesignSystemInputV1 = {
    id: SHIPPED_DESIGN_SYSTEM_ID,
    name: roots.profile,
    master,
    colors: Object.fromEntries(colors),
    logos,
    fonts: { ...faces },
    assetHashes,
    neutralMaster: neutral,
    ...(darkColors ? { darkColors: Object.fromEntries(darkColors) } : {}),
  };

  const system = await resolveRebrandDesignSystem(input);
  return { profile: roots.profile, input, system, neutralMaster: neutral, assets: used, notes };
}
