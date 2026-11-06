// SPDX-License-Identifier: MPL-2.0
/**
 * asset-scope.ts - which catalog rows go with the design system a person is using.
 *
 * Asset ids are global, so one catalog can hold two design systems' material (a
 * profile's `companions`, packages/node-shell/src/content-roots.ts). Lists answer by
 * namespace so the two do not mix: every `host.assets.query` reads through this, and
 * that one choke point keeps the Assets view, the picker, search, brand pages and any
 * tool hook that lists assets agreeing. `host.assets.get` stays global, because a saved
 * session names its asset by id and must keep drawing whichever system is active.
 *
 * The index states what each companion owns (`companionDesignSystems[].assets`). Three
 * kinds of row follow from that:
 *   - a row a companion names belongs to that companion;
 *   - a row in the namespace of the catalog's own tokens belongs to the catalog's system;
 *   - anything else (a sample both use, an emoji set, an instance's shared asset) is
 *     shared and always listed.
 *
 * A catalog that names no owned assets has no scope at all and nothing is filtered, so a
 * single-system instance and lolly.tools (whose one companion is the bundled starter,
 * which brings no rows) read exactly as they did.
 *
 * DOM-free. The active record is read from the same two stores the registry keeps, not
 * through the registry object, because the asset bridge is built before it.
 */
import {
  ACTIVE_DESIGN_SYSTEM_KEY, DESIGN_SYSTEMS_STORE, SHIPPED_ACTIVE_FALLBACK, stripTokensSuffix, type DesignSystemRecord,
} from './registry.ts';

/** One companion that owns rows in this catalog: `companionDesignSystems` with `assets`. */
export interface CompanionAssets {
  tokens: string;
  label: string;
  assets: string[];
}

export interface AssetScope {
  companions: CompanionAssets[];
  /** The catalog system's namespace, from its tokens id: `suse/`. Empty when none is declared. */
  shippedNamespace: string;
  /** The companion in use, or null when the catalog's own system (or a person's own) is. */
  active: CompanionAssets | null;
}

/** The slice of the shared IndexedDB connection this module reads. */
export interface AssetScopeDb {
  get(store: string, key: IDBValidKey): Promise<unknown>;
  objectStoreNames?: { contains(name: string): boolean };
}

/** The entries of an index's `companionDesignSystems` that own rows, in order. */
export function readCompanionAssets(value: unknown): CompanionAssets[] {
  if (!Array.isArray(value)) return [];
  const out: CompanionAssets[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { tokens, label, assets } = entry as Record<string, unknown>;
    if (typeof tokens !== 'string' || !tokens || typeof label !== 'string' || !label.trim() || !Array.isArray(assets)) continue;
    const named = assets.filter((name): name is string => typeof name === 'string' && name.length > 0);
    if (named.length) out.push({ tokens, label: label.trim(), assets: named });
  }
  return out;
}

/** Whether an `assets` list names this id: exactly, or as a family prefix. The same
 *  reading as `companionAssetNamed` in content-roots.ts, which decided what was copied. */
function named(assets: readonly string[], id: string): boolean {
  return assets.some(name => (name.endsWith('/') || name.endsWith('-') ? id.startsWith(name) : id === name));
}

/** The companion that owns this catalog id, or null. */
export function companionOwning(id: string, companions: readonly CompanionAssets[]): CompanionAssets | null {
  return companions.find(companion => named(companion.assets, id)) ?? null;
}

/** The namespace a tokens or asset id sits in: `lolly/tokens/demo` is `lolly/`. */
export function assetNamespace(id: string): string {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(0, slash + 1) : '';
}

/** Whether a catalog row is listed for the active system. No scope lists everything. */
export function assetInScope(id: string, scope: AssetScope | null): boolean {
  if (!scope) return true;
  const owner = companionOwning(id, scope.companions);
  if (owner) return owner === scope.active || owner.tokens === scope.active?.tokens;
  return !(scope.active && scope.shippedNamespace && id.startsWith(scope.shippedNamespace));
}

/** The namespace whose palettes and themes answer for the active system. */
export function activeNamespace(scope: AssetScope): string {
  return scope.active ? assetNamespace(scope.active.tokens) : scope.shippedNamespace;
}

