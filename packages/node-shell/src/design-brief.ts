// SPDX-License-Identifier: MPL-2.0
/**
 * The Node half of the design brief (plan 291 W3): the active content profile's token
 * document and the catalog facts `designBrief` adds to it, read from the profile's
 * catalog on disk.
 *
 * The token document is the profile's HEAD tokens asset, picked with the same
 * `pickHeadAssetId` rule the CLI render bridge and the MCP tokens resource use, so the
 * brief describes the system a render uses. The slide master and its logos come from the
 * rebrand reader's helpers (`./rebrand/design-system.ts`), so the brief, a renovation and
 * the deck tools agree on which master and which marks a pack ships.
 *
 * Every reader returns null when no profile resolves (a content-free install) and never
 * throws for a catalog file that is missing or unreadable: that section of the brief is
 * then reported as unavailable.
 *
 * Reads files and nothing else: no network, no clock.
 */

import { readFileSync } from 'node:fs';

import { canonicalJson, pickHeadAssetId } from '@lolly/engine';
import type { DesignBriefAssetV1, DesignBriefCatalogV1 } from '@lolly/engine';
import type { SlideMasterFileV1, SlideMasterV1 } from '@lolly-tools/core';

import { contentRoots, type ContentRoots } from './content-roots.ts';
import { assetsOf, fileOf, isUsableMaster, query, resolveLogos, tagsOf, type IndexAsset } from './rebrand/design-system.ts';

export interface ProfileSourceOptsV1 {
  /** A profile name; the active one (LOLLY_PROFILE, the sticky choice, then the default) when left out. */
  profile?: string;
  /** A checkout or content root other than the one the marker walk finds. */
  root?: string;
}

/** The profile's token document and where it came from. */
export interface ProfileTokenDocumentV1 {
  profile: string;
  /** The profile's display label from profiles.json, when it states one. */
  label?: string;
  /** The catalog id of the tokens asset. */
  tokensAsset: string;
  doc: unknown;
}

function rootsFor(opts: ProfileSourceOptsV1): ContentRoots | null {
  try {
    return contentRoots({
      ...(opts.profile !== undefined ? { profile: opts.profile } : {}),
      ...(opts.root !== undefined ? { root: opts.root } : {}),
    });
  } catch {
    return null;
  }
}

function safeAssets(roots: ContentRoots): IndexAsset[] {
  try { return assetsOf(roots); } catch { return []; }
}

function readJson(asset: IndexAsset | undefined, roots: ContentRoots): unknown {
  const file = asset ? fileOf(asset, roots) : null;
  if (!file) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return undefined; }
}

/** The head `tokens` asset: the one that is not a published version of another. */
function headTokensAsset(assets: IndexAsset[]): IndexAsset | undefined {
  const tokens = assets.filter((a) => a.type === 'tokens');
  const id = pickHeadAssetId(tokens.map((a) => a.id));
  return tokens.find((a) => a.id === id);
}

/** The active content profile's token document, or null when no profile or tokens asset answers. */
export function readProfileTokenDocument(opts: ProfileSourceOptsV1 = {}): ProfileTokenDocumentV1 | null {
  const roots = rootsFor(opts);
  if (!roots) return null;
  const asset = headTokensAsset(safeAssets(roots));
  const doc = readJson(asset, roots);
  if (!asset || doc === undefined) return null;
  return { profile: roots.profile, ...(roots.label ? { label: roots.label } : {}), tokensAsset: asset.id, doc };
}

/** The first `data` asset tagged `slides` and `slide-master` whose first master is usable. */
function readMaster(assets: IndexAsset[], roots: ContentRoots): { master: SlideMasterV1; id: string } | null {
  const entry = query(assets, { type: 'data', tags: ['slides', 'slide-master'] })[0];
  const file = readJson(entry, roots) as Partial<SlideMasterFileV1> | undefined;
  const first = file?.version === 1 && Array.isArray(file.masters) ? file.masters[0] : undefined;
  return entry && isUsableMaster(first) ? { master: first, id: entry.id } : null;
}

