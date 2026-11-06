// SPDX-License-Identifier: MPL-2.0
/**
 * One catalog file, one owning asset id.
 *
 * Lolly Work decides whether a catalog file may be served from the asset that owns
 * the file: when an asset is withdrawn, expired or scheduled, its bytes stop being
 * served too. So Work inverts the asset index into path to id (`buildPathMap` in lolly-work's
 * server/src/catalog/lifecycle.ts) and refuses the whole index when two ids claim one
 * path, because a withdrawal could not then say which asset it meant. A refused index
 * answers 503 `catalog asset ownership is unavailable` for catalog files that have no
 * content address of their own, which is nearly all of them on a catalog built from
 * source.
 *
 * Nothing on the Lolly side reads an index that way, so a catalog sharing a file
 * between two ids passes every other check here and only fails on its first Work
 * instance. These are that function's path rules, restated so the failure arrives at
 * authoring time: the leading slash and `catalog/` prefix are not part of a path,
 * locale formats claim paths too, and `name.<16 hex>.ext` also claims `name.ext`, its
 * legacy spelling. That last rule is why a release can collide where its source does
 * not: signed renditions are named `out.<16 hex>.webp`, so if they sat in one folder,
 * every asset with a rendition would claim `renditions/out.webp`.
 *
 * Pure, so a test can drive it without running the validator. Keep it in step with
 * buildPathMap; tests/catalog-asset-paths.test.ts carries the cases both must agree on.
 */

export interface AssetPathFormat { url?: unknown; checksum?: unknown; [key: string]: unknown }
export interface AssetPathEntry { id?: unknown; formats?: unknown; locales?: unknown; [key: string]: unknown }
export interface AssetPathIndex { assets?: unknown; [key: string]: unknown }
export interface RenditionProduct { file: string; sha256: string; [key: string]: unknown }
export interface RenditionEntry { id: string; source?: string; products?: RenditionProduct[]; [key: string]: unknown }
export interface RenditionManifest { assets?: RenditionEntry[]; [key: string]: unknown }

const ADDRESSED = /^(.*)\.([0-9a-f]{16})(\.[a-z0-9]{1,16})$/;
const UNSAFE_ADDRESS = /[\\%?#\p{White_Space}\p{Cc}]/u;

/** An index url as the path Work keys its ownership map on, or '' for an empty url. */
export function ownedPath(url: string): string {
  return url.replace(/^\/+/, '').replace(/^catalog\//, '');
}

/** The full SHA-256 of a canonical SRI string as hex; anything else is null. */
function checksumHex(checksum: unknown): string | null {
  const match = typeof checksum === 'string' ? /^sha256-([A-Za-z0-9+/]{43}=)$/.exec(checksum) : null;
  if (!match) return null;
  const digest = Buffer.from(match[1]!, 'base64');
  return digest.length === 32 && digest.toString('base64') === match[1] ? digest.toString('hex') : null;
}

function formatsOf(asset: AssetPathEntry): AssetPathFormat[] {
  const locales = asset.locales && typeof asset.locales === 'object' && !Array.isArray(asset.locales) ? Object.values(asset.locales) : [];
  return [...(Array.isArray(asset.formats) ? asset.formats : []), ...locales.filter(Array.isArray).flat()] as AssetPathFormat[];
}

/**
 * Everything in this index that would make Work refuse it, as one message per problem.
 * Empty means Work builds its ownership map from the index.
 */
export function assetPathProblems(index: AssetPathIndex): string[] {
  const owners = new Map<string, Set<string>>();
  const problems: string[] = [];
  const claim = (path: string, id: string): void => {
    const claimed = owners.get(path);
    if (claimed) claimed.add(id);
    else owners.set(path, new Set([id]));
  };
  for (const asset of (Array.isArray(index.assets) ? index.assets : []) as AssetPathEntry[]) {
    if (typeof asset?.id !== 'string') continue;
    for (const format of formatsOf(asset)) {
      const url = typeof format?.url === 'string' ? format.url : '';
      const rel = ownedPath(url);
      if (!rel) continue;
      claim(rel, asset.id);
      const address = ADDRESSED.exec(rel);
      if (!address) continue;
      if (UNSAFE_ADDRESS.test(rel) || rel.split('/').some(part => !part || part === '.' || part === '..') || rel.includes('://')) {
        problems.push(`[asset ${asset.id}] url "${url}" looks content addressed but is not a safe path, and Lolly Work refuses the whole index for that`);
        continue;
      }
      const digest = checksumHex(format.checksum);
      if (!digest || digest.slice(0, 16) !== address[2]) {
        problems.push(`[asset ${asset.id}] url "${url}" carries a content address that does not match its checksum, and Lolly Work refuses the whole index for that`);
        continue;
      }
      claim(`${address[1]}${address[3]}`, asset.id);
    }
  }
  for (const [path, ids] of owners) {
    if (ids.size < 2) continue;
    problems.push(`two asset ids claim one catalog file: ${[...ids].sort().join(' and ')} both own "${path}". `
      + 'Lolly Work decides whether a file may be served from its one owner, so it answers 503 for this catalog. '
      + 'Give each id a file of its own; the bytes may be identical, and asset ids never change.');
  }
  return problems;
}

/**
 * Where an asset's signed rendition sits under catalog/renditions in a release. One
 * folder per asset id keeps `out.<16 hex>.webp` from every asset claiming the same
 * `renditions/out.webp`. Asset ids are already safe paths (schemas/asset.schema.json).
 */
export function renditionRelPath(assetId: string, file: string): string {
  return `${assetId}/${file}`;
}

/**
 * The index as a release will hold it: the same assets plus each signed rendition the
 * manifest would add (scripts/build-catalog-renditions.ts `applyRenditions`). A source
 * index lists no renditions, so checking only that would miss a collision the release
 * makes.
 */
export function withRenditionFormats(index: AssetPathIndex, manifest: RenditionManifest | null | undefined): AssetPathIndex {
  const products = new Map((manifest?.assets ?? []).map(entry => [entry.id, entry.products ?? []]));
  if (!products.size || !Array.isArray(index.assets)) return index;
  return {
    ...index,
    assets: (index.assets as AssetPathEntry[]).map(asset => {
      const rows = typeof asset?.id === 'string' ? products.get(asset.id) : undefined;
      if (!rows?.length) return asset;
      const added = rows.map(product => ({
        url: `/catalog/renditions/${renditionRelPath(asset.id as string, product.file)}`,
        checksum: `sha256-${Buffer.from(product.sha256, 'hex').toString('base64')}`,
      }));
      return { ...asset, formats: [...(Array.isArray(asset.formats) ? asset.formats : []), ...added] };
    }),
  };
}

/**
 * A rendition entry points at its original by url, and `applyRenditions` stops the release
 * build when that url is not one of the asset's formats. Moving a file without moving
 * this reference would otherwise go unnoticed until a release is built.
 */
export function renditionSourceProblems(index: AssetPathIndex, manifest: RenditionManifest | null | undefined): string[] {
  const byId = new Map(((Array.isArray(index.assets) ? index.assets : []) as AssetPathEntry[]).map(asset => [asset?.id, asset]));
  const problems: string[] = [];
  for (const entry of manifest?.assets ?? []) {
    const asset = byId.get(entry.id);
    if (asset && !formatsOf(asset).some(format => format?.url === entry.source)) {
      problems.push(`renditions/index.json: "${entry.id}" points at source "${entry.source}", which is not one of that asset's formats, so a release build would stop here. Update the entry's source; the signed products do not name it.`);
    }
  }
  return problems;
}