/**
 * The palette of `tag` for the asset a caller is drawing (by its own namespace), else for
 * the active system. A catalog with one palette answers with that one. With no scope and
 * no asset named this is the first match, as it always was.
 */
export function pickPalette<T extends { id: string; type?: string; tags?: readonly string[] }>(rows: readonly T[], tag: string, scope: AssetScope | null, forAssetId?: string): T | undefined {
  const palettes = rows.filter(row => row.type === 'palette' && row.tags?.includes(tag));
  if (palettes.length < 2) return palettes[0];
  const wanted = (forAssetId && assetNamespace(forAssetId)) || (scope ? activeNamespace(scope) : '');
  return (wanted ? palettes.find(row => row.id.startsWith(wanted)) : undefined)
    ?? palettes.find(row => assetInScope(row.id, scope))
    ?? palettes[0];
}

const isRecordLike = (value: unknown): value is DesignSystemRecord =>
  typeof value === 'object' && value !== null && typeof (value as DesignSystemRecord).id === 'string';

/** The companion a record draws from: seeded from it, or copied from one that was. */
async function companionOfRecord(db: AssetScopeDb, record: DesignSystemRecord | null, companions: readonly CompanionAssets[]): Promise<CompanionAssets | null> {
  let at = record;
  for (let depth = 0; at && depth < 8; depth += 1) {
    const source = at.source;
    if (source?.kind !== 'local') return null;
    if (source.companion) return companions.find(companion => companion.tokens === source.companion!.tokens) ?? null;
    if (!source.forkedFrom) return null;
    const parent = await db.get(DESIGN_SYSTEMS_STORE, source.forkedFrom.id);
    at = isRecordLike(parent) ? parent : null;
  }
  return null;
}

/**
 * The scope for this device right now, or null when the catalog declares none. Costs one
 * read of the catalog-source row on a catalog with no companions, so every list on a
 * single-system instance stays what it was. Any failure reads as no scope: a person who
 * sees too much can still work, and one who sees nothing cannot.
 */
export async function readAssetScope(db: AssetScopeDb): Promise<AssetScope | null> {
  try {
    const source = await db.get('profile', 'catalog-source') as { companions?: unknown; tokensHead?: unknown } | undefined;
    const companions = readCompanionAssets(source?.companions);
    if (!companions.length) return null;
    const head = typeof source?.tokensHead === 'string' ? source.tokensHead : '';
    let active: CompanionAssets | null = null;
    if (!db.objectStoreNames || db.objectStoreNames.contains(DESIGN_SYSTEMS_STORE)) {
      const activeId = await db.get('profile', ACTIVE_DESIGN_SYSTEM_KEY);
      if (typeof activeId === 'string' && activeId !== SHIPPED_ACTIVE_FALLBACK) {
        const record = await db.get(DESIGN_SYSTEMS_STORE, activeId);
        active = await companionOfRecord(db, isRecordLike(record) ? record : null, companions);
      }
    }
    return { companions, shippedNamespace: assetNamespace(head), active };
  } catch {
    return null;
  }
}

/**
 * The design system an instance's server would draw in, when that is not the one this
 * person is using. A server render reads the instance's own tokens; it cannot see a
 * system held in this browser, edited or not. So on a catalog that offers a second system
 * a file the server draws while that system is active would come out in the wrong colours.
 * Null when there is nothing to warn about: the catalog declares no scope, or the
 * catalog's own system is active.
 */
export async function serverDrawsOtherSystem(db: AssetScopeDb): Promise<{ active: string; own: string } | null> {
  try {
    const scope = await readAssetScope(db);
    if (!scope) return null;
    const activeId = await db.get('profile', ACTIVE_DESIGN_SYSTEM_KEY);
    if (typeof activeId !== 'string' || activeId === SHIPPED_ACTIVE_FALLBACK) return null;
    const record = await db.get(DESIGN_SYSTEMS_STORE, activeId);
    if (!isRecordLike(record) || record.source?.kind === 'shipped') return null;
    const source = await db.get('profile', 'catalog-source') as { tokensHead?: unknown } | undefined;
    const head = typeof source?.tokensHead === 'string' ? await db.get('asset-meta', source.tokensHead) as { name?: unknown } | undefined : undefined;
    const name = typeof head?.name === 'string' ? stripTokensSuffix(head.name) : '';
    return { active: record.label, own: name };
  } catch {
    return null;
  }
}