/**
 * The catalog facts of the active content profile, as `designBrief` and the brand check
 * take them: the asset listing (no bytes), the icon-theme and photo-treatment palettes,
 * the slide master and the master's logos. Null when no profile resolves.
 */
export function readProfileBriefCatalog(opts: ProfileSourceOptsV1 = {}): (DesignBriefCatalogV1 & { label?: string }) | null {
  const roots = rootsFor(opts);
  if (!roots) return null;
  const assets = safeAssets(roots);
  const palette = (tag: string): unknown => readJson(query(assets, { type: 'palette', tags: [tag] })[0], roots);
  const master = readMaster(assets, roots);
  const tokens = headTokensAsset(assets);
  const listing: DesignBriefAssetV1[] = assets.map((a) => {
    const raw = a as IndexAsset & { name?: unknown; description?: unknown; license?: unknown };
    return {
      id: a.id,
      ...(typeof a.type === 'string' ? { type: a.type } : {}),
      ...(typeof raw.name === 'string' ? { name: raw.name } : {}),
      ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
      tags: tagsOf(a),
      ...(typeof raw.license === 'string' ? { license: raw.license } : {}),
      ...(a.deprecated === true ? { deprecated: true } : {}),
    };
  });
  const iconThemes = palette('icon-themes');
  const photoTreatments = palette('photo-treatments');
  return {
    profile: roots.profile,
    ...(roots.label ? { label: roots.label } : {}),
    ...(tokens ? { tokensAsset: tokens.id } : {}),
    assets: listing,
    ...(iconThemes !== undefined ? { iconThemes } : {}),
    ...(photoTreatments !== undefined ? { photoTreatments } : {}),
    master: master?.master ?? null,
    // The master's logos in the brand's logo-surface order (plan 291 E18).
    ...(master ? { masterAsset: master.id, logos: resolveLogos(assets, master.master, tokens ? readJson(tokens, roots) : undefined) } : {}),
  };
}

/** Where a brief's token document came from: the `origin` kind `lolly system context` records. */
export type BriefOriginKindV1 = 'file' | 'terminal' | 'profile';

/** A token document without its run-time `$metadata` projection, for comparing two documents. */
function documentKey(doc: unknown): string | null {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const { $metadata: _drop, ...rest } = doc as Record<string, unknown>;
  try { return canonicalJson(rest); } catch { return null; }
}

/**
 * The profile catalog facts for a brief or a check, only when they belong to the token
 * document being described: the document came from the profile itself, or it is the
 * profile's own tokens asset read another way (a `--file` that points at it, or a
 * terminal system imported from it unchanged). Any other design system gets null, so the
 * master, logos, icons and media of the active profile are never reported as its own,
 * and the profile's asset ids are never known assets to its check.
 */
export function readBriefCatalogFor(
  origin: BriefOriginKindV1 | null | undefined,
  doc: unknown,
  opts: ProfileSourceOptsV1 = {},
): (DesignBriefCatalogV1 & { label?: string }) | null {
  if (!origin || doc === null || doc === undefined) return null;
  if (origin !== 'profile') {
    const own = readProfileTokenDocument(opts);
    const key = documentKey(doc);
    if (!own || !key || key !== documentKey(own.doc)) return null;
  }
  return readProfileBriefCatalog(opts);
}

/**
 * The `catalog` key of a brief (`lolly system context`, lolly://design-context): which
 * profile's catalog facts went in, and the tokens asset they belong to. Null when none did.
 */
export function briefCatalogSummary(catalog: (DesignBriefCatalogV1 & { label?: string }) | null | undefined): { profile?: string; label?: string; tokensAsset?: string } | null {
  if (!catalog) return null;
  return {
    ...(catalog.profile ? { profile: catalog.profile } : {}),
    ...(catalog.label ? { label: catalog.label } : {}),
    ...(catalog.tokensAsset ? { tokensAsset: catalog.tokensAsset } : {}),
  };
}
